# Hillclimb

**You own the metric and the experiment's integrity. Supervise and review; delegate the
attempts.** For sustained improvement of one measurable thing against a target. A one-off
fix is Bug fix or Perf issue; this is the loop.

The core rule: one change, one measurement, keep or revert. Never stack untested
changes, and never claim a win from reading the code (`prove-it-works`).

1. Ground the workload before choosing the metric. Run `desk:how` over the target, name the
   workload dimensions that can move the result (data size, history, state,
   concurrency), and pick a case that reproduces the user's complaint. If none does,
   fix the repro first. Then fix one metric, the direction that counts as better, and a
   stop predicate that pairs a target with a minimum number of attempts, so a lucky early
   win can't end the run ("at least 50% better than baseline and at least 10
   iterations"). Use the user's numbers when given, else agree them.
2. Build the measuring harness, prove it can tell cases apart, then freeze it
   (`build-the-lever`). Run contrasting workloads and confirm the target case shows the
   symptom while easier cases separate as expected; if not, revise the workload or the
   metric. Vet it with `desk:benchmark-checklist`, and make it print its error count and how
   much work it did. Once frozen, one repeatable command prints the metric, sampled
   enough to clear the noise (a median of N). Record the baseline and a green run of the
   regression gate (the tests that must keep passing) before any change.
3. Keep the trail with `desk:show-me-your-work`: one row per attempt, with the attempt as the
   phase, the change as the decision, the hypothesis as the why, before and after and the
   gate as the evidence, and kept or reverted as the result. Read it before each attempt.
4. Ground each hypothesis in the model from step 1, so it names a mechanism ("move X off
   the start path because it blocks the first paint"), not "try caching something". For
   a performance metric, order the hypotheses by the mantras in Perf issue, step 2 (their
   order only, not that step's stop rule).
5. Loop, one hypothesis per iteration:
   - Hand the change to a subagent (`sonnet`) with a tight scope, and review the diff
     rather than typing it (`guard-the-context-window`). Several independent hypotheses
     can go to parallel subagents, each with `isolation: "worktree"`.
   - Measure before and after with the frozen harness, and run the regression gate.
   - Keep the change only when the metric moves past the noise and the gate stays green.
     Otherwise revert it in full.
   - One commit per kept change, staging only its files. Log the row either way.
   Each iteration ends in a check before the next starts.
6. Push past the first plateau. After several rejects in a row, change category, combine
   near misses, read the source again, or try something more radical before calling the
   hill climbed. Correctness and simplicity outrank the number: revert a win that breaks
   behaviour, and keep a simplification that holds the number (`laziness-protocol`).
7. Stop when the predicate is met, or when the remaining ideas aren't worth their cost.
   Don't relax the predicate to meet it, and don't quit while cheap untried hypotheses
   remain. If you are stuck, say so instead of spinning.

**Reply:** the metric and target, baseline to final with the percentage, the iterations
(kept against reverted), each kept change in one line, the trail's path, and the best
idea you would try next.
