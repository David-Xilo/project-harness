# Pause safely

**You own a clean stop: leave a state a cold start can resume from.** Only on an explicit
pause. On "keep going" or "don't stop", don't pause.

1. Stop at a safe boundary: finish the current small step or back out of it. Start
   nothing new, and stop any running subagents.
2. Take no irreversible step to pause: no commit, push or PR the operator hasn't
   approved.
3. Leave the work on disk. In approve mode the edits stay uncommitted; there is no wip
   commit. If the tree is broken, say so in the resume note. When the step is ready, show
   its commit preview instead of pausing. (In PR mode, a wip commit on the session's own
   branch is allowed: PRMODE.md.)
4. Write the resume note where the next session reads it: in a workspace, the module
   plan's "Current state" and "Next", and handoffs.md for anything another session
   needs; elsewhere, the repository's plan or a note in the scratchpad. Capture the
   intent, what you were doing, progress and what is verified, the current state, the
   next steps, the key files and the gotchas. If a `show-me-your-work` trail exists,
   point at it instead of repeating it.

**Reply:** where you are, what is on disk and what is only in your head (paths, no diff
dumps), whether the tree is clean, and the first action on resume. This is a pause, not
a final report.
