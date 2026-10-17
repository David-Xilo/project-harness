---
name: arena
description: "Spawn N parallel candidates at the same task on different models, pick a base, and graft the strongest parts of the others into it. Use for /arena, 'arena this', or when one attempt at a non-trivial artifact (a design, an API, a hard function, a doc) would lock in the wrong shape."
---

# Arena

Open a todo list with one entry per phase (Frame, Fan out, Cross-judge, Pick, Graft,
Verify) before launching anything.

## Phase A: Frame

Every candidate gets the same prompt, so the prompt is the contract.

1. State the artifact each candidate produces.
2. Write the rubric: three to six concrete, gradeable criteria for success on this task.
   It is the picker's tool in Phase D. Candidates see only the task.
3. Pick the runners: by default one on `opus` and one on `fable`, so the candidates
   don't share blind spots. Add runners when the arena covers several design directions
   (`sonnet` is the third). Use one model N times when the work is bound by generation,
   not judgment.
4. Give each candidate its own output: the Agent tool's `isolation: "worktree"` when it
   edits the repository, or its own folder in the scratchpad
   (`<scratchpad>/arena-<slug>/candidate-<n>/`) otherwise. Separate outputs mean no
   candidate sees another's work (the `separate-before-serializing-shared-state`
   principle, in the `principles` skill).

## Phase B: Fan out

Spawn all N Agent tool subagents in one message (`subagent_type: "general-purpose"`),
each with the task, the path to the shared grounding, its own output path, and the
instruction to produce the artifact and a short rationale that names the alternatives it
considered and what it rejected. Candidates run no git writes; their worktree, if any, is
thrown away after the graft.

If a candidate produces nothing, go on with N-1 and note the dropout.

## Phase C: Cross-judge

Once every candidate is done, spawn one read-only judge on a model other than the one
this session runs on (`sonnet` when you are on `opus`). It sees the rubric and the
candidates by path, scores each criterion, and recommends a base with its reasons. It
runs while you read in Phase D. Don't spawn it while candidates are still writing.

## Phase D: Pick a base

Read every candidate end to end before picking. Score each against the rubric, criterion
by criterion, not on overall feel, and compare with the judge. Agreement on the base
confirms the pick. Disagreement means one of you is biased or the rubric was ambiguous:
read both rationales before deciding.

Pick the base a future maintainer can extend most easily without breaking its
invariants. When two feel tied, prefer the cleaner boundary or the smaller API (the
`laziness-protocol` principle).

## Phase E: Graft

Walk each other candidate once more for what is worth porting into the base, usually one
or two things each, not most of it. Fold each graft in by hand, so the result stays
coherent under one mental model (the `redesign-from-first-principles` principle). Don't
paste mechanically.

If the candidates converge on one shape, that is strong agreement: note it and ship that
shape, with no graft. If they diverge wildly, Phase A was underspecified: reframe and run
again rather than averaging.

## Phase F: Verify

Verify the result like any other output (the `prove-it-works` principle). If the check
finds a problem the arena missed, either Phase A was wrong (reframe and run again) or a
candidate caught it and the graft missed it (back to Phase E). Don't paper over it.

## Outputs

One artifact, with a short synthesis note: the base and why, the judge's verdict, each
graft with the candidate it came from, what was rejected and why, any convergence or
dropout, and the verification result. The artifact reaches the repository through a
normal commit preview (git rules).

Adapted from pstack ([license](../LICENSE-pstack)).
