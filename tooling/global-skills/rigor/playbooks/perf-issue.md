# Perf issue

**You own the measurement story. Plan, review, verify the numbers.** Tie every fix to a
measurement; don't read the source instead of measuring.

1. Capture a baseline trace on the real surface. Vet the baseline, and every later
   number, with the `benchmark-checklist` skill.
2. Ground the hypotheses with `how`. Don't claim a ceiling before running it. Try the
   performance mantras in order, cheapest first, and stop when one meets the target:
   1. Don't do it: stop work whose result nothing uses.
   2. Do it, but don't do it again.
   3. Do it less.
   4. Do it later.
   5. Do it when they're not looking.
   6. Do it concurrently.
   7. Do it cheaper.
3. Plan the fix from the trace. If it crosses a function boundary, `architect` first.
   Hand the change to a subagent (`sonnet`, or `opus` for a subtle one). Review the diff
   and capture a trace after the fix. Check each attempt before the next
   (`sequence-verifiable-units`).
4. Parse and compare the two artifacts (load them into sqlite, diff them).
   "Inconclusive" or the wrong surface is not a pass: say so.
5. Put the measurement in the commit message or the PR body.
6. The commit preview (git rules).

For sustained improvement of one metric rather than a one-off fix, use Hillclimb.

**Reply:** the baseline number, the number after, the difference, and the artifact path.
