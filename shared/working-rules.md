# Working rules

These apply in every project on this machine. A project's own AGENTS.md or CLAUDE.md may
add exceptions.

## Steps for David

When a step is David's to do (sudo, an account, a web console, a file, a decision, a play
session), give every step in order with the exact commands and paths, ready to paste, and
a 'done when' check; never a summary he has to ask to expand.

- Put each command in a fenced `sh` block that starts with the `cd` it runs from.
- End with a "Done when" check.
- Settings files go to him as complete files to paste over, never fragments.

## Git

Commit without asking for a preview or approval; follow the repository's AGENTS.md for
message style.

- In ikarus and safehouse, commit only on your own task branch.
- Push your own work without asking. Never force-push, rewrite published history or delete
  remote branches.
- Project files may add exceptions; for example, ikarus lands by pull request.

## Questions and defaults

- When a choice does not change the goal or an output David will notice, pick the sensible
  default, say which in one line, and keep going.
- When answers would change the result, ask every such question at once, each with your
  recommended answer.
- A choice that cannot be undone is David's.
- "Remind me" or "note this" means say it in chat.

## Checks and evidence

- Before calling work done, run the project's check command and show the command and its
  output.
- When reviewing, flag only gaps that affect correctness or the stated requirements.

## Docs

These are the default. Where a project's AGENTS.md says how its plan, research or history
files are kept, follow that.

- Done means deleted. Remove a finished row or step from the plan in the commit that
  finishes it. Keep no done list and move no text to another file: the commit is the
  record.
- In a file other sessions edit, change only your own row. Locks and progress go in the
  pull request body.
- Write by hand nothing a command can print: a count, a version, a list of routes or
  files.
- Write a research note only when a decision depends on it. The decision takes one line
  in the decision log; working notes stay in the commit message or the pull request.
- When a plan fails its size check (`doc-budget.sh`), cut the plan. Do not raise the
  budget.

## Context

When compacting, keep the list of modified files, the checks run with their results, and
every boundary David stated.
