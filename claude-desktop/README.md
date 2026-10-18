# Claude Code desktop, without the harness

This folder holds a second way of working, apart from the harness. It is for projects you
run in the Claude desktop app. There, one task is one session, one worktree, one branch and
one PR. You review and merge the PRs. No mod gates commits, no `/session` IDs, and no
plan contract. The skills come as one plugin, `desk`, adapted from the harness's
engineering skills and from [pstack](https://github.com/cursor/plugins/tree/main/pstack).

The harness keeps working everywhere else. `sp-claude-desktop` turns it off for one
project at a time.

## Set up a project

You need the harness installed (`tooling/install`), `jq`, and the Claude desktop app. The
desktop app signs in with a Pro or Max subscription. It needs no API key. If
`ANTHROPIC_API_KEY` is set, it bills API rates instead.

1. Turn the harness off in the project and the `desk` plugin on:

   ```sh
   sp-claude-desktop ~/work/my-app
   ```

2. Check the result:

   ```sh
   sp-claude-desktop --check ~/work/my-app
   ```

   The last line reads `ok … harness off, desk on`. Any other line names what is still on.

   In a project whose modules are git submodules, add `--modules`. A session opened in a
   module's folder is a project of its own, so the script runs on the root and on each
   checked-out module, nested ones too: `sp-claude-desktop --modules ~/work/my-system`.
   The last line then reads `all <n> projects ok`, or says how many need work.

3. Restart any session open in that project. Type `/desk:` in a new session to see the
   skills.

If the project was planned for the harness, run `/desk:adopt` next. It goes through the
docs and plans with you and turns sessions, tracks, handoffs and checkpoints into a
backlog of tasks that each fit one PR.

Run the script again after you add a global skill, so the new skill is turned off there
too. To put the harness's settings back, run `sp-claude-desktop --off ~/work/my-app`. That
does not undo `/desk:adopt`, which rewrites the docs. Use git for that.

## What the script changes

It writes only `<project>/.claude/settings.local.json`, which stays out of git, and records
what it merged in `.claude/sp-claude-desktop.json`. `--off` removes exactly that.

| Setting | Effect in that project |
|---|---|
| `enabledPlugins`: each mod in `CLAUDE_CODE_PLUGIN_DIRS` set to `false` | No session-reset, workspace or overlay mods |
| `disableAllHooks: true` | No git-guard, typecheck or other user hooks. The status line is off too |
| `claudeMdExcludes`: `~/.claude/CLAUDE.md` and its `@` imports | The git rules do not load |
| `skillOverrides`: every skill in `~/.claude/skills` and command in `~/.claude/commands` set to `off` | Only the built-in skills and the `desk:` skills remain |
| `permissions.deny`: `Agent(<name>)` for each agent in `~/.claude/agents` | Only the `desk:` agents remain |
| `desk@project-harness`, from this folder as a local marketplace | The `desk:` skills and agents |

`--off` also puts back any value the project had set before the first run. The script adds
`.claude/settings.local.json`, `.claude/sp-claude-desktop.json` and `.claude/worktrees/`
to the repository's `.git/info/exclude`, anchored to the project's folder. It never edits
the project's `.gitignore`.

## Set up the desktop app

- Settings, **Branch prefix**: `cc/`, so every agent branch is easy to find.
- For each new session, turn on the **worktree** toggle next to the branch name. The
  worktree lives in `<project>/.claude/worktrees/`. Archiving the session removes it.
- On an open PR: turn on auto-fix for CI and for review comments. Leave auto-merge off,
  because the merge is your review. Turn on auto-archive after merge.

## Work one task at a time per session

1. Start a session with the worktree on. Describe one task.
2. For anything bigger than a one-sentence diff, use plan mode. The plan names the files
   the session owns, what it leaves out, and the check that proves it works.
3. Let it build in auto mode. It commits and pushes to its own branch as it goes.
4. Before the PR, run `code-review` on the diff. For a large or risky change, also run
   `/desk:interrogate`, which reviews it from subagents on other models.
5. The session opens the PR. The PR body says what it decided, what it verified and how.
6. Review the PR and merge it. Merge one PR at a time, then update the other open branches
   from the default branch.

Use `/clear` between unrelated tasks. After two failed corrections, start a new session
with a better prompt. When a mistake happens twice, turn it into a check: a test, a lint
rule or one line in the project's CLAUDE.md.

## Split work between sessions and agents

- Run sessions in parallel for independent work: different projects, or tasks in one
  project that touch different files. Work on the same files stays in one session.
- Use subagents to read, review and verify: exploring code, `/desk:blast-radius`,
  `/desk:interrogate`, a verifier on another model. Several subagents that edit one
  checkout overwrite each other. A subagent that writes code needs `isolation: worktree`.
- Use a workflow only for a large job, such as an audit or a migration across many
  files. Run a small slice first to see what it costs.
- Your review speed sets the limit. Start with 3 to 5 active sessions in total, across
  all projects. All sessions share one usage limit, and `/usage` shows how much is left.

## The skills

| Skill | Use it to |
|---|---|
| `/desk:adopt` | Turn a harness project's docs and plans into a backlog of PR-sized tasks, one doc at a time with you |
| `/desk:how`, `/desk:why`, `/desk:teach` | Understand code before you change it, and the reasons behind it |
| `/desk:recall` | Pick up your recent work on a topic from your past chats |
| `/desk:sharpen`, `/desk:in-your-own-words` | Frame a task before you start it |
| `/desk:principles` | Load the engineering rules before a design choice or before calling work done |
| `/desk:architect`, `/desk:arena` | Design a change from competing sketches on two models, and pick or merge the best |
| `/desk:figure-it-out` | Plan an auditable run when no narrower skill fits, such as a large migration you review after stepping away |
| `/desk:swarm` | Fan out parallel workers for coverage, races or exploration, and get one report back |
| `/desk:tdd` | Fix a bug test-first, within the test budget |
| `/desk:blast-radius` | Find what a change could break outside its diff |
| `/desk:interrogate` | Review a diff from subagents on other models |
| `/desk:show-me-your-work` | Keep a log of each decision and its evidence during a long run, and check it at the end |
| `/desk:ketchup` | Catch up on what changed while you were away, and what needs you |
| `/desk:reflect` | Turn what went wrong in a chat into fixes for the project's skills and CLAUDE.md |
| `/desk:correct` | Make a mistake agents keep repeating impossible: architecture, types, a lint, then a test |
| `/desk:create-verification-skill`, `/desk:maintain-verification-skill` | Give the project a skill that drives the real app to verify a change, and keep it true |
| `/desk:benchmark-checklist` | Vet a performance measurement before you report or act on it |
| `/desk:typescript-best-practices` | Write TypeScript with types that make bad states impossible |
| `/desk:no-comments` | Strip comments that restate the code, with the `desk:comment-sicko` agent |
| `/desk:technical-writing`, `/desk:unslop` | Write docs, commit messages and PR bodies |

## Not checked yet

`sp-claude-desktop` was checked in headless CLI sessions, not yet in the desktop app.
The desktop docs say a worktree session reads its settings from the main checkout, so
`settings.local.json` should apply there too. Check these in the desktop app on the first
project:
- the `desk:` skills show in a desktop session and in a worktree session;
- `/memory` lists no `~/.claude/CLAUDE.md`;
- a `git commit` runs with no preview.

Desktop on Linux is in beta, and only Ubuntu 22.04+ and Debian 12+ are supported.
Desktop does not document worktrees of git submodules.
