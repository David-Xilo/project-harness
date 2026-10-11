---
description: List every open operator task (O<n>) across the coordinated workspaces, sorted by what it unblocks
argument-hint: "[workspace ...]"
---
Arguments: $ARGUMENTS

List the open operator tasks so I can clear them in one sitting. This is read-only: edit no file and run no git command.

1. Workspaces: the ones named in the arguments (a name under the projects folder, `sp-config PROJECTS_DIR`, or a path), otherwise every root listed in the roots file, `sp-config ROOTS` (skip blank and `#` lines).
2. In each, read `operator.md` and the handoffs.md rows and plan tracker rows that name an open task. A task is open unless the docs say it is done.
3. Print one table per workspace, sorted by the number of sessions and steps each task unblocks (most first), then by date: ID | what to do (the exact command, path or web step, copied from operator.md) | unblocks (session IDs and step IDs) | earliest date it can be done.
4. End with the three tasks that unblock the most work across all workspaces, and any task whose entry lacks the command or the "done when" check it needs.
