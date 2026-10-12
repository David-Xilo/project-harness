# The super-project workflow

A super project is a root git repository whose modules are git submodules. Several Claude
Code sessions work on it in parallel. Each session is the only writer of its
repositories, coordinates through a few shared files, and runs git only after the
operator approves. Two layers make this work:

- **Global tooling**, installed once per machine and shared by every workspace.
- **A docs contract** in each root: the files and headings that the tooling parses.

This repository ships both: the docs as templates (`workspace/`, `module/`) and the
tooling under `tooling/`, which `tooling/install` links into place.

## 1. Global tooling

`tooling/install` links each piece to the path below, so the checkout is the running
copy; `tooling/install --check` says what is missing. It never edits `settings.json`: it
prints the hooks and plugin dirs to merge. Paths in `BIN_DIR` and the config keys are the
defaults; `sp-config <KEY>` prints yours.

| Piece | Installed at | What it does |
|---|---|---|
| Git rules | `~/.claude/git-rules.md`, imported by `~/.claude/CLAUDE.md` | "Ready to commit" preview (status, diff stat, message, exact commands per repository); runs only on a plain "approve"; commits as the operator, signed as the git config says, no trailers; `# approved` after any command that moves HEAD; never force-push, rebase a published branch, `reset --hard`, `clean` or `restore` |
| git-guard hook | `~/.claude/hooks/git-guard.sh` (PreToolUse Bash) | Always blocks `clean`, `reset --hard`, `rebase` and `restore`; blocks `stash`, `checkout`, `switch` and `worktree add` unless the command ends in `# approved` |
| typecheck hook | `~/.claude/hooks/typecheck.sh` (`track` after Edit/Write, `gate` on Stop) | Remembers the TypeScript projects and Go packages edited. At the end of the turn it runs `tsc -b`/`npm run typecheck` and `go vet`; a failure sends Claude back to fix it (up to 3 tries) |
| session-reset mod | `~/.claude/mods/session-reset` (listed in `CLAUDE_CODE_PLUGIN_DIRS`) | Enforces the git rules: a git or gh write must be the next command of the last preview, after a plain approve. An approve with a question or a condition is held. It blocks `--no-verify`, `--author`, `add -A`, force-push, trailers and identity overrides, and subagents may not write with git. After an approved run succeeds, or when the operator says "committed" or `/committed`, it runs `/clear` and then `/session <ID> [note]`. Session IDs it accepts: `S<n>`, `CP<m>`, `W`, `publish-<repo>` |
| workspace mod | `~/.claude/mods/workspace` | Write guard: inside `/session <ID>` it denies edits and Bash writes outside the session's repositories and shared files, as read from the plan (section 3). It blocks `S` sessions while the checkpoint row reads `running`, and everyone but `publish-<repo>` while a publish row does. A root's `.claude/workspace.json` adds its runtime rule (section 6). A band shows the ID, tracks, checkpoint, operator steps, handoffs and dirty repositories. `/ops` opens the operator-steps pane; `/guard` tests a command. It is fail-open: if the docs do not parse, a toast says so and the guard is off |
| `/session <ID> [note]` | `~/.claude/commands/session.md` | Reads plan.md by heading (session table, Session IDs, Session rules, checkpoint rules, its tracker rows) and handoffs.md (status tables, its rows). Replies in five lines: ID, tracks, repositories, shared files, next step. It needs a plan and a go-ahead first for a multi-repository step, a checkpoint, an objective or an operator decision |
| `/operator-steps` | `~/.claude/commands/operator-steps.md` | Read-only table of open `O<n>` tasks in every registered root, sorted by what each unblocks |
| new project | `/new-project [file]` (`~/.claude/commands/new-project.md`), `sp-new <file>`, `sp-new --modules <root>` | Asks every setup question in one batch and writes one `project.toml`; `sp-new` renders the root documents from it, and the module documents after O1 ([SETUP.md](SETUP.md)) |
| session sweep | `~/.claude/bin/session-sweep.sh [root …]` | Before opening terminals: for each root, prints one Sonnet line per session ID (next step, runnable or blocked, dirty repositories) |
| ops board | `opsboard [--md\|--tsv] [root …]` | The one parser of operator.md and of handoffs.md's status tables and H rows. The workspace mod reads its `--tsv` output |
| bootstrap | `sp-claude-init <root> [--skill <name>] [--force]` | Checks the docs contract, copies the project skills, writes `.zed/settings.json`, warns about `submodule.recurse`, and registers the root. Run again, it updates what it placed (section 6) |
| update | `sp-update [--ref <tag>] [--global] [root …]` | Brings roots, and with `--global` the installed tooling, to a version of this repository; lists the template doc changes to merge by hand |
| commit-all, push-all | `commit-all <root>`, `push-all <root>` | The operator's own helpers: walk the nested submodules deepest first |
| config | `sp-config <KEY>`; the file `${XDG_CONFIG_HOME:-~/.config}/super-project/config` | `KEY=value` lines; a missing key takes its default ([tooling/config.example](tooling/config.example)): `PROJECTS_DIR`, `PUBLISHED_DIR`, `ROOTS`, `PRIVATE_STRINGS`, `BIN_DIR`, `OVERLAY_DIR` |
| registry | `ROOTS` (`~/.config/super-project/roots`) | One root per line. The mods, the ops board, `/operator-steps` and the session sweep act only on these roots |
| private strings | `PRIVATE_STRINGS` (`~/.config/super-project/private-strings.txt`) | Strings that must never be published; leak-check and the `publish` skill look for them |
| leak check | `leak-check [<revisions>… \| --history]`; this repository's `.git/hooks/pre-push` | Runs gitleaks and the private strings (in any case) on the tracked files, on a range of commits and their messages, or on the whole history. It prints file names and counts only, never what matched. The pre-push hook runs it on what a push sends, and a hit stops the push |
| publish check | `publish-check [--snapshot] [<repo>]` | The local gates before a repository goes public, one line each with `ok`, `FAIL` or `warn`: a clean tree, leak-check on the files and (unless `--snapshot`) the history, the public files, CI (top-level `permissions:`, actions pinned by SHA, a gitleaks or leak-check step, zizmor clean when installed), Dependabot for actions, the pre-push hook, signed commits, and AGENTS.md's "Public repository" section. Exit 1 on a `FAIL`, 2 when a gate cannot be checked |
| overlay | `OVERLAY_DIR` (`~/.config/super-project/overlay`) | What stays private: `skills/<name>` for `sp-claude-init --skill`, and `mods/<name>`, which install adds to the plugin dirs it prints |

