#!/usr/bin/env node
// Replays Claude Code transcripts through the session-reset mod as it stands now, and counts
// the approves of a committing preview that restart the workspace session and those that do
// not, by cause. The regression harness of the commit loop (plan.md, T2).
//
//   node replay.mjs [--list] [<transcript.jsonl or folder> …]
//
// With no path it reads every transcript under ~/.claude/projects. --list prints each approve
// with no restart: where it was, its preview and its commands. Transcripts and the output hold
// private work: read them here, never commit them.
//
// The mod runs on a fake engine: each prompt, slash command, Bash call and turn end of the
// transcript is fired as the event the mod sees, a Bash call answers with its recorded result,
// and the mod's log (its own JSONL lines) says what it did. A command an older gate denied
// answers with that denial, so the replay sees it fail; its cause is read from its shape. A
// preview from before the Review: rule gets a Review: line, so the gate does not hold its
// approve.
//
// A preview from before the commit block (LOOP-3.2) becomes one: its git and gh writes, each
// pinned to the directory the same command later ran in, else the one the answer was given
// in. Each recorded git or gh write is pinned the
// same way, to the directory it ran in (a leading cd included), as a model that keeps the
// contract types it. A gh command with no --repo gets --repo replay/unknown on both sides.

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

// The mod imports './git' with no extension, as the mod loader resolves it.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context)
    } catch (error) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) {
        return next(`${specifier}.ts`, context)
      }
      throw error
    }
  },
})

const MOD = new URL('./hooks/register.ts', import.meta.url).href
const { blockCommands, commitBlock, FENCED, judge, normalize, PREVIEWED, REVIEWED } = await import(
  new URL('./hooks/git.ts', import.meta.url).href
)
const STATE = '/replay-state'
const PLUGIN = { kind: 'plugin', name: 'session-reset' }
const COMPOSER = { kind: 'composer' }

let aliases
function readAliases(argv) {
  aliases ??= spawnSync(argv[0], argv.slice(1), { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] })
  return { exitCode: aliases.status ?? 1, stdout: aliases.stdout ?? '', stderr: '' }
}

// One transcript's run of the mod: the hooks it registered, the engine beneath them, and what
// it wrote.
async function engine(file, sessionId) {
  const { register } = await import(`${MOD}?${encodeURIComponent(file)}`)
  const hooks = new Map()
  const state = new Map()
  const written = new Map()
  const queue = []
  const at = { cwd: '', time: 0 }
  const env = { ...process.env, XDG_STATE_HOME: STATE }

  const on = (event, filter, hook) => {
    const entry = hook ? { filter, hook } : { hook: filter }
    hooks.set(event, [...(hooks.get(event) ?? []), entry])
    return { catch: onError => void (entry.onError = onError) }
  }
  const matches = (filter, e) =>
    !filter || Object.entries(filter).every(([k, v]) => (Array.isArray(v) ? v.includes(e[k]) : v === e[k]))

  async function fire(event, e, bottom) {
    const chain = (hooks.get(event) ?? []).filter(h => matches(h.filter, e))
    const run = async (i, ev) => {
      if (i >= chain.length) {
        return bottom(ev)
      }
      const { hook, onError } = chain[i]
      const next = async x => {
        next.called = true
        return run(i + 1, x)
      }
      next.called = false
      try {
        return await hook($, ev, next)
      } catch (error) {
        if (onError) {
          next.error = error
          return onError($, ev, next)
        }
        throw error
      }
    }
    const result = await run(0, e)
    while (queue.length > 0) {
      await queue.shift()()
    }
    return result
  }

  // The engine's own end of a slash command: /clear starts a new host session.
  const ranCommand = e => {
    if (e.command === 'clear') {
      state.clear()
    }
    return { text: '' }
  }

  const $ = {
    state: {
      get: async key => ({ value: state.get(key.key), version: 0 }),
      set: async (key, value) => void state.set(key.key, value),
    },
    env: { get: async name => env[name] },
    fs: {
      read: async path => {
        if (written.has(path)) {
          return written.get(path)
        }
        if (path.startsWith(STATE)) {
          throw new Error(`ENOENT: ${path}`)
        }
        return readFileSync(path, 'utf8')
      },
      write: async (path, text) => void written.set(path, text),
      exists: async path => written.has(path) || (!path.startsWith(STATE) && existsSync(path)),
    },
    // The zsh aliases as they are now; the board as one whose checkpoint is not reached, so a
    // recorded /autopilot with no step starts.
    process: {
      run: async argv =>
        argv.at(-1) === 'alias -L'
          ? readAliases(argv)
          : { exitCode: argv[0]?.endsWith('/opsboard') ? 0 : 1, stdout: '', stderr: '' },
    },
    ui: { toast: () => undefined },
    prompt: { fill: async () => ({ isFilled: true }), submit: async () => undefined },
    command: {
      register: async () => undefined,
      run: async ({ command, args = '' }) => fire('command.run', { command, args, origin: PLUGIN }, ranCommand),
    },
    clock: { after: (ms, fn) => void queue.push(fn), now: async () => at.time },
    session: { cwd: async () => at.cwd, id: async () => sessionId },
  }
  register(on)

  return {
    at,
    fire,
    ranCommand,
    log: () =>
      [...written]
        .filter(([path]) => path.startsWith(`${STATE}/super-project/session-reset/`))
        .flatMap(([, text]) => text.trim().split('\n'))
        .filter(line => line !== '')
        .map(line => JSON.parse(line)),
  }
}

