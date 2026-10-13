import type { EngineInterface, Register } from 'claude-code'

import type { SessionResetAutopilot, SessionResetPreview, SessionResetSession } from '../types'
import { judge, normalize, parseAliases, previewCommands, setAliases } from './git'

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

// The words of the "Ready to commit" preview in the model's last answer.
const READY = /\bready to commit\b/i

// The preview's review line (~/.claude/CLAUDE.md): "Review: code-review, 1 finding, fixed",
// also as a list item or in bold ("- **Review:** docs only, reread"); a bare label is none.
const REVIEWED = /^[\s>*_-]*Review[*_]*:[*_]*[ \t]*([^\s*_].*)$/im
// A review line that leaves a finding to the operator: "1 stays", "2 left open", "skipped".
const OPEN_FINDING = /\?|\b(?:open|stays?|left|remain\w*|unfixed|not|skip\w*|defer\w*|later|ignored?|kept|todo|recorded)\b/i
// A review line that found nothing: "no findings", "docs only, reread".
const NOTHING_FOUND = /\b(?:no|0)\s+findings?\b|\bdocs only\b/i

// Autopilot (AUTOPILOT.md): `/autopilot [<step>] [--max N]` or `/autopilot off`.
const AUTOPILOT_USAGE = '/autopilot [<step>] [--max N], or /autopilot off'
const MAX_COMMITS = 100
const STEP_ID = /^[A-Z][A-Z0-9]*-\d+(?:\.\d+)*$/
// The only commands autopilot approves: a git add or a git commit, each on its own.
const ADD_OR_COMMIT = /^git\s+(?:-C\s+\S+\s+)?(add|commit)\s/
// A commit that rewrites one: --amend, --fixup, --squash (git takes these prefixes).
const REWRITES = /\s--(?:am|fix|squ)/
// What the restarted session reads in its note (/session).
const UNDER_AUTOPILOT = 'under autopilot'

// What the model reads beside an "approve" that holds a question or a condition.
const HELD =
  'session-reset: this answer to the Ready to commit preview holds a question or a condition, ' +
  'so it is not an approval (~/.claude/CLAUDE.md). Answer it, and if the work should still be ' +
  'committed, show the preview again and wait for a plain "approve". git and gh writes are ' +
  'blocked for this turn.'
// What the model reads beside an "approve" of a preview with no Review: line.
const UNREVIEWED =
  'session-reset: the Ready to commit preview has no Review: line, so this approve is held ' +
  '(~/.claude/git-rules.md). Run code-review on the diff and fix what it finds, then show the ' +
  'preview again with its Review: line and wait for "approve". git and gh writes are blocked ' +
  'for this turn.'
// What a failed git, gh or signing step prints, even when a pipe hides its exit code.
const FAILED_OUTPUT =
  /^(?:fatal|error):|\[rejected\]|failed to push|gpg failed|signing failed|nothing to commit|^\s*CONFLICT\b/im

let isRestarting = false
// After a refused /clear the person runs it; then the mod starts /session with these args.
let pendingArgs: string | undefined

async function session($: EngineInterface): Promise<SessionResetSession | null> {
  return (await $.state.get(SESSION)).value ?? null
}

async function preview($: EngineInterface): Promise<SessionResetPreview | null> {
  return (await $.state.get(PREVIEW)).value ?? null
}

