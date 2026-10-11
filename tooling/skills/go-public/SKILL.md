---
name: go-public
description: Record that a repository of this workspace should become public open source one day. Use when the operator says a repo or subrepo should go public, be open-sourced or published later ("mark X to go public", "I want X public in the future").
---

# Record a repository's intent to go public

The operator opened a plain session at the workspace root and asked to mark `<repo>` to
go public later. You only record the decision; the work happens later in a
`publish-<repo>` session (the `publish` skill).

1. Check that `<repo>` is a repository of this workspace (a submodule path in
   `.gitmodules`). If the name is ambiguous, ask which one.
2. Re-run `git status` at the root and re-read the files below right before editing. Other
   sessions may be running: edit by exact replacement, never a rewrite.
3. In the root plan's public release section (in `plan.md`, or the root file the plan
   names for it, such as `public-release.md`):
   - Add a row to the release order table: the module, its public name `<repo>-oss`, what
     it waits on (the module's other planned work unless the operator says otherwise),
     and today's date.
   - Add a decision row (next free decision ID) saying the operator decided `<repo>`
     goes public as `<repo>-oss`, with the date, in the plan's decisions table or the
     root file the plan names for it (such as `decisions.md`).
4. In the root `handoffs.md` "Publish status" table, add `| <repo> | planned | <date> |`.
5. Do not touch the repository itself, its plan or any other session's files. The publish
   session adds the release steps to the module plan on its first run.
6. Tell the operator in two lines what you recorded, and show the Ready to commit preview
   for the root (`~/.claude/git-rules.md`; no Co-Authored-By line); run it on approve.
   Starting the publish session later: `git init -b main
   "$(sp-config PUBLISHED_DIR)/<repo>-oss"`, then `/session publish-<repo>`
   from the workspace root.
