---
name: architect
description: "Sketch the caller's usage, types, signatures and module shape before code, on two models, then implement against the chosen sketch and scrap it when it fights back. Use for /architect, 'architect this', 'design this', or non-trivial work where jumping to code would lock in the wrong shape."
---

# Architect

Sketch types, function signatures, class shapes and module boundaries, with `not
implemented` bodies and pseudocode. Compare sketches from more than one model, then fill
in code against the chosen one.

Open a todo list with one entry per phase before starting: Ground, Sketch, Agree,
Implement, Scrap.

## Phase A: Ground the problem

Build a real mental model of every system the new code touches: run the `how` skill over
them. Naming a file isn't grounding. If the design changes ownership or layering, also run
the `why` skill on the existing shape, so its reasons become constraints, not guesses. In
a workspace module, read its AGENTS.md and the `SD`/`D` decisions the step rests on.

Skip Phase A only when the work is greenfield, with no surrounding system.

## Phase B: Sketch

Run the `arena` skill with the design-sketch task and the Phase A grounding, passing
`references/runner-prompt.md` as each runner's prompt. Runners are `opus` and `fable` by
default, as in `arena`.

Design it twice. Require at least two structurally different candidates, even when the
first looks enough (the `exhaust-the-design-space` principle, in the `principles` skill):
whole-shape alternatives, not point fixes inside one shape.

Screen every candidate against `references/design-red-flags.md` before picking. Assume
the next contributor is an agent that sees only the files it opened, copies the nearest
example and takes the shortest path that compiles. Prefer the design where a change that
looks right from one file is right for the whole repository.

Compare the viable candidates on interface depth. Prefer the design that hides more
behind a smaller, simpler public surface. A rich interface can keep call chains short by
putting capability in one place instead of spreading it over layers.

Arena returns one design. Its synthesis note fills the rationale's "Synthesis decision".

## Phase C: Agree (opt-in)

By default, go on to implement the design with no checkpoint: the code waits for the
commit preview anyway. Stop for sign-off only when asked ("/architect with checkpoint",
"show me before implementing"), or when the design changes a handoff between sessions or
tracks, which needs the operator's go-ahead in a workspace.

The sketch can ship as its own commit, scaffold first (the `foundational-thinking`
principle). Planned breakage during fill-in is fine (`outcome-oriented-execution`). For
pressure on the design before implementing, run the `interrogate` skill on the sketch.

If the operator pushes back on the shape, at a checkpoint or later, treat it as Phase A
evidence: ground again and run Phase B again before writing more code.

## Phase D: Implement against the sketch

Replace `not implemented` bodies with code and pseudocode with logic. The sketch is the
contract. A deviation from it is a signal to raise, not friction to absorb quietly. If a
function needs a parameter the sketch didn't plan, ask whether the sketch was wrong, the
requirement was missed, or the implementation is overreaching.

## Phase E: Scrap when the architecture is wrong

If implementing keeps producing friction the sketch can't absorb, throw the sketch out.
Don't bolt fixes onto a wrong design (`redesign-from-first-principles`,
`fix-root-causes`).

The signal is a pattern, not one instance:

- the same shape of workaround in unrelated code;
- several unrelated edge cases that each need a special branch;
- types that need escape hatches (`any`, casts, optional fields that are always set) to
  compile;
- the "we need a lock" reflex where the sketch said the state wasn't shared;
- callers that must know the abstraction's internal rules to use it;
- two or more independent Phase D deviations of the same shape.

Use judgment. A few edge cases don't condemn a design, and complexity in the data is not
complexity in the design.

When you scrap:

1. Run the `how` skill again over what was built.
2. Redesign as if the new constraints had been there from day one.
3. Subtract before adding (`subtract-before-you-add`): the new sketch is smaller than the
   old one before it grows.
4. Go back to Phase B and run the arena again.

## Outputs

The caller's usage first, and the type sketch derived from it. One file of new types and
signatures for a small change; a module map plus type definitions for larger work. The
rationale goes with it, shaped by `references/rationale-template.md`, including the usage
sketch and the synthesis decision. In a workspace module the decisions that last go in
its `research.md` or as an `SD` row.

Adapted from pstack ([license](../LICENSE-pstack)).
