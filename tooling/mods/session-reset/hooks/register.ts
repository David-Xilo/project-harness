import type { EngineInterface, Register } from 'claude-code'

import type { SessionResetPreview, SessionResetSession } from '../types'
import { judge, normalize, parseAliases, previewCommands, setAliases } from './git'

// The workspace session and the open preview, kept by the host so a hot reload keeps them.
const SESSION = { plugin: 'session-reset', key: 'session' } as const
const PREVIEW = { plugin: 'session-reset', key: 'preview' } as const

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
const REVIEWED = /^[\s>*_-]*Review[*_]*:[*_]*[ \t]*[^\s*_]/im

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

// A value from the tooling config, by the rules of `sp-config`: KEY=value lines in
// ${XDG_CONFIG_HOME:-~/.config}/super-project/config, # comments, the last line wins, a
// leading ~ expands, and a missing file or key gives the default.
async function config($: EngineInterface, key: 'ROOTS'): Promise<string> {
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
  const defaults = { ROOTS: `${dir}/roots` }

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
    ]
    for (const command of commands) {
      try {
        await $.command.register({ ...command, argumentHint: '[note]' })
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

  on('command.run', { command: 'session' }, async ($, e, next) => {
    const id = e.args.trim().split(/\s+/)[0] ?? ''
    const root = SESSION_ID.test(id) ? await workspaceRoot($, await $.session.cwd()) : undefined
    if (root) {
      await $.state.set(SESSION, { id, root })
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

    return next(e)
  })

  on('command.run', { command: 'committed' }, async ($, e) => {
    const current = await session($)
    if (!current) {
      return { text: 'No /session ID in this session, so there is nothing to restart.' }
    }
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
    if (current && isDone) {
      restart($, current.id, turn.note)
    } else if (isDone && (await workspaceRoot($, await $.session.cwd()))) {
      $.ui.toast('No restart: this conversation was not started with /session <ID>.', { timeoutMs: 15000 })
    } else if (current && turn?.note) {
      $.ui.toast(`No restart, so your note was not passed on: "${turn.note}"`, { timeoutMs: 15000 })
    }

    return next(e)
  })
}
