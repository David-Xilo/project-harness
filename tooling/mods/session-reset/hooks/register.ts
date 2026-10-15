import type { EngineInterface, Register } from 'claude-code'

import type { SessionResetAutopilot, SessionResetPreview, SessionResetSession } from '../types'
import { judge, normalize, parseAliases, PREVIEWED, previewCommands, REVIEWED, setAliases } from './git'

// The workspace session and the open preview, kept by the host so a hot reload keeps them.
const SESSION = { plugin: 'session-reset', key: 'session' } as const
const PREVIEW = { plugin: 'session-reset', key: 'preview' } as const
const AUTOPILOT = { plugin: 'session-reset', key: 'autopilot' } as const

// The session IDs the workspace plans define: S1, CP5, CP, W, publish-<repo>.
const SESSION_ID = /^(?:S\d+|CP\d*|W|publish-[\w./-]+)$/

// "committed", "commited", "all committed", "I committed", "I've committed",
// "I have committed", "it's committed", "its committed", then the end, punctuation
// or "and/go/continue/now/run/proceed ..."; the rest is the note.
const COMMITTED =
  /^\s*(?:all\s+|i\s+|i[’']?ve\s+|i\s+have\s+|it[’']?s\s+)?commit+ed(?=$|[\s,.;:!]*$|\s*[,.;:!]|\s+(?:and|go|continue|now|run|proceed)\b)[\s,.;:!]*([\s\S]*)$/i

