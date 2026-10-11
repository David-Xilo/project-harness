import { read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { WorkspaceBand, WorkspaceOps, WorkspaceOpsRow } from '../types'
import { commands, program, writtenPaths } from './shell'

// The engine follows $ only into functions of this file, so the docs model and the
// guards live here; shell.ts is pure.

// ---- Docs model -------------------------------------------------------------------


// What a workspace's docs say about its sessions. The plan's session table and its
// "Shared files" bullet are read here; the operator, handoff and status tables come from
// opsboard (in `sp-config BIN_DIR`), the one parser of those.

type SessionRow = {
  id: string
  // Track IDs, codes and names the handoff rows address it by ("T4", "PER", "Guards").
  tracks: string[]
  // Top-level folders of the root it may write.
  repos: string[]
  // It writes the root's own files ("root", "the root repository").
  isRootScope: boolean
  // Root files only it may edit, past the shared ones ("`S4` also owns …").
  files: string[]
}

type Docs = {
  root: string
  name: string
  sessions: SessionRow[]
  // Root files every session may edit (its own rows of them), relative to the root.
  shared: string[]
  checkpoint: string | undefined
  // Rows of the checkpoint and publish status tables that are not at rest.
  status: { table: string; who: string; status: string }[]
  handoffs: { id: string; fromTo: string; status: string }[]
  ops: WorkspaceOpsRow[]
  // The workspace's runtime rule (.claude/workspace.json), if it has one.
  runtime: Runtime | undefined
  error: string | undefined
}

const SESSION_ID = /^(?:S\d+|CP\d*|W|publish-[\w./-]+)$/

const cache = new Map<string, { stamp: string; docs: Docs }>()

async function home($: EngineInterface): Promise<string> {
  return (await $.env.get('HOME')) ?? ''
}

// A value from the tooling config, by the rules of `sp-config`: KEY=value lines in
// ${XDG_CONFIG_HOME:-~/.config}/super-project/config, # comments, the last line wins, a
// leading ~ expands, and a missing file or key gives the default.
async function config($: EngineInterface, key: 'ROOTS' | 'BIN_DIR'): Promise<string> {
  const h = await home($)
  const dir = `${(await $.env.get('XDG_CONFIG_HOME')) || `${h}/.config`}/super-project`
  const text = await $.fs.read(`${dir}/config`).catch(() => '')
  let value = ''
  for (const line of text.split('\n')) {
    const at = line.indexOf('=')
    if (at > 0 && !/^\s*#/.test(line) && line.slice(0, at).trim() === key) {
      value = line.slice(at + 1).trim()
    }
  }
  const defaults = { ROOTS: `${dir}/roots`, BIN_DIR: '~/.local/bin' }

  return (value || defaults[key]).replace(/^~(?=\/|$)/, h)
}

// The workspace roots: the roots file (`sp-config ROOTS`).
async function roots($: EngineInterface): Promise<string[]> {
  const h = await home($)
  const text = await $.fs.read(await config($, 'ROOTS')).catch(() => '')

  return text
    .split('\n')
    .map(line => line.trim().replace(/\/+$/, '').replace(/^~(?=\/)/, h))
    .filter(line => line !== '' && !line.startsWith('#'))
}

async function rootOf($: EngineInterface, path: string): Promise<string | undefined> {
  return (await roots($)).find(root => path === root || path.startsWith(`${root}/`))
}

function cells(line: string): string[] {
  return line.split('|').slice(1, -1).map(cell => cell.trim())
}

// The table that starts at a header line whose first cell is `first`.
function table(lines: string[], first: string): string[][] {
  const start = lines.findIndex(line => line.startsWith('|') && cells(line)[0] === first)
  if (start < 0) {
    return []
  }
  const rows: string[][] = []
  for (let i = start + 2; i < lines.length && (lines[i] as string).startsWith('|'); i++) {
    rows.push(cells(lines[i] as string))
  }

  return rows
}

// Candidate folder names in a cell: backticked words, link targets' first segment, and
// list items that are one word ("traffic-sniffer, persist-watch").
function candidates(cell: string): string[] {
  const out: string[] = []
  for (const m of cell.matchAll(/`([^`]+)`/g)) {
    out.push(m[1] as string)
  }
  for (const m of cell.matchAll(/\]\(([^)#\s]+)/g)) {
    out.push((m[1] as string).split('/')[0] as string)
  }
  for (const item of cell.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').split(/[,;]/)) {
    const one = item.trim()
    if (/^[\w.-]+\/?$/.test(one)) {
      out.push(one)
    }
  }

  return out.map(c => c.replace(/\/+$/, '').replace(/^\.\//, '')).filter(c => /^[\w.-]+$/.test(c) && c !== '.' && c !== '..')
}

// Track IDs, codes and names a session row carries.
function trackNames(row: string[]): string[] {
  const out = new Set<string>()
  const text = row.join(' | ')
  for (const m of text.matchAll(/\bT\d+\b/g)) {
    out.add(m[0])
  }
  for (const m of text.matchAll(/\*\*([^*]+)\*\*/g)) {
    const label = m[1] as string
    out.add(label)
    for (const part of label.split(/[:,]|\band\b/)) {
      if (part.trim() !== '') {
        out.add(part.trim())
      }
    }
  }
  for (const m of text.matchAll(/\(([A-Z]{2,5}(?:,\s*[A-Z]{2,5})*)[;)]/g)) {
    for (const code of (m[1] as string).split(',')) {
      out.add(code.trim())
    }
  }
  for (const cell of row.slice(1, 3)) {
    if (/^[A-Z]{1,5}$/.test(cell)) {
      out.add(cell)
    }
  }

  return [...out]
}

async function isDir($: EngineInterface, path: string): Promise<boolean> {
  const stat = await $.fs.stat(path).catch(() => undefined)

  return stat?.kind === 'dir'
}

async function readPlan($: EngineInterface, root: string): Promise<Pick<Docs, 'sessions' | 'shared'>> {
  const lines = (await $.fs.read(`${root}/plan.md`)).split('\n')
  // Module codes (for example "| API | [Public API](acme-api/plan.md) |").
  const codes = new Map<string, string>()
  for (const row of table(lines, 'Code')) {
    const dir = /\]\(([\w.-]+)\//.exec(row[1] ?? '')?.[1]
    if (row[0] && dir) {
      codes.set(row[0], dir)
    }
  }
  const sessions: SessionRow[] = []
  for (const row of table(lines, 'Session')) {
    const id = /^`([^`]+)`/.exec(row[0] ?? '')?.[1]
    if (!id || id.includes('<') || !SESSION_ID.test(id)) {
      continue
    }
    const repos = new Set<string>()
    for (const cell of row.slice(1)) {
      for (const name of candidates(cell)) {
        if (await isDir($, `${root}/${name}`)) {
          repos.add(name)
        }
      }
      for (const code of cell.split(/[,;\s]+/)) {
        const dir = codes.get(code.replace(/[^\w]/g, ''))
        if (dir) {
          repos.add(dir)
        }
      }
    }
    const isRootScope = row.slice(1).some(cell => /^root$|\bthe root\b/i.test(cell))
    sessions.push({ id, tracks: [id, ...trackNames(row)], repos: [...repos], isRootScope, files: [] })
  }
  if (sessions.length === 0) {
    throw new Error('plan.md has no session table (a table whose first column is "Session")')
  }
  // The "Shared files" bullet of the session IDs section, sentence by sentence: the .md files
  // it names (an anchor link being plan.md). A sentence that says "never" lists files no
  // session edits; "`S4` also owns …" gives that one session its files.
  const shared = new Set<string>()
  const at = lines.findIndex(line => /^- \*\*Shared files\b/.test(line))
  if (at < 0) {
    throw new Error('plan.md has no "Shared files" bullet')
  }
  let bullet = ''
  for (let i = at; i < lines.length; i++) {
    const line = lines[i] as string
    if (i > at && (/^- \*\*/.test(line) || line.trim() === '')) {
      break
    }
    bullet += ` ${line.trim()}`
  }
  const text = bullet.replace(/\[([^\]]*)\]\(([^)\s]*)\)/g, (_, label: string, target: string) => {
    const file = target.startsWith('#') ? 'plan.md' : target.replace(/#.*$/, '')
    return /\.md$/.test(file) && !/^\w+:/.test(file) ? ` ${label} <${file}> ` : ` ${label} `
  })
  for (const sentence of text.split(/\.\s+(?=[A-Z`])/)) {
    if (/\bnever\b/i.test(sentence) || /^\s*`?CP/.test(sentence)) {
      continue
    }
    const files = [...sentence.matchAll(/<([^>]+)>|(?<![\w/.-])([\w-][\w./-]*\.md)\b/g)].map(m => ((m[1] ?? m[2]) as string).replace(/^\.\//, ''))
    const only = /^\s*`([^`]+)` also owns\b/.exec(sentence)?.[1]
    const owner = only ? sessions.find(s => s.id === only) : undefined
    for (const file of files) {
      if (owner) {
        owner.files.push(file)
      } else {
        shared.add(file)
      }
    }
  }

  return { sessions, shared: [...shared] }
}

// How many step, handoff, session and checkpoint IDs a text names.
function weight(text: string): number {
  return new Set(text.match(/\b(?:[A-Z]{2,5}-[A-Z]?\d+(?:\.\d+)?|H\d+|S\d+|CP\d*|O\d+|[A-Z]{2,5}-G\d+)\b/g) ?? []).size
}

type Board = {
  ops: WorkspaceOpsRow[]
  checkpoints: { workspace: string; text: string }[]
  status: { root: string; table: string; who: string; status: string }[]
  handoffs: { root: string; id: string; fromTo: string; status: string }[]
}

// The rows of `opsboard --tsv`, for the given roots or every listed one.
async function board($: EngineInterface, only?: string): Promise<Board> {
  const ran = await $.process.run([`${await config($, 'BIN_DIR')}/opsboard`, '--tsv', ...(only ? [only] : [])], { timeoutMs: 20000 })
  if (ran.exitCode !== 0) {
    throw new Error(`opsboard --tsv failed: ${ran.stderr.trim() || ran.stdout.trim()}`.slice(0, 200))
  }
  const out: Board = { ops: [], checkpoints: [], status: [], handoffs: [] }
  for (const line of ran.stdout.split('\n')) {
    const [kind, root = '', ...f] = line.split('\t')
    const workspace = root.replace(/^.*\//, '')
    if (kind === 'op') {
      const [k, section = '', task = '', , lineNo = '0', when = '', id = '—', tell = '—', unblocks = '', owner = ''] = f
      const titleId = /^((?:[A-Z]{1,5}-[\w.]+|O\d+)):?\s/.exec(task)?.[1]
      const headUnblocks = /\(unblocks ([^)]*)\)/.exec(task)?.[1] ?? ''
      const all = `${unblocks} ${headUnblocks}`.trim()
      out.ops.push({
        workspace,
        kind: k === 'later' ? 'later' : 'you',
        section,
        id: id !== '—' ? id : titleId ?? '—',
        title: task,
        when,
        tell,
        owner,
        unblocks: all,
        weight: weight(all),
        line: Number(lineNo),
      })
    } else if (kind === 'cp') {
      out.checkpoints.push({ workspace, text: f[0] ?? '' })
    } else if (kind === 'status') {
      out.status.push({ root, table: f[0] ?? '', who: (f[1] ?? '').replace(/`/g, ''), status: f[2] ?? '' })
    } else if (kind === 'handoff') {
      out.handoffs.push({ root, id: f[0] ?? '', fromTo: f[1] ?? '', status: f[2] ?? '' })
    }
  }

  return out
}

