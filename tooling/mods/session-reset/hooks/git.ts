// Reads a Bash command the way the approve gate needs it: which parts are git or gh
// writes, and which break the rules of ~/.claude/CLAUDE.md even inside an approved preview.

type Segment = { words: string[] }

export type Judged = {
  // The parts that run a git or gh write (or a script that does).
  writes: number
  // Whether a part is a git commit.
  commits?: boolean
  // Why the command may never run, even approved.
  forbidden?: string
}

// Splits a command into simple commands at unquoted && || ; | & newlines and ( ) ` $( ,
// drops comments and heredoc bodies, and removes quotes from the words.
function segments(command: string): Segment[] {
  const out: Segment[] = []
  let words: string[] = []
  let word = ''
  let hasWord = false
  let quote: '' | "'" | '"' = ''
  const heredocs: { end: string; isIndented: boolean }[] = []
  const endWord = () => {
    if (hasWord) {
      words.push(word)
    }
    word = ''
    hasWord = false
  }
  const endSegment = () => {
    endWord()
    if (words.length > 0) {
      out.push({ words })
    }
    words = []
  }
  for (let i = 0; i < command.length; i++) {
    const c = command[i] as string
    if (quote === "'") {
      if (c === "'") {
        quote = ''
      } else {
        word += c
      }
      continue
    }
    if (c === '\\' && i + 1 < command.length) {
      const n = command[i + 1] as string
      if (n === '\n') {
        i++
        continue
      }
      if (quote === '' || '"\\$`'.includes(n)) {
        word += n
        hasWord = true
        i++
        continue
      }
    }
    if (quote === '"') {
      if (c === '"') {
        quote = ''
      } else if (c === '$' && command[i + 1] === '(') {
        // A command substitution inside quotes still runs.
        out.push(...segments(substitution(command, i + 2)))
        word += c
      } else if (c === '`') {
        const end = command.indexOf('`', i + 1)
        out.push(...segments(command.slice(i + 1, end < 0 ? command.length : end)))
        word += c
      } else {
        word += c
      }
      continue
    }
    if (c === "'" || c === '"') {
      quote = c
      hasWord = true
      continue
    }
    if (c === '#' && !hasWord) {
      while (i + 1 < command.length && command[i + 1] !== '\n') {
        i++
      }
      continue
    }
    if (c === '<' && command[i + 1] === '<' && command[i + 2] !== '<') {
      const m = /^<<(-?)\s*(['"]?)([\w.-]+)\2/.exec(command.slice(i))
      if (m) {
        heredocs.push({ end: m[3] as string, isIndented: m[1] === '-' })
        endWord()
        i += m[0].length - 1
        continue
      }
    }
    if (c === '\n') {
      endSegment()
      while (heredocs.length > 0) {
        const { end, isIndented } = heredocs.shift() as { end: string; isIndented: boolean }
        let next = command.indexOf('\n', i + 1)
        for (;;) {
          const line = command.slice(i + 1, next < 0 ? command.length : next)
          i = next < 0 ? command.length : next
          if ((isIndented ? line.trim() : line) === end || next < 0) {
            break
          }
          next = command.indexOf('\n', i + 1)
        }
      }
      continue
    }
    const isAmpRedirect = c === '&' && (command[i - 1] === '>' || command[i + 1] === '>')
    if (';|()`'.includes(c) || (c === '&' && !isAmpRedirect)) {
      endSegment()
      continue
    }
    if (c === '$' && command[i + 1] === '(') {
      endSegment()
      i++
      continue
    }
    if (c === ' ' || c === '\t') {
      endWord()
      continue
    }
    word += c
    hasWord = true
  }
  endSegment()

  return out
}

// The text of a $( ... ) that starts at `from`, up to its closing parenthesis.
function substitution(command: string, from: number): string {
  let depth = 1
  for (let i = from; i < command.length; i++) {
    if (command[i] === '(') {
      depth++
    } else if (command[i] === ')' && --depth === 0) {
      return command.slice(from, i)
    }
  }

  return command.slice(from)
}

const WRAPPERS = new Set(['command', 'builtin', 'exec', 'env', 'nice', 'nohup', 'time', 'sudo', 'xargs', 'timeout'])
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh'])
// Words that open a shell construct; the command follows them ("then git push").
const KEYWORDS = new Set(['if', 'then', 'elif', 'else', 'do', 'while', 'until', '!', '{', 'coproc', 'time'])
// Programs that only name git as text ("grep git", "which gh").
const MENTIONS = new Set([
  'echo', 'printf', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack', 'which', 'type', 'whence', 'where', 'man',
  'tldr', 'info', 'apropos', 'cat', 'less', 'more', 'head', 'tail', 'test', '[', '[[', 'jq', 'awk', 'sed', 'wc',
  'ls', 'file', 'stat', 'cd', 'pushd', 'mkdir', 'export', 'local', 'declare', 'unset', 'alias', 'unalias',
])
const GIT_LIKE = new Set(['git', 'gh', 'commit-all', 'push-all', 'gh-harden'])
// A word that names git or gh anywhere in the text, for commands the parse cannot follow.
const NAMES_GIT = /(?:^|[\s;&|(`'"=/])(?:git|gh|commit-all|push-all|gh-harden)(?=$|[\s;&|)`'"])/m

// The person's zsh aliases (gp → git push): the Bash tool's shell has them.
let aliases = new Map<string, string>()

export function setAliases(map: Map<string, string>) {
  aliases = map
}

// `alias -L` output, as `name → value`.
export function parseAliases(text: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of text.split('\n')) {
    const m = /^alias (?:-- )?([^=\s]+)=(.*)$/.exec(line)
    if (m) {
      const raw = m[2] as string
      map.set(m[1] as string, raw.startsWith("'") && raw.endsWith("'") ? raw.slice(1, -1).replace(/'\\''/g, "'") : raw)
    }
  }

  return map
}

const GIT_READS = new Set([
  'status', 'log', 'diff', 'show', 'rev-parse', 'rev-list', 'ls-files', 'ls-tree', 'ls-remote', 'blame',
  'describe', 'grep', 'cat-file', 'for-each-ref', 'shortlog', 'merge-base', 'name-rev', 'check-ignore',
  'show-ref', 'show-branch', 'count-objects', 'var', 'version', 'help', 'cherry', 'range-diff',
  'whatchanged', 'diff-tree', 'diff-files', 'diff-index', 'check-attr', 'check-ref-format',
])
// Subcommands whose first argument says whether they read: "stash list", "tag -l".
const GIT_READ_ACTIONS: Record<string, Set<string>> = {
  stash: new Set(['list', 'show']),
  worktree: new Set(['list']),
  submodule: new Set(['status', 'summary']),
  notes: new Set(['list', 'show']),
  reflog: new Set(['show']),
  remote: new Set(['-v', '--verbose', 'show', 'get-url']),
  config: new Set(['--get', '--get-all', '--get-regexp', '--get-urlmatch', '--list', '-l', 'get', 'list']),
  tag: new Set(['-l', '--list', '--contains', '--points-at', '-n']),
}
const GIT_BARE_READS = new Set(['reflog', 'remote', 'tag'])
// Config options that come before its action and change only where it looks.
const CONFIG_SCOPES = /^(--global|--system|--local|--worktree|--show-origin|--show-scope|--name-only|-z|--null|--includes|--no-includes|--type=.*|--bool|--int|--path)$/
const CONFIG_FILES = new Set(['-f', '--file', '--blob'])
const BRANCH_LISTS = new Set(['--list', '-l', '--contains', '--no-contains', '--merged', '--no-merged', '--points-at'])
const BRANCH_WRITES = /^(-[dDmMcCfu]|--delete|--move|--copy|--force|--set-upstream-to.*|--unset-upstream|--edit-description|--track|--no-track)$/
const GH_READS = new Set(['view', 'list', 'status', 'diff', 'checks', 'watch'])

const TRAILER = /co-authored-by|generated with \[?claude/i
// Config that changes who signs, the signing, or the hooks.
const SIGN_OVERRIDE = /^(user\.|author\.|committer\.|commit\.gpgsign|tag\.gpgsign|gpg\.|core\.hookspath)/i
// Config a read may set: how it prints.
const DISPLAY_CONFIG = /^(core\.quotepath|core\.abbrev|color\.[\w.-]+|advice\.[\w.-]+|column\.ui|i18n\.[\w.-]+|log\.(date|decorate|abbrevcommit))=/i
// Variables that change the author, the config or the signing of any git in the command.
const ENV_OVERRIDE = /(?:^|[\s;&|(])(GIT_(?:AUTHOR|COMMITTER)_\w*|GIT_CONFIG\w*|HOME|XDG_CONFIG_HOME|GNUPGHOME)=/m

// git takes any unique prefix of a long option: --no-verif is --no-verify.
function isOption(arg: string, full: string, shortest: number): boolean {
  const name = arg.split('=')[0] as string
  return name.length >= shortest && full.startsWith(name)
}

// "read", "write", "commit", or why a git command may never run.
function judgeGit(args: string[]): 'read' | 'write' | 'commit' | { forbidden: string } {
  let i = 0
  let isWrite = false
  for (; i < args.length; i++) {
    const a = args[i] as string
    if (a === '-C' || a === '--git-dir' || a === '--work-tree' || a === '--namespace') {
      i++
    } else if (a === '-c' || a === '--config-env' || a.startsWith('--config-env=')) {
      const kv = a.startsWith('--config-env=') ? a.slice('--config-env='.length) : (args[++i] ?? '')
      if (SIGN_OVERRIDE.test(kv)) {
        return { forbidden: `${a.startsWith('--') ? '--config-env' : '-c'} ${kv} overrides the operator's identity, signing or hooks` }
      }
      if (a !== '-c' || !DISPLAY_CONFIG.test(kv)) {
        isWrite = true
      }
    } else if (a === '--exec-path' || a.startsWith('--exec-path=')) {
      isWrite = true
    } else if (!a.startsWith('-')) {
      break
    }
  }
  const sub = args[i] ?? ''
  const rest = args.slice(i + 1)
  for (const a of GIT_READS.has(sub) ? [] : rest) {
    if (isOption(a, '--no-verify', 6) || isOption(a, '--no-gpg-sign', 6) || isOption(a, '--author', 5) || isOption(a, '--trailer', 5)) {
      return { forbidden: `${sub} ${a} breaks the commit rules (signed, hooks on, the operator as author, no trailer)` }
    }
  }
  if (sub === 'commit' && rest.some(a => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(a))) {
    return { forbidden: 'commit -n skips the hooks' }
  }
  if (sub === 'commit' && rest.some(a => /^-[a-zA-Z]*a[a-zA-Z]*$/.test(a) || isOption(a, '--all', 4))) {
    return { forbidden: 'commit -a stages every change; stage explicit paths first' }
  }
  if (sub === 'push' && rest.some(a => /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a) || /^--force/.test(a) || isOption(a, '--force', 5) || isOption(a, '--mirror', 4) || /^\+/.test(a))) {
    return { forbidden: 'push --force is never run' }
  }
  if (
    sub === 'add' &&
    rest.some(
      a =>
        /^-[a-zA-Z]*[Au][a-zA-Z]*$/.test(a) ||
        isOption(a, '--all', 4) ||
        isOption(a, '--update', 4) ||
        isOption(a, '--no-ignore-removal', 6) ||
        ['.', './', ':', ':/', '*', ':/*'].includes(a),
    )
  ) {
    return { forbidden: 'add stages explicit paths only, never -A, -u or .' }
  }
  if (sub === 'commit') {
    return 'commit'
  }
  if (isWrite || sub === '') {
    return isWrite ? 'write' : 'read'
  }
  if (rest.some(a => a.startsWith('--output'))) {
    return 'write'
  }
  if (GIT_READS.has(sub)) {
    return 'read'
  }
  if (sub === 'branch') {
    const isList = rest.some(a => BRANCH_LISTS.has(a))
    const hasName = rest.some(a => !a.startsWith('-'))
    return rest.some(a => BRANCH_WRITES.test(a)) || (hasName && !isList) ? 'write' : 'read'
  }
  const actions = GIT_READ_ACTIONS[sub]
  if (actions) {
    let k = 0
    while (sub === 'config' && k < rest.length && (CONFIG_SCOPES.test(rest[k] as string) || CONFIG_FILES.has(rest[k] as string))) {
      k += CONFIG_FILES.has(rest[k] as string) ? 2 : 1
    }
    const first = rest[k]
    if (first === undefined) {
      return GIT_BARE_READS.has(sub) ? 'read' : 'write'
    }
    return actions.has(first) ? 'read' : 'write'
  }

  return 'write'
}

type SegmentJudged = Judged & { isOpaque?: boolean }

// `isArgument`: the words are a tail of another command's ("timeout 60 git push"), where zsh
// expands no alias. `isPreview`: the words are a line of a preview, so git counts only as the
// command itself, never as a word inside another program's line (see blockCommands).
function judgeSegment(words: string[], depth: number, isArgument = false, isPreview = false): SegmentJudged {
  let i = 0
  const env: string[] = []
  let isWrapped = false
  for (;;) {
    const w = words[i]
    if (w === undefined) {
      return { writes: 0 }
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) {
      env.push(w)
      i++
    } else if (KEYWORDS.has(w)) {
      i++
    } else if (WRAPPERS.has(w)) {
      isWrapped = true
      i++
      while (words[i]?.startsWith('-')) {
        i++
      }
    } else {
      break
    }
  }
  const word = words[i] as string
  const name = word.replace(/^.*\//, '')
  const args = words.slice(i + 1)
  if (depth >= 3) {
    return { writes: 0, isOpaque: true }
  }
  // A program the parse cannot see: a variable, a substitution.
  if (/[$`]/.test(word)) {
    return { writes: 0, isOpaque: true }
  }
  if (name === 'for' || name === 'case' || name === 'select' || name === 'function') {
    return { writes: 0 }
  }
  // zsh expands an alias only in command position, and not again inside its own value
  // ("ls='ls -G'").
  const alias = isWrapped || isArgument ? undefined : aliases.get(word)
  if (alias !== undefined && !GIT_LIKE.has(word) && alias.split(/\s+/)[0] !== word) {
    return judge([alias, ...args].join(' '), depth + 1, isPreview)
  }
  if (SHELLS.has(name)) {
    const c = args.findIndex(a => /^-[a-zA-Z]*c[a-zA-Z]*$/.test(a))
    if (c >= 0) {
      return args[c + 1] !== undefined ? judge(args[c + 1] as string, depth + 1, isPreview) : { writes: 0 }
    }
    // With no script file it runs what comes on stdin: a pipe or a heredoc.
    const hasScript = args.some(a => !a.startsWith('-')) && !args.includes('-s')
    return hasScript ? { writes: 0 } : { writes: 0, isOpaque: true }
  }
  if (name === 'eval') {
    return judge(args.join(' '), depth + 1, isPreview)
  }
  if (!GIT_LIKE.has(name)) {
    // "timeout 60 git push", "find . -exec git add {} ;", "stdbuf -oL git push": judge it
    // from the git word on.
    // In a preview only a wrapper's own arguments lead on to git ("timeout 60 git push").
    if (MENTIONS.has(name) || (isPreview && !isWrapped)) {
      return { writes: 0 }
    }
    const at = args.findIndex(a => GIT_LIKE.has(a.replace(/^.*\//, '')))
    return at >= 0 ? judgeSegment(args.slice(at), depth + 1, true) : { writes: 0 }
  }
  if (env.some(v => /^GIT_(AUTHOR|COMMITTER)_|^GIT_CONFIG|^HOME=|^XDG_CONFIG_HOME=|^GNUPGHOME=/.test(v))) {
    return { writes: 1, forbidden: `${env.join(' ')} overrides the operator's identity or config` }
  }
  if (name === 'commit-all') {
    return { writes: 1, forbidden: 'commit-all stages everything (add -A); show explicit add paths in a preview' }
  }
  if (name === 'push-all') {
    return { writes: 1 }
  }
  // It changes the GitHub settings only with --apply.
  if (name === 'gh-harden') {
    return { writes: args.includes('--apply') ? 1 : 0 }
  }
  if (name === 'gh') {
    let k = 0
    while (args[k]?.startsWith('-')) {
      k += ['-R', '--repo', '--hostname'].includes(args[k] as string) ? 2 : 1
    }
    const [group = '', action = ''] = args.slice(k)
    const isRead = group === 'status' || (group === 'auth' && action === 'status') || (group !== 'api' && GH_READS.has(action))
    return { writes: isRead ? 0 : 1 }
  }
  const v = judgeGit(args)
  if (v === 'commit') {
    return { writes: 1, commits: true }
  }
  return v === 'read' ? { writes: 0 } : v === 'write' ? { writes: 1 } : { writes: 1, forbidden: `git ${v.forbidden}` }
}

export function judge(command: string, depth = 0, isPreview = false): Judged {
  let writes = 0
  let forbidden: string | undefined
  let isOpaque = false
  let commits = false
  for (const { words } of segments(command)) {
    const one = judgeSegment(words, depth, false, isPreview)
    writes += one.writes
    forbidden ??= one.forbidden
    isOpaque ||= one.isOpaque === true
    commits ||= one.commits === true
  }
  // A part the parse cannot follow, in a command that names git: count it as a write. A
  // preview line counts only when git is its command, so it is not one there.
  if (isOpaque && !isPreview && NAMES_GIT.test(command)) {
    writes += 1
  }
  if (writes > 0 && !forbidden && ENV_OVERRIDE.test(command)) {
    forbidden = `${ENV_OVERRIDE.exec(command)?.[1]}= changes the operator's identity, config or signing for git`
  }
  if (writes > 0 && !forbidden && TRAILER.test(command)) {
    forbidden = 'the commit message holds a Co-Authored-By or "Generated with" trailer'
  }

  return { writes, ...(commits ? { commits } : {}), ...(forbidden ? { forbidden } : {}) }
}

// How a command compares with a preview's: continued lines joined, whitespace collapsed,
// the "# approved" marker optional, and a cd before a pinned git left out (it changes
// nothing).
export function normalize(command: string): string {
  return command
    .replace(/\\\n/g, ' ')
    .replace(/\s+#\s*approved\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^cd \S+ ?&& ?(?=git -C )/, '')
}

// The quote a line ends inside ('' when none), so the command goes on in the next line.
function openQuote(text: string): string {
  let quote = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote === "'") {
      if (c === "'") quote = ''
    } else if (c === '\\') {
      i++
    } else if (quote === '"') {
      if (c === '"') quote = ''
    } else if (c === "'" || c === '"') {
      quote = c
    } else if (c === '#' && (i === 0 || /\s/.test(text[i - 1] as string))) {
      return ''
    }
  }

  return quote
}

// An answer that names a preview: "Ready to commit", or a heading such as "Preview: switch
// to the release branches".
export const PREVIEWED = /^[\s#>*_-]*(?:ready to commit|preview)\b/im

// The preview's review line (~/.claude/CLAUDE.md): "Review: code-review, 1 finding, fixed",
// also as a list item or in bold ("- **Review:** docs only, reread"); a bare label is none.
export const REVIEWED = /^[\s>*_-]*Review[*_]*:[*_]*[ \t]*([^\s*_].*)$/im

// A fenced code block: its fence, its info string ("commit", "sh") and its body.
export const FENCED = /^[ \t]*(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm

// The preview's commands (~/.claude/CLAUDE.md): one fenced block tagged `commit`, each line
// one git or gh write pinned to its repository. A git or gh read there ("git log -1") is
// left out: it runs unchecked. `problem` says why the block is no preview; undefined when
// the answer has none and names no preview.
export type CommitBlock = { commands: string[]; problem?: undefined } | { commands?: undefined; problem: string }

export function commitBlock(answer: string): CommitBlock | undefined {
  const blocks = [...answer.matchAll(FENCED)]
  const tagged = blocks.filter(b => (b[2] as string).trim().split(/\s+/)[0] === 'commit')
  if (tagged.length === 0) {
    const isShown = PREVIEWED.test(answer) && blocks.some(b => blockCommands(b[3] as string).some(c => judge(c, 0, true).writes > 0))
    return isShown ? { problem: 'its git commands are not in a ```commit block' } : undefined
  }
  if (tagged.length > 1) {
    return { problem: `${tagged.length} commit blocks; one block holds every command` }
  }
  const commands: string[] = []
  for (const command of blockCommands((tagged[0] as RegExpMatchArray)[3] as string)) {
    const why = unfit(command)
    if (why === READ) {
      continue
    }
    if (why) {
      return { problem: `${why}: ${command.split('\n')[0]}` }
    }
    commands.push(command)
  }

  return commands.length > 0 ? { commands } : { problem: 'the commit block holds no git or gh write' }
}

const READ = 'a read'
// A leading `cd <absolute path> &&`: the pin of a command that runs only inside its checkout
// (`gh release create --notes-from-tag` reads the local tag and refuses --repo).
const CD_PIN = /^cd\s+(?:\/\S*|"\/[^"]*"|'\/[^']*')\s*&&\s*/

// Why a line of the commit block cannot run as it stands, READ for a git or gh read, or
// undefined when it can.
function unfit(command: string): string | undefined {
  const cd = CD_PIN.exec(command)
  const rest = cd ? command.slice(cd[0].length) : command
  const top = topLevel(rest)
  const name = top.trim().split(/\s+/)[0] ?? ''
  const isChained = /&&|\|\||[;|\n]|(?<![>&])&(?![>&])/.test(top.trim())
  const judged = judge(rest, 0, true)
  if (judged.writes === 0) {
    return GIT_LIKE.has(name) && !isChained ? READ : 'not a git or gh write'
  }
  if (judged.forbidden) {
    return `never runs (${judged.forbidden})`
  }
  if (isChained) {
    return 'one command per line'
  }
  // `# approved` after a command that moves HEAD is the git-guard hook's marker, not a note.
  const note = /(?:^|\s)#\s*(.*)$/m.exec(top)
  if (note && !/^approved\s*$/i.test(note[1] as string)) {
    return 'a note in the block'
  }
  if (/<[^<>\s]+>|…|(?:^|\s)\.\.\.(?:\s|$)/.test(top)) {
    return 'a placeholder'
  }
  if (!GIT_LIKE.has(name)) {
    return 'not a git or gh command first'
  }
  const words = segments(rest).find(s => s.words[0] === name)?.words ?? []
  const [, first = '', second = ''] = words
  const isPinned =
    cd !== null ||
    (name === 'git'
      ? first === '-C' && second.startsWith('/')
      : name === 'gh'
        ? words.some((w, k) => ((w === '-R' || w === '--repo') && k + 1 < words.length) || w.startsWith('--repo=')) ||
          (first === 'api' && words.some(w => /^\/?repos\/[\w.-]+\/[\w.-]+/.test(w)))
        : name === 'push-all'
          ? first.startsWith('/')
          : /^[\w.-]+\/[\w.-]+$/.test(first))
  return isPinned
    ? undefined
    : 'not pinned to its repository (git -C <absolute path>, gh --repo <owner>/<name>, or cd <absolute path> && <command>)'
}

// The command as the shell reads it at the top: quoted text and $( ) emptied (a heredoc
// inside one too), a heredoc's body dropped, an escaped character kept as a plain one.
function topLevel(command: string): string {
  let out = ''
  let quote = ''
  for (let i = 0; i < command.length; i++) {
    const c = command[i] as string
    if (c === '$' && command[i + 1] === '(' && quote !== "'") {
      i = substitutionEnd(command, i + 2)
    } else if (quote !== '') {
      if (c === '\\' && quote === '"') {
        i++
      } else if (c === quote) {
        quote = ''
        out += c
      }
    } else if (c === '\\') {
      i++
      out += 'x'
    } else if (c === "'" || c === '"') {
      quote = c
      out += c
    } else if (c === '<' && command[i + 1] === '<') {
      return out + (command.slice(i).split('\n')[0] as string)
    } else {
      out += c
    }
  }

  return out
}

// Where the `)` is that closes a $( ) whose text starts at `from`; quotes and a heredoc's
// body inside it are skipped.
function substitutionEnd(command: string, from: number): number {
  let depth = 1
  let quote = ''
  for (let i = from; i < command.length; i++) {
    const c = command[i] as string
    if (quote !== '') {
      if (c === '\\' && quote === '"') {
        i++
      } else if (c === quote) {
        quote = ''
      }
      continue
    }
    const here = c === '<' ? /^<<-?\s*(['"]?)([\w.-]+)\1[^\n]*\n/.exec(command.slice(i)) : null
    if (here) {
      let at = i + here[0].length
      for (;;) {
        const nl = command.indexOf('\n', at)
        const line = command.slice(at, nl < 0 ? command.length : nl)
        if (line.trim() === here[2] || nl < 0) {
          at = nl < 0 ? command.length : nl
          break
        }
        at = nl + 1
      }
      i = at - 1
    } else if (c === "'" || c === '"') {
      quote = c
    } else if (c === '(') {
      depth++
    } else if (c === ')' && --depth === 0) {
      return i
    }
  }

  return command.length
}

// Each command of a code block's body, joined over continued lines, open quotes and heredocs.
export function blockCommands(body: string): string[] {
  const out: string[] = []
  const lines = body.split('\n')
  for (let i = 0; i < lines.length; i++) {
    let line = (lines[i] as string).replace(/^\s*\$\s+/, '').trim()
    if (line === '') {
      continue
    }
    // An open quote goes on in the next lines only when the line, closed where it breaks,
    // is a git or gh command: a note such as "the operator's approve" is not one, and must
    // not join the commands after it.
    const quote = openQuote(line)
    const joins = quote === '' || judge(line + quote, 0, true).writes > 0
    while ((/\\$/.test(line) || (joins && openQuote(line) !== '')) && i + 1 < lines.length) {
      line = /\\$/.test(line) ? `${line.slice(0, -1).trimEnd()} ${(lines[++i] as string).trim()}` : `${line}\n${lines[++i]}`
    }
    // A heredoc the shell reads (not "<<EOF" inside a quoted message) goes on to its end
    // line; one inside a quoted $( ) came whole with the open quote above.
    const here = /<<-?\s*(['"]?)([\w.-]+)\1/.exec(topLevel(line))
    if (here) {
      while (i + 1 < lines.length) {
        const next = lines[++i] as string
        line = `${line}\n${next}`
        if (next.trim() === here[2]) {
          break
        }
      }
    }
    out.push(line)
  }

  return out
}
