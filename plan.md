# project-harness plan

Updated 2026-10-13. This plan holds the work left on project-harness itself: tracks, open
steps, releases and the decisions they rest on. Setup copies only `workspace/` and
`module/` into a new workspace, never this file. What is built is described in
[WORKFLOW.md](WORKFLOW.md) and the [CHANGELOG](CHANGELOG.md); how, in git log.

## Contents

1. [What project-harness is](#what-project-harness-is)
2. [How it fits together](#how-it-fits-together)
3. [Components and ownership](#components-and-ownership)
4. [Tracks and order](#tracks-and-order)
5. [Tracker: open steps](#tracker-open-steps)
6. [Releases and versions](#releases-and-versions)
7. [Rules for this repository](#rules-for-this-repository)
8. [Decisions](#decisions)

## What project-harness is

A template and its tooling for running a coordinated super project: a root repository with
module submodules, several Claude Code sessions in parallel, each the only writer of its
repositories, git only after the operator's approve, and one checkpoint per milestone.
The docs and the tooling that reads them (mods, hooks, ops board, bootstrap, skill
templates) live here; `tooling/install` links the tooling into `~/.claude` and `BIN_DIR`,
so the checkout is the running copy. [T4](#t4-autopilot-m2) adds a second mode,
autopilot: the operator decides ahead, and Claude builds, reviews, merges and releases
unattended.

**Defaults:**
- Build only what a live workspace needs.
- One operator, Linux, Claude Code. Packaging, a plugin marketplace, macOS and other
  agents are deferred.
- Personal values (paths, registered roots, private strings, signing) live in local
  config, never in the repository.
- Public since v0.1.0 (2026-10-11) and developed in the open ([D11](#decisions)). The
  history before v0.1.0 stays in the archived private repository.

## How it fits together

```mermaid
flowchart LR
  T[workspace/ and module/ docs] --> I[sp-claude-init]
  I --> R[live workspace root]
  I --> G[roots registry]
  G --> B[opsboard]
  R --> B
  R --> M[mods: session-reset, workspace]
  B --> M
  H[hooks: git-guard, typecheck] --> S[Claude Code sessions]
  M --> S
  S --> R
```

- **Docs** (`workspace/`, `module/`): the files and headings the tooling parses, the docs
  contract in [WORKFLOW.md](WORKFLOW.md) section 3.
- **Bootstrap** (`sp-claude-init`): checks the contract, copies the project skills and
  registers the root.
- **Ops board** (`opsboard`): the one parser of `operator.md` and `handoffs.md`; the
  workspace mod reads its `--tsv` output.
- **Mods**: session-reset gates git on the operator's approve and restarts the session
  after a commit; workspace guards writes by session and shows the band and the `/ops`
  pane.
- **Hooks**: git-guard blocks destructive git; typecheck sends Claude back on a failing
  type check.

## Components and ownership

One track writes each component at a time. Every component lives under `tooling/`, and
`tooling/install` links it to the path it runs from ([WORKFLOW.md](WORKFLOW.md)
section 1).

| Code | Component | Owns | Tracks left |
|---|---|---|---|
| DOC | Template docs | README, WORKFLOW, SETUP, `workspace/`, `module/` | T4 |
| MOD | Mods | session-reset, workspace | T4, then T2, then T3 |
| BIN | Scripts | opsboard, sp-claude-init, session-sweep, commit-all, push-all, leak-check, publish-check, gh-harden, sp-autopilot | T4, then T3 |
| HOOK | Hooks | git-guard, typecheck, the pre-push hook | — |
| SKL | Skills and commands | skill templates, `/session`, `/operator-steps` | T4, then T2 |
| PUB | Publishing | `tooling/publish/` (templates, rulesets) | — |

## Tracks and order

One session at a time works here, from a plain session in this repository; it is not a
registered root. The tracks run in the order of the table below (T4 comes before T2,
[D8](#decisions)), so each finishes before the next starts. One exception: BOARD-4.2 and
BOARD-4.3 touch only `opsboard` and may start during T2.

| Track | Goal | Milestone | Release |
|---|---|---|---|
| **T4 Autopilot** | A workspace in autopilot mode runs from its charter to a release with no approve; the operator only answers questions and does operator tasks | M2 | v0.2.0 |
| **T2 Commit loop** | Every approve whose commands succeed ends in a session restart | M3 | v0.3.0 |
| **T3 Session board** | The ops board shows each session ID: live or not, working, waiting or idle, since when | M4 | v0.4.0 |

T1 Public (M1) is built and released as v0.1.0 and v0.1.1; only its gate is left.

**Waiting on the operator:** the `O<n>` tasks, under "Open operator tasks" in the tracker.

## Tracker: open steps

Priorities: **P0** critical path, **P1** required but parallel, **P2** only for a named
need. Step IDs are `<CODE>-<milestone>.<n>`, never renumbered or reused; the next
operator task is O10.

**Open operator tasks:** none.

**Next.**
- The operator confirms **Gate M1** from the evidence under it, or names what is missing.
- Then T4, from AUTO-2.1.

**Notes.**
- The publish skills (`go-public`, `publish`) were checked by reading, not on a fixture
  workspace. The first real `/go-public` is their run.
- Edits to the session-reset mod get no verdict from auto mode's check; make them outside
  auto mode.
- GitHub drops parameters it does not use from a stored ruleset (`update` on a tag
  ruleset keeps none), so a ruleset file holds only what GitHub keeps, or `gh-harden`
  reads it as different forever.
- Elsewhere, not in this repository: a workspace planned under the old export model
  (`<repo>-oss` names, `PUBLISHED_DIR`, its own copies of the publish skills) moves to D11
  after `sp-update` brings it v0.1.1. There, `/go-public <repo>` plans each module again,
  and the operator decides the names and any module paths that named `-oss`.

### T1 Public (M1)

- [ ] **Gate M1:** a clean checkout installs and runs in a live workspace → v0.1.0.
  Evidence: v0.1.0 is released (`c338a16`, CI passed on `main` and the tag); its archive
  from GitHub installs into a scratch home, and a second install links nothing; the
  operator's live workspaces run the same files from this checkout; `gh-harden
  David-Xilo/project-harness` prints only `ok` and `ui` (2026-10-13). The operator
  confirms.

### T4 Autopilot (M2)

Why: in the operated workflow the operator is in every step. They approve each commit,
open a terminal per session, give a go-ahead for multi-repository steps, approve each
rebalance and start each checkpoint. The operator wants to own the vision and the
decisions only, and to do the steps only they can do. The more they decide in advance,
the more Claude runs unattended. At the limit they decide everything up front, and
Claude loops build → review → merge → checkpoint until the last milestone.

Autopilot is a second workflow, picked per workspace (D5). The operated workflow stays.
- **Shared charter.** Both modes keep `plan.md` (vision, milestones, gates, the tracker
  with each step's dependencies), `acceptance.md`, `decisions.md`, `operator.md`,
  `capabilities.md`, `glossary.md` and the module plans and research.
- **What autopilot replaces.** The `S<n>` sessions and tracks, `handoffs.md`, `release.md`,
  the checkpoint status and the per-commit approve. A need between modules becomes a new
  step. The release is what is merged when the checkpoint runs.
- **New docs.**
  - `policy.md`: decision classes, each `auto`, `auto+log` or `ask` (D7). Git authority,
    budgets (workers, workers per repository, review rounds, retries, a daily token cap)
    and stop conditions.
  - A "never automatic" list in `policy.md`: going public, secrets, money, deleting data,
    force-push and sudo.
  - `inbox.md`: questions `### Q<n>`, each with options, the recommended one first, whether
    it is reversible and what it blocks.
  - Provisional rows `SD<n> (auto, <date>)` in `decisions.md`, for the operator to
    confirm or overturn. An overturn becomes a new step.
  - `"mode": "operated" | "autopilot"` in `.claude/workspace.json`, changed only at a
    checkpoint.
- **The loop** (`sp-autopilot <root>`: bash, its state in git and a JSONL log; D6):
  1. Ready steps are those whose dependencies are merged and that wait on no open `Q` or
     `O`, within the worker caps.
  2. A worker runs in `git worktree add .worktrees/<step> -b auto/<step> development` as
     `claude -p "/auto-step <step>"`. It builds, checks, ticks the step, commits (signed),
     pushes and opens a PR.
  3. A fresh `claude -p "/auto-review <pr>"` reruns the checks and `code-review`. It
     approves, sends the PR back (up to N rounds) or escalates to a `Q`. CI must pass.
  4. The driver merges `development` into a lagging branch (never a rebase), then runs
     `git merge --no-ff` into `development`, signed. It pushes, then removes the branch
     and the worktree.
  5. `claude -p "/auto-replan"` (`balance-sessions` with policy authority) adds, splits
     and reorders steps within policy; anything else becomes a `Q`.
  6. When a milestone's steps are merged and its gate has evidence,
     `claude -p "/auto-checkpoint M<m>"` runs acceptance from a clean checkout. It
     updates capabilities and the submodule pins, tags (signed), fast-forwards `main`,
     creates the GitHub release and writes `digest.md`. A failing acceptance becomes fix
     steps.
  7. The run stops and notifies when only `Q`s and `O`s are left, a budget is hit, a step
     keeps failing, leak-check hits, or `.claude/autopilot.stop` exists. The notification
     lists every open `Q` and `O` at once.
- **Where it runs.** The driver is local, not in the cloud: a cloud session cannot sign
  with the operator's local key, load the local mods or keep data private. Signing uses
  the signing agent's cached approval, so the operator unlocks once per run.
- **The operator's part.**
  - `/decide-ahead [M<m>]` asks the foreseeable forks of the coming steps in batches,
    each with a recommendation, and records the answers as `SD` rows and policy entries.
  - `/answer` clears the inbox in a batch.
  - `/ops` shows the inbox, the `O`s, the running workers, recent merges and the
    provisional decisions.
- **Safety kept.**
  - git-guard still blocks `clean`, `reset --hard`, `rebase`, `restore` and force-push.
  - Workers write only inside their worktree.
  - leak-check runs before every push.
  - The autopilot git rules are their own section of the git rules. They hold only where
    `mode` is `autopilot` and while the driver runs.

| Done | Pri | Step | Depends on | Done when |
|---|---|---|---|---|
| [ ] | P0 | AUTO-2.1: `AUTOPILOT.md`: the mode, the docs contract it adds and the loop; WORKFLOW.md links to it | M1 | Links resolve; the operator reads it |
| [ ] | P0 | AUTO-2.2: Contract. `workspace/policy.md`, `workspace/inbox.md`, provisional rows in `decisions.md`, `mode` in `workspace.json`, `sp-claude-init --mode autopilot`. opsboard parses `Q<n>`; `/ops` shows them | AUTO-2.1 | `opsboard --tsv` lists a fixture's `Q`s; mod tests pass |
| [ ] | P0 | AUTO-2.3: Skills `/decide-ahead` (forks of the coming steps → `SD` rows and policy) and `/answer` (the inbox in one batch) | AUTO-2.2 | A fixture plan's forks are asked and recorded |
| [ ] | P0 | AUTO-2.4: Spike: headless `claude -p` in a worktree. Do the mods and hooks load, which permission mode and allowlist work, does the workspace mod guard the worktree path, does signing work from the signing agent's cache with no TTY, and what does `--output-format json` give back. **O4** comes first: the SSH signing agent remembers approval, with an auto-lock window that covers a run | AUTO-2.1 | Findings in this plan, each with its command |
| [ ] | P0 | AUTO-2.5: Worker: `/auto-step` and the driver's worktree, branch, PR and JSONL log. **O5:** `gh` has the `repo` scope for the module repositories | AUTO-2.2, AUTO-2.4 | One fixture step ends in an open PR with evidence |
| [ ] | P0 | AUTO-2.6: Review and merge: `/auto-review`, the local signed `merge --no-ff`, catching up with `development` by merge, the round limit and the escalation to a `Q` | AUTO-2.5 | A good PR merges signed; a bad one goes back, then escalates |
| [ ] | P0 | AUTO-2.7: Scheduler: ready set, caps, stop conditions, kill switch, notification. The autopilot section of `tooling/claude/git-rules.md`, which `~/.claude/CLAUDE.md` already imports | AUTO-2.6 | Two steps in parallel in one repository merge; a blocked run stops with one notification |
| [ ] | P1 | AUTO-2.8: Replanner `/auto-replan`: the `balance-sessions` checks with policy authority | AUTO-2.7 | A merged step that makes a new need adds a step; an `ask` change becomes a `Q` |
| [ ] | P0 | AUTO-2.9: Checkpoint `/auto-checkpoint` and `digest.md` | AUTO-2.7 | A fixture milestone is tagged and released, signed |
| [ ] | P0 | AUTO-2.10: End to end: a toy two-module super project goes from its charter through two milestones unattended. Then docs, CHANGELOG and the release | AUTO-2.8, AUTO-2.9 | v0.2.0 tagged |

- [ ] **Gate M2:** the toy project passes two milestones with no approve; the operator
  only answered `Q`s and did `O`s → v0.2.0.

### T2 Commit loop (M3)

Why: an approved commit often does not clear and restart the session. Replaying the
session-reset gate over past transcripts showed about 35 of 177 approves without a
restart, almost all at the root commit. Two causes account for most of them:
- **Nothing left to commit.** Another session had already committed the shared root file
  whole, so `git commit` exits 1, the preview counts as failed, and a re-approve fails the
  same way.
- **Wrong working directory.** Preview lines carry no directory, and the shell's
  directory persists from earlier work. The obvious fix, `cd <root> && …`, is denied as
  not matching the preview. The bare command fails, and one failure locks every later
  command.

The other causes: chaining that differs from the preview, annotated or template lines
that can never match, a reworded message, and fenced diff blocks parsed as commands. The
guard also reads a tool's name in any command as a call to that tool: copying the
`commit-all` and `push-all` scripts with `cp` was denied.

The fix (decision D2): the model stops retyping git commands. On a plain approve, the mod
runs the preview itself.

| Done | Pri | Step | Depends on | Done when |
|---|---|---|---|---|
| [ ] | P0 | LOOP-3.1: session-reset appends a JSONL log under `~/.local/state/`: preview, approve, each command and result, restart or the reason for none. A local replay script over transcripts serves as the regression harness; its data is never committed | M2 | The replay reproduces the failure classes above |
| [ ] | P0 | LOOP-3.2: Preview contract. Exactly one fenced block tagged `commit` holds the commands, each pinned to an absolute repository path (`git -C <abs>`, `gh` with `--repo`). Diffs and messages go in other blocks and are never parsed. A block with placeholders or annotations is rejected at preview time, with a toast. Update the git rules, `/session` and WORKFLOW.md | LOOP-3.1 | Parser tests pass |
| [ ] | P0 | LOOP-3.3: Runner. First a spike: how a mod hands output back to the conversation. Then, on a plain approve, the mod runs the block in order with `$.process.run`, with a timeout long enough for the signing prompt. It stops at the first failure and gives the model the failing command and output to report; on success it restarts. Git writes typed by the model stay denied | LOOP-3.2 | A two-repository preview runs and restarts in a live workspace |
| [ ] | P0 | LOOP-3.4: Empty commit. Before each `git commit`, if the paths from its `git add` have no diff against HEAD and nothing is staged, record "already committed in `<hash>`" and continue | LOOP-3.3 | The fixture of a root file committed by another session restarts |
| [ ] | P1 | LOOP-3.5: Recovery. A re-approve resumes at the failed command. `/committed` restarts only after a git check: the preview's paths are clean and each repository's HEAD moved, or the path was already committed. Relax its doubt filter. The band shows "preview n/m ran, failed at …" | LOOP-3.3 | Tests for each path |
| [ ] | P0 | LOOP-3.6: Fixtures for every failure class: empty root commit, wrong directory, signing failure, diff lines in the preview, an unbalanced apostrophe, several roots, template tag lines, a tool name in a non-git command | LOOP-3.4 | The replay restarts after every approve whose commands succeed; one week of live use confirms it from the log |
| [ ] | P1 | LOOP-3.7: Docs (WORKFLOW.md lifecycle, git rules), CHANGELOG, release | LOOP-3.6 | v0.3.0 tagged |

- [ ] **Gate M3:** one week of live use with no missed restart in the log → v0.3.0.

### T3 Session board (M4)

Why: the operator cannot see which sessions are running, which are idle and which wait
for an approve. Claude Code's own per-process records (`~/.claude/sessions/<pid>.json`)
already give `busy`, `idle` or `waiting` and liveness. What is missing is a record on
disk of which `/session <ID>` each process runs. The old attention files in
`~/.cache/agents` have no working state, are never cleaned up and carry no session ID.

| Done | Pri | Step | Depends on | Done when |
|---|---|---|---|---|
| [ ] | P0 | BOARD-4.1: Session registry. session-reset writes `~/.local/state/super-project/sessions/<pid>.json` (`pid`, process start, Claude session, root, ID, time) on `/session` and on each restart. It clears it on a user `/clear` or `/resume`; a SessionEnd hook removes it | M3 | Files match the running sessions |
| [ ] | P0 | BOARD-4.2: opsboard parses the plan's `Session` table (IDs, tracks, repositories) and keeps the Since column and the at-rest rows of the checkpoint and publish status | M2 | `--tsv` lists every session ID of every root |
| [ ] | P0 | BOARD-4.3: Join the live data per ID: working, waiting for approval, waiting for input, idle since, or not running; two processes claiming one ID; checkpoint status and since; dirty repositories; open `O<n>` and handoffs addressed to it. Also list live sessions at a root with no ID. Output in `--tsv`, plain and `--md`. The Claude Code records are internal: one reader function, failing soft | BOARD-4.1, BOARD-4.2 | Matches a manual check of running sessions |
| [ ] | P1 | BOARD-4.4: `/ops` pane: a Sessions block per workspace above the operator steps, idle sessions first ("idle 25m, ready"); the band shows the count of idle sessions | BOARD-4.3 | Seen in the pane |
| [ ] | P1 | BOARD-4.5: Retire `~/.cache/agents`; docs, CHANGELOG, release | BOARD-4.4 | v0.4.0 tagged |

- [ ] **Gate M4:** the board matches the running sessions for a week → v0.4.0.

## Releases and versions

- Milestone M*m* is `v0.<m>.0`: an annotated, signed tag whose notes list the
  capabilities, and a GitHub Release (`gh release create <tag> --verify-tag
  --notes-from-tag`, run inside the checkout: it refuses `-R`). A patch version `v0.<m>.<p>` carries fixes
  and small tooling between milestones.
- Work lands on `development`, the default branch. A release fast-forwards `main` to the
  release commit once CI has passed on it, and the tag goes on that commit. `main` is
  always the latest release; README installs from it.
- Pull requests target `development`. Merge commits or squash; never a rebase merge,
  which drops the signature.
- Nobody force-pushes or rewrites `main` or `development`.
- session-reset counts `git tag -v`, `git fetch` and `gh api` as writes, so they run from
  a preview; `gh run view` and `gh run watch` are reads.
- CI pins Claude Code to the version the mods are written for (2.1.296; 2.1.283 fails to
  load the workspace mod).

## Rules for this repository

- **Everything here is public.** Every push is public at once, this plan included: no
  private names or paths, no workspace names, personal folders, transcript IDs, captured
  data or secrets, and commit messages stay neutral. The pre-push hook runs leak-check;
  CI runs it over the tree and the history.
- **Personal values only in local config.** Workspace-specific behaviour only through
  `.claude/workspace.json` or an overlay. Never in the repository: the config file, the
  roots registry, the private-strings list, the overlay, `~/.claude/settings.json` and
  the personal lines of `~/.claude/CLAUDE.md`.
- **The docs contract moves as one.** A change to a parsed file or heading updates
  WORKFLOW.md section 3 and the parsers in the same commit.
- **Git** follows the global rules: a preview, then the operator's approve.

## Decisions

| ID | Decision | Date |
|---|---|---|
| D1 | Repository layout and local config: install links each file to the path it runs from; one `KEY=value` config file read through `sp-config`; data rules in `.claude/workspace.json`, code rules and private skills in the overlay ([WORKFLOW.md](WORKFLOW.md) section 1) | 2026-10-10 |
| D2 | The session-reset mod runs the approved preview itself; the model no longer retypes git commands | 2026-10-10 |
| D4 | The public repository holds the docs and the tooling, under MIT | 2026-10-10 |
| D5 | Autopilot is a second workflow, picked per workspace with `mode` in `.claude/workspace.json`; the operated workflow stays. Both share the charter docs ([T4](#t4-autopilot-m2)) | 2026-10-11 |
| D6 | In autopilot each step runs in its own worktree and branch, then a PR, a fresh-context Claude review and CI, then a local signed `merge --no-ff` by the driver `sp-autopilot`. The policy approves every git action up to and including checkpoints, tags and releases; going public stays manual. Signing uses the signing agent's cached approval. The driver runs locally, not in the cloud | 2026-10-11 |
| D7 | Unknowns in autopilot follow `policy.md`: each decision class is `auto`, `auto+log` (a provisional `SD` row) or `ask` (a `Q<n>` in `inbox.md`, and the worker moves to other ready work) | 2026-10-11 |
| D8 | T4 Autopilot comes right after T1 as M2 (v0.2.0); T2 becomes M3 and T3 M4. Their steps were renumbered once for it (`LOOP-3.n`, `BOARD-4.n`), the one exception to "never renumbered" | 2026-10-11 |
| D9 | A new project is set up from one file: the `new-project` skill interviews the operator in one batch and writes `.claude/project.toml` (or the operator edits it), and `sp-new` renders every root and module document from it. Agents no longer fill tokens by hand across the docs | 2026-10-11 |
| D11 | Develop in the open. A repository goes public under its own name and is developed there: in place when its history is clean, else one audited snapshot in a new repository of that name, with the old one renamed `<repo>-private` and archived. The gates are local (`publish-check`, the pre-push hook) and on GitHub (`gh-harden`); `/go-public <repo>` plans the whole release ([WORKFLOW.md](WORKFLOW.md) section 4). This repository was the first. Replaces D10, the export to a `<repo>-oss` copy | 2026-10-12 |
| D12 | The repository is `project-harness`: the harness a super project's sessions run in. "Super project" stays the name of what it runs (a root and its module submodules), so the `sp-*` commands and the `super-project` folders keep their names | 2026-10-12 |