**Project skills.** They live in [tooling/skills/](tooling/skills), and `sp-claude-init`
copies them into `<root>/.claude/skills/`, recording each file's hash in
`.claude/project-template.lock`. Run again, or through `sp-update`, it updates the copies
nobody edited and reports the edited ones (`--force` replaces them).
- `add-objective`: turns an idea into plan changes after iterating with the operator, then rebalances.
- `balance-sessions`: checks the plan for drift against module plans, handoffs and operator tasks, reorders queues, judges load (merge, split, park, start, move tracks) and says what to run next. `/balance-sessions drift` only reports.
- `milestone-checkpoints`: converts older checkpoint schemes to one `CP<m>` per milestone. A workspace made from this template already has it.
- `go-public`: marks a repository for open source (a plan table row, a decision, a `planned` publish row).
- `publish`: the `publish-<repo>` session (audit, cleanup, public files, CI, allowlist export into `PUBLISHED_DIR/<repo>-oss`).
- A private skill one workspace needs goes in the overlay and is copied with `--skill <name>`.

**Global skills used in every step:** `code-review` on each diff before the commit
preview, and `simplify` when a slice grew.

**Memory.** It is per root path, so a new workspace starts empty. Workflow facts belong in
its AGENTS.md and plan, not in memory.

## 2. Roles and IDs

