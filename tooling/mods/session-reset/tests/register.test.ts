import { describe, expect, mock, test, type Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

// A workspace root listed in the opsboard roots, where /session <ID> is a workspace session.
const HOME = '/home/op'
const ROOT = '/work/acme'
const COMPOSER = { kind: 'composer' } as const

const PREVIEW_ANSWER = ['Ready to commit', '', 'Review: docs only, reread', '', '```', 'git add docs/plan.md', 'git commit -m "docs: plan"', '```'].join('\n')

type World = {
  runs: (readonly string[])[]
  toasts: string[]
  commands: string[]
  // What the mod submitted as the person's words.
  prompts: string[]
  state: Map<string, unknown>
  // The files the mod wrote, by path.
  written: Map<string, string>
  setBoard: (text: string) => void
  settle: () => Promise<void>
}

type Options = {
  alias?: { exitCode: number; stdout: string }
  // The files the mod reads; by default every read answers the roots file.
  files?: Record<string, string>
  // The state as saved before the mod loads.
  saved?: Record<string, unknown>
  // What `opsboard --tsv` prints.
  board?: string
  // Commands whose run prints a git error.
  fails?: string[]
  // The mod's own /clear is refused, as when a dialog holds the screen.
  refuseClear?: boolean
}

// The world beneath the mod: state, the alias lookup and opsboard, the files it reads, and
// the bottom of the command, prompt, tool and turn chains.
function world(on: On, options: Options = {}): World {
  const { alias = { exitCode: 0, stdout: "alias gp='git push'\n" }, files, saved = {}, fails = [], refuseClear } = options
  let board = options.board ?? ''
  const runs: (readonly string[])[] = []
  const toasts: string[] = []
  const commands: string[] = []
  const prompts: string[] = []
  const written = new Map<string, string>()
  const state = new Map<string, unknown>(Object.entries(saved))
  const clock = mock.clock(on)
  mock.env(on, { HOME })
  on('state.get', ($, e) => ({ value: { value: state.get(e.key), version: 0 } }))
  on('state.set', ($, e) => {
    state.set(e.key, e.value)
    return { value: { isSet: true, version: 0 } }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('process.run', ($, e) => {
    runs.push(e.argv)
    const out = e.argv[0]?.endsWith('/opsboard') ? { exitCode: 0, stdout: board } : alias
    return { value: { ...out, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('fs.read', ($, e) => {
    // What the mod wrote reads back; a state file it has not written is missing.
    const text = written.get(e.path) ?? (e.path.includes('/.local/state/') ? undefined : files ? (files[e.path] ?? '') : `${ROOT}\n`)
    if (text === undefined) {
      throw new Error(`ENOENT: ${e.path}`)
    }
    return { value: text }
  })
  on('fs.write', ($, e) => {
    written.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.exists', ($, e) => ({ value: written.has(e.path) || !e.path.includes('/.local/state/') }))
  on('session.cwd', () => ({ value: ROOT }))
  on('session.id', () => ({ value: 'claude-1' }))
  on('prompt.fill', () => ({ isFilled: true }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('command.run', ($, e) => {
    if (refuseClear && e.command === 'clear' && e.origin.kind === 'plugin') {
      throw new Error('busy')
    }
    commands.push(e.args ? `/${e.command} ${e.args}` : `/${e.command}`)
    // A /clear starts a new host session, whose state starts empty.
    if (e.command === 'clear') {
      state.clear()
    }
    return { text: '' }
  })
  on('prompt.submit', ($, e) => {
    prompts.push(e.text)
    return { text: e.text, context: e.context }
  })
  on('tool.call', ($, e) => {
    const text = 'command' in e && typeof e.command === 'string' && fails.includes(e.command) ? 'error: failed' : ''
    return { result: { stdout: text, stderr: '', interrupted: false }, text }
  })
  on('turn.complete', ($, e) => ({ text: e.answer }))

  return { runs, toasts, commands, prompts, state, written, setBoard: text => (board = text), settle: () => clock.settle() }
}

const bash = (command: string) => ({ tool: 'Bash', command, description: '' }) as const
const turn = (answer: string) => ({ answer, reason: 'answer', durationMs: 1, isAborted: false, turnId: 't' }) as const
const start = { cwd: ROOT, surface: 'terminal', isInteractive: true } as const
const typed = (command: string, args = '') =>
  ({ command, args, origin: COMPOSER, presentation: { isFullscreen: false, columns: 80 } }) as const
// A preview that commits one step, reviewed clean unless told otherwise.
const stepPreview = (step: string, review = 'Review: code-review, 1 finding, fixed', more: string[] = []) =>
  ['Ready to commit', '', review, '', '```', 'git add src/a.ts', `git commit -m "${step}: a step"`, ...more, '```'].join('\n')
const PILOT_FILE = `${HOME}/.local/state/super-project/autopilot/_work_acme__S1.tsv`
const LOG_FILE = `${HOME}/.local/state/super-project/session-reset/claude-1.jsonl`
// The log's entries, each reduced to its event and the fields named.
const logged = (w: World, ...fields: string[]) =>
  (w.written.get(LOG_FILE) ?? '')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as Record<string, unknown>)
    .map(entry => Object.fromEntries(['event', ...fields].filter(f => f in entry).map(f => [f, entry[f]])))
// The restart note under autopilot with a target.
const piloting = (step: string) => `under autopilot until ${step} is done (the preview that finishes it says "Step done: ${step}")`
const REACHED = `status\t${ROOT}\tcheckpoint\t\`S1\`\treached\n`

describe('session start', () => {
  // Regression, 2026-10-07: a bare `zsh -ic` took the terminal for job control while
  // .zshrc loaded, and terminal input in that window stopped Claude at launch (state T).
  test('reads the zsh aliases with no terminal, and gates a git alias', async ($, on) => {
    const w = world(on)
    await $.session.start(start)

    expect(w.runs).toEqual([['setsid', '-w', 'zsh', '-ic', 'alias -L']])
    const gp = await $.tool.call(bash('gp'))
    expect(gp.deny).toContain('operator approves a preview')
  })

  test('warns when the aliases cannot be read', async ($, on) => {
    const w = world(on, { alias: { exitCode: 1, stdout: '' } })
    await $.session.start(start)

    expect(w.toasts).toEqual([expect.stringContaining('could not read the zsh aliases')])
  })
})

describe('approve gate', () => {
  test('lets git reads run, blocks writes with no approved preview, and never runs a forbidden one', async ($, on) => {
    world(on)
    await $.session.start(start)

    expect((await $.tool.call(bash('git status'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('git commit -m "docs: x"'))).deny).toContain('operator approves a preview')
    expect((await $.tool.call(bash('git push --force'))).deny).toContain('never run')
    expect((await $.tool.call(bash('gh-harden acme/x'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('gh-harden acme/x --apply'))).deny).toContain('operator approves a preview')
  })

  test('an approve with a condition is not an approval', async ($, on) => {
    world(on)
    await $.session.start(start)
    await $.turn.complete(turn(PREVIEW_ANSWER))

    const held = await $.prompt.submit({ text: "approve, but don't push", wait: false, origin: COMPOSER })
    expect(held.context?.join('\n')).toContain('not an approval')
    expect((await $.tool.call(bash('git add docs/plan.md'))).deny).toContain('not an approval')
  })

  test('an approve of a preview with no Review: line is held, typed or by /approve', async ($, on) => {
    world(on)
    await $.session.start(start)
    await $.turn.complete(turn(PREVIEW_ANSWER.replace('Review: docs only, reread', 'Reviewed by hand.')))

    const typed = await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })
    expect(typed.context?.join('\n')).toContain('no Review: line')
    expect((await $.tool.call(bash('git add docs/plan.md'))).deny).toContain('no Review: line')

    const ran = await $.command.run({ command: 'approve', args: '', origin: COMPOSER, presentation: { isFullscreen: false, columns: 80 } })
    expect(ran.text).toContain('Held')
    expect((await $.tool.call(bash('git add docs/plan.md'))).deny).toContain('no Review: line')

    // A bold label with nothing after it is no review.
    await $.turn.complete(turn(PREVIEW_ANSWER.replace('Review: docs only, reread', '- **Review:**')))
    await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })
    expect((await $.tool.call(bash('git add docs/plan.md'))).deny).toContain('no Review: line')

    await $.turn.complete(turn(PREVIEW_ANSWER))
    await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })
    expect((await $.tool.call(bash('git add docs/plan.md'))).deny).toBeUndefined()
  })

  test('runs the approved preview, then restarts the workspace session with the note', async ($, on) => {
    const w = world(on)
    await $.session.start(start)
    await $.command.run({ command: 'session', args: 'S1', origin: COMPOSER, presentation: { isFullscreen: false, columns: 80 } })
    await $.turn.complete(turn(PREVIEW_ANSWER))

    const sent = await $.prompt.submit({ text: 'approve, go A.4', wait: false, origin: COMPOSER })
    expect(sent.text).toBe('approve')
    expect((await $.tool.call(bash('git add docs/plan.md'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('git commit -m "docs: plan"'))).deny).toBeUndefined()
    await $.turn.complete(turn('Committed.'))
    await w.settle()

    expect(w.commands).toEqual(['/session S1', '/clear', '/session S1 go A.4'])
    // The approve covered that turn only.
    expect((await $.tool.call(bash('git push'))).deny).toContain('operator approves a preview')
    expect(logged(w, 'via', 'command', 'matched', 'restart', 'args')).toEqual([
      { event: 'preview' },
      { event: 'approve', via: 'typed' },
      { event: 'command', command: 'git add docs/plan.md', matched: 1 },
      { event: 'command', command: 'git commit -m "docs: plan"', matched: 1 },
      { event: 'turn', restart: true },
      { event: 'restart', args: 'S1 go A.4' },
      { event: 'command', command: 'git push' },
    ])
  })

  // 2026-10-13: a checkpoint's "Preview: switch to the release branches" was no Ready to
  // commit preview, so its approved switches were refused.
  test("the operator's approve runs any preview's git writes, and restarts only after a commit", async ($, on) => {
    const w = world(on)
    await $.session.start(start)
    await $.command.run(typed('session', 'CP2'))
    const answer = ['Preview: switch to the release branches', '', '```sh', 'git -C a switch -c release/cp2 abc # approved', '```'].join('\n')
    await $.turn.complete(turn(answer))

    // No commit, so no Review: line is needed.
    expect((await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })).context).toBeUndefined()
    expect((await $.tool.call(bash('git -C a switch -c release/cp2 abc # approved'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('git -C b switch -c release/cp2 def # approved'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('git push --force'))).deny).toContain('never run')
    await $.turn.complete(turn('Switched.'))
    await w.settle()
    expect(w.commands).toEqual(['/session CP2'])

    await $.turn.complete(turn(PREVIEW_ANSWER))
    await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })
    expect((await $.tool.call(bash('git add docs/plan.md docs/other.md'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('git commit -m "docs: plan"'))).deny).toBeUndefined()
    await $.turn.complete(turn('Committed.'))
    await w.settle()
    expect(w.commands).toEqual(['/session CP2', '/clear', '/session CP2'])
  })

  test('an approve needs a preview, and an unshown commit needs its Review: line', async ($, on) => {
    world(on)
    await $.session.start(start)

    // No preview open: an approve lets nothing run.
    await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })
    expect((await $.tool.call(bash('git push'))).deny).toContain('operator approves a preview')

    // A code block in an answer that names no preview is none.
    await $.turn.complete(turn(['You could run:', '```', 'git push origin development', '```'].join('\n')))
    await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })
    expect((await $.tool.call(bash('git push origin development'))).deny).toContain('operator approves a preview')

    // A preview with no commit and no Review: line: its approve lets no commit run.
    await $.turn.complete(turn(['Preview: tag the release', '', '```', 'git tag -s v1 -m "after git commit"', '```'].join('\n')))
    expect((await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })).context).toBeUndefined()
    expect((await $.tool.call(bash('git tag -s v1 -m "after git commit"'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('git -C "a b" --no-pager commit -m "x"'))).deny).toContain('not in the approved preview')
  })

  test('an answer with no preview closes the open one, and /approve then says so', async ($, on) => {
    world(on)
    await $.session.start(start)
    await $.turn.complete(turn(PREVIEW_ANSWER))
    await $.turn.complete(turn('Approach A keeps the parser; B rewrites it. Which one?'))

    await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })
    expect((await $.tool.call(bash('git push'))).deny).toContain('operator approves a preview')
    expect((await $.command.run(typed('approve'))).text).toBe('No preview is open: nothing to approve.')
  })

  test('a corrected command stands in for the preview\'s, but never skips a commit', async ($, on) => {
    const w = world(on)
    await $.session.start(start)
    await $.command.run(typed('session', 'S1'))
    await $.turn.complete(turn(PREVIEW_ANSWER))
    await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })
    // A corrected message for the preview's commit.
    expect((await $.tool.call(bash('git add docs/plan.md'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('git commit -m "docs: the plan"'))).deny).toBeUndefined()
    await $.turn.complete(turn('Committed.'))
    await w.settle()
    expect(w.commands).toEqual(['/session S1', '/clear', '/session S1'])

    // The push run first does not count the commit before it as done.
    const answer = ['Ready to commit', 'Review: docs only, reread', '```', 'git add docs/plan.md', 'git commit -m "docs: plan"', 'git push', '```'].join('\n')
    await $.turn.complete(turn(answer))
    await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })
    expect((await $.tool.call(bash('git push'))).deny).toBeUndefined()
    await $.turn.complete(turn('Pushed.'))
    await w.settle()
    expect(w.commands).toEqual(['/session S1', '/clear', '/session S1'])
    expect(w.state.get('preview')).toMatchObject({ next: 0 })
  })

  test('no restart until every command of the preview ran', async ($, on) => {
    const w = world(on)
    await $.session.start(start)
    await $.command.run(typed('session', 'S1'))
    await $.turn.complete(turn(['Ready to commit', 'Review: docs only, reread', '```', 'git add docs/plan.md', 'git commit -m "docs: plan"', 'git push', '```'].join('\n')))
    await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })
    await $.tool.call(bash('git add docs/plan.md'))
    await $.tool.call(bash('git commit -m "docs: plan"'))
    await $.turn.complete(turn('Committed.'))
    await w.settle()

    expect(w.commands).toEqual(['/session S1'])
    expect(w.toasts.at(-1)).toContain('not every command of the preview ran')
  })

  // Regression, 2026-10-11: a commit message in its own code block names git, and was
  // taken for the preview's first command, so the approved `git add` was refused.
  test('a code block that only names git is not a command', async ($, on) => {
    world(on)
    await $.session.start(start)
    const answer = [
      'Ready to commit', '', '```', ' M docs/plan.md', '```', '', '- **Review:** docs only, reread', '', '', '```', 'PUB-1.5: docs and the shipped git rules', '```', '',
      '```', 'git add docs/plan.md', 'git commit -m "PUB-1.5: docs and the shipped git rules"', '```',
    ].join('\n')
    await $.turn.complete(turn(answer))
    await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })

    expect((await $.tool.call(bash('git add docs/plan.md'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('git commit -m "PUB-1.5: docs and the shipped git rules"'))).deny).toBeUndefined()
  })

  // Regression, 2026-10-11: a note with an apostrophe ("the operator's approve") in the
  // commands' code block opened a quote that joined every line after it, the commands too,
  // so the approved push was refused.
  test('an unclosed quote outside a command does not join the lines after it', async ($, on) => {
    world(on)
    await $.session.start(start)
    const answer = [
      'Ready to commit', 'Review: code-review, no findings', '', '```', "Runs after the operator's approve.", 'git add docs/plan.md', 'git push origin development', '```',
    ].join('\n')
    await $.turn.complete(turn(answer))
    await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })

    expect((await $.tool.call(bash('git add docs/plan.md'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('git push origin development'))).deny).toBeUndefined()
  })

  test('a preview saved before the Review: check is held', async ($, on) => {
    world(on, { saved: { preview: { commands: ['git commit -m "docs: plan"'], next: 0, at: 0 } } })
    await $.session.start(start)

    await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })
    expect((await $.tool.call(bash('git commit -m "docs: plan"'))).deny).toContain('no Review: line')
  })
})

