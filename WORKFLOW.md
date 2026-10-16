# The super-project workflow

A super project is a root git repository whose modules are git submodules. Several Claude
Code sessions work on it in parallel. Each session is the only writer of its
repositories, coordinates through a few shared files, and runs git only after the
operator approves. Two layers make this work:

- **Global tooling**, installed once per machine and shared by every workspace.
- **A docs contract** in each root: the files and headings that the tooling parses.

This repository ships both: the docs as templates (`workspace/`, `module/`) and the
tooling under `tooling/`, which `tooling/install` links into place.

This file describes the workflow where the operator approves every commit.
[AUTOPILOT.md](AUTOPILOT.md) describes `/autopilot` (v0.2.0): a session approves its own
reviewed commits until a target, and stops for the operator's decisions.

## 1. Global tooling

`tooling/install` links each piece to the path below, so the checkout is the running
copy; `tooling/install --check` says what is missing. It never edits `settings.json`: it
prints the hooks and plugin dirs to merge. Paths in `BIN_DIR` and the config keys are the
defaults; `sp-config <KEY>` prints yours.

| Piece | Installed at | What it does |
|---|---|---|
| Git rules | `~/.claude/git-rules.md`, imported by `~/.claude/CLAUDE.md` | "Ready to commit" preview (status, diff stat, message, and the exact commands in one ```` ```commit ```` block, each pinned with `git -C <absolute path>` or `gh --repo`); runs only on a plain "approve"; commits as the operator, signed as the git config says, no trailers; messages and docs written with the `technical-writing` and `unslop` skills; `# approved` after any command that moves HEAD; never force-push, rebase a published branch, `reset --hard`, `clean` or `restore` |
| git-guard hook | `~/.claude/hooks/git-guard.sh` (PreToolUse Bash) | Always blocks `clean`, `reset --hard`, `rebase` and `restore`; blocks `stash`, `checkout`, `switch` and `worktree add` unless the command ends in `# approved` |
| typecheck hook | `~/.claude/hooks/typecheck.sh` (`track` after Edit/Write, `gate` on Stop) | Remembers the TypeScript projects and Go packages edited. At the end of the turn it runs `tsc -b`/`npm run typecheck` and `go vet`; a failure sends Claude back to fix it (up to 3 tries) |
| session-reset mod | `~/.claude/mods/session-reset` (listed in `CLAUDE_CODE_PLUGIN_DIRS`) | Enforces the git rules: a git or gh write runs only in the turn of a plain approve of a preview, whatever the preview's title. A preview is the answer's one `commit` block; a block with a note, a placeholder, a chain or an unpinned command opens none, and a toast says why. An approve with a question or a condition, or of a preview that commits with no `Review:` line, is held, and a commit the preview did not show runs only under a `Review:` line. An answer with no preview closes the open one. It blocks `--no-verify`, `--author`, `add -A`, force-push, trailers and identity overrides, and subagents may not write with git. After an approved run that commits, or when the operator says "committed" or `/committed`, it runs `/clear` and then `/session <ID> [note]`; a batch with no commit (a checkpoint's switches or tags) keeps the session. Session IDs it accepts: `S<n>`, `CP<m>`, `W`, `publish-<repo>`. `/autopilot [<step>] [--max N]` makes it approve the session's clean `git add` and `git commit` previews itself, running only their commands in order, until the step's commit, the session's `reached` checkpoint row or N commits; `/autopilot off` ends it ([AUTOPILOT.md](AUTOPILOT.md)). It logs each preview, approve, git or gh write and approved turn's end (a restart, or why none) to `~/.local/state/super-project/session-reset/<Claude session>.jsonl` (after 1 MiB, in `<Claude session>.2.jsonl` and on); `node tooling/mods/session-reset/replay.mjs [--list]` runs the local transcripts through the mod and counts the approves with no restart by cause. It records which workspace session each Claude session runs in `~/.local/state/super-project/sessions/<Claude session>.json` (`claude`, `id`, `root`, `since`, when the session started, kept over its restarts, and `preview`, whether a preview waits for an approve), written on `/session` and at each turn's end, and removed when the Claude session ends (`/clear`, `/resume`, exit), for the ops board |
| workspace mod | `~/.claude/mods/workspace` | Write guard: inside `/session <ID>` it denies edits and Bash writes outside the session's repositories, as read from the plan (section 3), and the root docs: the root's `.md` files outside the module repositories, which every session keeps current and leaves uncommitted for the operator's or the checkpoint's one root commit (`git-rules.md` rule 5). It blocks `S` sessions while the checkpoint row reads `running`, and everyone but `publish-<repo>` while a publish row does. A root's `.claude/workspace.json` adds its runtime rule (section 6). A band shows the ID, tracks, autopilot, checkpoint, operator steps, handoffs, how many of the workspace's other sessions wait for you (a preview, a question, or idle with ready work) and dirty repositories. `/ops` opens the operator-steps pane, whose sessions, the live `CP`, `W` and publish sessions among them, say whether they run ("idle 25m", "preview open 3m", "working 1m"), those that wait for you first; `/guard` tests a command. It is fail-open: if the docs do not parse, a toast says so and the guard is off |
| `/session <ID> [note]` | `~/.claude/commands/session.md` | Reads plan.md by heading (session table, Session IDs, Session rules, checkpoint rules, its tracker rows) and handoffs.md (status tables, its rows). Replies in five lines: ID, tracks, repositories, shared files, next step. It needs a plan and a go-ahead first for a multi-repository step, a checkpoint, an objective or an operator decision |
| `/operator-steps` | `~/.claude/commands/operator-steps.md` | Read-only table of open `O<n>` tasks in every registered root, sorted by what each unblocks |
| new project | `/new-project [file]` (`~/.claude/commands/new-project.md`), `sp-new <file>`, `sp-new --modules <root>` | Asks every setup question in one batch and writes one `project.toml`; `sp-new` renders the root documents from it, and the module documents after O1 ([SETUP.md](SETUP.md)) |
| session sweep | `~/.claude/bin/session-sweep.sh [root …]` | Before opening terminals: for each root, prints one Sonnet line per session ID (next step, runnable or blocked, dirty repositories) |
| ops board | `opsboard [--md\|--tsv] [root …]` | The one parser of operator.md and of handoffs.md's status tables and H rows. It also gives each `S` session's next step, how much is ready, what blocks it, its checkpoint row and its autopilot (from the files session-reset writes under `~/.local/state/super-project/autopilot/`), and whether it runs: working, waiting for you, a preview open, idle, or not running, since when, and how many processes claim the ID. That comes from Claude Code's own process records (`~/.claude/sessions/<pid>.json`), joined with session-reset's registry; it also lists the live processes at a root that no `S` session row covers, and removes a registry file with no live process once it is a day old. The workspace mod reads its `--tsv` output and shows the sessions in `/ops` |
| bootstrap | `sp-claude-init <root> [--skill <name>] [--force]` | Checks the docs contract, copies the project skills, writes `.zed/settings.json`, warns about `submodule.recurse`, and registers the root. Run again, it updates what it placed (section 6) |
| update | `sp-update [--ref <tag>] [--global] [root …]` | Brings roots, and with `--global` the installed tooling, to a version of this repository; lists the template doc changes to merge by hand |
| commit-all, push-all | `commit-all <root>`, `push-all <root>` | The operator's own helpers: walk the nested submodules deepest first |
| config | `sp-config <KEY>`; the file `${XDG_CONFIG_HOME:-~/.config}/super-project/config` | `KEY=value` lines; a missing key takes its default ([tooling/config.example](tooling/config.example)): `PROJECTS_DIR`, `ROOTS`, `PRIVATE_STRINGS`, `BIN_DIR`, `OVERLAY_DIR` |
| registry | `ROOTS` (`~/.config/super-project/roots`) | One root per line. The mods, the ops board, `/operator-steps` and the session sweep act only on these roots |
| private strings | `PRIVATE_STRINGS` (`~/.config/super-project/private-strings.txt`) | Strings that must never be published; leak-check and the `publish` skill look for them |
| leak check | `leak-check [<revisions>… \| --history]`; this repository's `.git/hooks/pre-push`, and another's after `tooling/install --hook <repo>…` | Runs gitleaks and the private strings (in any case) on the tracked files, on a range of commits and their messages, or on the whole history. It prints file names and counts only, never what matched. The pre-push hook runs it on what a push sends, and a hit stops the push |
| publish check | `publish-check [--snapshot] [<repo>]` | The local gates before a repository goes public, one line each with `ok`, `FAIL` or `warn`: a clean tree, leak-check on the files and (unless `--snapshot`) the history, the public files, CI (top-level `permissions:`, actions pinned by SHA, a gitleaks or leak-check step, zizmor clean when installed), Dependabot for actions, the pre-push hook, signed commits, and AGENTS.md's "Public repository" section. Exit 1 on a `FAIL`, 2 when a gate cannot be checked |
| publish templates | [tooling/publish/templates/](tooling/publish/templates) | What a repository needs to pass `publish-check`: LICENSE (MIT), SECURITY.md, CONTRIBUTING.md and CHANGELOG.md with `<placeholders>` to fill, `gitignore` (copied as `.gitignore`), the `leaks.yml` workflow (gitleaks over the tree and the history, pinned) and `dependabot.yml` for actions |
| GitHub hardening | `gh-harden <owner/repo> [--apply] [--main <b>] [--dev <b>] [--check-name <name>]` | Reads every GitHub setting a public repository needs (the account items, the settings before and after the switch, the rulesets) through `gh api`: `ok`, `missing` with the command that sets it, `after public`, `waiting` (a ruleset waits for its branch, the signing key and CI), or `ui`. `--apply` sets the missing ones and reads again; it never changes visibility or the account items. Rulesets come from `tooling/publish/rulesets/*.json`, matched by name. session-reset counts `--apply` as a write |
| overlay | `OVERLAY_DIR` (`~/.config/super-project/overlay`) | What stays private: `skills/<name>` for `sp-claude-init --skill`, and `mods/<name>`, which install adds to the plugin dirs it prints |

**Project skills.** They live in [tooling/skills/](tooling/skills), and `sp-claude-init`
copies them into `<root>/.claude/skills/`, recording each file's hash in
`.claude/project-harness.lock` (a `project-template.lock` from before the rename is read
once and moved). Run again, or through `sp-update`, it updates the copies nobody edited
and reports the edited ones (`--force` replaces them).
- `add-objective`: turns an idea into plan changes after iterating with the operator, then rebalances.
- `balance-sessions`: sizes the sessions to the workload: ready and blocked work per session from the ops board, how many sessions to run for the next stretch and which on `/autopilot`, a review of the decisions, the load (merge, split, park, start, move tracks), and the drift check as a fallback. `/balance-sessions drift` only reports.
- `milestone-checkpoints`: converts older checkpoint schemes to one `CP<m>` per milestone. A workspace made from this template already has it.
- `go-public`: `/go-public <repo>` plans a repository's public release, in place or as a snapshot: the steps `<CODE>-P1`–`P6` with their gates, a plan table row, a decision, a `planned` publish row and the operator tasks.
- `publish`: the `publish-<repo>` session works those steps (audit, cleanup, public files, CI and the pre-push hook, the gates, GitHub hardening and the first release).
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
| `plan.md` | A table whose first header cell is `Session`, with rows starting `` `S1` `` etc., its tracks in the second cell (`T1 Name, T2 Name`) and repository names in backticks or links | workspace mod, ops board, `/session` |
| `plan.md` | A table `\| Code \| Module \| Owns \| Track \|`, with `[Module](<repo>/plan.md)` links (code → folder) and the track in the fourth cell | workspace mod, ops board |
| `plan.md` | `### Session IDs` containing a bullet starting `- **Shared files`. Its sentences name the shared files for `/session`'s reply (the guard lets every session edit the root docs anyway); a sentence with "never" or starting with `CP` is skipped; `` `S2` also owns x `` (or `` `S2` owns x ``, also after a `;`) gives one session a file outside them | workspace mod, `sp-claude-init`, `/session` |
| `plan.md` | `### Session rules` (Each step, Always, Per session) and `### Milestone checkpoints` | `/session`, skills |
| `handoffs.md` | `## Checkpoint status` (`\| Session \| Checkpoint \| Status \| Since \|`), `## Publish status` (`\| Repository \| Status \| Since \|`), `## Rows` with `\| H<n> \|` rows | ops board, workspace mod, `/session`, `sp-claude-init` |
| `operator.md` | `## <section>` / `### O<n> <task>` with `**Session:**`, `**Unblocks:**`, `**When:**` and `**Status:**` fields; `## Later` holds later tasks | ops board, `/operator-steps` |
| `release.md` | One section per open checkpoint: `\| Repository \| Session \| Commit \| Recorded \|` | `CP<m>`, skills |
| module `plan.md` | `## Current state` and `## Next` (these win over the root queue when they differ). `## Next` items read `1. **<step>** title. Waits for <steps, H<n>, O<n>>.`, continued on indented lines; "done" right after the ID, or a tick `- [x] **<step>**` under `## Milestone steps`, marks a step finished | `/session`, `balance-sessions`, ops board |

## 4. Lifecycles

**A session step** (plan "Session rules"):
1. `/session <ID>` replies in five lines.
2. State scope and done-check.
3. Build the smallest slice.
4. Run the repository's checks.
5. Run `code-review` (and `simplify`).
6. Tick the step with evidence and record what it learned in research.md.
7. Clean up its own docs: "Current state", "Next" and its queue, its handoff rows, the
   `O<n>` entries it verified, and anything stale it wrote.
8. Show the Ready to commit preview with its `Review:` line and its commands in a
   `commit` block, run it on "approve", and the mod restarts the session. The mod holds an approve of a preview with no `Review:` line.

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
1. Measure: each session's ready and blocked work from `opsboard --tsv`, checked against the module plans.
2. Drift and decisions: the root queues and scopes against module "Current state" and "Next", the handoffs and operator tasks, each fix named as a session's skipped cleanup, or as setup; the decisions the open steps rest on, against what the work has shown.
3. Sync the plan and reprioritise the queues (P0 critical path, P1 parallel, P2 named need, M maintenance).
4. Judge the load: how many sessions the next stretch needs, then merge, split, park, start or move tracks, within the session cap, and which sessions run on `/autopilot`.
5. Propose, then apply on approval, with a decision row.

It runs when a checkpoint opens, after `/add-objective`, or when the operator asks.

**Going public:**
1. `/go-public <repo>` reads the gates (`publish-check`, `gh-harden`) and picks the way: in place when the history is clean, else one audited snapshot in a new repository of the same name, the old one renamed `<repo>-private` and archived. It writes the steps, a plan row, a decision, a `planned` publish row and the operator tasks.
2. `/session publish-<repo>` sets `running`. The owner stops, and no checkpoint runs.
3. It works the steps: audit, cleanup, the public files and the module's AGENTS.md "Public repository" section, CI and the pre-push hook, until `publish-check` passes and the operator signs off.
4. From previews: the push (or the snapshot), `gh-harden --apply`, the operator's visibility switch, `gh-harden --apply` again, the first tag and Release.

After that the repository is developed in the open by its own track; there is no export
and no second copy.

## 5. Design choices

| Topic | Choice | Why |
|---|---|---|
| Sessions and tracks | Two tables: a track is the only writer of its repositories; a session holds one or more tracks, at most four at once | Ownership stays fixed while the number of terminals changes |
| IDs | Milestones `M<m>`, sessions `S<n>`, root decisions `SD<n>`, each letter used once | An ID never means two things, so tools and people can grep for it |
| Versions | The system version is the milestone, one tag in every repository; libraries keep their own lines | One checkpoint is one release, easy to name and to reproduce |
| Module status | "Current state" and "Next" at the top of each module plan | `/session` reads them; one home per fact, and the module wins over the root queue |
| Evidence | Module `research.md`, next to the decisions it supports | No separate evidence tree to keep in sync |
| Session practice | Only in the root AGENTS.md; modules carry the Common working rules, copied verbatim | One copy to change |
| Public release | A repository goes public under its own name and is developed in the open; `/go-public` plans it, a `publish-<repo>` session works it | One copy of the code; the pre-push hook and CI are the gates on every push. A history that leaks is never rewritten: a snapshot starts a new repository |
| Future modules | Their steps wait in `future-steps.md` | The tracker lists only modules whose repositories exist |
| Setup | One `project.toml`, rendered by `sp-new` | Nothing is filled by hand, and the same answers give the same files |
| Guards | The workspace mod fails open with a toast | A broken doc never blocks work; section 3 is what to keep stable |

## 6. Registering a root

`sp-claude-init <root>` adds the root to the roots file (`sp-config ROOTS`). That is the
only registration: the mods, the ops board, `/operator-steps` and the session sweep all
read that file. Run again on a registered root, it updates the skills and Zed settings it
placed; `sp-update` does that for every root at a chosen version. One optional extra:
`.claude/workspace.json`, when a runtime script may only be run by one session. `sp-new`
writes it from the `[runtime]` section of `project.toml`:
`{"runtime": {"scripts": [...], "runners": "<session ID regex>", "free": [...],
"dockerFree": [...], "cite": "<plan section>", "commitFirst": {"<subcommand>":
[<repositories>]}}}`. Only sessions matching `runners` run the scripts, except their
`free` subcommands and the `dockerFree` docker subcommands; a `commitFirst` subcommand
waits until the listed repositories are committed. A file that does not parse turns the
guard off with a toast.
