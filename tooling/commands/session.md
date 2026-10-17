---
description: Start a workspace session by ID (reads the parts of plan.md and handoffs.md it needs)
argument-hint: S1 [note]
---
Arguments: $ARGUMENTS

The first word is the session ID. Anything after it is my note for your next step (for example after a commit); follow it within the session's scope. If the session ID is empty, ask me for it and stop.

1. AGENTS.md is already loaded as project instructions; don't read it again. Read plan.md and handoffs.md in the current directory (the workspace root) in parts:
   - plan.md: list its headings first (`grep -n '^#' plan.md`). Read the sessions table, its "Session IDs" section, the "Session rules" section (the part every session follows and the bullet for this ID) and the checkpoint rules if the workspace has them, and this session's tracks in the tracker. Open other sections only when the next step needs them.
   - handoffs.md: read the "Checkpoint status" and "Publish status" tables (where they exist) and the rows that name this session's tracks.
2. Before any work, reply in five short lines: your session ID, the tracks you hold, the repositories you may write, the shared files you may edit, and your next step. Say where in the docs each one comes from.
3. If the docs don't say which tracks this session holds, or one of those files is missing, stop and tell me. Don't guess.
4. Before choosing the next step, follow the plan's rules for the checkpoint and publish status. A queue or scope cell in the root plan can lag behind the module plan: the module plan's "Current state" and "Next" and handoffs.md win. Name the drift in your reply and fix it in the root docs during your next step's cleanup (left uncommitted for the operator or the checkpoint session); drift across several sessions' plans is `/balance-sessions`' to fix. For `publish-<repo>`, use the `publish` skill and the plan's public release rules.
5. Otherwise continue with that next step. If it needs my decisions, ask them all in one question, each with your recommended answer first, instead of stopping at the first one.
6. Before you edit anything, show a short plan and wait for my go-ahead when the step:
   - changes more than one repository, or a handoff between tracks;
   - has a plan entry that doesn't say clearly what "done" means;
   - is a checkpoint (`CP<m>`), a new objective, or needs an operator decision or a live operation.

   The plan lists the files you will change, the checks you will run and the open decisions. For any other step, go on without one.

   Under autopilot (my note says "under autopilot", or I just ran `/autopilot`), show that plan for a step that spans repositories or changes a handoff, and go on without waiting. Still stop and ask for an unclear "done", a checkpoint, a new objective, a decision or a live operation. Under autopilot, also log each decision with the `show-me-your-work` skill in `<root>/.audit/<ID>.tsv` (right after `/autopilot`, a row with phase `autopilot` first). When my note says "autopilot is off" because a step is done, its commits ran or the session reached its checkpoint, open with a `ketchup` of the run read from that trail, with a review on another model (AUTOPILOT.md section 2). When it is off for any other reason, say why and point me at the trail.

Commits follow the "Ready to commit" preview in `~/.claude/git-rules.md`: its commands in one ```` ```commit ```` block, each line `git -C <absolute path>` (or `gh … --repo <owner>/<name>`), run one by one as shown. Before the preview, run `code-review` on the diff and fix what it finds (the preview's `Review:` line says what it found), then record the step's result and the next step in the docs this session may edit. When I answer "approve" and the commands succeed (or I commit myself and say "committed"), this session is cleared and restarted with `/session <ID>`, so anything not in the docs is lost. Under autopilot the session-reset mod approves a preview itself when its `Review:` line leaves nothing open ("no findings", "docs only, reread", "2 findings, both fixed", "9 findings, 5 fixed, 4 kept", each kept one with its reason in parentheses or below) and its commands are only `git add` and `git commit`; anything else waits for me. When a preview's commit finishes a step, not just one slice of it, add a line `Step done: <ID>`: `/autopilot <ID>` stops after that commit.

Open operator.md, release.md or capabilities.md only when you need to update them.