describe('roots', () => {
  test('reads the roots file the config names, and ignores the default one', async ($, on) => {
    const config = `${HOME}/.config/super-project/config`
    const w = world(on, { files: { [config]: '# mine\nROOTS = ~/work/roots\n', [`${HOME}/work/roots`]: `${ROOT}\n` } })
    await $.session.start(start)
    await $.command.run({ command: 'session', args: 'S1', origin: COMPOSER, presentation: { isFullscreen: false, columns: 80 } })
    await $.prompt.submit({ text: 'committed', wait: false, origin: COMPOSER })
    await w.settle()

    expect(w.commands).toEqual(['/session S1', '/clear', '/session S1'])
  })

  test('with no config, reads the default roots file', async ($, on) => {
    const w = world(on, { files: { [`${HOME}/.config/super-project/roots`]: `${ROOT}\n` } })
    await $.session.start(start)
    await $.command.run({ command: 'session', args: 'S1', origin: COMPOSER, presentation: { isFullscreen: false, columns: 80 } })
    await $.prompt.submit({ text: 'committed', wait: false, origin: COMPOSER })
    await w.settle()

    expect(w.commands).toEqual(['/session S1', '/clear', '/session S1'])
  })

  test('a root missing from the roots file is not a workspace', async ($, on) => {
    const w = world(on, { files: { [`${HOME}/.config/super-project/roots`]: '/elsewhere\n' } })
    await $.session.start(start)
    await $.command.run({ command: 'session', args: 'S1', origin: COMPOSER, presentation: { isFullscreen: false, columns: 80 } })
    await $.prompt.submit({ text: 'committed', wait: false, origin: COMPOSER })
    await w.settle()

    expect(w.commands).toEqual(['/session S1'])
  })
})

