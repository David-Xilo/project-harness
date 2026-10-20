---
name: figure-it-out
description: "Design an auditable playbook when no narrower one fits: a large migration, an ambitious multi-part change, or work a human reviews after stepping away. Scales rigor to the task, runs a hypothesis loop, and logs decisions. Use for /desk:figure-it-out or 'figure it out'."
disable-model-invocation: true
---

# Figure it out

When the task matches no playbook, design one. The deliverable before any code is the workflow itself: a sequence of phases that scales rigor to the task, runs the scientific method, and leaves a decision trail a human can audit after stepping away.

## Start

Open a todo list (TodoWrite if the session offers it, otherwise keep the list in your reply and update it at each phase) whose first item is to load the `desk:principles` skill. Then add the phases below as todos.

## Phase A: Frame

Ground first, then commit. Don't start the run until you can state:

- The definition of done as a falsifiable predicate (the [prove-it-works](../principles/references/prove-it-works.md) reference of the `desk:principles` skill).
- Scope, quantified: rough units and effort, plus the blockers grounding surfaced.
- The rigor level, biased high. One-way doors and high blast radius get more. Reversible low-stakes steps get less. Rigor is gates and artifacts, not "try harder".

Present the framing and tradeoffs before committing to a long run. Reversible work proceeds (the [never-block-on-the-human](../principles/references/never-block-on-the-human.md) reference), but a multi-hour run earns one pause for the user's go-ahead.

## Phase B: Design the workflow

Decompose into atomic, independently-landable units. Sequence riskiest-unknown-first. Scaffold and verification come before features (the [foundational-thinking](../principles/references/foundational-thinking.md) reference).

- Build the verification harness before the work, with the baseline captured from the pre-change state, so the check reads as "old value vs new value".
- For one-way-door design decisions, run the [`desk:architect`](../architect/SKILL.md) skill (it runs [`desk:arena`](../arena/SKILL.md)). The Skill tool refuses both, so read `../architect/SKILL.md` and follow it. Skip it for mechanical work whose shape is already concrete. A second arena over a settled design is over-engineering (the [laziness-protocol](../principles/references/laziness-protocol.md) reference).
- Decide what fans out. Parallelize only across seams, and give each worker its own worktree or branch (the [separate-before-serializing-shared-state](../principles/references/separate-before-serializing-shared-state.md) reference). Don't over-fan. Pick each subagent's `effort` for the job, per the Subagents section of the `desk:rigor` skill.
- Write the designed phase list down. That list is what the human reviews.

Then execute the design. Add its steps to the todo list as concrete items between the Phase C and Phase D entries. Run each under the Phase C loop discipline, and weave the Phase D log through them, a row as each step lands, rather than saving the whole trail for the end.

## Phase C: Run the loop

Each unit is an experiment. State the hypothesis, make the smallest change, measure against the predicate on the real artifact, keep it if it advanced, revert it if it didn't. Apply the [sequence-verifiable-units](../principles/references/sequence-verifiable-units.md) reference, verifying each unit before starting the next instead of batching checks at the end.

- Verify by inspecting the artifact, never a self-report. When something passes too easily, suspect the observation method before the system.
- Pair delegated work with a judge. If a worker games the gate, reset and harden the contract. If the gate itself is wrong, fix the gate in its own change rather than routing around it.
- A verdict is VERIFIED, NOT VERIFIED, or INCONCLUSIVE. Inconclusive is not a pass. Don't hide a negative.

## Phase D: Keep the audit trail

Log the run via the [`desk:show-me-your-work`](../show-me-your-work/SKILL.md) skill. figure-it-out's work is usually ambitious enough to commit the trail so the reviewer can read it in the PR. The trail plus the diff is what lets the human come back and trust the work.

## Phase E: Verify and hand back

Check the whole against the Phase A predicate on the real product, not just the harness. Encode any recurring correction as a gate, a lint rule, a check, or a script (the [encode-lessons-in-structure](../principles/references/encode-lessons-in-structure.md) reference).

**Reply:** the playbook you designed, the rigor level and why, the decision-trail path, what's verified against the predicate, and what's still open.

Adapted from pstack ([license](../LICENSE-pstack)).
