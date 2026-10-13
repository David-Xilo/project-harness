# Working in {{name}}

## Common working rules

- Read this module's plan and code before choosing work, and the root plan when present.
  The local plan must also work in a standalone checkout.
- Build the smallest slice the current caller needs. No speculative frameworks, backends,
  config knobs or future-service scaffolding.
- Reuse settled decisions and working code. Research only a concrete open question, and
  record the evidence and its limits.
- Keep ownership, {{domain_invariants}}, provenance and compatibility. Never add a
  second writer for data another module owns.
- At a gate, name the missing owner, artifact or check and stop dependent work.
  Maintenance, needed research and agreed fixtures stay allowed. Write a step only the
  operator can do in the workspace `operator.md`, with full paths, commands and web steps.
- Keep changes focused. Preserve unrelated work; no drive-by refactors.
- Prove behavior end to end through real entry points and realistic fixtures. Unit-test
  only tricky logic. Delete tests that only repeat other tests.
- Update both sides of a changed handoff. Say plainly what is implemented, locally
  verified or system accepted; never report a missing or unrun check as passing.
- Never expose secrets or {{private_data}}. Protect raw evidence; no destructive
  maintenance without explicit scope. Do not commit or push unless asked.
- Write short, plain sentences. Link domain and design terms to the workspace
  `glossary.md`. Report what changed, what was checked and what is blocked.
- Use any skill or MCP server that is useful to you.

## Session practice

These hold for every session in this workspace. Repository AGENTS.md files do not repeat
them.

- The shell is zsh, which does not split an unquoted variable into words. Loop over an
  array (`ports=(3000 3001); for p in $ports`) or run the script with `bash`. Never
  `pkill` a pattern that can match your own shell.
- Other sessions edit the shared root files at the same time. Re-read a shared file
  (handoffs.md, operator.md and the like) right before you edit it, and keep what others
  changed. Report a failure caused by another session's uncommitted work; do not fix it.
- "Remind me" or "note this" means say it in chat; write it into a doc only when asked.
  When asked to remove one part of a section, remove only that part, and ask when the
  scope is unclear.
- When anything is unclear, ask every open question at once, each with your recommended
  answer, instead of stopping at the first one.
- Before you call a change verified, run the full check of what it touches. For
  TypeScript that is the project's own typecheck (`tsc -b` for a project with
  references) and the affected specs, never a partial `tsc -p`. An end-of-turn hook also
  typechecks the TypeScript projects and Go packages you edited.
- Search for repositories and files recursively (`find . -maxdepth 4 -name .git`), never
  only the top level.
- Run git commands only as shown in an approved preview (`~/.claude/git-rules.md`), with
  nothing appended. Keep git command text out of heredocs and prompts, because the
  git-guard hook blocks it.
- A read-only GitHub MCP server (`github`) shows CI runs, releases, tags, issues and
  pull requests. Use it instead of parsing `gh` output.

## Workspace boundaries and checks

The root plan owns goals, handoffs and system acceptance. Module plans own their steps;
research records decisions/evidence, READMEs document delivered behavior. Keep the same
Common working rules in every module AGENTS.md, plus concise local boundaries/checks.

This directory is a workspace of independent repositories, each a git submodule here.
Respect each repository's existing worktree changes. No new service/repository, runtime
change or live operation is implied by a docs task. A new module repository is created
with its first implementation step; the operator creates it on GitHub and adds the
submodule.

A session works in one or more tracks of the root plan's [tracks and
checkpoints](plan.md#tracks-and-checkpoints). It finds its ID (`S1`–`S{{n}}`, `CP<m>`,
`publish-<repo>`), tracks, repositories, shared files and next step in the plan's
[session IDs](plan.md#session-ids) and follows its [session rules](plan.md#session-rules)
(at most four track sessions, SD3). Each repository has one writing track. A session
edits only its tracks' repositories. It asks other sessions through rows in
[handoffs.md](handoffs.md) and the operator through entries under its tracks in
[operator.md](operator.md), one ID `O<n>` per task (SD4). With its repositories' rows in
[release.md](release.md), these are the only root files it may edit (it may also append
a glossary entry and keep its tracks' queue cells in the plan current). Root files
otherwise change only in a checkpoint session `CP<m>`.
Each milestone has one [checkpoint](plan.md#milestone-checkpoints), always one open:
every session works up to its scope, records its release commits in release.md and marks
`reached` in handoffs.md's checkpoint status, then may work ahead; `CP<m>` runs only when
all have, and no other session works while it runs (SD6). A module marked public is
released by its own `publish-<repo>` session ([public release](plan.md#public-release));
while its publish status reads `running`, no other session works in that repository, and
a repository whose AGENTS.md has a "Public repository" section is public: follow it. A
release follows [Releases and versions](plan.md#releases-and-versions); what works today
is in [capabilities](capabilities.md).

{{#runtime}}
Only `{{runtime_session}}`, and `CP<m>` during its run, run {{runtime_name}}.

{{/runtime}}
For documentation changes, check local links/anchors, names, matching ownership, all
module stop/resume gates and an acyclic dependency order. Check that commands exist and
status claims name evidence. No application test suite is required solely for prose.
Each fact has one home: status in the module plan's "Current state", evidence in module
`research.md`, order and gates in the root plan.