| ID | What | Where |
|---|---|---|
| `M<m>` | Milestone, a delivery stage with a release | plan "Milestones" |
| `G<m>-<name>` | Gate: dependent work waits for its evidence | plan "Gates" |
| `<CODE>-<m>.<n>` | Module step; `<CODE>-0.<n>` is maintenance | module plan "Milestone steps", root tracker |
| `T<n>` | Track: the only writer of its repositories | plan track table |
| `` `S<n>` `` | Track session, holding one or more tracks (at most four) | plan session table |
| `` `CP<m>` `` | M*m*'s checkpoint, and the session that runs it | plan "Milestone checkpoints" |
| `` `publish-<repo>` `` | Publish session of a module marked public | plan "Public release" |
| `` `W` `` | Workspace session in an umbrella root (a folder of loosely related projects) with no checkpoint; not used by this template | — |
| `H<n>` | Request between tracks | handoffs.md |
| `O<n>` | Operator task, one ID per task | operator.md |
| `SD<n>` / `D<n>` | Root / module decision | decisions.md / module plan |

## 3. The docs contract

What the tooling parses. Rename one of these and something stops working silently,
because the workspace mod fails open.

| File | Must contain | Read by |
|---|---|---|
| `AGENTS.md` | Common working rules (copied verbatim into every module), Session practice, Workspace boundaries | Claude Code (auto-loaded) |
| `plan.md` | A table whose first header cell is `Session`, with rows starting `` `S1` `` etc. and repository names in backticks or links | workspace mod, `/session` |
| `plan.md` | A table whose first header cell is `Code`, with `[Module](<repo>/plan.md)` links (code → folder) | workspace mod |
| `plan.md` | `### Session IDs` containing a bullet starting `- **Shared files`. Its sentences list the `.md` files every session may edit; a sentence with "never" or starting with `CP` is skipped; `` `S2` also owns x.md `` gives one session a file | workspace mod, `sp-claude-init`, `/session` |
| `plan.md` | `### Session rules` (Each step, Always, Per session) and `### Milestone checkpoints` | `/session`, skills |
| `handoffs.md` | `## Checkpoint status` (`\| Session \| Checkpoint \| Status \| Since \|`), `## Publish status` (`\| Repository \| Status \| Since \|`), `## Rows` with `\| H<n> \|` rows | ops board, workspace mod, `/session`, `sp-claude-init` |
| `operator.md` | `## <section>` / `### O<n> <task>` with `**Session:**`, `**Unblocks:**`, `**When:**` and `**Status:**` fields; `## Later` holds later tasks | ops board, `/operator-steps` |
| `release.md` | One section per open checkpoint: `\| Repository \| Session \| Commit \| Recorded \|` | `CP<m>`, skills |
| module `plan.md` | `## Current state` and `## Next` (these win over the root queue when they differ) | `/session`, `balance-sessions` |

## 4. Lifecycles

**A session step** (plan "Session rules"):
1. `/session <ID>` replies in five lines.
2. State scope and done-check.
3. Build the smallest slice.
4. Run the repository's checks.
5. Run `code-review` (and `simplify`).
6. Tick the step with evidence and update "Current state" and research.md.
7. Update the handoff rows.
8. Record the next step in the docs.
9. Show the Ready to commit preview, run it on "approve", and the mod restarts the session.

"approve, then <note>" passes a note to the restarted session.

**A handoff:** `open` (requester) → `acknowledged` (owner plans a step ID) → `delivered`
(commit or evidence link) → `closed` (requester confirms), or `declined`. `CP<m>` removes
closed rows. IDs are never reused.

**An operator task:** the session writes `### O<n>` with full paths and commands. The
operator does it and tells the named session "O<n> done". The session verifies, records
evidence and deletes the entry; a standing task keeps its entry with "last run <date>".

