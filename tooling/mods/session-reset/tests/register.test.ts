import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

// A workspace root listed in the opsboard roots, where /session <ID> is a workspace session.
const HOME = '/home/op'
const ROOT = '/work/acme'
const COMPOSER = { kind: 'composer' } as const

const PREVIEW_ANSWER = ['Ready to commit', '', '```', 'git add docs/plan.md', 'git commit -m "docs: plan"', '```'].join('\n')

type World = {
  runs: (readonly string[])[]
  toasts: string[]
  commands: string[]
  settle: () => Promise<void>
}

// The world beneath the mod: state, the alias lookup, the files it reads (by default every
// read answers the roots file), and the bottom of the command, prompt, tool and turn chains.
function world(on: On, alias = { exitCode: 0, stdout: "alias gp='git push'\n" }, files?: Record<string, string>): World {
  const runs: (readonly string[])[] = []
  const toasts: string[] = []
  const commands: string[] = []
  const state = new Map<string, unknown>()
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
    return { value: { ...alias, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('fs.read', ($, e) => ({ value: files ? (files[e.path] ?? '') : `${ROOT}\n` }))
  on('session.cwd', () => ({ value: ROOT }))
  on('prompt.fill', () => ({ isFilled: true }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.run', ($, e) => {
    commands.push(e.args ? `/${e.command} ${e.args}` : `/${e.command}`)
    return { text: '' }
  })
  on('prompt.submit', ($, e) => ({ text: e.text, context: e.context }))
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false }, text: '' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  return { runs, toasts, commands, settle: () => clock.settle() }
}

const bash = (command: string) => ({ tool: 'Bash', command, description: '' }) as const
const turn = (answer: string) => ({ answer, reason: 'answer', durationMs: 1, isAborted: false, turnId: 't' }) as const
const start = { cwd: ROOT, surface: 'terminal', isInteractive: true } as const

describe('session start', () => {
  // Regression, 2026-10-07: a bare `zsh -ic` took the terminal for job control while
  // .zshrc loaded, and terminal input in that window stopped Claude at launch (state T).
  test('reads the zsh aliases with no terminal, and gates a git alias', async ($, on) => {
    const w = world(on)
    await $.session.start(start)

    expect(w.runs).toEqual([['setsid', '-w', 'zsh', '-ic', 'alias -L']])
    const gp = await $.tool.call(bash('gp'))
    expect(gp.deny).toContain('approved Ready to commit preview')
  })

  test('warns when the aliases cannot be read', async ($, on) => {
    const w = world(on, { exitCode: 1, stdout: '' })
    await $.session.start(start)

    expect(w.toasts).toEqual([expect.stringContaining('could not read the zsh aliases')])
  })
})

describe('approve gate', () => {
  test('lets git reads run, blocks writes with no approved preview, and never runs a forbidden one', async ($, on) => {
    world(on)
    await $.session.start(start)

    expect((await $.tool.call(bash('git status'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('git commit -m "docs: x"'))).deny).toContain('approved Ready to commit preview')
    expect((await $.tool.call(bash('git push --force'))).deny).toContain('never run')
    expect((await $.tool.call(bash('gh-harden acme/x'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('gh-harden acme/x --apply'))).deny).toContain('approved Ready to commit preview')
  })

  test('an approve with a condition is not an approval', async ($, on) => {
    world(on)
    await $.session.start(start)
    await $.turn.complete(turn(PREVIEW_ANSWER))

    const held = await $.prompt.submit({ text: "approve, but don't push", wait: false, origin: COMPOSER })
    expect(held.context?.join('\n')).toContain('not an approval')
    expect((await $.tool.call(bash('git add docs/plan.md'))).deny).toContain('not an approval')
  })

  test('runs the approved preview in order, then restarts the workspace session with the note', async ($, on) => {
    const w = world(on)
    await $.session.start(start)
    await $.command.run({ command: 'session', args: 'S1', origin: COMPOSER, presentation: { isFullscreen: false, columns: 80 } })
    await $.turn.complete(turn(PREVIEW_ANSWER))

    const sent = await $.prompt.submit({ text: 'approve, go A.4', wait: false, origin: COMPOSER })
    expect(sent.text).toBe('approve')
    expect((await $.tool.call(bash('git commit -m "docs: plan"'))).deny).toContain('next: git add docs/plan.md')
    expect((await $.tool.call(bash('git add docs/plan.md'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('git commit -m "docs: plan"'))).deny).toBeUndefined()
    await $.turn.complete(turn('Committed.'))
    await w.settle()

    expect(w.commands).toEqual(['/session S1', '/clear', '/session S1 go A.4'])
  })
})

describe('roots', () => {
  test('reads the roots file the config names, and ignores the default one', async ($, on) => {
    const config = `${HOME}/.config/super-project/config`
    const w = world(on, undefined, { [config]: '# mine\nROOTS = ~/work/roots\n', [`${HOME}/work/roots`]: `${ROOT}\n` })
    await $.session.start(start)
    await $.command.run({ command: 'session', args: 'S1', origin: COMPOSER, presentation: { isFullscreen: false, columns: 80 } })
    await $.prompt.submit({ text: 'committed', wait: false, origin: COMPOSER })
    await w.settle()

    expect(w.commands).toEqual(['/session S1', '/clear', '/session S1'])
  })

  test('with no config, reads the default roots file', async ($, on) => {
    const w = world(on, undefined, { [`${HOME}/.config/super-project/roots`]: `${ROOT}\n` })
    await $.session.start(start)
    await $.command.run({ command: 'session', args: 'S1', origin: COMPOSER, presentation: { isFullscreen: false, columns: 80 } })
    await $.prompt.submit({ text: 'committed', wait: false, origin: COMPOSER })
    await w.settle()

    expect(w.commands).toEqual(['/session S1', '/clear', '/session S1'])
  })

  test('a root missing from the roots file is not a workspace', async ($, on) => {
    const w = world(on, undefined, { [`${HOME}/.config/super-project/roots`]: '/elsewhere\n' })
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
