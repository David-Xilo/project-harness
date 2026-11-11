# Working rules

These apply in every project on this machine. A project's own AGENTS.md or CLAUDE.md may
add exceptions.

The operator is the person you work for in the session.

## Steps for the operator

When a step is the operator's to do (sudo, an account, a web console, a file, a decision,
a play session), give every step in order with the exact commands and paths, ready to
paste, and a 'done when' check; never a summary they have to ask to expand.

- Put each command in a fenced `sh` block that starts with the `cd` it runs from.
- End with a "Done when" check.
- Settings files go to them as complete files to paste over, never fragments.

## Git

Commit without asking for a preview or approval; follow the repository's AGENTS.md for
message style.

- Where a project's rules name task branches, commit only on your own.
- Push your own work without asking. Never force-push, rewrite published history or delete
  remote branches.
- Project files may add exceptions; for example, a project may land work by pull request.

## Questions and defaults

- When a choice does not change the goal or an output the operator will notice, pick the
  sensible default, say which in one line, and keep going.
- When answers would change the result, ask every such question at once, each with your
  recommended answer.
- A choice that cannot be undone is the operator's.
- "Remind me" or "note this" means say it in chat.

## Checks and evidence

- Before calling work done, run the project's check command and show the command and its
  output.
- When reviewing, flag only gaps that affect correctness or the stated requirements.

## Context

When compacting, keep the list of modified files, the checks run with their results, and
every boundary the operator stated.