// The docs of one workspace, re-read when plan.md, handoffs.md or operator.md change.
async function docs($: EngineInterface, root: string): Promise<Docs> {
  const stamps = await Promise.all(
    ['plan.md', 'handoffs.md', 'operator.md', '.claude/workspace.json'].map(f => $.fs.stat(`${root}/${f}`).then(s => s.mtimeMs, () => 0)),
  )
  const stamp = stamps.join(':')
  const hit = cache.get(root)
  if (hit && hit.stamp === stamp) {
    return hit.docs
  }
  const name = root.replace(/^.*\//, '')
  let result: Docs
  try {
    const [plan, b, runtime] = await Promise.all([readPlan($, root), board($, root), readRuntime($, root)])
    result = {
      root,
      name,
      ...plan,
      checkpoint: b.checkpoints[0]?.text,
      status: b.status.map(({ table: t, who, status }) => ({ table: t, who, status })),
      handoffs: b.handoffs.map(({ id, fromTo, status }) => ({ id, fromTo, status })),
      ops: b.ops,
      runtime,
      error: undefined,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    result = { root, name, sessions: [], shared: [], checkpoint: undefined, status: [], handoffs: [], ops: [], runtime: undefined, error: reason }
  }
  cache.set(root, { stamp, docs: result })

  return result
}

// ---- Guards -----------------------------------------------------------------------


// What a /session may write and run, from its workspace's docs. Every answer is a reason to
// deny, or undefined to let the call run.

type Context = { docs: Docs; id: string; cwd: string }

// The workspace's own runtime rule, from <root>/.claude/workspace.json "runtime": the
// scripts only some sessions run, the session IDs that run them, the script and docker
// subcommands every session may run, the rule's home in the docs, and the subcommands that
// take repositories' HEADs, so those repositories are committed first.
type Runtime = {
  scripts: Set<string>
  runners: RegExp
  free: Set<string>
  dockerFree: Set<string>
  cite: string
  commitFirst: Map<string, string[]>
}

// The runtime rule, or undefined when the file or its "runtime" key is missing. A file that
// does not parse throws, which turns the guard off with a toast, like broken docs.
async function readRuntime($: EngineInterface, root: string): Promise<Runtime | undefined> {
  const text = await $.fs.read(`${root}/.claude/workspace.json`).catch(() => undefined)
  if (text === undefined) {
    return undefined
  }
  const fail = (why: string): never => {
    throw new Error(`.claude/workspace.json: ${why}`)
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
  const r = (json as { runtime?: Record<string, unknown> } | null)?.runtime
  if (r === undefined) {
    return undefined
  }
  const strings = (key: string): string[] => {
    const v = r[key] ?? []
    return Array.isArray(v) && v.every(s => typeof s === 'string') ? v : fail(`runtime.${key} must be a list of strings`)
  }
  const scripts = strings('scripts')
  if (scripts.length === 0) {
    fail('runtime.scripts is empty')
  }
  if (typeof r.runners !== 'string') {
    fail('runtime.runners must be a regular expression string')
  }
  let runners: RegExp
  try {
    runners = new RegExp(r.runners as string)
  } catch {
    return fail('runtime.runners is not a valid regular expression')
  }
  const first = r.commitFirst ?? {}
  if (typeof first !== 'object' || first === null || Array.isArray(first)) {
    fail('runtime.commitFirst must map subcommands to lists of repositories')
  }
  const commitFirst = new Map<string, string[]>()
  for (const [sub, repos] of Object.entries(first as Record<string, unknown>)) {
    if (!Array.isArray(repos) || !repos.every(s => typeof s === 'string')) {
      fail(`runtime.commitFirst.${sub} must be a list of repositories`)
    }
    commitFirst.set(sub, repos as string[])
  }

  return {
    scripts: new Set(scripts),
    runners,
    free: new Set(strings('free')),
    dockerFree: new Set(strings('dockerFree')),
    cite: typeof r.cite === 'string' ? r.cite : '.claude/workspace.json',
    commitFirst,
  }
}

function sessionOf(docs: Docs, id: string): SessionRow | undefined {
  return docs.sessions.find(s => s.id === id)
}

function ownerOf(docs: Docs, top: string): SessionRow | undefined {
  return docs.sessions.find(s => s.repos.includes(top) && !s.isRootScope)
}

function holds(docs: Docs) {
  const isCheckpointRunning = docs.status.some(r => r.table === 'checkpoint' && /^CP/.test(r.who) && /^running/.test(r.status))
  const publishing = docs.status.filter(r => r.table === 'publish' && /^running/.test(r.status)).map(r => r.who.trim())

  return { isCheckpointRunning, publishing }
}

async function branch($: EngineInterface, dir: string): Promise<string> {
  const ran = await $.process.run(['git', '-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 5000 }).catch(() => undefined)

  return ran?.exitCode === 0 ? ran.stdout.trim() : ''
}

function resolve(path: string, cwd: string, home: string): string {
  const expanded = path.replace(/^~(?=\/|$)/, home)
  const absolute = expanded.startsWith('/') ? expanded : `${cwd.replace(/\/+$/, '')}/${expanded}`
  const parts: string[] = []
  for (const part of absolute.split('/')) {
    if (part === '..') {
      parts.pop()
    } else if (part !== '' && part !== '.') {
      parts.push(part)
    }
  }

  return `/${parts.join('/')}`
}

// Where a path lands once links are followed: the file, or its nearest existing folder.
async function real($: EngineInterface, path: string): Promise<string> {
  let head = path
  let tail = ''
  for (;;) {
    const stat = await $.fs.stat(head, { resolve: true }).catch(() => undefined)
    if (stat?.realPath) {
      return `${stat.realPath.replace(/\/+$/, '')}${tail}`
    }
    const cut = head.lastIndexOf('/')
    if (cut <= 0) {
      return path
    }
    tail = `${head.slice(cut)}${tail}`
    head = head.slice(0, cut)
  }
}

// May the session write this (absolute, resolved) path?
async function judgeWrite($: EngineInterface, { docs, id }: Context, path: string): Promise<string | undefined> {
  const root = docs.root
  if (path !== root && !path.startsWith(`${root}/`)) {
    return undefined
  }
  const rel = path.slice(root.length + 1)
  const top = rel.split('/')[0] ?? ''
  const { isCheckpointRunning, publishing } = holds(docs)
  const published = publishing.find(repo => rel === repo || rel.startsWith(`${repo}/`))
  if (published && id !== `publish-${published}`) {
    return `${published}'s publish status reads running in handoffs.md, so no other session works in it.`
  }
  if (id.startsWith('CP')) {
    return undefined
  }
  if (isCheckpointRunning && /^S\d/.test(id)) {
    const owner = ownerOf(docs, top)
    const onRelease = owner !== undefined && (await branch($, `${root}/${top}`)).startsWith('release/')
    if (!onRelease) {
      return 'the checkpoint is running (handoffs.md "Checkpoint status"), so S sessions start no work; only a fix the checkpoint asks for, on a release/ branch.'
    }
  }
  if (id.startsWith('publish-')) {
    const repo = id.slice('publish-'.length)
    if (rel === repo || rel.startsWith(`${repo}/`) || docs.shared.includes(rel)) {
      return undefined
    }
    return `${id} writes only ${repo} and its shared rows (plan.md "Session IDs").`
  }
  const me = sessionOf(docs, id)
  if (!me) {
    return undefined
  }
  if (me.repos.includes(top) || docs.shared.includes(rel) || me.files.includes(rel)) {
    return undefined
  }
  const owner = ownerOf(docs, top)
  if (me.isRootScope && !owner) {
    return undefined
  }
  const why = owner
    ? `${top} belongs to \`${owner.id}\`; ask it through a handoffs.md row`
    : `${rel} is not \`${id}\`'s to write (its repositories: ${me.repos.join(', ') || 'none'}; shared files: ${docs.shared.join(', ')})`

  return `${why} (${docs.name}/plan.md "Session IDs").`
}

// A subcommand that takes repositories' HEADs runs only when they are committed: no Ready
// to commit preview open, and none of them dirty.
async function judgeCommitFirst($: EngineInterface, docs: Docs, sub: string, isPreviewOpen: boolean): Promise<string | undefined> {
  const repos = docs.runtime?.commitFirst.get(sub)
  if (!repos) {
    return undefined
  }
  if (isPreviewOpen) {
    return `a Ready to commit preview is still open: approve it and run its commits before ${sub}.`
  }
  const dirty: string[] = []
  for (const repo of repos) {
    const ran = await $.process.run(['git', '-C', `${docs.root}/${repo}`, 'status', '--porcelain'], { timeoutMs: 10000 })
    if (ran.exitCode === 0 && ran.stdout.trim() !== '') {
      dirty.push(repo)
    }
  }

  return dirty.length > 0 ? `${sub} takes each repository's HEAD, so commit first; uncommitted: ${dirty.join(', ')}.` : undefined
}

// Programs that read or name the stack script without running it ("cat stackctl.sh").
const READERS = new Set([
  'cat', 'less', 'more', 'head', 'tail', 'grep', 'rg', 'sed', 'awk', 'vim', 'nvim', 'nano', 'code', 'shellcheck',
  'bat', 'wc', 'ls', 'stat', 'file', 'diff', 'git', 'echo', 'printf', 'which', 'type', 'man', 'cp', 'realpath',
])
// docker and docker compose options that take a value, before the subcommand.
const DOCKER_VALUES = new Set(['-c', '--context', '-H', '--host', '--config', '-l', '--log-level', '-f', '--file', '-p', '--project-name', '--profile', '--env-file', '--project-directory'])

// The stack call a command makes, wherever it sits: "./stackctl.sh up", "bash stackctl.sh
// down", "timeout 600 stackctl.sh build", "docker --context x compose up".
function stackCall(words: string[], scripts: Set<string>): { tool: string; sub: string } | undefined {
  const run = program(words)
  if (!run || READERS.has(run.name)) {
    return undefined
  }
  const all = [run.path, ...run.args]
  const base = (w: string) => w.replace(/^.*\//, '')
  const at = all.findIndex(w => scripts.has(base(w)) || base(w) === 'docker')
  if (at < 0) {
    return undefined
  }
  const tool = base(all[at] as string)
  const rest = all.slice(at + 1)
  const subAt = (from: number) => {
    let k = from
    while (rest[k]?.startsWith('-')) {
      k += tool === 'docker' && DOCKER_VALUES.has(rest[k] as string) ? 2 : 1
    }
    return k
  }
  const k = subAt(0)
  const sub = rest[k] ?? ''

  return { tool, sub: tool === 'docker' && sub === 'compose' ? `compose ${rest[subAt(k + 1)] ?? ''}`.trim() : sub }
}

// May the session run this Bash command?
async function judgeBash($: EngineInterface, ctx: Context, command: string, home: string, isPreviewOpen: boolean): Promise<string | undefined> {
  const stack = ctx.docs.runtime
  for (const one of commands(command)) {
    const cwd = one.cwd ? resolve(one.cwd, ctx.cwd, home) : ctx.cwd
    const call = stack ? stackCall(one.words, stack.scripts) : undefined
    if (call && stack) {
      const isScript = call.tool !== 'docker'
      const isFree = isScript ? stack.free.has(call.sub) || call.sub === '' : stack.dockerFree.has(call.sub)
      if (!isFree && !stack.runners.test(ctx.id)) {
        return `only the stack's sessions run ${call.tool} ${call.sub} (${stack.cite}); ask through a handoffs.md row.`
      }
      if (isScript) {
        const why = await judgeCommitFirst($, ctx.docs, call.sub, isPreviewOpen)
        if (why) {
          return why
        }
      }
    }
    for (const path of writtenPaths(one)) {
      const why = await judgeWrite($, ctx, await real($, resolve(path, cwd, home)))
      if (why) {
        return why
      }
    }
  }

  return undefined
}

// ---- Band, pane and hooks ---------------------------------------------------------
const BAND = { plugin: 'workspace', key: 'band' } as const
const OPS = { plugin: 'workspace', key: 'ops' } as const
const SHOW_LATER = { plugin: 'workspace', key: 'showLater' } as const
// session-reset's: the /session this conversation runs, and the open Ready to commit preview.
const SESSION = { plugin: 'session-reset', key: 'session' } as const
const PREVIEW = { plugin: 'session-reset', key: 'preview' } as const

const PANE = 'workspace-ops'
const REFRESH_MS = 60_000

// Each docs error is said once per load: the guards then let calls run (operator decision).
const warned = new Set<string>()

function warn($: EngineInterface, docs: Docs) {
  if (docs.error && !warned.has(docs.error)) {
    warned.add(docs.error)
    $.ui.toast(`workspace guard off in ${docs.name}: ${docs.error}. Calls run unguarded until the docs parse.`, { timeoutMs: 15000 })
  }
}

// The guard's view of this session, or undefined outside a workspace session.
async function context($: EngineInterface): Promise<Context | undefined> {
  const session = (await $.state.get(SESSION)).value
  if (!session) {
    return undefined
  }
  const d = await docs($, session.root)
  if (d.error) {
    warn($, d)
    return undefined
  }

  return { docs: d, id: session.id, cwd: await $.session.cwd() }
}

async function isPreviewOpen($: EngineInterface): Promise<boolean> {
  return ((await $.state.get(PREVIEW)).value ?? null) !== null
}

function deny(why: string) {
  return { deny: `workspace: ${why}` }
}

// The handoff rows addressed to one of the session's tracks that are not yet delivered.
function handoffsTo(d: Docs, tracks: string[]): number {
  return d.handoffs.filter(h => {
    const to = h.fromTo.split('→')[1] ?? ''
    const isOpen = /^(open|acknowledged)/i.test(h.status)
    return isOpen && tracks.some(t => new RegExp(`(^|[^\\w])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\w])`, 'i').test(to))
  }).length
}

function isMine(row: WorkspaceOpsRow, id: string, tracks: string[]): boolean {
  const lower = tracks.map(t => t.toLowerCase())
  const sectionHead = row.section.split(/[\s:]/)[0]?.toLowerCase() ?? ''

  return row.tell === id || lower.includes(row.owner.toLowerCase()) || lower.includes(sectionHead)
}

async function refreshBand($: EngineInterface) {
  const session = (await $.state.get(SESSION)).value
  const root = session?.root ?? (await rootOf($, await $.session.cwd()))
  if (!root) {
    await $.state.set(BAND, null)
    return
  }
  const d = await docs($, root)
  const parts: string[] = []
  let isWarning = false
  if (d.error) {
    warn($, d)
    parts.push(session?.id ?? d.name, `guard off: ${d.error}`)
    isWarning = true
  } else if (!session) {
    parts.push(`${d.name} · no /session`)
    if (d.checkpoint) {
      parts.push(d.checkpoint)
    }
  } else {
    const me = sessionOf(d, session.id)
    const tracks = me?.tracks ?? [session.id]
    parts.push([session.id, ...tracks.slice(1, 3)].join(' '))
    if (d.checkpoint) {
      parts.push(d.checkpoint)
    }
    for (const row of d.status.filter(r => r.table === 'publish' && /^running/.test(r.status))) {
      parts.push(`publishing ${row.who}`)
    }
    const ops = d.ops.filter(r => r.kind === 'you' && isMine(r, session.id, tracks))
    if (ops.length > 0) {
      parts.push(`ops ${ops.length} (${ops.filter(r => r.when === 'now').length} now)`)
    }
    const h = handoffsTo(d, tracks)
    if (h > 0) {
      parts.push(`handoffs ${h} to ${session.id}`)
    }
    const dirty: string[] = []
    for (const repo of me?.repos ?? []) {
      const ran = await $.process.run(['git', '-C', `${root}/${repo}`, 'status', '--porcelain'], { timeoutMs: 5000 }).catch(() => undefined)
      if (ran?.exitCode === 0 && ran.stdout.trim() !== '') {
        dirty.push(repo)
      }
    }
    if (dirty.length > 0) {
      parts.push(`dirty: ${dirty.join(', ')}`)
    }
    if (!me && !session.id.startsWith('CP') && !session.id.startsWith('publish-')) {
      parts.push(`guard: ${session.id} is not in plan.md's session table`)
      isWarning = true
    } else {
      parts.push('guard on')
    }
  }
  const band: WorkspaceBand = { text: parts.join(' · '), isWarning }
  await $.state.set(BAND, band)
}

function whenRank(when: string): string {
  return when === 'now' ? '0' : /^\d{4}-/.test(when) ? `1${when}` : when === 'standing' ? '2' : '3'
}

async function refreshOps($: EngineInterface) {
  let ops: WorkspaceOps
  try {
    const b = await board($)
    const rows = [...b.ops].sort(
      (a, z) => a.workspace.localeCompare(z.workspace) || z.weight - a.weight || whenRank(a.when).localeCompare(whenRank(z.when)),
    )
    ops = { rows, checkpoints: b.checkpoints, at: await $.clock.now(), error: null }
  } catch (error) {
    ops = { rows: [], checkpoints: [], at: await $.clock.now(), error: error instanceof Error ? error.message : String(error) }
  }
  await $.state.set(OPS, ops)
}

function cut(text: string, columns: number): string {
  return text.length > columns ? `${text.slice(0, Math.max(1, columns - 1))}…` : text
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'ops', description: 'Show the open operator steps of every workspace in a pane' })
    await $.command.register({
      name: 'guard',
      description: 'Say what the workspace guard would decide for a Bash command, or for "edit <path>", without running it',
      argumentHint: '<bash command> | edit <path>',
    })
    $.clock.every(REFRESH_MS, () => {
      void refreshBand($)
      void $.ui.panes().then(panes => (panes.some(p => p.id === PANE) ? refreshOps($) : undefined))
    })
    void refreshBand($)

    return next(e)
  })

  // The session guard and the workspace's runtime rule. A guard that fails lets the call run
  // (operator decision 2026-10-06): the band says so.
  on('tool.call', async ($, e, next) => {
    if (e.tool !== 'Bash' && e.tool !== 'Monitor' && e.tool !== 'Edit' && e.tool !== 'Write' && e.tool !== 'NotebookEdit') {
      return next(e)
    }
    const ctx = await context($)
    if (!ctx) {
      return next(e)
    }
    const h = await home($)
    if (e.tool === 'Bash' || e.tool === 'Monitor') {
      const why = e.command === undefined ? undefined : await judgeBash($, ctx, e.command, h, await isPreviewOpen($))
      return why ? deny(why) : next(e)
    }
    const path = e.tool === 'NotebookEdit' ? e.notebook_path : e.file_path
    const why = await judgeWrite($, ctx, await real($, resolve(path, ctx.cwd, h)))

    return why ? deny(why) : next(e)
  }).catch(($, e, next) => {
    $.ui.toast('workspace guard failed on a call; it ran unguarded.', { timeoutMs: 10000 })
    return next(e)
  })

  on('command.run', { command: 'guard' }, async ($, e) => {
    const ctx = await context($)
    const session = (await $.state.get(SESSION)).value
    if (!ctx) {
      return { text: session ? 'The guard is off: the docs did not parse (see the band).' : 'No /session in this conversation: the guard is off.' }
    }
    const args = e.args.trim()
    const h = await home($)
    const edit = /^edit\s+(.+)$/.exec(args)
    const why = edit
      ? await judgeWrite($, ctx, await real($, resolve(edit[1] as string, ctx.cwd, h)))
      : await judgeBash($, ctx, args, h, await isPreviewOpen($))
    const me = sessionOf(ctx.docs, ctx.id)
    const scope = me ? `${ctx.id} writes ${me.repos.join(', ') || (me.isRootScope ? 'the root' : 'no repository')}; shared: ${ctx.docs.shared.join(', ')}` : ctx.id

    return { text: `${why ? `deny: ${why}` : 'allow'}\n(${scope}; git writes are session-reset's gate)` }
  })

  on('command.run', { command: 'ops' }, async $ => {
    await refreshOps($)
    await $.ui.open({ id: PANE, title: 'Operator steps' })

    return { text: 'Operator steps pane opened.' }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      void refreshBand($)
    }

    return next(e)
  })

  // A /session or /clear changes the session the band shows.
  on('command.run', { command: ['session', 'clear', 'resume'] }, async ($, e, next) => {
    const ran = await next(e)
    $.clock.after(0, () => void refreshBand($))

    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const band = await read($, { plugin: 'workspace', key: 'band' } as const)
    if (e.props.hasSurvey || !band) {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text dimColor={!band.isWarning} color={band.isWarning ? 'yellow' : undefined} wrap="truncate-end">
          {cut(band.text, e.props.bodyColumns)}
        </Text>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const ops = await read($, { plugin: 'workspace', key: 'ops' } as const)
    const showLater = (await read($, { plugin: 'workspace', key: 'showLater' } as const)) ?? false
    const columns = e.props.bodyColumns
    if (!ops) {
      return <Text dimColor>Loading…</Text>
    }
    const workspaces = [...new Set(ops.rows.map(r => r.workspace))]
    const later = ops.rows.filter(r => r.kind === 'later').length

    return (
      <Box flexDirection="column">
        <Box gap={1}>
          <Button key="refresh" label="Refresh" onPress={() => void refreshOps($)} />
          <Button
            key="later"
            label={showLater ? 'Hide later' : `Show later (${later})`}
            onPress={() => update($, SHOW_LATER, v => !(v ?? false))}
          />
        </Box>
        {ops.error && <Text color="red">{cut(ops.error, columns)}</Text>}
        {workspaces.map(w => {
          const rows = ops.rows.filter(r => r.workspace === w && (showLater || r.kind === 'you'))
          const cp = ops.checkpoints.find(c => c.workspace === w)
          return (
            <Box key={`ws-${w}`} flexDirection="column" marginTop={1}>
              <Text bold>{cut(`${w}${cp ? ` · ${cp.text}` : ''}`, columns)}</Text>
              {rows.length === 0 && <Text dimColor>  Nothing open.</Text>}
              {rows.map(r => (
                <Box key={`${w}-${r.line}`} flexDirection="column">
                  <Text dimColor={r.kind === 'later'} wrap="truncate-end">
                    {cut(`  ${r.id !== '—' ? `${r.id} ` : ''}${r.title.replace(/^(O\d+|[A-Z]{1,5}-[\w.]+):?\s+/, '')}`, columns)}
                  </Text>
                  <Text dimColor wrap="truncate-end">
                    {cut(
                      `    ${r.when}${r.tell !== '—' ? ` · tell ${r.tell}` : r.owner ? ` · ${r.owner}` : ''}${r.weight > 0 ? ` · unblocks ${r.weight}: ${r.unblocks}` : ''}`,
                      columns,
                    )}
                  </Text>
                </Box>
              ))}
            </Box>
          )
        })}
      </Box>
    )
  })
}
