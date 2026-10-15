import { describe, expect, test } from 'claude-code/testing'

import { commitBlock, normalize } from '../hooks/git'

const ROOT = '/work/acme'
const fence = (...lines: string[]) => ['```commit', ...lines, '```'].join('\n')
const ready = (...blocks: string[]) => ['Ready to commit', '', 'Review: docs only, reread', '', ...blocks].join('\n')
const problem = (answer: string) => commitBlock(answer)?.problem

describe('commit block', () => {
  test('holds the preview\'s commands, each pinned to its repository', () => {
    const commands = [
      `git -C ${ROOT} add docs/plan.md`,
      `git -C ${ROOT}/web commit -m "docs: plan; then <the rest>"`,
      `git -C ${ROOT} switch release/cp1 # approved`,
      `git -C ${ROOT} push origin development`,
      'gh release create v1 --repo acme/web --notes "v1"',
      'gh pr merge 7 -R acme/web --merge',
      'gh api -X PUT repos/acme/web/topics',
      `push-all ${ROOT}`,
      'gh-harden acme/web --apply',
      // gh release create --notes-from-tag reads the local tag and refuses --repo.
      `cd ${ROOT}/web && gh release create v1 --verify-tag --notes-from-tag`,
    ]
    expect(commitBlock(ready(fence(...commands)))).toEqual({ commands })
  })

  test('joins a heredoc message and continued lines into one command', () => {
    const heredoc = [`git -C ${ROOT} commit -F - <<'EOF'`, 'docs: plan', '', 'Body; with a <word>.', 'EOF']
    const quoted = [`git -C ${ROOT} commit -m "$(cat <<'EOF'`, 'docs: plan', 'EOF', ')"']
    const continued = [`git -C ${ROOT} add \\`, '  docs/plan.md']
    expect(commitBlock(ready(fence(...heredoc, ...quoted, ...continued)))).toEqual({
      commands: [heredoc.join('\n'), quoted.join('\n'), `git -C ${ROOT} add docs/plan.md`],
    })
  })

  test('reads a quoted message as text: its quotes, <words>, ; and # are no shell', () => {
    const quoted = [`git -C ${ROOT} commit -m "$(cat <<'EOF'`, 'docs: the "approve, then <note>" answer', '', 'One; two # three.', 'EOF', ')"']
    // "<<EOF" inside a quoted message is no heredoc: the next line is a command of its own.
    const named = `git -C ${ROOT} commit -m "docs: a <<EOF heredoc"`
    expect(commitBlock(ready(fence(...quoted, named, `git -C ${ROOT} push`)))).toEqual({
      commands: [quoted.join('\n'), named, `git -C ${ROOT} push`],
    })
  })

  test('leaves a git read out of the commands, and compares a cd before a pinned git as none', () => {
    const answer = ready(fence(`git -C ${ROOT} add a`, `git -C ${ROOT} commit -m "x"`, `git -C ${ROOT} log -1 --format='%h %an %G? %s'`))
    expect(commitBlock(answer)).toEqual({ commands: [`git -C ${ROOT} add a`, `git -C ${ROOT} commit -m "x"`] })
    expect(normalize(`cd ${ROOT} && git -C ${ROOT} add a`)).toBe(`git -C ${ROOT} add a`)
    expect(normalize(`cd ${ROOT} && gh release create v1`)).toBe(`cd ${ROOT} && gh release create v1`)
  })

  test('reads only the commit block: a diff, a message or a status block is never a command', () => {
    const answer = ready(
      ['```diff', '+git add everything', '-old', '```'].join('\n'),
      ['```', 'git push origin development', '```'].join('\n'),
      fence(`git -C ${ROOT} add docs/plan.md`),
    )
    expect(commitBlock(answer)).toEqual({ commands: [`git -C ${ROOT} add docs/plan.md`] })
  })

  test('says why a block cannot run as it stands', () => {
    expect(problem(ready(fence('git add docs/plan.md')))).toStartWith('not pinned to its repository')
    expect(problem(ready(fence('git -C web add docs/plan.md')))).toStartWith('not pinned to its repository')
    expect(problem(ready(fence('gh release create v1')))).toStartWith('not pinned to its repository')
    expect(problem(ready(fence('push-all')))).toStartWith('not pinned to its repository')
    expect(problem(ready(fence('cd web && git push')))).toStartWith('one command per line')
    expect(problem(ready(fence(`git -C ${ROOT} add a && git -C ${ROOT} commit -m "x"`)))).toStartWith('one command per line')
    expect(problem(ready(fence(`git -C ${ROOT} add <paths>`)))).toStartWith('a placeholder')
    expect(problem(ready(fence(`git -C ${ROOT} add docs/a.md …`)))).toStartWith('a placeholder')
    expect(problem(ready(fence(`git -C ${ROOT} push # after CI`)))).toStartWith('a note in the block')
    expect(problem(ready(fence("Runs after the operator's approve.", `git -C ${ROOT} push`)))).toBe(
      "not a git or gh write: Runs after the operator's approve.",
    )
    expect(problem(ready(fence(` M docs/plan.md`, `git -C ${ROOT} add docs/plan.md`)))).toStartWith('not a git or gh write')
    expect(problem(ready(fence(`git -C ${ROOT} push --force`)))).toStartWith('never runs')
    expect(problem(ready(fence(`timeout 60 git -C ${ROOT} push`)))).toStartWith('not a git or gh command first')
    expect(problem(ready(fence()))).toBe('the commit block holds no git or gh write')
    expect(problem(ready(fence(`git -C ${ROOT} status --short`)))).toBe('the commit block holds no git or gh write')
    expect(problem(ready(fence('cd web && gh release create v1 --verify-tag --notes-from-tag')))).toStartWith('one command per line')
    expect(problem(ready(fence(`git -C ${ROOT} add a`, `git -C ${ROOT} log -1 && git -C ${ROOT} push`)))).toStartWith('one command per line')
    expect(problem(ready(fence(`git -C ${ROOT} add a`), fence(`git -C ${ROOT} push`)))).toBe('2 commit blocks; one block holds every command')
  })

  test('an answer that names a preview but shows its commands in another block says so', () => {
    expect(problem(ready(['```sh', `git -C ${ROOT} push`, '```'].join('\n')))).toBe('its git commands are not in a ```commit block')
    // An answer that names no preview, or shows no git write, is no preview at all.
    expect(commitBlock(['You could run:', '```', 'git push origin development', '```'].join('\n'))).toBeUndefined()
    expect(commitBlock(ready(['```', ' M docs/plan.md', '```'].join('\n')))).toBeUndefined()
  })
})
