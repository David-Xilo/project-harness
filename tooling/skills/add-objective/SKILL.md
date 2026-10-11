---
name: add-objective
description: Add a new objective to this workspace's root plan from the operator's idea, iterate on it with the operator before any change, then adapt every plan it touches (root, group and module level), reprioritize, and rebalance the sessions. Use when the operator says "add an objective", "new goal", "I want the system to also do X", or runs /add-objective <idea>.
argument-hint: <the idea, in your own words>
---

# Add an objective

The operator's idea: $ARGUMENTS

If the idea is empty, ask for it and stop.

You run in a plain session at the workspace root, outside the track sessions. Nothing is
written until the operator approves the proposal.

## 1. Iterate first (plan mode)

1. Call `EnterPlanMode` (load it with ToolSearch if it is deferred). If plan mode is not
   available, make no edits until step 3 anyway.
2. Read AGENTS.md, the root plan.md (goals, modules and ownership, tracks and sessions,
   tracker or queues, gates and checkpoints, decisions), handoffs.md, and the plans of the
   modules or projects the idea plausibly touches. Read code only to answer a concrete
   question.
3. Write the proposal to the plan file:
   - **Objective:** one or two sentences in the operator's terms, and what "done" means
     (an acceptance check, or the gate it belongs to).
   - **Where it lands:** a new goal or milestone in the root plan; steps in existing module
     plans (with new step IDs in each plan's scheme); a new module or project (then name
     its repository, owner track and session); or a mix. Prefer existing owners. A new
     repository is created only with its first implementation step.
   - **Steps:** each with its ID, owner, what it depends on, what it unblocks and its
     priority. Keep the dependency order acyclic.
   - **Reprioritization:** what moves earlier or later in each affected queue, and why.
     Nothing already done or in progress is reopened without saying so.
   - **Conflicts:** decisions it changes (a new decision row that amends or replaces the
     old one), gates or checkpoints it moves, privacy or licence rules it touches, and
     steps that would need the operator (they go to operator.md).
   - **Sessions:** a first view of the load change; the full check is step 5.
4. Ask the operator only what changes the plan (scope, priority against current work,
   owner when two fit, acceptance). Use AskUserQuestion with a recommended option first.
   Revise the proposal and repeat until the operator approves it with `ExitPlanMode`.
   The operator may iterate as long as they want; each round updates the plan file.

## 2. Check before writing

- Re-run `git status` at the root and in every repository you will edit, and re-read the
  files right before editing. Other sessions may be running.
- **Root files** (plan.md, operator.md, handoffs.md): edit by exact
  replacement, never a rewrite. In a coordinated workspace (a "Checkpoint status" table in
  handoffs.md), do not edit while the checkpoint session's row (`CP` or `CP<m>`) reads
  `running`.
- **Module or project plans:** a repository has one writer, its owning session. Edit its
  plan directly only if its worktree is clean and the operator confirms its session is
  stopped; otherwise open a handoff row to the owning track with the exact steps to add
  (IDs, text, dependencies), and the owner adds them.
- A repository whose "Publish status" reads `running` is not touched.

## 3. Apply

1. Root plan: the objective (goals or milestone section), the tracker or queue rows, the
   cross-track blockers or dependency order, gates or checkpoint scope if they move, and
   a decision row (next free ID) that names the objective and the date, in the plan's
   decisions table or the root file the plan names for it (such as `decisions.md`).
2. Module or project plans (directly or by handoff, as above): the steps in "Next" or the
   step tables, in priority order, with the plan's own ID scheme and status words.
3. operator.md: any step only the operator can do, in that file's format, with real
   paths and commands.
4. Check local links and anchors, unique step IDs, that every dependency exists, and an
   acyclic order.

## 4. Report

Say in a few lines what changed in which file, which handoff rows were opened, and what
waits on the operator. Then show the Ready to commit preview per repository (nested ones
first, the root last; `~/.claude/git-rules.md`) and run it when the operator answers
"approve": their identity, signed, no Co-Authored-By line.

## 5. Rebalance

Run the `balance-sessions` skill on the updated plans: it checks the root plan for drift,
reorders the queues, and sizes the parallel sessions to the new work.
