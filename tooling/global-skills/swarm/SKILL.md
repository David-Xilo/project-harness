---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /swarm, 'swarm this', or parallel coverage (one slice each), races (same brief, pick by a declared rule), gauntlets and exploration."
---

# Swarm

Open a todo list with one entry per phase before launching anything: Frame, Fan out,
Aggregate, Report.

Workers are Agent tool subagents. Use a Workflow only when the operator asks for one: it
can spawn many agents and spend a lot.

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm returns.
2. Choose the shape: partition the work into slices, race N workers on the same brief,
   or both. For a race, declare the rule before spawning: `first pass`, `rank all` or
   `best-of`.
3. Pick the worker model: `sonnet` by default, `haiku` for cheap, wide and mechanical
   slices. For a model race, name each arm's model up front.
4. Give each worker that writes its own output: the Agent tool's `isolation:
   "worktree"`, or its own folder in the scratchpad. When workers verify or measure
   commits, each brief names the exact hashes. A measurement brief also names the method
   (sample count, what one sample is, the order), and the worker records both in its
   result.

## Phase B: Fan out

Spawn all N workers in one message, `subagent_type: "general-purpose"`, on the model from
step 3. Workers run locally. A cloud worker (`isolation: "remote"`) carries neither the
mods nor the private submodules, so use one only when the brief needs neither and the
operator agrees.

Every brief stands alone: the goal, the scope, the exact slice or race arm, how to verify,
and what to report. Workers run no git writes. A report reads `PASS`, `ISSUES` or
`BLOCKED`, with evidence. A worker that can prove a defect reports `ISSUES` and lists
every issue it can prove, not only the first.

If a worker drops out, go on with N-1 and note it.

## Phase C: Aggregate

Read the results. Drop a result that doesn't record the hashes and method its brief
named, and spawn that worker once more. After a second miss, record a gap; a gap is not a
pass. For coverage, every slice needs a result. For a race, apply the rule declared up
front. Don't paste raw worker output.

## Phase D: Report

Return one report in the chat: a table of slices or arms with their result, one line per
issue, the gaps and dropouts, and the race rule when there was one.

Adapted from pstack ([license](../LICENSE-pstack)).