**A checkpoint:**
- Every `S<n>` works its scope for the open `CP<m>`, records release commits in release.md and sets `reached`. It may then work ahead; those commits are not in the release.
- When all read `reached` and no publish row is `running`, the operator runs `/session CP<m>`, which sets `running`. No one else works.
- `CP<m>`:
  1. Switches each repository to `release/<tag>` at its recorded commit.
  2. Runs the checks and acceptance, and records the evidence.
  3. Updates the tracker, capabilities and pins.
  4. Tags; `main` fast-forwards.
  5. Merges the branch back with `--no-ff`.
  6. Opens `CP<m+1>`: new scopes, a release.md section, rows back to `working`.
  7. Runs `/balance-sessions`.
- A fix after recording goes on `release/<tag>`, never by rewriting `development`.

**Rebalancing** (`/balance-sessions`):
1. Drift: the root queues and scopes against module "Current state" and "Next", the handoffs and operator tasks.
2. Sync the plan.
3. Reprioritise the queues (P0 critical path, P1 parallel, P2 named need, M maintenance).
4. Judge each session's load: ready against blocked steps. Then merge, split, park, start or move tracks, within the session cap.
5. Propose, then apply on approval, with a decision row.

It runs when a checkpoint opens, after `/add-objective`, or when the operator asks.

**Going public:**
1. `go-public` adds a plan row, a decision and a `planned` publish row.
2. `/session publish-<repo>` sets `running`. The owner stops, and no checkpoint runs.
3. It audits and exports to `PUBLISHED_DIR/<repo>-oss`, then adds a "Public repository" section to the module's AGENTS.md.
4. It pushes on approve.

Changes flow private → public only.

## 5. Design choices

| Topic | Choice | Why |
|---|---|---|
| Sessions and tracks | Two tables: a track is the only writer of its repositories; a session holds one or more tracks, at most four at once | Ownership stays fixed while the number of terminals changes |
| IDs | Milestones `M<m>`, sessions `S<n>`, root decisions `SD<n>`, each letter used once | An ID never means two things, so tools and people can grep for it |
| Versions | The system version is the milestone, one tag in every repository; libraries keep their own lines | One checkpoint is one release, easy to name and to reproduce |
| Module status | "Current state" and "Next" at the top of each module plan | `/session` reads them; one home per fact, and the module wins over the root queue |
| Evidence | Module `research.md`, next to the decisions it supports | No separate evidence tree to keep in sync |
| Session practice | Only in the root AGENTS.md; modules carry the Common working rules, copied verbatim | One copy to change |
| Public release | A section in the root plan and a `publish-<repo>` session | Going public is a scheduled step, and changes flow private → public only |
| Future modules | Their steps wait in `future-steps.md` | The tracker lists only modules whose repositories exist |
| Setup | One `project.toml`, rendered by `sp-new` | Nothing is filled by hand, and the same answers give the same files |
| Guards | The workspace mod fails open with a toast | A broken doc never blocks work; section 3 is what to keep stable |

## 6. Registering a root

`sp-claude-init <root>` adds the root to the roots file (`sp-config ROOTS`). That is the
only registration: the mods, the ops board, `/operator-steps` and the session sweep all
read that file. Run again on a registered root, it updates the skills and Zed settings it
placed; `sp-update` does that for every root at a chosen version. Two optional extras:
- `.claude/settings.local.json` with `additionalDirectories` for `PUBLISHED_DIR`, once a module will be published.
- `.claude/workspace.json`, when a runtime script may only be run by one session. `sp-new`
  writes it from the `[runtime]` section of `project.toml`:
  `{"runtime": {"scripts": [...], "runners": "<session ID regex>", "free": [...],
  "dockerFree": [...], "cite": "<plan section>", "commitFirst": {"<subcommand>":
  [<repositories>]}}}`. Only sessions matching `runners` run the scripts, except their
  `free` subcommands and the `dockerFree` docker subcommands; a `commitFirst` subcommand
  waits until the listed repositories are committed. A file that does not parse turns the
  guard off with a toast.
