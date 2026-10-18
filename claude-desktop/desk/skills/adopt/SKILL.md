---
name: adopt
description: "Go through a project's docs and plans with the operator, one doc at a time, and leave them ready for the desk way of working (one task, one session, one worktree, one PR). Removes the harness's sessions, tracks, handoffs and checkpoints, and keeps every piece of open work as a task that fits one PR. Use for /desk:adopt, 'convert this project to the desktop workflow', 'clean up the plans for desk', or after running sp-claude-desktop on a harness workspace."
argument-hint: "[project root]"
---

# Adopt

Turn a project planned for the harness into one planned for desk. The harness splits
work by session and track, with each session the only writer of its repositories. Desk
splits it by task: each task is one session, one worktree, one branch and one PR in one
repository, and the operator's merge is the review. The plan has to say what the next
tasks are, what each one touches and how to check it. Who runs a task stops mattering.

Adopting is one-way for the docs. `sp-claude-desktop --off` turns the harness's settings
back on, but it does not bring back the session tables, handoffs and checkpoints this skill
rewrites, or the harness files it removes. Say so before step 5, and go back through git
if the operator changes their mind.

Two rules hold throughout:
- **No open work is lost.** Every open step, handoff and operator task ends up as a task,
  a "Needs a human" item or an issue, unless the operator says to drop it.
- **The operator sees every doc before it changes.** You propose, they decide, then you
  edit.

## 1. Check that nobody else is working

Run this skill in a session on the main checkout, with the worktree toggle off. It
changes docs in the root and in the modules, and a worktree of the root has no submodules
checked out.

Harness sessions write the root docs and leave them uncommitted.
1. Run `git status --short` in the root and in each submodule.
2. If `opsboard` exists, run `opsboard --md <root>` to see which sessions are live.
3. If a session is live or a doc has uncommitted changes, stop. Ask the operator to
   finish or stop those sessions and commit their work first. Never adopt docs that a
   live session is still writing.

## 2. Take stock

Spawn one Explore subagent on `sonnet` per group of docs, in parallel:
- the root: `*.md` and `docs/`;
- each module repository: its `AGENTS.md`, `plan.md`, `research.md` and `README.md`;
- the harness leftovers: `.claude/skills/`, `.claude/project-harness.lock`,
  `.claude/workspace.json` and `.audit/`.

Each subagent returns one row per section: the file and heading, what the section holds,
whether it is project content or harness workflow, and the open items in it with their
IDs. Open items are steps not ticked done, handoff rows not closed, and operator tasks
still listed. Keep only these tables in the main thread.

Count the open items by ID. That list is the check in step 6.

## 3. Agree the shape

Ask these in one question batch, with the recommended option first:
- **Where the backlog lives.** The root `plan.md` suits one person running a few
  sessions. GitHub issues suit many parallel sessions, because PRs then never conflict on
  one plan file. Module plans' `## Next` suit work that stays inside one module.
- **Milestones and releases.** Keep milestones as goals, and tag a release once a
  milestone's PRs are merged (recommended). Or keep the release tables.
- **Operator tasks.** A short "Needs a human" list in `plan.md` (recommended), or GitHub
  issues with a `human` label.
- **Modules.** Confirm that each module stays its own repository with its own PRs.

## 4. Map each harness piece to its desk form

Use this map unless the operator chose otherwise in step 3:

| Harness | Desk |
|---|---|
| Session table, `### Session IDs`, `### Session rules`, session IDs (`S<n>`, `CP<m>`, `W`, `publish-<repo>`) | Removed |
| Tracks (`T<n>`) and their ownership tables | Removed. A track's goal can stay as a heading over its tasks |
| Steps (`<CODE>-<m>.<n>`) with "Done when" | Backlog tasks that keep their IDs. Each one names its repository, the paths it touches, its done-when check and what it waits for. Split a step that spans repositories into one task per repository |
| Open handoffs (`H<n>`) | Tasks in the backlog of the repository that owns the work, citing the `H<n>` ID. Closed rows go |
| Operator tasks (`O<n>`) | Open ones go to "Needs a human". Runbooks the operator reuses (keys, undo steps) stay as docs |
| Checkpoints, `release.md`, `## Checkpoint status`, `## Publish status` | A milestone is done when its PRs are merged, and the tag goes on then. The status tables go |
| `AGENTS.md`: "Common working rules" | Kept and trimmed. It gains the commands that verify a change and the PR rules |
| `AGENTS.md`: "Session practice", "Workspace boundaries and checks" | Removed, in the root and in every module |
| Module `## Current state` and `## Next` | Kept |
| `decisions.md`, `research.md`, capabilities, acceptance criteria | Kept, with the session wording removed |
| The harness's project skills in `.claude/skills/` (`add-objective`, `balance-sessions`, `go-public`, `publish`, `milestone-checkpoints`), `project-harness.lock`, `workspace.json` | Removed |

Claude reads `AGENTS.md` when a repository has no `CLAUDE.md`. Keep it under 200 lines,
holding only what a fresh session needs on every task.

## 5. Go through the docs with the operator

Start with the largest doc, usually the root `plan.md`. For each doc:
1. Show a short proposal: each section with keep, rewrite, move to another file, or
   remove, and one line of reason. List the open items the doc holds and where each one
   goes.
2. Wait for a yes or for changes.
3. Edit the doc. Write with `desk:technical-writing` and `desk:unslop`.

Do one doc per turn unless the operator asks for a batch.

## 6. Check nothing was lost

- Every open item from step 2 is in the new backlog, in "Needs a human", in an issue
  list, or on a list the operator agreed to drop. Show any that are missing.
- Search the changed docs for harness terms that only the harness uses: `/session`,
  `/autopilot`, `/balance-sessions`, session IDs as a table cell or in backticks
  (`` `S2` ``, `` `CP3` ``), `H<n>` and `O<n>` IDs, `handoffs.md`, `release.md`,
  "Checkpoint status", "Ready to commit" and `Review:`. Show each hit, and let the
  operator decide on it.
- Every relative link in the changed docs resolves.

## 7. Land it

1. In each repository you changed, commit on a branch `cc/adopt-desk` and push it.
2. Open one PR per repository. The root PR lists the module PRs.
3. If the backlog moves to GitHub issues, create them only after the operator approves
   the list. Issues are visible to anyone who can see the repository.

If the operator has not run `sp-claude-desktop --modules <root>` yet, ask them to run it
in a terminal and restart the sessions in that project. Until then, a session in the root
or a module still loads the harness.
