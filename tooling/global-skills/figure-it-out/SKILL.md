---
name: figure-it-out
description: "Design an auditable playbook when no narrower one fits: a large migration, an ambitious multi-part change, or work the operator reviews after stepping away. Scales rigor to the task, runs a hypothesis loop, and keeps a decision trail. Use for /figure-it-out or 'figure it out'."
---

# Figure it out

When the task matches no playbook, design one. The first deliverable, before any code, is
the workflow itself: phases that scale rigor to the task, run the scientific method, and
leave a decision trail the operator can audit after stepping away.

Open a todo list whose first item is to read the `principles` skill's index. Then add the
phases below.

## Phase A: Frame

Ground first, then commit. Don't start the run until you can state:

- what done means, as a predicate that can fail (`prove-it-works`);
- the scope, in numbers: rough units and effort, and the blockers grounding found;
- the rigor level, biased high. One-way doors and a large blast radius get more;
  reversible, low-stakes steps get less. Rigor is gates and artifacts, not "try harder".

Show the framing and its tradeoffs before a long run. Reversible work goes on without
waiting (`never-block-on-the-human`), but a run of several hours earns one checkpoint,
and every commit still waits for its preview.

## Phase B: Design the workflow

Split the work into small units that each land on their own, riskiest unknown first.
Scaffolding and checks come before features (`foundational-thinking`).

- Build the check before the work, with a baseline from before the change, so it reads
  "old value against new value".
- For a one-way design decision, run the `architect` skill (it runs `arena`). Skip it
  for mechanical work whose shape is already clear. A second arena over a settled design
  is over-engineering (`laziness-protocol`).
- Decide what fans out. Split only along real seams, and give each worker its own
  worktree or folder (`separate-before-serializing-shared-state`, and the `swarm`
  skill). Don't over-split.
- Write the phase list down. That list is what the operator reviews. In a workspace it
  becomes steps in the plan, in its format.

Then run the design. Add its steps to the todo list between Phase C and Phase D. Run
each under the Phase C loop, and log a trail row as each step lands, not all at the end.

## Phase C: Run the loop

Each unit is an experiment: state the hypothesis, make the smallest change, measure it
against the predicate on the real artifact, keep it if it moved forward, revert it if it
didn't. Check each unit before starting the next (`sequence-verifiable-units`).

- Check the artifact, never a self-report. When something passes too easily, suspect how
  you observed it before the system.
- Pair delegated work with a judge. If a worker games the gate, reset and tighten the
  brief. If the gate itself is wrong, fix it in its own change instead of going around it.
- A verdict is VERIFIED, NOT VERIFIED or INCONCLUSIVE. Inconclusive is not a pass. Don't
  hide a negative.

## Phase D: Keep the trail

Log the run with the `show-me-your-work` skill. The trail stays out of git; copy the rows
a reviewer needs into the step's docs or the PR body, so the trail and the diff together
let the operator come back and trust the work.

## Phase E: Verify and hand back

Check the whole against the Phase A predicate on the real product, not only the
checks. Turn any correction that repeated into a gate, a lint, a check or a script (the
`correct` skill).

**Reply:** the playbook you designed, the rigor level and why, the trail's path, what is
verified against the predicate, and what is still open.

Adapted from pstack ([license](../LICENSE-pstack)).
