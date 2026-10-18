# Pause safely

**You own a clean stop: leave a state a cold start can resume from.** Only on an explicit
pause. On "keep going" or "don't stop", don't pause.

1. Stop at a safe boundary: finish the current small step or back out of it. Start
   nothing new, and stop any running subagents.
2. Take no irreversible step to pause: no merge, release or deploy.
3. Leave the work where the next session finds it: a wip commit pushed to the task's own
   branch is fine. If the tree is broken, say so in the resume note.
4. Write the resume note where the next session reads it: the PR body, the repository's
   plan, or a note in the scratchpad. Capture the
   intent, what you were doing, progress and what is verified, the current state, the
   next steps, the key files and the gotchas. If a `desk:show-me-your-work` trail exists,
   point at it instead of repeating it.

**Reply:** where you are, what is on disk and what is only in your head (paths, no diff
dumps), whether the tree is clean, and the first action on resume. This is a pause, not
a final report.
