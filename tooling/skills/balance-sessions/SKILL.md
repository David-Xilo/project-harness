---
name: balance-sessions
description: Keep this workspace's root plan in step with the work and size the parallel sessions - check the plan for drift against the module plans, handoffs and operator tasks, synchronize it, reprioritize the queues, judge each session's load (merge, split, park, start, move tracks) and say which sessions to run next; apply the approved changes to the plan. Use any time the operator asks "are the sessions balanced", "is the plan in sync", "what should run next", "rebalance", after a new objective, or when a checkpoint opens the next one. `/balance-sessions drift` only reports.
argument-hint: [drift]
---

# Balance the sessions

Arguments: $ARGUMENTS

You run in a plain session at the workspace root, or inside a `CP<m>` session that opens
the next checkpoint. `/session <ID>` builds every session from the root plan and
handoffs.md, so the plan is the only prompt a session gets: keep it true. Measure first,
propose, and change the docs only after the operator approves. With the argument `drift`,
stop after step 5 and change nothing.

## 0. Migrate once: no prompt.md

If the root has a `prompt.md`, it goes away in this run. Move into
the plan's "Session rules" (format in step 6) each rule that only prompt.md holds and
that still holds: the step loop, a session's own prohibitions, timing or host rules, what
it reads first. Drop what the plan, a module AGENTS.md or a skill already says, and every
"now", "Start with" or "Resume" text: the queues hold the next step. Repoint links to it
(README, AGENTS.md, operator.md, the plan), add a "Start the sessions" part to
operator.md (open a terminal at the root, `claude`, `/session <ID>`; the same command
resumes), add a decision row, and delete `prompt.md` in the commit preview. If another
session has uncommitted edits in it, carry them over or say why not.

## 1. Measure

Read AGENTS.md, the root plan (session table, "Session IDs", "Session rules", tracks or
projects, queues or tracker, cross-track order and blockers, gates and checkpoints,
decisions that limit sessions, such as a maximum count or a host limit), handoffs.md
(open rows, "Checkpoint status", "Publish status"), operator.md, and each module or
project plan's "Current state" and "Next".

For each session, count from the module plans, not from the root queue or memory:
- **Ready:** steps whose dependencies are done and that wait on no one.
- **Blocked:** steps waiting on another track (name it), on the operator (name the
  `O<n>` entry), on a gate or checkpoint, or on a running publish session.
- **Size:** the plan's own size or priority marks (P0/P1, S/M/L) where they exist.
- **Repositories** it writes, and whether its ready steps are in one repository or
  several independent ones.

## 2. Check drift

Compare the root plan with the facts and list every difference with its source:
- **Queues and scopes:** each track's queue cell and each session's checkpoint scope
  against the module plan's "Current state" and "Next": done steps still listed, new
  steps missing, a different order, a blocker that cleared or a new one.
- **Handoffs:** rows delivered or closed in a module plan but still open in handoffs.md,
  rows waiting on a step that is done, rows addressed to a track no session holds.
- **Operator tasks:** `O<n>` entries whose result a module plan already records, and
  blocked steps whose `O<n>` is gone.
- **Sessions:** the session table against reality (a repository now exists or is gone, a
  track has no session, a session holds a finished track).
- **Session rules:** rules duplicated in a module AGENTS.md, contradicted by one or by a
  newer decision, or naming steps, files or commands that no longer exist.
- **Dates:** the plan's "Updated" line and the revisions list.

## 3. Synchronize and reprioritize

- Fix root-plan drift in the plan itself. Drift inside a module plan is its owner's: open
  a handoff row to that track with the exact change (one writer per repository).
- Order each track's queue: open handoff rows addressed to it; its scope for the open
  checkpoint; steps on the cross-track critical path or that unblock another track; then
  the plan's size and priority marks. Keep the dependency order acyclic. Nothing done or
  in progress is reopened without saying so.

## 4. Judge the load and the next sessions

Rules that always hold:
- One writer per repository: a repository belongs to exactly one session.
- Respect the workspace's limits: a decision capping the number of sessions, the shared
  host (memory caps, GPU, a running stack), and the operator's attention (each session
  produces commits and questions for them). A cap changes only with a new decision.
- Coordinated workspaces (with checkpoints): a change waits while a checkpoint session
  runs; where one checkpoint is always open (one per milestone), a moved track keeps its
  scope and its rows in release.md move with it. The checkpoint session (`CP`, or `CP<m>`
  per milestone) is not counted, since it runs alone.
- Umbrella workspaces: one session per active project plus `W`; never merge two projects
  into one session unless the operator asks.
- Publish sessions are counted only while a row reads `running`.

Then decide:
- **Fewer sessions** when a session has no ready work for its next few steps: park it, or
  merge its tracks into a session whose work they hand off to most.
- **More sessions** when one session holds independent ready work in several repositories
  and the limits allow: split by repository, along the existing track lines.
- **Move a track** when its handoffs mostly go to another session's tracks.
- **Start a publish session** when a `planned` module's other work is done.
- Leave it as is when the gain is small; say so.

Finish with the sessions to run next: for each, start, resume, keep running, finish its
step and stop, or park; its `/session <ID>` line; and its first step after the sync.

## 5. Propose

Show one table: session, tracks and repositories, ready, blocked (by what), load verdict
(idle, light, right, heavy). Below it: the drift list with each fix, the queue changes,
each session change with its reason, and the sessions to run next. Ask with
AskUserQuestion, the recommended option first. Iterate until the operator approves. With
`drift`, stop here.

## 6. Apply (after approval)

- Re-run `git status` and re-read each file right before editing; exact replacements.
  Another session's uncommitted change in a root file stays; the commit preview shows the
  file's full diff.
- Root plan: the session table, the queues and checkpoint scopes, the "Session IDs"
  section if a rule changes, and the "Session rules". Those stay bullets, never a table
  (the workspace mod reads every table whose first column is "Session"): an "Each step"
  list, an "Always" list, and one bullet per session with what it reads after its track
  row and its own rules. Add a decision row (next free ID) with the date and the reason
  when sessions change, in the plan's decisions table or the root file the plan names
  for it (such as `decisions.md`).
- handoffs.md: the "Checkpoint status" rows for new or removed sessions (coordinated
  workspaces), and the rows opened in step 3; handoff rows whose owner session changed
  keep their track names.
- Never change a running session's ownership mid-step: tell the operator which sessions
  to finish and stop, and which to start with `/session <ID>`.

## 7. Report

Say what changed in which file and what was checked, then list the `/session <ID>` lines
from step 4. Show the root's Ready to commit preview and run it when the operator answers
"approve" (`~/.claude/git-rules.md`; no Co-Authored-By line).
