// Reads a Bash command far enough for the guards: its simple commands, their words, the
// files they redirect into, and the directory a leading `cd` moves to. A rail, not a parser.

export type Command = { words: string[]; redirects: string[]; cwd: string | undefined }

export function commands(text: string): Command[] {
  const out: Command[] = []
  let words: string[] = []
  let redirects: string[] = []
  let word = ''
  let hasWord = false
  let isRedirect = false
  let quote = ''
  let cwd: string | undefined
  const heredocs: string[] = []
  const endWord = () => {
    if (hasWord) {
      if (isRedirect) {
        redirects.push(word)
        isRedirect = false
      } else {
        words.push(word)
      }
    }
    word = ''
    hasWord = false
  }
  const endCommand = () => {
    endWord()
    if (words[0] === 'cd' || words[0] === 'pushd') {
      // "cd a && cd b": b is under a.
      const to = words[1] ?? '~'
      cwd = cwd === undefined || /^[/~]/.test(to) ? to : `${cwd}/${to}`
    } else if (words[0] === '[[') {
      // `>` inside [[ ]] compares strings.
      out.push({ words, redirects: [], cwd })
    } else if (words.length > 0 || redirects.length > 0) {
      out.push({ words, redirects, cwd })
    }
    words = []
    redirects = []
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string
    if (quote === "'") {
      if (c === "'") {
        quote = ''
      } else {
        word += c
      }
      continue
    }
    if (c === '\\' && i + 1 < text.length) {
      word += text[++i]
      hasWord = true
      continue
    }
    if (quote === '"') {
      if (c === '"') {
        quote = ''
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
      while (i + 1 < text.length && text[i + 1] !== '\n') {
        i++
      }
      continue
    }
    if (c === '<' && text[i + 1] === '<') {
      const m = /^<<-?\s*(['"]?)([\w.-]+)\1/.exec(text.slice(i))
      if (m) {
        heredocs.push(m[2] as string)
        endWord()
        i += m[0].length - 1
        continue
      }
    }
    if (c === '>') {
      // `>`, `>>`, `2>`, `&>`, `>|`; `>&2` and `2>&1` point at a stream, not a file.
      if (/^\d+$/.test(word) && hasWord) {
        word = ''
        hasWord = false
      } else {
        endWord()
      }
      while (text[i + 1] === '>' || text[i + 1] === '|') {
        i++
      }
      if (text[i + 1] === '&') {
        i++
        while (/[\d-]/.test(text[i + 1] ?? '')) {
          i++
        }
        continue
      }
      isRedirect = true
      continue
    }
    if (c === '\n') {
      endCommand()
      for (const end of heredocs.splice(0)) {
        for (;;) {
          const next = text.indexOf('\n', i + 1)
          const line = text.slice(i + 1, next < 0 ? text.length : next)
          i = next < 0 ? text.length : next
          if (line.trim() === end || next < 0) {
            break
          }
        }
      }
      continue
    }
    if (c === '&' && text[i + 1] === '>') {
      endWord()
      continue
    }
    if (';|&()`'.includes(c)) {
      endCommand()
      continue
    }
    if ((c === '$' && text[i + 1] === '(' && text[i + 2] === '(') || (c === '(' && text[i + 1] === '(')) {
      // Arithmetic: `>` there compares numbers.
      const end = text.indexOf('))', i)
      i = end < 0 ? text.length : end + 1
      hasWord = true
      continue
    }
    if (c === '$' && text[i + 1] === '(') {
      endCommand()
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
  endCommand()

  return out
}

const WRAPPERS = new Set(['command', 'builtin', 'exec', 'env', 'nice', 'nohup', 'time', 'sudo', 'timeout', 'stdbuf', 'xargs'])
// Words that open a shell construct; the command follows them ("then rm x").
const KEYWORDS = new Set(['if', 'then', 'elif', 'else', 'do', 'while', 'until', '!', '{', 'coproc'])
// Wrapper options that take a value ("nice -n 5", "sudo -u x").
const WRAPPER_VALUES = new Set(['-n', '-u', '-g', '-s', '-k', '-C', '-I', '-P', '-L', '-d', '-a', '--signal', '--kill-after', '--adjustment', '--user', '--chdir'])

// The program a command runs and its arguments, past env assignments, shell keywords and
// wrappers with their options and durations ("timeout 60 x", "nice -n 5 x").
export function program(words: string[]): { name: string; path: string; args: string[] } | undefined {
  let i = 0
  for (;;) {
    const w = words[i]
    if (w === undefined) {
      return undefined
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w) || KEYWORDS.has(w)) {
      i++
    } else if (WRAPPERS.has(w)) {
      i++
      while (words[i] !== undefined && (words[i]?.startsWith('-') || /^\d+(\.\d+)?[smhd]?$/.test(words[i] as string))) {
        i += WRAPPER_VALUES.has(words[i] as string) ? 2 : 1
      }
    } else {
      break
    }
  }
  const path = words[i]
  if (path === undefined) {
    return undefined
  }

  return { name: path.replace(/^.*\//, ''), path, args: words.slice(i + 1) }
}

// Per program, the options that take a value.
const TARGET = ['-t', '--target-directory']
const VALUED: Record<string, Set<string>> = {
  mkdir: new Set(['-m', '--mode']),
  install: new Set(['-m', '--mode', '-o', '--owner', '-g', '--group', ...TARGET]),
  cp: new Set(TARGET),
  mv: new Set(TARGET),
  ln: new Set(TARGET),
  sed: new Set(['-e', '--expression', '-f', '--file']),
  perl: new Set(['-e', '-E']),
}

// The paths a command writes: its redirections, and the file arguments of the common
// writing tools.
export function writtenPaths(command: Command): string[] {
  // A path with a variable or a substitution in it cannot be resolved here, so it is skipped.
  const isPlain = (p: string) => !/[$`]/.test(p)
  const out = command.redirects.filter(p => !p.startsWith('/dev/'))
  const run = program(command.words)
  if (!run) {
    return out.filter(isPlain)
  }
  // Options that take a value: `mkdir -m 755`, `install -o root`, `cp -t dir`.
  const valued = VALUED[run.name] ?? new Set<string>()
  const files: string[] = []
  let target: string | undefined
  for (let k = 0; k < run.args.length; k++) {
    const a = run.args[k] as string
    if (valued.has(a)) {
      if (a === '-t' || a === '--target-directory') {
        target = run.args[k + 1]
      }
      k++
    } else if (!a.startsWith('-')) {
      files.push(a)
    }
  }
  // sed with -e or -f names its script there; otherwise the script is the first word.
  const hasScript = run.args.some(a => a === '-e' || a === '--expression' || a === '-f' || a === '--file')
  switch (run.name) {
    case 'tee':
    case 'rm':
    case 'rmdir':
    case 'mkdir':
    case 'touch':
    case 'chmod':
    case 'chown':
    case 'truncate':
    case 'mv':
      // chmod and chown name a mode or owner first.
      out.push(...(run.name === 'chmod' || run.name === 'chown' ? files.slice(1) : files))
      break
    case 'cp':
    case 'ln':
    case 'install':
    case 'rsync':
      if (target !== undefined) {
        out.push(target)
      } else if (files.length > 1) {
        out.push(files[files.length - 1] as string)
      }
      break
    case 'sed':
    case 'perl':
      if (run.args.some(a => /^-i|^--in-place/.test(a) || (run.name === 'perl' && /^-\w*i/.test(a)))) {
        out.push(...(hasScript ? files : files.slice(1)))
      }
      break
  }
  if (run.name === 'mv' && target !== undefined) {
    out.push(target)
  }

  return out.filter(isPlain)
}
