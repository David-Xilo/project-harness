import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

// A workspace root with two sessions: S1 writes acme-api, S2 runs the stack.
const HOME = '/home/op'
const ROOT = '/work/acme'
const PLAN = [
  '| Code | Module | Owns | Track |',
  '|---|---|---|---|',
  '| API | [Public API](acme-api/plan.md) | the API | T1 |',
  '',
  '| Session | Tracks | Only writer of |',
  '|---|---|---|',
  '| `S1` **API** | T1 | `acme-api` |',
  '| `S2` **Stack** | T2 | `acme-stack` |',
  '',
  '### Session IDs',
  '',
  '- **Shared files:** its rows in handoffs.md; `S2` owns stack.md.',
  '',
].join('\n')
const RUNTIME = {
  runtime: {
    scripts: ['stackctl.sh'],
    runners: '^(?:S2|CP\\d+)$',
    free: ['status'],
    dockerFree: ['ps'],
    cite: 'plan.md "The stack"',
    commitFirst: { build: ['acme-api', 'acme-stack'] },
  },
}

type World = { runs: (readonly string[])[]; toasts: string[] }

// The world beneath the mod: the session-reset state (session ID, open preview), the files
// it reads, and git status per repository (dirty lists the dirty ones).
function world(on: On, opts: { id: string; workspace?: unknown; dirty?: string[]; isPreviewOpen?: boolean }): World {
  const runs: (readonly string[])[] = []
  const toasts: string[] = []
  const files: Record<string, string> = {
    [`${HOME}/.config/super-project/roots`]: `${ROOT}\n`,
    [`${ROOT}/plan.md`]: PLAN,
  }
  if (opts.workspace !== undefined) {
    files[`${ROOT}/.claude/workspace.json`] = typeof opts.workspace === 'string' ? opts.workspace : JSON.stringify(opts.workspace)
  }
  const state = new Map<string, unknown>([
    ['session', { id: opts.id, root: ROOT }],
    ['preview', opts.isPreviewOpen ? { commands: ['git add x'], next: 0, at: 0 } : null],
  ])
  mock.env(on, { HOME })
  on('state.get', ($, e) => ({ value: { value: state.get(e.key) ?? null, version: 0 } }))
  on('state.set', ($, e) => {
    state.set(e.key, e.value)
    return { value: { isSet: true, version: 0 } }
  })
  const folders = new Set(['/work', ROOT, `${ROOT}/acme-api`, `${ROOT}/acme-stack`, `${ROOT}/vendor/lib/.git`])
  on('fs.read', ($, e) => {
    const text = files[e.path]
    return text === undefined ? { deny: `ENOENT: ${e.path}` } : { value: text }
  })
  on('fs.stat', ($, e) => {
    const isFolder = folders.has(e.path)
    if (files[e.path] === undefined && !isFolder) {
      return { deny: `ENOENT: ${e.path}` }
    }
    return { value: { kind: isFolder ? ('dir' as const) : ('file' as const), size: 0, mtimeMs: 1, isLink: false, realPath: e.path } }
  })
  on('process.run', ($, e) => {
    runs.push(e.argv)
    const repo = e.argv[0] === 'git' ? (e.argv[2] ?? '').replace(`${ROOT}/`, '') : ''
    const stdout = opts.dirty?.includes(repo) && e.argv.includes('status') ? ' M x\n' : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.cwd', () => ({ value: ROOT }))
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false }, text: '' }))

  return { runs, toasts }
}

const bash = (command: string) => ({ tool: 'Bash', command, description: '' }) as const

describe('runtime rule', () => {
  test('with no workspace.json, any session runs the stack script', async ($, on) => {
    world(on, { id: 'S1' })
    expect((await $.tool.call(bash('./stackctl.sh up'))).deny).toBeUndefined()
  })

  test('only the runners run it, except its free subcommands', async ($, on) => {
    world(on, { id: 'S1', workspace: RUNTIME })
    expect((await $.tool.call(bash('./stackctl.sh up'))).deny).toContain('only the stack\'s sessions run stackctl.sh up (plan.md "The stack")')
    expect((await $.tool.call(bash('./stackctl.sh status'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('docker ps'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('docker compose up'))).deny).toContain('only the stack\'s sessions')
  })

  test('a runner runs it', async ($, on) => {
    world(on, { id: 'S2', workspace: RUNTIME })
    expect((await $.tool.call(bash('./stackctl.sh up'))).deny).toBeUndefined()
  })

  test('commitFirst: build waits for dirty repositories', async ($, on) => {
    world(on, { id: 'S2', workspace: RUNTIME, dirty: ['acme-api'] })
    expect((await $.tool.call(bash('./stackctl.sh build'))).deny).toContain('uncommitted: acme-api')
  })

  test('commitFirst: build runs once everything is committed', async ($, on) => {
    world(on, { id: 'S2', workspace: RUNTIME })
    expect((await $.tool.call(bash('./stackctl.sh build'))).deny).toBeUndefined()
  })

  test('commitFirst: an open preview comes first', async ($, on) => {
    world(on, { id: 'S2', workspace: RUNTIME, isPreviewOpen: true })
    expect((await $.tool.call(bash('./stackctl.sh build'))).deny).toContain('a Ready to commit preview is still open')
  })

  test('a broken workspace.json turns the guard off, with a toast', async ($, on) => {
    const w = world(on, { id: 'S1', workspace: '{ "runtime": { "scripts": [] } }' })
    expect((await $.tool.call(bash('./stackctl.sh up'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('echo x > acme-stack/file'))).deny).toBeUndefined()
    expect(w.toasts).toEqual([expect.stringContaining('.claude/workspace.json: runtime.scripts is empty')])
  })

  test('every session edits the root docs, not another repository or a root script', async ($, on) => {
    world(on, { id: 'S1' })
    expect((await $.tool.call(bash('echo x >> plan.md'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('echo x > docs/notes.md'))).deny).toBeUndefined()
    expect((await $.tool.call(bash('echo x > acme-stack/README.md'))).deny).toContain('belongs to `S2`')
    expect((await $.tool.call(bash('echo x > run.sh'))).deny).toContain('past those, the root docs')
    expect((await $.tool.call(bash('echo x > vendor/lib/README.md'))).deny).toContain('workspace:')
    expect((await $.tool.call(bash('echo x > .claude/commands/session.md'))).deny).toContain('workspace:')
    expect((await $.tool.call(bash('echo x > stack.md'))).deny).toContain('workspace:')
  })

  test('the write guard still holds next to the rule', async ($, on) => {
    world(on, { id: 'S1', workspace: RUNTIME })
    expect((await $.tool.call(bash('echo x > acme-stack/file'))).deny).toContain('workspace:')
    expect((await $.tool.call(bash('echo x > acme-api/file'))).deny).toBeUndefined()
  })
})
