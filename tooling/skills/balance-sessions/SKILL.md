---
name: balance-sessions
description: Size the parallel sessions to the workload and keep this workspace's root plan in step with the work - count each session's ready and blocked work from the ops board, say how many sessions to run for the next stretch and which (on /autopilot or not), review the decisions the work rests on, judge each session's load (merge, split, park, start, move tracks), and as a fallback fix drift against the module plans, handoffs and operator tasks; apply the approved changes to the plan. Use any time the operator asks "are the sessions balanced", "is the plan in sync", "what should run next", "rebalance", after a new objective, or when a checkpoint opens the next one. `/balance-sessions drift` only reports.
argument-hint: [drift]
---

# Balance the sessions

Arguments: $ARGUMENTS

You run in a plain session at the workspace root, or inside a `CP<m>` session that opens
the next checkpoint. `/session <ID>` builds every session from the root plan and
handoffs.md, so the plan is the only prompt a session gets: keep it true. Measure first,
propose, and change the docs only after the operator approves. With the argument `drift`,
stop after step 5 and change nothing.

The focus is the workload: what each session can do now, what blocks it, and how many
sessions should run for the next stretch. Sessions clean up their own docs after every
step (the plan's "Session rules"), so the drift check is a fallback: each fix it needs is
a cleanup a session skipped, and the report names that session. Where the "Session
rules" have no cleanup step (an older workspace), report drift without naming one.

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

Then run `opsboard --tsv <root>`. Its `session` rows (columns: `session`, root, ID,
state, next, ready, blocked by, checkpoint, autopilot, live, since, pids) give each
`S<n>` session's state (`reached`, `ready`, `blocked`, `idle` or `no plan`), next step,
ready count, checkpoint row and autopilot, and, when nothing is ready, what blocks it.
`live` says whether it runs (`working`, `waiting`, `approve`, `idle`, `not running`),
since when (epoch seconds) and in which processes; its `live` rows (root, ID or `—`,
live, since, pid, cwd) are the other processes at the root. The `session` rows count the not-done
items of the module plans' "Next", against the ticked steps, the handoffs and the open
`O<n>` entries. Take the ready counts from them and check a few against the module plans.
Count by hand: the blocked steps of every session, every session without a row (project
sessions and `W` in an umbrella workspace, publish sessions), a row that reads `no plan`
(its plans do not follow the template), and what the board cannot read: an open `O<n>`
whose "Unblocks" names no step ID ("every first step"), and an item waiting on a gate.

For each session, take from the board or count from the module plans, never from the
root queue or memory:
- **Ready:** steps whose dependencies are done and that wait on no one.
- **Blocked:** steps waiting on another track (name it), on the operator (name the
  `O<n>` entry), on a gate or checkpoint, or on a running publish session.
- **Size:** the plan's own size or priority marks (P0/P1, S/M/L) where they exist.
- **Repositories** it writes, and whether its ready steps are in one repository or
  several independent ones.

## 2. Check drift and decisions

Compare the root plan with the facts and list every difference with its source, and the
session that should have fixed it in its cleanup: the one holding the track whose work
made the line stale (for a handoff row, the track that delivered or closed it), or
"setup" when the line was wrong from the start:
- **Module plans:** milestone steps whose dependencies are done but that "Next" leaves
  out (the board does not count them as ready), and ticks without their "Done" note,
  which the board counts as done anyway.
- **Checkpoint rows:** a `reached` row whose repositories have no release commit in
  release.md.
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
- **Unplanned work:** what a gate, an acceptance criterion or the runtime needs that no
  step plans. List it for the operator in step 5; it is not a skipped cleanup.
- **Dates:** the plan's "Updated" line, and the revisions list where the plan keeps one.

Then review the decisions: the root `SD` rows and the module `D` rows that the open steps
rest on. List each one the work has contradicted since (a research result, a failed
approach, a changed limit or tool), with the evidence, for the operator to keep or
revisit in step 5. Decisions only the operator changes.

## 3. Synchronize and reprioritize

- Fix drift in the root files (plan, handoffs.md, operator.md) here. Drift inside a
  module plan is its owner's (one writer per repository): when it is the owner's skipped
  cleanup, name the fix in the report for that session's next run (a short cleanup run
  when it is parked, step 4); otherwise open a handoff row to that track, from `CP<m>`
  or the operator, with the exact change.
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

**The next stretch.** A stretch is the work until what can run in parallel changes: a
checkpoint, a gate, or a blocker that clears. Its size is the number of sessions with
ready work, after the splits and merges below, within the limits above. `blocked` and
`idle` sessions are parked. A `reached` session with ready items counts only when its
module plan does not stop it at the gate (the "Stop after the last M<m> step until
<gate>" line; without one, ask the operator); otherwise it is parked until the
checkpoint. A session with no ready work but a skipped cleanup gets a short cleanup run,
then parks; it is not counted. A milestone often starts narrow (the first steps wait on
a shared contract), widens once the modules are independent, and narrows near its
checkpoint as sessions reach it. Say the number and why.

Then decide:
- **Fewer sessions** when a session has no ready work for its next few steps: park it, or
  merge its tracks into a session whose work they hand off to most.
- **More sessions** when one session holds independent ready work in several repositories
  and the limits allow: split by repository, along the existing track lines.
- **Move a track** when its handoffs mostly go to another session's tracks.
- **Start a publish session** when a `planned` module's other work is done.
- Leave it as is when the gain is small; say so.

Finish with the sessions to run next: for each, start, resume, keep running, finish its
step and stop, clean up and park, or park; its `/session <ID>` line; its first step
after the sync; and whether to run it on `/autopilot`, with the last step of its part of
the stretch as the target (`/autopilot PAY-1.3`), or no target when that part runs to
its checkpoint.

## 5. Propose

Show one table: session, tracks and repositories, state, ready, blocked (by what),
autopilot (now → proposed), load verdict (idle, light, right, heavy). Below it: the
number of sessions for the next stretch and why, the sessions to run next, each session
change with its reason, the decisions to keep or revisit, the unplanned work, the queue
changes, and the drift list with each fix and the session that skipped it. Ask with
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