async function autopilot($: EngineInterface): Promise<SessionResetAutopilot | null> {
  return (await $.state.get(AUTOPILOT)).value ?? null
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
    await $.state.set(AUTOPILOT, null)
    $.ui.toast('Autopilot off: you committed by hand.', { timeoutMs: 15000 })
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
    let step = '/clear'
    try {
      await $.command.run({ command: 'clear' })
      step = `/session ${args}`
      await $.command.run({ command: 'session', args })
    } catch (error) {
      pendingArgs = step === '/clear' ? args : undefined
      try {
        await $.prompt.fill({ text: step })
      } catch {
        // The box may be held by a dialog; the toast still says what to run.
      }
      const then = step === '/clear' ? `; /session ${args} follows` : ''
      $.ui.toast(`session-reset could not run ${step} (${error}). Press Enter to run it${then}.`, {
        timeoutMs: 15000,
      })
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
// fixed", "2 findings, both fixed", "3 findings, all fixed" or "3 findings, 3 fixed".
function isCleanReview(review: string): boolean {
  if (OPEN_FINDING.test(review)) {
    return false
  }
  if (NOTHING_FOUND.test(review)) {
    return true
  }
  const found = /(\d+)\s+findings?\b/i.exec(review)?.[1]
  const fixed = /\b(\d+|all|both)\s+fixed\b/i.exec(review)?.[1]
  if (found === '1') {
    return /\bfixed\b/i.test(review)
  }

  return found !== undefined && fixed !== undefined && (fixed === found || /^(?:all|both)$/i.test(fixed))
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

// Whether the preview commits step `target`: a git commit whose message starts with its ID.
function commitsStep(commands: string[], target: string): boolean {
  const subject = new RegExp(`(?:^|[\\s"'])${target.replace(/\./g, '\\.')}:`)
  return commands.some(c => ADD_OR_COMMIT.exec(c)?.[1] === 'commit' && subject.test(c))
}

function progress(pilot: SessionResetAutopilot): string {
  return `${pilot.count}/${pilot.max} → ${pilot.target ?? 'checkpoint'}`
}

// Why an answer to the open preview is not an approval: a question or a condition in its
// note, or a preview with no Review: line (one saved before the mod read it counts as none).
function holdReason(note: string, open: SessionResetPreview | null): string | undefined {
  if (DOUBT.test(note)) {
    return HELD
  }

  return open !== null && open.isReviewed !== true ? UNREVIEWED : undefined
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

export const register: Register = on => {
  // The turn that runs an approved preview: its note, and how its commands went.
  let approved: { note: string; writes: number; hasFailed: boolean } | undefined
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
    held = holdReason(note, await preview($))
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
    approved = { note, writes: 0, hasFailed: false }
    submitAsPerson($, 'approve')

    return { text: note ? `Approved; the note goes to the restarted session: ${note}` : 'Approved.' }
  })

  on('command.run', { command: 'autopilot' }, async ($, e) => {
    const words = e.args.trim().split(/\s+/).filter(w => w !== '')
    if (words.length === 1 && words[0] === 'off') {
      const was = await autopilot($)
      await $.state.set(AUTOPILOT, null)

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
    const pilot = { id: current.id, target, max, count: 0 }
    await $.state.set(AUTOPILOT, pilot)
    submitAsPerson($, `Autopilot is on (${progress(pilot)}): go on with your next step, ${UNDER_AUTOPILOT} (/session).`)

    return { text: `Autopilot on: ${progress(pilot)}` }
  })

  on('command.run', { command: 'session' }, async ($, e, next) => {
    const id = e.args.trim().split(/\s+/)[0] ?? ''
    const root = SESSION_ID.test(id) ? await workspaceRoot($, await $.session.cwd()) : undefined
    if (root) {
      await $.state.set(SESSION, { id, root })
    }
    // Another session ID is another session: autopilot was for this one.
    if ((await autopilot($))?.id !== id) {
      await $.state.set(AUTOPILOT, null)
    }

    return next(e)
  })

  // A /clear that is not this mod's own ends the workspace session, unless it is the
  // person running the /clear the mod could not run: then /session follows it.
  on('command.run', { command: 'clear' }, async ($, e, next) => {
    const isOwn = e.origin.kind === 'plugin' && e.origin.name === 'session-reset'
    const args = isOwn ? undefined : pendingArgs
    pendingArgs = undefined
    if (!isOwn) {
      await $.state.set(SESSION, null)
    }
    // The person's own /clear ends autopilot; the one that finishes a restart does not.
    if (!isOwn && !args) {
      await $.state.set(AUTOPILOT, null)
    }
    await $.state.set(PREVIEW, null)
    const ran = await next(e)
    if (args) {
      $.clock.after(0, () => void $.command.run({ command: 'session', args }))
    }

    return ran
  })

  // /resume leaves this conversation for another one.
  on('command.run', { command: 'resume' }, async ($, e, next) => {
    await $.state.set(SESSION, null)
    await $.state.set(PREVIEW, null)
    await $.state.set(AUTOPILOT, null)

    return next(e)
  })

  on('command.run', { command: 'committed' }, async ($, e) => {
    const current = await session($)
    if (!current) {
      return { text: 'No /session ID in this session, so there is nothing to restart.' }
    }
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
    const open = await preview($)
    const approve = APPROVE.exec(e.text) ?? (open !== null ? COMMIT.exec(e.text) : null)
    // In every session: an approve with a question or a condition, or of a preview with
    // no Review: line, is not an approval.
    held = approve ? holdReason(approve[1] ?? '', open) : undefined
    if (held !== undefined) {
      return next({ ...e, context: [...(e.context ?? []), held] })
    }
    const current = await session($)
    const committed = current ? COMMITTED.exec(e.text) : null
    if (current && committed && !DOUBT.test(e.text)) {
      await takeOver($)
      restart($, current.id, (committed[1] ?? '').trim())

      return { drop: `Committed: clearing, then /session ${current.id}` }
    }
    if (!approve) {
      return next(e)
    }
    approved = { note: (approve[1] ?? '').trim(), writes: 0, hasFailed: false }

    // In a workspace session the note is for the restarted session; the model runs the
    // preview as shown. Elsewhere the model reads the answer whole.
    return current ? next({ ...e, text: 'approve' }) : next(e)
  })

  // The approve gate: a git or gh write runs only as the next command of the approved
  // preview, in its order, once; some never run (~/.claude/CLAUDE.md). Every command of the
  // approved preview counts: a failed one (git, gh, a pipe that hides git's exit code)
  // keeps the session and stops the rest.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const judged = judge(e.command)
    if (judged.writes === 0) {
      return next(e)
    }
    if (judged.forbidden) {
      return { deny: `session-reset: never run: ${judged.forbidden} (~/.claude/CLAUDE.md).` }
    }
    if (e.agentId !== undefined) {
      return { deny: 'session-reset: a subagent never runs git or gh writes; the main session runs them after approve.' }
    }
    if (held !== undefined) {
      return { deny: held }
    }
    const open = await preview($)
    if (!approved || !open) {
      return {
        deny:
          'session-reset: git and gh writes run only from an approved Ready to commit preview. ' +
          'Show the preview (~/.claude/CLAUDE.md) and wait for "approve".',
      }
    }
    if (approved.hasFailed) {
      return { deny: 'session-reset: a command of the approved preview failed; stop and report it.' }
    }
    const count = matches(e.command, open)
    if (count === 0) {
      const expected = open.commands[open.next]

      return {
        deny: expected
          ? `session-reset: not the next command of the approved preview. Run them one by one, as shown; next: ${expected}`
          : 'session-reset: every command of the approved preview has run; anything more needs a new preview.',
      }
    }
    const from = open.next
    await $.state.set(PREVIEW, { ...open, next: from + count })
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true || FAILED_OUTPUT.test(ran.text ?? '')) {
      approved.hasFailed = true
      const now = await preview($)
      if (now) {
        await $.state.set(PREVIEW, { ...now, next: Math.min(now.next, from) })
      }
    } else {
      approved.writes += judged.writes
    }

    return ran
  }).catch(($, e, next) =>
    next.called || !/\b(git|gh|commit-all|push-all)\b/.test(e.command)
      ? next(e)
      : { deny: 'session-reset: its git gate failed, so git and gh writes are blocked.' },
  )

  // A monitor runs its command unseen in the background: never a git or gh write.
  on('tool.call', { tool: 'Monitor' }, ($, e, next) => {
    const judged = e.command === undefined ? { writes: 0 } : judge(e.command)
    return judged.writes > 0
      ? { deny: 'session-reset: git and gh writes run only through Bash, from an approved Ready to commit preview.' }
      : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'session-reset: its git gate failed on this monitor.' }))

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
    const isDone = turn !== undefined && e.reason === 'answer' && turn.writes > 0 && !turn.hasFailed && hasRunAll
    // A preview stays open until all its commands ran or a new preview replaces it.
    const shown = READY.test(e.answer) ? previewCommands(e.answer) : []
    if (shown.length > 0) {
      await $.state.set(PREVIEW, { commands: shown, next: 0, at: await $.clock.now(), isReviewed: REVIEWED.test(e.answer) })
    } else if (hasRunAll && turn !== undefined && turn.writes > 0) {
      await $.state.set(PREVIEW, null)
    }
    const current = await session($)
    let pilot = await autopilot($)
    // After a run, autopilot counts the commit and stops at a failure, its target, its
    // count or the checkpoint.
    if (pilot && turn !== undefined && (turn.writes > 0 || turn.hasFailed)) {
      const target = pilot.target
      const count = turn.hasFailed ? pilot.count : pilot.count + 1
      let why = turn.hasFailed
        ? 'a command of the preview failed'
        : target !== null && commitsStep(open?.commands ?? [], target)
          ? `${target} is committed`
          : count >= pilot.max
            ? `${count} of ${pilot.max} commits ran`
            : undefined
      if (why === undefined && target === null && current) {
        const isReached = await hasReached($, current)
        why = isReached ? `${pilot.id} reached its checkpoint` : isReached === undefined ? 'opsboard --tsv could not be read' : undefined
      }
      pilot = why ? null : { ...pilot, count }
      await $.state.set(AUTOPILOT, pilot)
      if (why) {
        $.ui.toast(`Autopilot off: ${why}.`, { timeoutMs: 15000 })
      }
    }
    if (current && isDone) {
      restart($, current.id, pilot ? [turn.note, UNDER_AUTOPILOT].filter(n => n !== '').join('; ') : turn.note)
    } else if (pilot && current?.id === pilot.id && shown.length > 0 && e.reason === 'answer') {
      // A new preview under autopilot: approve it, or say why it waits for the operator.
      const why = autopilotWaits(e.answer, shown)
      if (why) {
        $.ui.toast(`Autopilot waits for your approve: ${why}.`, { timeoutMs: 15000 })
      } else {
        approved = { note: '', writes: 0, hasFailed: false }
        submitAsPerson($, 'approve')
      }
    } else if (isDone && (await workspaceRoot($, await $.session.cwd()))) {
      $.ui.toast('No restart: this conversation was not started with /session <ID>.', { timeoutMs: 15000 })
    } else if (current && turn?.note) {
      $.ui.toast(`No restart, so your note was not passed on: "${turn.note}"`, { timeoutMs: 15000 })
    }

    return next(e)
  })
}
