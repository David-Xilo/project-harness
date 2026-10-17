# Bug fix

**You own this task. Plan, review, verify.** Hand the search and the fix to subagents and
stay in the lead.

Be scientific. Every line that ships traces to runtime evidence. A belt-and-braces change
that "might help" is a hypothesis, not a fix, and it doesn't ship. When the evidence
refutes a hypothesis, revert what it motivated. The smallest change the evidence
justifies ships, nothing more.

1. Reproduce it yourself on the surface where it happens: the module's `verify-<module>`
   skill, the CLI, the app, the service. Ask the operator to reproduce only with a stated
   reason the surface can't be reached, and only after driving it as far as it goes. If
   it won't reproduce, build the trigger, tighten the conditions, or instrument until it
   fires.
2. Binary-search the cause. List the candidate hypotheses, then rule them out until one
   survives. Seed them with `how` over the subsystem and `why` for its regression
   history. Each pass, take the split that cuts the most of what remains, get runtime
   evidence, eliminate. When the program's state is unclear, add logging and read it as
   the code runs; don't guess. Drive a long hunt with `/loop`. Confirm the surviving
   mechanism with runtime evidence before step 3.
3. Plan the fix. If it crosses a function boundary, `architect` first. Hand the change to
   a subagent (`sonnet`, or `opus` for a subtle one) with a precise scope.
4. Verify on the same surface: the original repro now passes. "Inconclusive" or the wrong
   surface is not a pass: say so. Unit tests show branch behaviour, not that the bug is
   gone.
5. Order the commits so the failing repro lands before the fix. With a cheap local test
   path, use the `tdd` skill and keep the test only if the test budget allows it; skip
   it when the test would be expensive or unclear (`sequence-verifiable-units`).
6. The commit preview (git rules).

**Reply:** what was broken, the cause, the fix, how you verified it, with the failing and
then passing repro output pasted as is.