// A question or a doubt is for the model, never a go-ahead: "committed, but the push
// failed?", "I committed. Wait", "committed and then reverted it". A condition limits what
// runs: "approve, don't push", "approve except the tag", "approve only orchestration".
const DOUBT =
  /\?|\b(?:but|wait|hold|no|not|\w+n['’]t|do not|fail\w*|error\w*|revert\w*|wrong|problem\w*|issue\w*|undo|except|only|skip\w*|without|unless|just|instead|exclud\w*|leave|omit\w*)\b/i

// The answer to a "Ready to commit" preview (~/.claude/CLAUDE.md): "approve" or "approved",
// then optionally a note for the restarted session ("approve, remind me of X", "approved,
// and go A.4"). A note with a question or a doubt ("approve, but is it just that one?",
// "approve but don't push") is for the model: the message reaches it whole and the
// session is kept.
const APPROVE = /^\s*approved?\b[\s,.;:!-]*(?:(?:then|next|and)\b[\s,:]*)?([\s\S]*?)[\s,.;:!]*$/i

// "commit" or "commit it" answers a preview the same way while one is open; the rest is
// the note ("commit remind me of this note"). With no preview open it is a request.
const COMMIT = /^\s*commit(?:\s+it)?\b[\s,.;:!-]*(?:(?:then|next|and)\b[\s,:]*)?([\s\S]*?)[\s,.;:!]*$/i

// The words of the "Ready to commit" preview in the model's last answer; autopilot approves
// only such a preview. The operator approves any answer that names a preview ("Preview:
// switch to the release branches", git.ts PREVIEWED) and shows git or gh writes in a code
// block. Its review line is git.ts REVIEWED.
const READY = /\bready to commit\b/i

// A review line that leaves a finding to the operator: "2 left open", "skipped", "wasn't fixed".
const OPEN_FINDING = /\?|n['’]t\b|\b(?:open|left|remain\w*|unfixed|not|skip\w*|defer\w*|later|ignored?|todo|recorded)\b/i
// How the session settled its findings: fixed, or kept with a reason ("4 kept as documented
// limits", "1 stays", "2 moot").
const SETTLED = /\b(\d+)\s+(?:fixed|kept|stay(?:s|ed)?|moot)\b/gi
// A review line that found nothing: "no findings", "docs only, reread".
const NOTHING_FOUND = /\b(?:no|0)\s+findings?\b|\bdocs only\b/i

// Autopilot (AUTOPILOT.md): `/autopilot [<step>] [--max N]` or `/autopilot off`.
const AUTOPILOT_USAGE = '/autopilot [<step>] [--max N], or /autopilot off'
const MAX_COMMITS = 100
const STEP_ID = /^[A-Z][A-Z0-9]*-\d+(?:\.\d+)*$/
// The preview's line naming the steps its commit finishes, also as a heading, a list item or
// in bold.
const STEP_DONE = /^[\s#>*_\d.-]*Steps? done[*_]*:[*_]*[ \t]*(.+)$/gim
// The only commands autopilot approves: a git add or a git commit, each on its own.
const ADD_OR_COMMIT = /^git\s+(?:-C\s+\S+\s+)?(add|commit)\s/
// A commit that rewrites one: --amend, --fixup, --squash (git takes these prefixes).
const REWRITES = /\s--(?:am|fix|squ)/
// What the restarted session reads in its note (/session).
const UNDER_AUTOPILOT = 'under autopilot'
// The note under autopilot, with the target step the session's preview marks done.
function pilotNote(pilot: SessionResetAutopilot): string {
  return pilot.target
    ? `${UNDER_AUTOPILOT} until ${pilot.target} is done (the preview that finishes it says "Step done: ${pilot.target}")`
    : UNDER_AUTOPILOT
}

// What the model reads beside an "approve" that holds a question or a condition.
const HELD =
  'session-reset: this answer to the preview holds a question or a condition, ' +
  'so it is not an approval (~/.claude/CLAUDE.md). Answer it, and if the work should still be ' +
  'committed, show the preview again and wait for a plain "approve". git and gh writes are ' +
  'blocked for this turn.'
// What the model reads beside an "approve" of a committing preview with no Review: line.
const UNREVIEWED =
  'session-reset: the preview commits but has no Review: line, so this approve is held ' +
  '(~/.claude/git-rules.md). Run code-review on the diff and fix what it finds, then show the ' +
  'preview again with its Review: line and wait for "approve". git and gh writes are blocked ' +
  'for this turn.'
// What a failed git, gh or signing step prints, even when a pipe hides its exit code.
const FAILED_OUTPUT =
  /^(?:fatal|error):|\[rejected\]|failed to push|gpg failed|signing failed|nothing to commit|^\s*CONFLICT\b/im

let isRestarting = false
// After a refused /clear the person runs it; then the mod starts /session with these args.
let pendingArgs: string | undefined

// The workspace session and autopilot a restart carries over its /clear: a /clear starts a
// new host session, whose state starts empty.
type Carried = { session: SessionResetSession | null; pilot: SessionResetAutopilot | null }

async function session($: EngineInterface): Promise<SessionResetSession | null> {
  return (await $.state.get(SESSION)).value ?? null
}

async function preview($: EngineInterface): Promise<SessionResetPreview | null> {
  return (await $.state.get(PREVIEW)).value ?? null
}

async function autopilot($: EngineInterface): Promise<SessionResetAutopilot | null> {
  return (await $.state.get(AUTOPILOT)).value ?? null
}

// Sets autopilot, on (`pilot`) or off (null), and writes it where opsboard reads it: one
// line root<TAB>id<TAB>target<TAB>count<TAB>max<TAB>waiting per session, empty when off.
async function setAutopilot($: EngineInterface, pilot: SessionResetAutopilot | null) {
  const was = await autopilot($)
  await $.state.set(AUTOPILOT, pilot)
  const at = pilot ?? was
  if (!at) {
    return
  }
  const dir = await stateDir($, 'autopilot')
  const line = pilot
    ? `${[pilot.root, pilot.id, pilot.target ?? '', pilot.count, pilot.max, pilot.waiting ?? ''].join('\t')}\n`
    : ''
  await $.fs.write(`${dir}/${at.root.replace(/[^\w.-]/g, '_')}__${at.id}.tsv`, line).catch(() => {
    $.ui.toast('session-reset could not write the autopilot state for opsboard.', { timeoutMs: 15000 })
  })
}

// The commit loop's log: one JSON line per preview, approve, git or gh write, and approved
// turn's end (restart, or why none), in ${XDG_STATE_HOME:-~/.local/state}/super-project/
// session-reset/<Claude session>.jsonl. One file per Claude session, so sessions in parallel
// never write the same file; the writes of one session queue here. The engine has no append,
// so the file's text stays here and each line rewrites it whole; a full file (LOG_PART) goes
// on in <Claude session>.2.jsonl, and so on. A file that exists but cannot be read is never
// written over: the log goes on in the next part. A failed write is lost: the log never stops
// the gate.
const LOG_PART = 1024 * 1024
let logged: Promise<void> = Promise.resolve()
let logTo: { base: string; part: number; text: string } | undefined

// ${XDG_STATE_HOME:-~/.local/state}/super-project/<name>.
async function stateDir($: EngineInterface, name: string): Promise<string> {
  const home = (await $.env.get('HOME')) ?? ''
  return `${(await $.env.get('XDG_STATE_HOME')) || `${home}/.local/state`}/super-project/${name}`
}

const logFile = (at: { base: string; part: number }) => (at.part === 1 ? `${at.base}.jsonl` : `${at.base}.${at.part}.jsonl`)

// The first part of the session's log with room left, and its text.
async function openLog($: EngineInterface, base: string): Promise<{ base: string; part: number; text: string }> {
  for (let part = 1; ; part++) {
    if (!(await $.fs.exists(logFile({ base, part })))) {
      return { base, part, text: '' }
    }
    const text = await $.fs.read(logFile({ base, part })).catch(() => undefined)
    if (text !== undefined && text.length < LOG_PART) {
      return { base, part, text }
    }
  }
}

function log($: EngineInterface, event: string, fields: Record<string, unknown> = {}): Promise<void> {
  logged = logged
    .then(async () => {
      const base = `${await stateDir($, 'session-reset')}/${await $.session.id()}`
      if (logTo?.base !== base) {
        logTo = await openLog($, base)
      }
      if (logTo.text.length >= LOG_PART) {
        logTo = { base, part: logTo.part + 1, text: '' }
      }
      const current = await session($)
      const line = JSON.stringify({ at: new Date(await $.clock.now()).toISOString(), event, id: current?.id ?? null, ...fields })
      await $.fs.write(logFile(logTo), `${logTo.text}${line}\n`)
      logTo.text += `${line}\n`
    })
    .catch(() => undefined)

  return logged
}

// A failed command's output, enough to tell why it failed: git puts the reason first
// ("fatal: …") or last ("no changes added to commit").
function excerpt(text: string | undefined): string {
  const out = (text ?? '').trim()
  return out.length <= 600 ? out : `${out.slice(0, 300)} … ${out.slice(-300)}`
}

// A value from the tooling config, by the rules of `sp-config`: KEY=value lines in
// ${XDG_CONFIG_HOME:-~/.config}/super-project/config, # comments, the last line wins, a
// leading ~ expands, and a missing file or key gives the default.
async function config($: EngineInterface, key: 'ROOTS' | 'BIN_DIR'): Promise<string> {
  const home = (await $.env.get('HOME')) ?? ''
  const dir = `${(await $.env.get('XDG_CONFIG_HOME')) || `${home}/.config`}/super-project`
  const text = await $.fs.read(`${dir}/config`).catch(() => '')
  let value = ''
  for (const line of text.split('\n')) {
    const at = line.indexOf('=')
    if (at > 0 && !/^\s*#/.test(line) && line.slice(0, at).trim() === key) {
      value = line.slice(at + 1).trim()
    }
  }
  const defaults = { ROOTS: `${dir}/roots`, BIN_DIR: '~/.local/bin' }

  return (value || defaults[key]).replace(/^~(?=\/|$)/, home)
}

// The workspace roots, one home: the roots file (`sp-config ROOTS`).
async function workspaceRoot($: EngineInterface, cwd: string): Promise<string | undefined> {
  const home = (await $.env.get('HOME')) ?? ''
  const text = await $.fs.read(await config($, 'ROOTS')).catch(() => '')
  const roots = text
    .split('\n')
    .map(line => line.trim().replace(/\/+$/, '').replace(/^~(?=\/)/, home))
    .filter(line => line !== '' && !line.startsWith('#'))

  return roots.find(root => cwd === root || cwd.startsWith(`${root}/`))
}

// The operator committed by hand: they took over, so autopilot ends.
async function takeOver($: EngineInterface) {
  if (await autopilot($)) {
    await setAutopilot($, null)
    $.ui.toast('Autopilot off: you committed by hand.', { timeoutMs: 15000 })
  }
}

async function carry($: EngineInterface): Promise<Carried> {
  return { session: await session($), pilot: await autopilot($) }
}

// A restart step the mod could not run: the person runs it from the prompt box.
async function refused($: EngineInterface, step: string, error: unknown, then = '') {
  try {
    await $.prompt.fill({ text: step })
  } catch {
    // The box may be held by a dialog; the toast still says what to run.
  }
  $.ui.toast(`session-reset could not run ${step} (${error}). Press Enter to run it${then}.`, { timeoutMs: 15000 })
}

// After the restart's /clear: puts back the session and autopilot, then runs /session.
async function reopen($: EngineInterface, args: string, carried: Carried) {
  try {
    if (carried.session) {
      await $.state.set(SESSION, carried.session)
    }
    if (carried.pilot) {
      await setAutopilot($, carried.pilot)
    }
    await $.command.run({ command: 'session', args })
  } catch (error) {
    await refused($, `/session ${args}`, error)
  }
}

function restart($: EngineInterface, id: string, note: string) {
  if (isRestarting) {
    return
  }
  isRestarting = true
  const args = note ? `${id} ${note}` : id
  // Run once the hook has returned: $.command.run rejects inside a hook the turn waits on.
  $.clock.after(0, async () => {
    try {
      const carried = await carry($)
      await log($, 'restart', { args })
      try {
        await $.command.run({ command: 'clear' })
      } catch (error) {
        pendingArgs = args
        await log($, 'restart-refused', { error: String(error) })
        await refused($, '/clear', error, `; /session ${args} follows`)
        return
      }
      await reopen($, args, carried)
    } finally {
      isRestarting = false
    }
  })
}

// Whether the session's checkpoint row reads `reached` (`opsboard --tsv`), or undefined when
// the board cannot be read.
async function hasReached($: EngineInterface, current: SessionResetSession): Promise<boolean | undefined> {
  const bin = await config($, 'BIN_DIR')
  const ran = await $.process.run([`${bin}/opsboard`, '--tsv', current.root], { timeoutMs: 20000 }).catch(() => undefined)
  if (ran?.exitCode !== 0) {
    return undefined
  }

  return ran.stdout.split('\n').some(line => {
    const [kind, , table, who = '', status = ''] = line.split('\t')
    return kind === 'status' && table === 'checkpoint' && who.replace(/`/g, '').split(/\s/)[0] === current.id && /^reached\b/.test(status)
  })
}

// Whether a review line leaves nothing open: "no findings", "docs only, reread", "1 finding,
// fixed", "2 findings, both fixed", "9 findings, 5 fixed, 4 kept": every finding is fixed,
// kept with its reason (git rule 1) or moot, and none is left to the operator. Only the tally
// counts: a reason in parentheses may say "not" or "left", or hold counts of its own.
function isCleanReview(line: string): boolean {
  const review = line.replace(/\([^)]*\)/g, '')
  if (OPEN_FINDING.test(review)) {
    return false
  }
  if (NOTHING_FOUND.test(review)) {
    return true
  }
  const found = /(\d+)\s+findings?\b/i.exec(review)?.[1]
  if (found === undefined) {
    return false
  }
  if (/\b(?:all|both)\s+fixed\b/i.test(review)) {
    return true
  }
  if (found === '1' && /[,:;]\s*(?:fixed|kept|stay(?:s|ed)?|moot)\b/i.test(review)) {
    return true
  }

  return [...review.matchAll(SETTLED)].reduce((sum, m) => sum + Number(m[1]), 0) === Number(found)
}

// Why autopilot leaves a preview to the operator, or undefined when it approves it: every
// Review: line in the answer leaves nothing open, and every command is a plain git add or
// git commit that the gate allows.
function autopilotWaits(answer: string, commands: string[]): string | undefined {
  const reviews = [...answer.matchAll(new RegExp(REVIEWED.source, 'gim'))].map(m => m[1] as string)
  if (reviews.length === 0 || !reviews.every(isCleanReview)) {
    return 'its Review: line is missing or leaves a finding open'
  }
  const isPlain = (c: string) => {
    const judged = judge(c)
    return ADD_OR_COMMIT.test(c) && !REWRITES.test(c) && judged.writes === 1 && judged.forbidden === undefined
  }
  if (!commands.every(isPlain)) {
    return 'it runs more than a plain git add and git commit'
  }

  return undefined
}

// The steps a preview's `Step done:` lines say its commit finishes ("Step done: PAY-1.3");
// a commit of one slice of a step has none. A remark in parentheses ("PAY-1.2 is next") is not
// a step done.
function stepsDone(answer: string): string[] {
  const id = new RegExp(`\\b${STEP_ID.source.slice(1, -1)}\\b`, 'g')
  return [...answer.matchAll(STEP_DONE)].flatMap(m => (m[1] as string).replace(/\([^)]*\)/g, '').match(id) ?? [])
}

function progress(pilot: SessionResetAutopilot): string {
  return `${pilot.count}/${pilot.max} → ${pilot.target ?? 'checkpoint'}`
}

// Why an answer to the open preview is not an approval: a question or a condition in its
// note, or a preview that commits with no Review: line (one saved before the mod read it
// counts as none). A preview that only switches, tags, merges or pushes needs no review.
function holdReason(note: string, open: SessionResetPreview | null): string | undefined {
  if (DOUBT.test(note)) {
    return HELD
  }
  const commits = open !== null && open.commands.some(c => judge(c).commits === true)

  return commits && open.isReviewed !== true ? UNREVIEWED : undefined
}

// Why the log says an approve was held, if it was.
function heldFields(reason: string | undefined, open: SessionResetPreview | null): { held?: string } {
  if (reason !== undefined) {
    return { held: reason === HELD ? 'a question or a condition' : 'no Review: line' }
  }

  return open === null ? { held: 'no preview open' } : {}
}

// Why an approved turn ends with no restart, or undefined when it restarts (in a workspace
// session): after a commit, once every command of the preview ran. A batch that only switches
// or tags keeps the session.
function noRestart(turn: Approved, open: SessionResetPreview | null, reason: string): string | undefined {
  if (turn.hasFailed) {
    return 'a command failed'
  }
  if (reason !== 'answer') {
    return `the turn ended: ${reason}`
  }
  if (!turn.hasCommitted) {
    return 'no commit ran'
  }
  if (open === null || open.next < open.commands.length) {
    return `${open?.next ?? 0} of ${open?.commands.length ?? 0} commands ran`
  }

  return undefined
}

// Submit the answer of "/approve" or "/commit" as the person's words. The mod's own hooks
// do not see this prompt, so the command hook sets the turn's state first.
function submitAsPerson($: EngineInterface, text: string) {
  $.clock.after(0, () => void $.prompt.submit({ text, asUser: true }))
}

// How many of the open preview's commands, from `next` on, this command is: one, or
// several joined with &&. Zero when it is none of them.
function matches(command: string, open: SessionResetPreview): number {
  const wanted = normalize(command)
  let joined = ''
  for (let k = open.next; k < open.commands.length; k++) {
    joined = joined === '' ? normalize(open.commands[k] as string) : `${joined} && ${normalize(open.commands[k] as string)}`
    if (joined === wanted) {
      return k - open.next + 1
    }
  }

  return 0
}

// The turn that runs an approved preview: its note, how its commands went, and whether it
// committed. The operator's approve lets any git or gh write run that is not forbidden (a
// commit the preview did not show only when the preview has its Review: line); autopilot's
// (`isExact`) only the preview's commands, in order.
type Approved = { note: string; writes: number; hasFailed: boolean; hasCommitted: boolean; isExact: boolean }

export const register: Register = on => {
  let approved: Approved | undefined
  // The turn that answers a preview with a question or a condition, or approves one with
  // no Review: line: no git write runs, and the model reads why.
  let held: string | undefined

  on('session.start', async ($, e, next) => {
    const commands = [
      { name: 'committed', description: 'I committed: clear this workspace session and restart it with /session <ID> [note]' },
      { name: 'approve', description: 'Approve the Ready to commit preview; the note goes to the restarted session' },
      { name: 'commit', description: 'Approve the Ready to commit preview (same as /approve)' },
      {
        name: 'autopilot',
        description: 'Approve this workspace session\'s clean commit previews until a step, its checkpoint or N commits',
        argumentHint: '[<step>] [--max N] | off',
      },
    ]
    for (const command of commands) {
      try {
        await $.command.register({ argumentHint: '[note]', ...command })
      } catch {
        // A built-in of the same name keeps its own; the typed answer still works.
      }
    }
    // The Bash tool's shell has the person's zsh aliases (gp → git push), so the gate reads
    // them too. An interactive zsh takes the terminal for job control and leaves Claude
    // stopped in the background, so it runs in its own session with no terminal.
    const listed = await $.process.run(['setsid', '-w', 'zsh', '-ic', 'alias -L'], { timeoutMs: 10000 }).catch(() => undefined)
    if (listed?.exitCode === 0) {
      setAliases(parseAliases(listed.stdout))
    } else {
      $.ui.toast('session-reset could not read the zsh aliases; a git alias (gp, gcmsg) is not gated.', { timeoutMs: 15000 })
    }

    return next(e)
  })

  on('command.run', { command: ['approve', 'commit'] }, async ($, e) => {
    const note = e.args.trim()
    const open = await preview($)
    held = holdReason(note, open)
    await log($, 'approve', { via: `/${e.command}`, note, ...heldFields(held, open) })
    if (held === HELD) {
      approved = undefined
      submitAsPerson($, `approve, ${note}`)

      return { text: 'Not an approval: a question or a condition. git writes are blocked for this turn.' }
    }
    if (held === UNREVIEWED) {
      approved = undefined
      // This prompt gets no context from the mod's own hooks, so it says why itself.
      submitAsPerson($, `approve. ${UNREVIEWED}`)

      return { text: 'Held: the preview has no Review: line. git writes are blocked for this turn.' }
    }
    if (open === null) {
      return { text: 'No preview is open: nothing to approve.' }
    }
    approved = { note, writes: 0, hasFailed: false, hasCommitted: false, isExact: false }
    submitAsPerson($, 'approve')

    return { text: note ? `Approved; the note goes to the restarted session: ${note}` : 'Approved.' }
  })

  on('command.run', { command: 'autopilot' }, async ($, e) => {
    const words = e.args.trim().split(/\s+/).filter(w => w !== '')
    if (words.length === 1 && words[0] === 'off') {
      const was = await autopilot($)
      await setAutopilot($, null)

      return { text: was ? 'Autopilot off: approve each preview by hand.' : 'Autopilot was not on.' }
    }
    const current = await session($)
    if (!current) {
      return { text: 'Autopilot runs in a workspace session: start it with /session <ID> first.' }
    }
    let target: string | null = null
    let max = MAX_COMMITS
    for (let i = 0; i < words.length; i++) {
      const w = words[i] as string
      if (w === '--max' && /^[1-9]\d*$/.test(words[i + 1] ?? '')) {
        max = Number(words[++i])
      } else if (target === null && STEP_ID.test(w)) {
        target = w
      } else {
        return { text: `Usage: ${AUTOPILOT_USAGE}` }
      }
    }
    if (target === null) {
      const isReached = await hasReached($, current)
      if (isReached !== false) {
        const why = isReached ? `${current.id} has already reached its checkpoint` : 'opsboard --tsv could not be read'
        return { text: `Autopilot not started: ${why}. Name a step: /autopilot <step>.` }
      }
    }
    const pilot = { id: current.id, root: current.root, target, max, count: 0, waiting: null }
    await setAutopilot($, pilot)
    submitAsPerson($, `Autopilot is on (${progress(pilot)}): go on with your next step, ${pilotNote(pilot)} (/session).`)

    return { text: `Autopilot on: ${progress(pilot)}` }
  })

  on('command.run', { command: 'session' }, async ($, e, next) => {
    // The person's own /session replaces a restart still waiting for its /clear.
    if (e.origin.kind !== 'plugin' || e.origin.name !== 'session-reset') {
      pendingArgs = undefined
    }
    const id = e.args.trim().split(/\s+/)[0] ?? ''
    const root = SESSION_ID.test(id) ? await workspaceRoot($, await $.session.cwd()) : undefined
    if (root) {
      await $.state.set(SESSION, { id, root })
    }
    // Another session ID is another session: autopilot was for this one.
    if ((await autopilot($))?.id !== id) {
      await setAutopilot($, null)
    }

    return next(e)
  })

  // A /clear that is not this mod's own ends the workspace session, unless it is the
  // person running the /clear the mod could not run: then /session follows it.
  on('command.run', { command: 'clear' }, async ($, e, next) => {
    const isOwn = e.origin.kind === 'plugin' && e.origin.name === 'session-reset'
    const args = isOwn ? undefined : pendingArgs
    pendingArgs = undefined
    // The person's /clear that finishes a restart carries the session and autopilot as they
    // stand now; any other ends both.
    const carried = args ? await carry($) : undefined
    if (!isOwn) {
      await $.state.set(SESSION, null)
    }
    if (!isOwn && !args) {
      await setAutopilot($, null)
    }
    await $.state.set(PREVIEW, null)
    const ran = await next(e)
    if (args && carried) {
      $.clock.after(0, () => reopen($, args, carried))
    }

    return ran
  })

  // The process ends (/exit, ctrl+c): autopilot ends with it. A /clear is handled above.
  on('session.end', async ($, e, next) => {
    if (e.reason !== 'clear') {
      await setAutopilot($, null)
    }

    return next(e)
  })

  // /resume leaves this conversation for another one.
  on('command.run', { command: 'resume' }, async ($, e, next) => {
    pendingArgs = undefined
    await $.state.set(SESSION, null)
    await $.state.set(PREVIEW, null)
    await setAutopilot($, null)

    return next(e)
  })

  on('command.run', { command: 'committed' }, async ($, e) => {
    const current = await session($)
    if (!current) {
      return { text: 'No /session ID in this session, so there is nothing to restart.' }
    }
    await log($, 'committed', { via: '/committed' })
    await takeOver($)
    restart($, current.id, e.args.trim())

    return { text: `Committed: clearing, then /session ${current.id}` }
  })

  on('prompt.submit', async ($, e, next) => {
    // Typed during a running turn, the message is for the model and the turn goes on.
    if (e.turnId !== undefined) {
      return next(e)
    }
    approved = undefined
    held = undefined
    const isPerson = e.origin.kind === 'composer' || e.origin.kind === 'bridge'
    if (!isPerson) {
      return next(e)
    }
    // The operator answered: the session no longer waits for them.
    const pilot = await autopilot($)
    if (pilot?.waiting) {
      await setAutopilot($, { ...pilot, waiting: null })
    }
    const open = await preview($)
    const approve = APPROVE.exec(e.text) ?? (open !== null ? COMMIT.exec(e.text) : null)
    // In every session: an approve with a question or a condition, or of a preview with
    // no Review: line, is not an approval.
    held = approve ? holdReason(approve[1] ?? '', open) : undefined
    if (approve) {
      await log($, 'approve', { via: 'typed', note: (approve[1] ?? '').trim(), ...heldFields(held, open) })
    }
    if (held !== undefined) {
      return next({ ...e, context: [...(e.context ?? []), held] })
    }
    const current = await session($)
    const committed = current ? COMMITTED.exec(e.text) : null
    if (current && committed && !DOUBT.test(e.text)) {
      await log($, 'committed', { via: 'typed' })
      await takeOver($)
      restart($, current.id, (committed[1] ?? '').trim())

      return { drop: `Committed: clearing, then /session ${current.id}` }
    }
    if (!approve) {
      return next(e)
    }
    approved = { note: (approve[1] ?? '').trim(), writes: 0, hasFailed: false, hasCommitted: false, isExact: false }

    // In a workspace session the note is for the restarted session; the model runs the
    // preview as shown. Elsewhere the model reads the answer whole.
    return current ? next({ ...e, text: 'approve' }) : next(e)
  })

  // The approve gate: a git or gh write runs only in a turn the operator approved, or as the
  // next command of a preview autopilot approved; some never run (~/.claude/CLAUDE.md). A
  // failed command (git, gh, a pipe that hides git's exit code) keeps the session and stops
  // the rest.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const judged = judge(e.command)
    if (judged.writes === 0) {
      return next(e)
    }
    const refuse = async (deny: string) => {
      await log($, 'command', { command: e.command, denied: deny })
      return { deny }
    }
    if (judged.forbidden) {
      return refuse(`session-reset: never run: ${judged.forbidden} (~/.claude/CLAUDE.md).`)
    }
    if (e.agentId !== undefined) {
      return refuse('session-reset: a subagent never runs git or gh writes; the main session runs them after approve.')
    }
    if (held !== undefined) {
      return refuse(held)
    }
    const open = await preview($)
    if (!approved || !open) {
      return refuse(
        'session-reset: git and gh writes run only after the operator approves a preview. ' +
          'Show the preview (~/.claude/CLAUDE.md) and wait for "approve".',
      )
    }
    if (approved.hasFailed) {
      return refuse('session-reset: a command of the approved preview failed; stop and report it.')
    }
    let count = matches(e.command, open)
    // Under the operator's approve a corrected command stands in for the preview's: a later
    // command of the preview counts the ones before it as done unless one of them commits,
    // and a commit stands in for the preview's next command when that one commits.
    if (count === 0 && !approved.isExact) {
      const wanted = normalize(e.command)
      const later = open.commands.findIndex((c, k) => k > open.next && normalize(c) === wanted)
      const skipped = later > 0 ? open.commands.slice(open.next, later) : []
      const nextCommits = judge(open.commands[open.next] ?? '').commits === true
      count =
        later > 0 && !skipped.some(c => judge(c).commits === true)
          ? later - open.next + 1
          : judged.commits === true && nextCommits
            ? 1
            : 0
    }
    if (judged.commits === true && open.isReviewed !== true && !open.commands.some(c => judge(c).commits === true)) {
      return refuse('session-reset: this commit is not in the approved preview, which has no Review: line. Review, then show a new preview.')
    }
    if (count === 0 && approved.isExact) {
      const expected = open.commands[open.next]

      return refuse(
        expected
          ? `session-reset: not the next command of the approved preview. Run them one by one, as shown; next: ${expected}`
          : 'session-reset: every command of the approved preview has run; anything more needs a new preview.',
      )
    }
    // A command of the preview moves it on; another one runs too, under the operator's approve.
    const from = open.next
    if (count > 0) {
      await $.state.set(PREVIEW, { ...open, next: from + count })
    }
    const ran = await next(e)
    const hasFailed = ran.deny !== undefined || ran.isError === true || FAILED_OUTPUT.test(ran.text ?? '')
    await log($, 'command', { command: e.command, matched: count, ...(hasFailed ? { failed: ran.deny ?? excerpt(ran.text) } : {}) })
    if (hasFailed) {
      approved.hasFailed = true
      const now = await preview($)
      if (now && count > 0) {
        await $.state.set(PREVIEW, { ...now, next: Math.min(now.next, from) })
      }
    } else {
      approved.writes += judged.writes
      approved.hasCommitted ||= judged.commits === true
    }

    return ran
  }).catch(($, e, next) => {
    if (next.called || !/\b(git|gh|commit-all|push-all)\b/.test(e.command)) {
      return next(e)
    }
    const deny = 'session-reset: its git gate failed, so git and gh writes are blocked.'
    // Not awaited: a catch handler answers within a grace.
    void log($, 'command', { command: e.command, denied: deny, error: String(next.error) })

    return { deny }
  })

  // A monitor runs its command unseen in the background: never a git or gh write.
  on('tool.call', { tool: 'Monitor' }, async ($, e, next) => {
    const judged = e.command === undefined ? { writes: 0 } : judge(e.command)
    if (judged.writes === 0) {
      return next(e)
    }
    const deny = 'session-reset: git and gh writes run only through Bash, after the operator approves a preview.'
    await log($, 'command', { command: e.command, denied: deny, tool: 'Monitor' })

    return { deny }
  }).catch(($, e, next) => {
    if (next.called) {
      return next(e)
    }
    const deny = 'session-reset: its git gate failed on this monitor.'
    void log($, 'command', { command: e.command, denied: deny, tool: 'Monitor', error: String(next.error) })

    return { deny }
  })

  // After all the approved commands ran, with a git write and no failed command, restart.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      return next(e)
    }
    const turn = approved
    approved = undefined
    held = undefined
    const open = await preview($)
    const hasRunAll = open !== null && open.next >= open.commands.length
    const missed = turn === undefined ? undefined : noRestart(turn, open, e.reason)
    const isDone = turn !== undefined && missed === undefined
    // A preview stays open until all its commands ran or a new preview replaces it. An
    // approve answers the last answer's preview: an answer with none closes it.
    const shown = PREVIEWED.test(e.answer) ? previewCommands(e.answer) : []
    const isReviewed = shown.length > 0 && REVIEWED.test(e.answer)
    const done = shown.length > 0 ? stepsDone(e.answer) : undefined
    if (shown.length > 0) {
      await $.state.set(PREVIEW, { commands: shown, next: 0, at: await $.clock.now(), isReviewed, done })
    } else if (hasRunAll && turn !== undefined && turn.writes > 0 && !turn.hasFailed) {
      await $.state.set(PREVIEW, null)
    } else if (turn === undefined && e.reason === 'answer') {
      await $.state.set(PREVIEW, null)
    }
    const current = await session($)
    if (turn !== undefined) {
      const why = missed ?? (!current ? 'no /session ID' : isRestarting ? 'a restart was already running' : undefined)
      await log($, 'turn', why === undefined ? { restart: true } : { restart: false, why })
    }
    if (shown.length > 0) {
      await log($, 'preview', { commands: shown, isReviewed, done })
    }
    let pilot = await autopilot($)
    let stopped: string | undefined
    // After a run, autopilot counts the commit and stops at a failure, its target, its
    // count or the checkpoint.
    if (pilot && turn !== undefined && (turn.hasCommitted || turn.hasFailed)) {
      const target = pilot.target
      const count = turn.hasFailed ? pilot.count : pilot.count + 1
      let why = turn.hasFailed
        ? 'a command of the preview failed'
        : target !== null && (open?.done ?? []).includes(target)
          ? `${target} is done`
          : count >= pilot.max
            ? `${count} of ${pilot.max} commits ran`
            : undefined
      if (why === undefined && target === null && current) {
        const isReached = await hasReached($, current)
        why = isReached ? `${pilot.id} reached its checkpoint` : isReached === undefined ? 'opsboard --tsv could not be read' : undefined
      }
      pilot = why ? null : { ...pilot, count, waiting: null }
      await setAutopilot($, pilot)
      if (why) {
        await log($, 'autopilot', { off: why })
        stopped = `autopilot is off (${why}): name your next step and wait for me`
        $.ui.toast(`Autopilot off: ${why}.`, { timeoutMs: 15000 })
      }
    }
    if (current && isDone) {
      const note = pilot ? pilotNote(pilot) : stopped
      restart($, current.id, [turn.note, note ?? ''].filter(n => n !== '').join('; '))
    } else if (pilot && current?.id === pilot.id && shown.length > 0 && e.reason === 'answer') {
      // A new preview under autopilot: approve it, or say why it waits for the operator.
      const why = READY.test(e.answer) ? autopilotWaits(e.answer, shown) : 'it is no Ready to commit preview'
      await log($, 'autopilot', why ? { waits: why } : { approves: true })
      if (why) {
        await setAutopilot($, { ...pilot, waiting: 'your approve' })
        $.ui.toast(`Autopilot waits for your approve: ${why}.`, { timeoutMs: 15000 })
      } else {
        approved = { note: '', writes: 0, hasFailed: false, hasCommitted: false, isExact: true }
        submitAsPerson($, 'approve')
      }
    } else if (isDone && (await workspaceRoot($, await $.session.cwd()))) {
      $.ui.toast('No restart: this conversation was not started with /session <ID>.', { timeoutMs: 15000 })
    } else if (current && turn?.hasCommitted && !turn.hasFailed && !hasRunAll && e.reason === 'answer') {
      $.ui.toast('No restart: not every command of the preview ran. Say "committed" to restart.', { timeoutMs: 15000 })
    } else if (current && turn?.note) {
      $.ui.toast(`No restart, so your note was not passed on: "${turn.note}"`, { timeoutMs: 15000 })
    }
    // A turn under autopilot that ends with no preview and no run asks the operator something.
    if (pilot && current?.id === pilot.id && turn === undefined && shown.length === 0 && e.reason === 'answer') {
      await setAutopilot($, { ...pilot, waiting: 'an answer' })
    }

    return next(e)
  })
}