const textOf = content =>
  typeof content === 'string' ? content : (content ?? []).map(c => (c.type === 'text' ? c.text : '')).join('\n')

// A slash command as a transcript records it, the person's or a plugin's.
function slashCommand(text) {
  const name = /<command-name>\/?([^<]+)<\/command-name>/.exec(text)
  if (!name || !/^\s*<command-(?:name|message)>/.test(text)) {
    return undefined
  }
  return { command: name[1].trim(), args: (/<command-args>([\s\S]*?)<\/command-args>/.exec(text)?.[1] ?? '').trim() }
}

// A command as the contract has it: a leading cd folded in, each git pinned with -C to an
// absolute directory, push-all given its root, gh given a --repo.
function pinned(command, cwd) {
  const cd = /^\s*cd\s+("[^"]*"|'[^']*'|\S+)\s*(?:&&|;)\s*/.exec(command)
  const dir = cd ? resolve(cwd, cd[1].replace(/^["']|["']$/g, '').replace(/^~(?=\/|$)/, homedir())) : cwd
  const rest = cd ? command.slice(cd[0].length) : command
  return rest
    .replace(/(^|&&\s*|;\s*|\|\|\s*)git\s+-C\s+(?!\/)(\S+)/g, (_, before, path) => `${before}git -C ${resolve(dir, path)}`)
    .replace(/(^|&&\s*|;\s*|\|\|\s*)git\s+(?!-C\s)/g, `$1git -C ${dir} `)
    .replace(/(^|&&\s*|;\s*)push-all(?=\s*(?:$|&&|;))/g, `$1push-all ${dir}`)
    .replace(/(^|&&\s*|;\s*)gh\s+(?![^\n]*(?:\s-R\s|--repo))(\S+)\s+(\S+)/g, '$1gh $2 $3 --repo replay/unknown')
}

// A command with its git -C directories left out, to find where a preview line ran.
const unpinned = command => normalize(command).replace(/\bgit -C \S+ /g, 'git ')

// An answer from before the commit block, with one: its git and gh writes (the old reading
// of a preview), each pinned as the next of `later` (the pinned commands run after it, && parts
// apart, taken in order) that is the same command, else to `cwd`. An answer with a commit block, or no
// preview, is as it was.
function asCommitBlock(answer, cwd, later) {
  if (/^[ \t]*(`{3,}|~{3,})commit\b/m.test(answer) || !(PREVIEWED.test(answer) || /\bready to commit\b/i.test(answer))) {
    return answer
  }
  let from = 0
  const commands = [...answer.matchAll(FENCED)]
    .flatMap(b => blockCommands(b[3]))
    .filter(c => judge(c, 0, true).writes > 0)
    .map(c => {
      const k = later.findIndex((ran, i) => i >= from && unpinned(ran) === unpinned(c))
      from = k < 0 ? from : k + 1
      return k < 0 ? pinned(c, cwd) : later[k]
    })
  return commands.length === 0 ? answer : `${answer}\n\n\`\`\`commit\n${commands.join('\n')}\n\`\`\``
}

// Replays one transcript; returns the mod's log, each entry with the transcript line it came from.
async function replay(file, text) {
  const rows = text
    .split('\n')
    .map((line, i) => {
      try {
        return { ...JSON.parse(line), line: i + 1 }
      } catch {
        return undefined
      }
    })
    .filter(row => row && !row.isSidechain)
  const sessionId = rows.find(r => r.sessionId)?.sessionId ?? file
  const mod = await engine(file, sessionId)
  const results = new Map()
  for (const row of rows) {
    for (const c of Array.isArray(row.message?.content) ? row.message.content : []) {
      if (c.type === 'tool_result') {
        results.set(c.tool_use_id, { text: textOf(c.content), isError: c.is_error === true })
      }
    }
  }
  // Each git or gh write the transcript ran, pinned as the replay fires it (a row with no cwd
  // keeps the last one), by the line it ran at.
  let cwd = rows.find(r => r.cwd)?.cwd ?? ''
  const ran = rows.flatMap(row => {
    cwd = row.cwd ?? cwd
    return (row.type === 'assistant' && Array.isArray(row.message?.content) ? row.message.content : [])
      .filter(c => c.type === 'tool_use' && c.name === 'Bash' && typeof c.input?.command === 'string' && judge(c.input.command).writes > 0)
      .flatMap(c => pinned(c.input.command, cwd).split(/\s+&&\s+/).map(command => ({ line: row.line, command })))
  })
  const lines = []
  let seen = 0
  // The answer an approve answered, to tell why the gate found no preview in it.
  let answered = ''
  const mark = line => {
    const log = mod.log()
    for (const entry of log.slice(seen)) {
      lines.push(entry.held === 'no preview open' ? { ...entry, line, answered } : { ...entry, line })
    }
    seen = log.length
  }

  let turn
  const complete = async reason => {
    if (turn) {
      answered = turn.answer
      const after = turn.line
      const blocked = asCommitBlock(turn.answer, mod.at.cwd, ran.filter(r => r.line > after).slice(0, 40).map(r => r.command))
      const answer = commitBlock(blocked)?.commands && !REVIEWED.test(blocked) ? `${blocked}\n\nReview: replayed` : blocked
      await mod.fire('turn.complete', { answer, reason, durationMs: 1, isAborted: reason === 'aborted', turnId: 't' }, e => ({ text: e.answer }))
      mark(turn.line)
      turn = undefined
    }
  }

  const first = rows.find(r => r.cwd)
  mod.at.cwd = first?.cwd ?? ''
  await mod.fire('session.start', { cwd: mod.at.cwd, surface: 'terminal', isInteractive: true }, e => ({ cwd: e.cwd }))
  for (const row of rows) {
    mod.at.cwd = row.cwd ?? mod.at.cwd
    mod.at.time = row.timestamp ? Date.parse(row.timestamp) : mod.at.time
    const content = row.message?.content
    if (row.type === 'system' && row.subtype === 'turn_duration') {
      await complete('answer')
      continue
    }
    const command = row.type === 'system' && row.subtype === 'local_command' ? slashCommand(row.content ?? '') : undefined
    if (row.type === 'user' && typeof content === 'string') {
      const typed = slashCommand(content)
      if (typed) {
        await complete('answer')
        const origin = row.origin?.kind === 'plugin' ? { kind: 'plugin', name: row.origin.name } : COMPOSER
        await mod.fire('command.run', { ...typed, origin }, mod.ranCommand)
        mark(row.line)
        if (typed.command === 'session') {
          turn = { answer: '', line: row.line }
        }
        continue
      }
      if (row.isMeta || /^\s*<(?:local-command|command-|task-notification|system-reminder)/.test(content)) {
        continue
      }
      if (/^\[Request interrupted/.test(content)) {
        await complete('aborted')
        continue
      }
      await complete('answer')
      // A plugin's prompt as the person's words: the mod's own hooks never see it.
      if (row.origin?.kind !== 'plugin') {
        await mod.fire('prompt.submit', { text: content, origin: COMPOSER, wait: false }, e => ({ text: e.text }))
        mark(row.line)
      }
      turn = { answer: '', line: row.line }
      continue
    }
    if (command) {
      await complete('answer')
      await mod.fire('command.run', { ...command, origin: COMPOSER }, mod.ranCommand)
      mark(row.line)
      continue
    }
    if (row.type !== 'assistant' || !Array.isArray(content)) {
      continue
    }
    turn ??= { answer: '', line: row.line }
    for (const c of content) {
      if (c.type === 'text') {
        turn.answer = turn.answer ? `${turn.answer}\n\n${c.text}` : c.text
      } else if (c.type === 'tool_use') {
        turn.answer = ''
        if (c.name !== 'Bash' || typeof c.input?.command !== 'string') {
          continue
        }
        const result = results.get(c.id) ?? { text: '<tool_use_error>no recorded result</tool_use_error>', isError: true }
        const command = judge(c.input.command).writes > 0 ? pinned(c.input.command, row.cwd ?? mod.at.cwd) : c.input.command
        await mod.fire('tool.call', { tool: 'Bash', command, description: c.input.description ?? '' }, () => result)
        mark(row.line)
      }
    }
  }
  await complete('answer')

  return lines
}

// Why an approve did not restart: the first command of its turn that went wrong, by what its
// output says, else by how it differs from the preview; then what is wrong with the preview.
function cause(approve) {
  const preview = approve.preview ?? []
  const shown = new Set(preview.map(normalize))
  for (const c of approve.commands) {
    const out = c.denied ?? c.failed
    if (out === undefined) {
      continue
    }
    if (/nothing to commit|nothing added to commit|no changes added to commit/i.test(out)) {
      return 'nothing to commit: already committed'
    }
    if (/not a git repository|did not match any file|pathspec|cannot change to/i.test(out)) {
      return 'wrong working directory'
    }
    if (/1Password|gpg failed|signing failed|failed to write commit object/i.test(out)) {
      return 'signing failed'
    }
    if (/every command of the approved preview has run/.test(out)) {
      return 'a git command after the preview ran'
    }
    // The gate matched it to the preview (`matched`), but it ran under an older gate.
    if (shown.has(normalize(c.command)) || c.matched > 0) {
      return /^<tool_use_error>|Permission for this action was denied/.test(out)
        ? 'a preview command was denied when recorded'
        : `a preview command failed: ${out.split('\n')[0].slice(0, 60)}`
    }
    if (/(?:^|&&|;)\s*cd\s/.test(c.command)) {
      return 'a cd the preview did not show'
    }
    if (!/^\s*(?:git|gh|commit-all|push-all|gh-harden)\b/.test(c.command)) {
      return 'a tool name in a command that is not git'
    }
    if (/&&|;|\|/.test(c.command)) {
      return 'chained differently from the preview'
    }
    if (/\bcommit\b/.test(c.command)) {
      return 'a reworded commit'
    }
    return `${c.denied ? 'denied' : 'failed'}: ${out.split('\n')[0].slice(0, 60)}`
  }
  if (approve.commands.length === 0) {
    return 'no git write ran in the turn'
  }
  if (preview.some(c => /<[^>\s]+>|…/.test(c))) {
    return 'a template or annotated preview line'
  }
  if (preview.some(c => /^[+\-@]/.test(c))) {
    return 'a diff line read as a command'
  }
  if (/commands ran/.test(approve.why ?? '') && approve.commands.some(c => /&&|;/.test(c.command))) {
    return 'chained differently from the preview'
  }
  return approve.why ?? 'no turn end'
}

const args = process.argv.slice(2)
const isList = args.includes('--list')
const roots = args.filter(a => a !== '--list')
const files = []
const walk = path => {
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path)) {
      walk(join(path, name))
    }
  } else if (path.endsWith('.jsonl') && !path.includes('/subagents/')) {
    files.push(path)
  }
}
for (const root of roots.length > 0 ? roots : [join(homedir(), '.claude', 'projects')]) {
  walk(root)
}
// Only a transcript that holds an approve or a git write is worth the replay.
const WORTH = /approve|"git |git -C/

const approves = []
const held = new Map()
// Previews the commit block rule opened none for, by problem.
const rejected = new Map()
const unopened = []
let replayed = 0
let failedFiles = 0
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  if (!WORTH.test(text)) {
    continue
  }
  replayed++
  let lines
  try {
    lines = await replay(file, text)
  } catch (error) {
    failedFiles++
    console.error(`replay failed: ${file}: ${error.message}`)
    continue
  }
  let preview
  let open
  for (const entry of lines) {
    if (entry.event === 'preview') {
      preview = entry.commands
      if (entry.rejected) {
        const why = entry.rejected.split(':')[0]
        rejected.set(why, (rejected.get(why) ?? 0) + 1)
      }
    } else if (entry.event === 'approve' && entry.held) {
      const why = entry.answered === undefined ? entry.held : `${entry.held}: ${unread(entry.answered)}`
      held.set(why, (held.get(why) ?? 0) + 1)
      if (entry.answered !== undefined) {
        unopened.push({ file, line: entry.line, at: entry.at, id: entry.id, why, answered: entry.answered })
      }
    } else if ((entry.event === 'approve' && !entry.held) || (entry.event === 'autopilot' && entry.approves)) {
      open = { file, line: entry.line, at: entry.at, id: entry.id, via: entry.via ?? 'autopilot', preview, commands: [] }
      approves.push(open)
    } else if (entry.event === 'command' && open) {
      open.commands.push(entry)
    } else if (entry.event === 'turn' && open) {
      open.restart = entry.restart
      open.why = entry.why
      open = undefined
    }
  }
  for (const a of approves.filter(a => a.file === file)) {
    a.cause = a.restart ? undefined : cause(a)
  }
}

// Why an approve's answer had no preview the gate read.
function unread(answer) {
  if (/ready to commit/i.test(answer) && /^\s*(`{3,}|~{3,})/m.test(answer)) {
    return '"Ready to commit" not as a heading'
  }
  if (/\b(?:fail\w*|denied|rejected|refused|stopped|not made|did not run|didn't run)\b/i.test(answer)) {
    return 'a re-approve after a failure report'
  }
  return 'the answer showed no preview'
}

const commits = a => (a.preview ?? []).some(c => judge(c).commits === true)
const due = approves.filter(a => a.id !== null && commits(a))
const missed = due.filter(a => !a.restart)
const tally = list =>
  [...list.reduce((m, a) => m.set(a.cause, (m.get(a.cause) ?? 0) + 1), new Map())].sort((x, y) => y[1] - x[1])

console.log(`transcripts: ${files.length}, replayed: ${replayed}${failedFiles ? `, failed to replay: ${failedFiles}` : ''}`)
console.log(`approves of a committing preview in a workspace session: ${due.length}`)
console.log(`  restarted: ${due.length - missed.length}`)
console.log(`  no restart: ${missed.length}`)
for (const [why, n] of tally(missed)) {
  console.log(`    ${String(n).padStart(4)}  ${why}`)
}
const other = approves.filter(a => !due.includes(a))
const troubled = other.filter(a => a.commands.some(c => c.denied || c.failed !== undefined))
console.log(`other approves (no /session ID, or a preview with no commit): ${other.length}`)
console.log(`  with a denied or failed command: ${troubled.length}`)
for (const a of troubled) {
  a.cause = cause(a)
}
for (const [why, n] of tally(troubled)) {
  console.log(`    ${String(n).padStart(4)}  ${why}`)
}
for (const [why, n] of held) {
  console.log(`held approves, ${why}: ${n}`)
}
for (const [why, n] of rejected) {
  console.log(`previews not opened, ${why}: ${n}`)
}
if (isList) {
  for (const a of [...missed, ...troubled]) {
    console.log(`\n${a.file}:${a.line} ${a.at} ${a.id} via ${a.via}: ${a.cause}`)
    for (const c of a.preview ?? []) {
      console.log(`  preview  ${c.split('\n')[0]}`)
    }
    for (const c of a.commands) {
      const outcome = c.denied ? `denied: ${c.denied}` : c.failed !== undefined ? `failed: ${c.failed.split('\n')[0]}` : 'ok'
      console.log(`  ran      ${c.command.split('\n')[0]}\n           ${outcome.slice(0, 160)}`)
    }
  }
  for (const u of unopened) {
    console.log(`\n${u.file}:${u.line} ${u.at} ${u.id} ${u.why}\n  answered ${JSON.stringify(u.answered.slice(0, 200))}`)
  }
}