describe('committed', () => {
  test('"committed, <note>" restarts the workspace session with the note', async ($, on) => {
    const w = world(on)
    await $.session.start(start)
    await $.command.run({ command: 'session', args: 'S1', origin: COMPOSER, presentation: { isFullscreen: false, columns: 80 } })

    const sent = await $.prompt.submit({ text: 'committed, next step', wait: false, origin: COMPOSER })
    await w.settle()

    expect(sent.drop).toContain('Committed')
    expect(w.commands).toEqual(['/session S1', '/clear', '/session S1 next step'])
  })
})

describe('autopilot', () => {
  // The session S1 on /autopilot with these arguments, its first prompt sent.
  async function piloted($: Engine, w: World, args: string) {
    await $.session.start(start)
    await $.command.run(typed('session', 'S1'))
    const ran = await $.command.run(typed('autopilot', args))
    await w.settle()
    return ran
  }
  // Runs the approved step preview and ends its turn.
  async function commitStep($: Engine, w: World, step: string) {
    await $.tool.call(bash('git add src/a.ts'))
    await $.tool.call(bash(`git commit -m "${step}: a step"`))
    await $.turn.complete(turn('Committed.'))
    await w.settle()
  }

  test('approves a clean preview itself, and restarts the session under autopilot', async ($, on) => {
    const w = world(on)
    expect((await piloted($, w, 'PAY-1.3')).text).toBe('Autopilot on: 0/100 → PAY-1.3')
    expect(w.prompts).toEqual([expect.stringContaining('Autopilot is on')])

    await $.turn.complete(turn(stepPreview('PAY-1.1')))
    await w.settle()
    expect(w.prompts.at(-1)).toBe('approve')
    expect((await $.tool.call(bash('git add src/a.ts'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('git commit -m "PAY-1.1: a step"'))).deny).toBeUndefined()
    await $.turn.complete(turn('Committed.'))
    await w.settle()

    // The session and autopilot outlive the /clear, which starts a new host session.
    expect(w.commands.at(-1)).toBe(`/session S1 ${piloting('PAY-1.3')}`)
    expect(w.state.get('session')).toEqual({ id: 'S1', root: ROOT })
    expect(w.state.get('autopilot')).toEqual({ id: 'S1', root: ROOT, target: 'PAY-1.3', max: 100, count: 1, waiting: null })
    expect(w.written.get(PILOT_FILE)).toBe(`${ROOT}\tS1\tPAY-1.3\t1\t100\t\n`)

    // Findings kept with their reason are settled too; autopilot's approve runs only the
    // preview's commands, in order.
    const prompts = w.prompts.length
    const review = 'Review: code-review, 20 findings: 14 fixed, 2 moot (not reachable), 4 kept as documented limits (2 fixed upstream)'
    await $.turn.complete(turn(stepPreview('PAY-1.2', review)))
    await w.settle()
    expect(w.prompts.slice(prompts)).toEqual(['approve'])
    expect((await $.tool.call(bash('git push'))).deny).toContain('next: git add src/a.ts')
  })

  test('leaves to the operator a preview with an open finding, or one that pushes or amends', async ($, on) => {
    const w = world(on)
    await piloted($, w, 'PAY-1.3')

    const open = [
      'Review: code-review, 2 findings, 1 fixed', 'Review: 3 findings, fixed 2', 'Review: none',
      'Review: 9 findings, 5 fixed, 3 kept', 'Review: 2 findings, 1 fixed, 1 left open',
      'Review: 1 finding, 0 fixed', "Review: 1 finding, wasn't fixed", 'Review: 3 findings, all kept',
    ]
    for (const review of open) {
      await $.turn.complete(turn(stepPreview('PAY-1.1', review)))
    }
    await $.turn.complete(turn(stepPreview('PAY-1.1', 'Review: no findings', ['git push'])))
    await $.turn.complete(turn(stepPreview('PAY-1.1', 'Review: docs only, reread', ['git commit --amend --no-edit'])))
    await w.settle()

    expect(w.prompts).toHaveLength(1)
    expect(w.toasts).toEqual([
      ...Array(open.length).fill(expect.stringContaining('leaves a finding open')),
      ...Array(2).fill(expect.stringContaining('more than a plain git add')),
    ])
    expect((await $.tool.call(bash('git add src/a.ts'))).deny).toContain('operator approves a preview')
    expect(w.written.get(PILOT_FILE)).toBe(`${ROOT}\tS1\tPAY-1.3\t0\t100\tyour approve\n`)

    // A question waits for an answer; the operator's reply clears it.
    await $.turn.complete(turn('Integer cents or decimal strings?'))
    expect(w.written.get(PILOT_FILE)).toContain('\tan answer\n')
    await $.prompt.submit({ text: '1', wait: false, origin: COMPOSER })
    expect(w.written.get(PILOT_FILE)).toBe(`${ROOT}\tS1\tPAY-1.3\t0\t100\t\n`)
  })

  test('counts only commits: a switch batch the operator approves leaves the count', async ($, on) => {
    const w = world(on)
    await piloted($, w, 'PAY-1.3 --max 1')
    await $.turn.complete(turn(['Preview: switch to the release branch', '```', 'git switch release/cp1 # approved', '```'].join('\n')))
    await w.settle()
    await $.prompt.submit({ text: 'approve', wait: false, origin: COMPOSER })
    expect((await $.tool.call(bash('git switch release/cp1 # approved'))).deny).toBeUndefined()
    await $.turn.complete(turn('Switched.'))
    await w.settle()

    expect(w.state.get('autopilot')).toMatchObject({ count: 0, max: 1, waiting: null })
    expect(w.toasts).toEqual([expect.stringContaining('no Ready to commit preview')])
  })

  test('stops after the commit that finishes its target step', async ($, on) => {
    const w = world(on)
    await piloted($, w, 'PAY-1.1')
    // A slice of the step: autopilot goes on.
    await $.turn.complete(turn(stepPreview('PAY-1.1')))
    await w.settle()
    await commitStep($, w, 'PAY-1.1')
    expect(w.commands.at(-1)).toBe(`/session S1 ${piloting('PAY-1.1')}`)

    await $.turn.complete(turn(`${stepPreview('PAY-1.1')}\n\n- **Step done:** PAY-1.1`))
    await w.settle()
    await commitStep($, w, 'PAY-1.1')

    expect(w.toasts).toEqual([expect.stringContaining('PAY-1.1 is done')])
    expect(w.commands.at(-1)).toBe('/session S1 autopilot is off (PAY-1.1 is done): name your next step and wait for me')
    expect(w.written.get(PILOT_FILE)).toBe('')
  })

  test('with no step, stops once the session reaches its checkpoint, and will not start past it', async ($, on) => {
    const w = world(on)
    await piloted($, w, '')
    await $.turn.complete(turn(stepPreview('PAY-1.1')))
    await w.settle()
    w.setBoard(REACHED)
    await commitStep($, w, 'PAY-1.1')

    expect(w.toasts).toEqual([expect.stringContaining('S1 reached its checkpoint')])
    expect(w.written.get(PILOT_FILE)).toBe('')
    expect((await $.command.run(typed('autopilot'))).text).toContain('already reached')
  })

  test('stops on a failed command, after --max commits, and on the person\'s /clear', async ($, on) => {
    const w = world(on, { fails: ['git commit -m "PAY-1.1: a step"'] })
    await piloted($, w, 'PAY-1.3 --max 1')
    await $.turn.complete(turn(stepPreview('PAY-1.1')))
    await w.settle()
    await commitStep($, w, 'PAY-1.1')
    expect(w.toasts.at(-1)).toContain('failed')
    expect(w.state.get('autopilot')).toBeNull()
    expect(logged(w, 'failed', 'why', 'off').filter(l => l.event !== 'command' || l.failed !== undefined)).toEqual([
      { event: 'preview' },
      { event: 'autopilot' },
      { event: 'command', failed: 'error: failed' },
      { event: 'turn', why: 'a command failed' },
      { event: 'autopilot', off: 'a command of the preview failed' },
    ])

    await $.command.run(typed('autopilot', 'PAY-1.3 --max 1'))
    await $.turn.complete(turn(stepPreview('PAY-1.2')))
    await w.settle()
    await commitStep($, w, 'PAY-1.2')
    expect(w.toasts.at(-1)).toContain('1 of 1 commits ran')
    expect(w.commands.at(-1)).toBe('/session S1 autopilot is off (1 of 1 commits ran): name your next step and wait for me')

    await $.command.run(typed('autopilot', 'PAY-1.3'))
    await $.command.run(typed('clear'))
    expect(w.written.get(PILOT_FILE)).toBe('')
  })

  test('a refused /clear: the person\'s /clear carries the session and autopilot as they stand', async ($, on) => {
    const w = world(on, { refuseClear: true })
    await piloted($, w, 'PAY-1.3')
    await $.turn.complete(turn(stepPreview('PAY-1.1')))
    await w.settle()
    await commitStep($, w, 'PAY-1.1')
    expect(w.toasts.at(-1)).toContain('could not run /clear')

    await $.command.run(typed('clear'))
    await w.settle()
    expect(w.commands.at(-1)).toBe(`/session S1 ${piloting('PAY-1.3')}`)
    expect(w.state.get('session')).toEqual({ id: 'S1', root: ROOT })
    expect(w.state.get('autopilot')).toMatchObject({ id: 'S1', count: 1 })

    // Turned off before the person's /clear, autopilot stays off.
    await $.turn.complete(turn(stepPreview('PAY-1.2')))
    await w.settle()
    await commitStep($, w, 'PAY-1.2')
    await $.command.run(typed('autopilot', 'off'))
    await $.command.run(typed('clear'))
    await w.settle()
    expect(w.commands.at(-1)).toBe(`/session S1 ${piloting('PAY-1.3')}`)
    expect(w.state.get('autopilot')).toBeUndefined()
  })

  test('ends with the process, and its state file is emptied', async ($, on) => {
    const w = world(on)
    await piloted($, w, 'PAY-1.3')
    expect(w.written.get(PILOT_FILE)).toBe(`${ROOT}\tS1\tPAY-1.3\t0\t100\t\n`)
    await $.session.end({ reason: 'prompt_input_exit', sessionId: 's', resume: { id: 's' } })

    expect(w.state.get('autopilot')).toBeNull()
    expect(w.written.get(PILOT_FILE)).toBe('')
  })

  test('ends when the operator commits by hand', async ($, on) => {
    const w = world(on)
    await piloted($, w, 'PAY-1.3')
    await $.prompt.submit({ text: 'committed', wait: false, origin: COMPOSER })
    await w.settle()

    expect(w.toasts).toEqual([expect.stringContaining('committed by hand')])
    expect(w.commands.at(-1)).toBe('/session S1')
    expect(w.written.get(PILOT_FILE)).toBe('')
  })

  test('/autopilot needs a workspace session and a valid target', async ($, on) => {
    world(on)
    await $.session.start(start)
    expect((await $.command.run(typed('autopilot'))).text).toContain('/session <ID> first')
    await $.command.run(typed('session', 'S1'))
    expect((await $.command.run(typed('autopilot', 'soon'))).text).toContain('Usage')
    expect((await $.command.run(typed('autopilot', 'off'))).text).toBe('Autopilot was not on.')
  })
})
