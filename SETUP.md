# Create a super project from this template

The steps for "create a new super project from `project-harness`". The result is a
coordinated workspace: a root repository, module submodules, tracks and sessions, one
checkpoint per milestone. [WORKFLOW.md](WORKFLOW.md) explains every file and the tooling
that reads it.

Every value a project needs lives in one file, `project.toml`. `sp-new` renders every
root and module document from it, so no one fills a placeholder by hand.

## 1. The project file

Run `/new-project` in Claude Code. It asks every question in one message, each with a
recommended answer, writes `project.toml`, checks it with `sp-new --check` and shows it
to you. You may also skip the questions: copy
[tooling/project.example.toml](tooling/project.example.toml), which documents every key,
edit it, and run `sp-new --check <file>`. `/new-project <file>` then takes it from there.

## 2. Render the root

```sh
sp-new <file>          # creates $(sp-config PROJECTS_DIR)/<dir>; it must not exist yet
```

It writes the root documents and keeps the file in `<root>/.claude/project.toml`, the
record of the setup. After setup the documents win; only `sp-new --modules` reads the file
again. `operations.md` and the runtime rules are written only when the file has a
`[runtime]`. When the runtime names its `scripts`, `sp-new` also writes
`.claude/workspace.json`: the rule the workspace mod enforces, so that only the runtime's
session, and `CP<m>` during its run, runs them. Rows repeat per module, track, session and milestone. Queues, checkpoint
scopes, the module matrix, versions and the cross-track order come from the steps and
their dependencies. `sp-new` fails, naming each problem, on a missing or unknown key, a
`|` or a second line in a value that goes into a table, a step that depends on a later
milestone, a dependency cycle, or anything left unfilled.

Work lands on `development`; `main` only fast-forwards to release tags.

## 3. Wire the tooling

`sp-claude-init` needs a git repository. Show a preview with `git init -b main` in the
root and run it on approve. Then:

```sh
sp-claude-init <root>          # --skill <name> copies a private skill from the overlay
```

This copies the project skills into `.claude/skills/`, writes `.zed/settings.json`,
excludes `.zed/` from git, warns about `submodule.recurse`, and registers the root in the
roots file (`sp-config ROOTS`). Registration turns on the session-reset and workspace
mods, the ops board, `/operator-steps` and `session-sweep.sh` for this root. Commit
`.claude/skills` with the root.

## 4. Check, then the first commit

From the new root:

```sh
grep -rn -e '{{' -e '<!-- template' . --include='*.md' --include='.gitignore'   # nothing
grep -q '^### Session IDs' plan.md && grep -q '^- \*\*Shared files' plan.md
grep -q '^## Publish status' handoffs.md && grep -q '^## Checkpoint status' handoffs.md
opsboard --md .                                                   # shows O1, nothing else
```

Links into module folders resolve after O1; every other local link and anchor resolves
now. Append GitHub's `.gitignore` template for the root's language to `.gitignore`.

Then show the Ready to commit preview for the root: `git add` with the explicit paths
(the docs, `.gitignore`, `.claude/project.toml`, `.claude/workspace.json` if written,
`.claude/skills`), the message
`docs: workspace created from project-harness`, then
`git switch -c development # approved`. Tell the operator that O1 is next. The operator
adds and commits the submodules, because sessions never stage submodule pointers outside
a checkpoint.

## 5. The modules, after O1

When the operator says "O1 done", fill the module repositories:

```sh
sp-new --modules <root>
```

It writes each module's AGENTS.md (with the root's Common working rules, copied
verbatim), plan.md, research.md and README.md, dated the day it runs. It fills only a
repository that holds just the README `gh repo create --add-readme` made, and leaves any
other alone. It fails when a module's repository does not exist yet. Then run the checks
below and show each module's first commit (`<CODE>-0.1: plan, research and agent rules
from project-harness`), one preview per repository.

A future module gets its repository from an O task in a later milestone. Then move it
from `[[future_modules]]` to `[[modules]]` in `<root>/.claude/project.toml`, add the keys
a module needs, and run `sp-new --modules <root>` again. Until it is moved, a repository
for it makes `--modules` stop and say so.

## 6. Check after O1

- Every repository named in backticks in the session table is a real folder. Otherwise
  the workspace mod will not let that session write it.
- Links into the module folders resolve.
- `/session S1` in a fresh terminal answers in five lines (ID, tracks, repositories,
  shared files, next step), with no "missing" complaint.

## 7. After setup

- `/balance-sessions` sizes the sessions once the queues have real steps.
- `/add-objective <idea>` adds goals later and rebalances.
- `go-public` marks a module for open source; `/session publish-<repo>` releases it.
- When the operator commits and says "committed", the session-reset mod restarts the
  session with `/session <ID>`.

## Changing the templates

`workspace/` and `module/` use a small mustache subset that `sp-new` fills: `{{key}}`,
`{{a.b}}`, `{{.}}` for the current item, `{{#list}}…{{/list}}` to repeat, or to keep text
when a value is set, and `{{^key}}…{{/key}}` for text when it is not. A tag alone on its
line takes the line with it. The values, including the derived ones, are built in
`build()` in [tooling/bin/sp-new](tooling/bin/sp-new). After a change, run
`tooling/tests/sp-new/run.sh`: it renders the example and a minimal file and runs the
checks above on both.
