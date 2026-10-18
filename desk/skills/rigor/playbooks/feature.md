# Feature

**You own the design. Plan, review, verify.** Delegate the implementation and stay in the
lead.

1. `desk:how` over the affected subsystem.
2. `desk:architect` for the design.
3. Write the throughput checkpoint as four todo items. A dimension that doesn't apply
   (one file, no fan-out) keeps its item with `n/a: <reason>`:
   - **Blocking first steps.** The gates that run before any fan-out.
   - **Independent workstreams.** Disjoint files, services or layers run in parallel;
     shared writes run in order.
   - **Shared mutable state.** Split the target by default
     (`separate-before-serializing-shared-state`); serialize only for a real invariant.
   - **Smallest safe split.** If one worker is best, say why.
4. Hand the code to a subagent (`sonnet`, `opus` for the hardest parts) with a precise
   scope: the file paths, the named data shape and its structure (`model-the-domain`: a
   state machine over scattered booleans, a table over branching, a typed model over
   repeated shape assumptions), and what success looks like. When the implementation
   has several valid shapes (error handling, an abstraction layer, the test layout), run
   it through `desk:arena` instead, so the alternatives surface and a judge guards the pick.
   That separation of writer and reviewer is the point, so don't skip it to save lines.
   Comments per the reply rules. Port a shared improvement to every consumer and verify
   each.
5. Verify on the real surface. "Inconclusive" or the wrong surface is not a pass: say so.
   Tests stay within the test budget.
6. Split the work into small ordered commits (`sequence-verifiable-units`). Never rebase
   a published branch.
7. If the design is contested, `desk:interrogate` before the PR.

Coupled work (one feature, one migration) goes to one owner with the checkpoint inline;
that owner fans out after the blocking phase. Fan out from the top only for slices that
produce independent artifacts (audits, cross-subsystem investigations, competing
experiments). Rewrite the checkpoint at each phase boundary.

**Reply:** what you built, what you chose and why, the throughput checkpoint, and the open
decisions. Tables for design alternatives.
