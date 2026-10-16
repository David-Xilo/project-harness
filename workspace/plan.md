# {{name}} system plan

Updated {{date}}. This plan owns system goals, module ownership, tracks, the order of
work, gates and releases. Each module's `plan.md` owns its own steps and status. Terms
are in the [glossary](glossary.md). History: git log and the [decisions](decisions.md).

**Where each fact lives:**
- Module status and next steps: that module's plan, sections "Current state" and "Next".
- Requests between tracks: [handoffs](handoffs.md).
- Evidence (commands, counts, dates): module `research.md`.
- What works today: [capabilities](capabilities.md).
- Sessions, their IDs, what each may write and the rules each follows: [Session
  IDs](#session-ids) and [session rules](#session-rules); `/balance-sessions` keeps them
  in step with the work.
- Steps only the operator can do, per track, one ID each: [operator.md](operator.md).
- The commit of each repository that goes into the next milestone release:
  [release.md](release.md).
{{#runtime}}
- Reference, read when a step needs it: [milestone acceptance](acceptance.md), the
  [decisions](decisions.md) SD1–SD11, [future module steps](future-steps.md) and
  [operations](operations.md).
{{/runtime}}
{{^runtime}}
- Reference, read when a step needs it: [milestone acceptance](acceptance.md), the
  [decisions](decisions.md) SD1–SD11 and [future module steps](future-steps.md).
{{/runtime}}

## Contents

1. [What {{name}} is](#{{slug}})
2. [How the system fits together](#how-the-system-fits-together)
3. [Modules and ownership](#modules-and-ownership)
4. [Tracks and checkpoints](#tracks-and-checkpoints)
5. [Milestones, gates and module work](#milestones-gates-and-module-work)
6. [Tracker: open steps](#tracker-open-steps)
7. [Releases and versions](#releases-and-versions)
8. [Rules every module follows](#rules-every-module-follows)
9. [Public release](#public-release)

## What {{name}} is

{{vision}}

**Defaults:**
- Build only what the current caller needs.
{{#defaults}}
- {{.}}
{{/defaults}}

## How the system fits together

```mermaid
flowchart LR
  {{diagram}}
```

{{#layers}}
- {{.}}
{{/layers}}

## Modules and ownership

Status is not repeated here: each module plan's "Current state" is authoritative.

| Code | Module | Owns | Track |
|---|---|---|---|
{{#modules}}
| {{code}} | [{{module}}]({{repo}}/plan.md) | {{owns}} | {{track}} |
{{/modules}}

Future repositories are created with their first implementation, not before (their steps
are in [future-steps.md](future-steps.md)):

| Repository | Code | Owns | Created at | Track |
|---|---|---|---|---|
{{#future}}
| `{{repo}}` | {{code}} | {{owns}} | {{created_at}} | {{track}} |
{{/future}}
{{^future}}
| None yet | | | | |
{{/future}}

## Tracks and checkpoints

Work runs in parallel **tracks** (SD2). A track is the only writer of its repositories;
it waits only on named artifacts from other tracks. At most four track **sessions** run
at once, and a session may hold several tracks (SD3). Each milestone has one checkpoint,
run alone by its own session `CP<m>` (`CP1` for M1; SD6), and a publish session runs
beside the track sessions (SD10). `/session <ID>` starts each one from this plan
([session IDs](#session-ids)).

| Session | Tracks | Only writer of |
|---|---|---|
{{#sessions}}
| `{{id}}` **{{session_name}}** | {{tracks_text}} | {{repos_text}} |
{{/sessions}}
| `CP<m>` **Checkpoint** (`CP1`–`CP{{last_m}}`) | CP | the root repository, during its milestone's checkpoint run ([rules](#milestone-checkpoints)) |
| `publish-<repo>` **Release** | one module the [public release](#public-release) section marks public | `<repo>`, while its publish status reads `running`. None planned |

| Track | Queue now (details in the module plans' "Next") | Then, after its inputs |
|---|---|---|
{{#tracks}}
| **{{id}} {{track_name}}** | {{queue}} | {{then}} |
{{/tracks}}
| **CP Checkpoint** | `CP1` (M1, {{m1.version}}) is open; it runs once every session has reached it | {{later_cps}} |

**Waiting on the operator** (no track can do these): see [operator.md](operator.md),
one section per track plus General, with the steps for each.

### Track rules

- **One writer per repository.** A track edits only its own repositories. It reads any
  other repository but never edits it, not even its plan.
- **Sessions (SD3).** A session holding several tracks writes all their repositories.
  A request between its own tracks needs no handoff row; the session records the step
  and its delivery in both module plans.
- **Handoffs.** A request to another track is one row in [handoffs](handoffs.md): the
  requester opens it, the owner acknowledges, delivers and closes it, and records the
  step in its own plan.
- **Operator steps (SD4).** A step only the operator can do (a file, a secret, a
  decision, a host or web action) is one entry `O<n>` under the track's heading in
  [operator.md](operator.md), or under General when it spans tracks. One ID is one task
  the operator finishes. It gives full paths, commands and web steps, what it unblocks
  and the session to tell. The operator says "O<n> done" to that session; the session
  checks the result, records the evidence in its own plan and deletes the entry.
- **Root docs** (`plan.md` and its reference files `acceptance.md`, `decisions.md`,
  `future-steps.md`{{#runtime}}, `operations.md`{{/runtime}}, `capabilities.md`, `README.md`,
  `handoffs.md`, `operator.md`, `release.md`, the glossary): every session keeps them
  current as its work goes, so the plan does not drift. It re-reads a file right before
  editing it, edits by exact replacement and keeps what other sessions wrote. It leaves
  them uncommitted: the operator or `CP<m>` commits the root in one commit (SD2).
  Submodule pins and tags change only in a `CP<m>` session.
{{#runtime}}
- **The shared runtime** ({{runtime_name}}) is run only by `{{runtime_session}}`, and by
  `CP<m>` during its run while `{{runtime_session}}` is stopped. Other sessions ask
  its track through a handoff row. Images and builds come only from committed revisions,
  so commits come before a build.
{{/runtime}}
- **Waiting.** A track whose next step waits on another track reads the owner's plan
  "Current state" and `handoffs.md`. If still blocked, it does maintenance (`<CODE>-0.n`),
  needed research or agreed fixtures from its own queue, or stops and names what it waits
  for.
- **Commits (SD7).** A session runs git only after the operator's approve: it shows a
  "Ready to commit" preview (files, message, exact commands per repository) and runs it
  as the operator, signed, with no Co-Authored-By line (`~/.claude/git-rules.md`).

### Session IDs

`/session <ID>` starts a session from the workspace root; it reads AGENTS.md, this plan and
[handoffs.md](handoffs.md). Session IDs are always written in backticks (`S1`–`S{{n}}`,
`CP1`–`CP{{last_m}}`, `publish-<repo>`); the [decisions](decisions.md) SD*n* and the
operator task IDs `O<n>` are different namespaces.

- **Tracks and repositories:** the session's row in the table above, and no others.
- **Shared files:** the root docs ([track rules](#track-rules)): this plan,
  [handoffs.md](handoffs.md), [operator.md](operator.md), [release.md](release.md) and
  the root's other `.md` files, left uncommitted for the operator or `CP<m>`.
- **Checkpoint first:** while the checkpoint session's row reads `running`, `S1`–`S{{n}}`
  start no work, except a fix the `CP<m>` session asks for on a release branch. One
  checkpoint is always open, the current milestone's ([milestone
  checkpoints](#milestone-checkpoints)). A session works on its scope there first. Once
  its row reads `reached`, it may work ahead ([rules](#milestone-checkpoints)).
- **Publish status:** a session does no work in a repository whose row in the [publish
  status](handoffs.md#publish-status) reads `running`.
- **Next step:** open handoff rows addressed to its tracks, then its scope for the open
  checkpoint, then its tracks' "Queue now" above and the module plans' "Next". A blocked
  item is skipped and named.
- **`CP<m>`** runs milestone M*m*'s checkpoint only when every `S1`–`S{{n}}` row reads
  `reached` and no publish row reads `running`; otherwise it names who is still working
  and stops.
- **`publish-<repo>`** follows the [public release](#public-release) rules and the
  `publish` skill.
- **Rules for every session:** the [session rules](#session-rules) below.

### Session rules

Every session follows these on top of AGENTS.md and the git rules in
`~/.claude/git-rules.md` (SD7). They are the only session prompt (SD8); `/balance-sessions`
keeps them and the queues in step with the work.

**Each step:**
1. State its scope and done-check in three lines.
2. Build the smallest slice.
3. Run the checks in each changed repository's AGENTS.md.
4. Run the `code-review` skill on the diff and fix what it finds; run `simplify` when the
   slice grew.
5. Tick the step in the owning plan with evidence, and record what it learned in
   research.md.
6. Clean up its own docs, so they are true when the step is committed:
   - its module plans' "Current state" and "Next", and its tracks' queue above;
   - its handoff rows: open or acknowledge what it needs, mark what it delivered, close
     what was delivered to it;
   - the `O<n>` entries it verified, which it deletes ([operator.md](operator.md));
   - nothing stale that it wrote earlier;
   - any other root doc its work changed (this plan, decisions, acceptance), left
     uncommitted with the rest of the root ([track rules](#track-rules)).
7. Show the Ready to commit preview, with its `Review:` line from step 4, and run it on
   "approve"; session-reset holds an approve of a preview with no `Review:` line. Once it
   succeeds the session is cleared and restarted with `/session <ID>` (the session-reset
   mod); "approve, then <note>" hands a note to the restarted session. On "continue",
   take the next item.

**Always:**
- A step only the operator can do becomes an `O<n>` entry ([track
  rules](#track-rules)); then continue with unblocked work, or stop and name what the
  session waits for.
- Never run sudo: give the operator the commands as an `O<n>` entry.
- Under `/autopilot`, session-reset approves each clean commit preview itself: a step
  that spans repositories or changes a handoff shows its plan and goes on. A decision, an
  unclear "done", a checkpoint, a new objective or a live operation still waits for the
  operator, and a finding left open waits for a typed "approve".
{{#hard_rules}}
- {{.}}
{{/hard_rules}}

**Per session:** what it reads after its track row, and its own rules.
{{#sessions}}
- **`{{id}}`:** {{reads}}.
{{/sessions}}
- **`CP<m>`:** [release.md](release.md), [capabilities](capabilities.md) and
  [acceptance](acceptance.md), with the [milestone checkpoints](#milestone-checkpoints)
  rules. It drafts annotated tag notes for the root and every changed repository by the
  [versioning policy](#releases-and-versions). Never run sudo. It ends by running
  `/balance-sessions` and naming the sessions to start.

### Milestone checkpoints

Each milestone has one checkpoint, `CP<m>` for milestone M*m*, run by a session of the
same name (SD6). Every session works up to its part of the milestone and records the
commits that go into the release. When all of them have, `CP<m>` builds, verifies,
accepts the milestone and tags it; then the next checkpoint opens.

- **Always one open.** The current milestone's checkpoint is open: now `CP1`. Each
  session's scope is in the table below: its tracks' steps for that milestone, or `none`
  (commit the current step). Every `S1`–`S{{n}}` row in the [checkpoint
  status](handoffs.md#checkpoint-status) reads `working` until the session reaches it.
- **Reaching it.** A session has reached it when its scope is done, the operator has
  committed its work, and the handoff rows another session needs for it are delivered.
  It writes the release commit of each repository it holds in [release.md](release.md)
  and sets its row to `reached`.
- **Working ahead.** After `reached`, a session may take next-milestone steps whose
  inputs are ready. A step behind a gate this checkpoint passes still waits for it.
  Commits made ahead are not in the release.
- **A fix after recording** never rewrites `development`. The session previews the
  commands for a branch `release/<tag>` from the recorded commit and runs them on approve;
  the fix is committed there, merged back into `development` with `git merge --no-ff`, and
  the row moves to the branch tip.
- **Running it.** `CP<m>` starts only when every `S1`–`S{{n}}` row reads `reached` and no
  publish row reads `running`, and sets its row to `running`; no other session works
  meanwhile. Then: every repository is committed, the root too, with every session's doc
  edits in one commit → each repository switches to
  `release/<tag>` at its recorded commit → each repository's checks and builds → the
  milestone's [acceptance](acceptance.md) runs → evidence recorded → this tracker,
  `capabilities.md` and submodule pins (the release commits) updated → tag the branch
  tip, `main` fast-forwards to it → the branch merges back into `development` if it has
  commits `development` lacks → every repository back on `development`. A failing check
  names the repository; only its owning session works, on that release branch, and the
  run restarts at the checks. `CP<m>` previews the git commands and runs them on the
  operator's approve (SD7).
- **Ending it.** `CP<m>` marks the checkpoint done below and opens the next one: it
  writes the scopes, starts the next section of `release.md`, sets every `S1`–`S{{n}}`
  row to `working` on `CP<m+1>` and its own to `idle`, then runs `/balance-sessions`
  (drift, queues, load) and names the sessions to start.
- **No system patch releases between milestones** (SD9). Work done between checkpoints
  ships in the next milestone release.

| Checkpoint | Milestone, gates | Scope per session (reached when) | Release | Unblocks |
|---|---|---|---|---|
{{#milestones}}
| **{{cp}}**{{#open}} (open){{/open}} | {{id}}: {{gate_id}} | {{scope_text}} | **{{version}}** | {{next_m}} |
{{/milestones}}

Cross-track order (acyclic): {{cross_order}}.

## Milestones, gates and module work

Order: **{{milestone_order}}.**

| Milestone | Delivers | Release | State |
|---|---|---|---|
{{#milestones}}
| {{id}} | {{delivers}} | {{version}} | Planned |
{{/milestones}}

### Gates

A gate is a named checkpoint. Dependent work stops until the gate has recorded evidence.
While blocked, maintenance, needed research and agreed fixtures stay allowed;
speculative adapters, substitute data paths and future-service scaffolding are not.

| Gate | Delivering owners and artifact | Consumers may resume when | State |
|---|---|---|---|
{{#milestones}}
| {{gate_id}} | {{owners_text}}: {{gate_artifact}} | {{id}} acceptance passes | Open |
{{/milestones}}

### Handoffs and stopping rules

Step IDs are `<CODE>-<milestone>.<n>`, for example `{{first_step}}`. Milestone `0` is
maintenance: allowed any time, never completes a gate. A published ID is never
renumbered or reused. A module starts a stage only after its gate passes and stops at the
stage's last step until the next gate passes. Requests between tracks go through
[handoffs](handoffs.md); the [tracker](#tracker-open-steps) lists each step's
dependencies.

### Module work by milestone

Each cell is the range of a module's own steps. `—` means maintenance, research and
agreed fixtures only.

| Module |{{#milestones}} {{id}} |{{/milestones}}
|---|{{#milestones}}---|{{/milestones}}
{{#modules}}
| [{{code}}]({{repo}}/plan.md#milestone-steps) |{{#cells}} {{cell}} |{{/cells}}
{{/modules}}

## Tracker: open steps

This is the single place where system progress is ticked, by the `CP<m>` session at
its checkpoint, with recorded evidence. Priorities: **P0** critical path, **P1** required
but parallel, **P2** only for a named need, **M** maintenance.

**Done:** nothing yet.

Ticks below between checkpoints mirror a module plan's "locally verified" status; system
acceptance comes with the checkpoint run.

{{#milestones}}
### {{id}}

| Done | Pri | Step | Track | Depends on | Unblocks |
|---|---|---|---|---|---|
{{#steps}}
| [ ] | {{pri}} | {{id}}: {{title}} | {{track}} | {{depends_text}} | {{unblocks_text}} |
{{/steps}}

- [ ] **Gate: {{gate_id}}, then {{id}} accepted** → {{cp}}, release {{version}}.
{{^last}}

{{/last}}
{{/milestones}}

## Releases and versions

SD9, agreed {{date}}:
- **The system version is the milestone.** The root repository and every application
  repository carry the same tag at a milestone: M*m* is `v0.<m>.0` until
  {{v1_milestone}}, the first unattended production use, which is **v1.0.0**; each later
  milestone takes the next minor, and a breaking change the next major.
- **Patches.** The system has no patch release between milestones: each milestone has one
  checkpoint (SD6), and work between checkpoints ships in the next milestone release. A
  library release between milestones takes the next free patch in that repository only.
- **Libraries keep their own lines**, because callers pin them. A new API is a minor; a
  fix or docs change is a patch.
- **Tags are annotated**; their notes list that repository's capabilities. The root tag's
  notes list the system capabilities and every repository's version. Each tag is also a
  GitHub Release (`gh release create <tag> --verify-tag --notes-from-tag`).
- **Operator use.** A milestone is accepted only when its capabilities work through
  documented entry points (CLIs, API, UI); package version fields match the release.
- **Branches.** Work lands on `development`. A milestone release is built from the
  commits in [release.md](release.md), on a branch `release/<tag>` per repository; a fix
  for the release is committed there and merged back into `development` with
  `git merge --no-ff`. `main` only fast-forwards to the tagged release commit. Nobody
  rebases or force-pushes a published branch.

## Rules every module follows

{{#rules}}
### {{group}}

{{#items}}
- {{.}}
{{/items}}

{{/rules}}
## Public release

No module is planned public today.

A module goes public under its own name and is developed in the open from then on; there
is no export and no second copy (SD10).
- **Marking a module public.** The operator runs `/go-public <repo>` in a plain session
  at the root. The `go-public` skill reads the module's gates (`publish-check`,
  `gh-harden`) and picks the way: **in place** when its history is clean, or a
  **snapshot**, one audited commit of its tree in a new repository of the same name, with
  the old one renamed `<repo>-private` and archived. It writes the steps `<CODE>-P1`–`P6`
  into the module plan, a row in the table below, a decision, a `planned` row in the
  [publish status](handoffs.md#publish-status) and the operator tasks.
- **The publish session.** `publish-<repo>` (the `publish` skill) works those steps:
  security audit, cleanup, the public files, CI and the pre-push hook, the gates, then
  GitHub hardening, the operator's visibility switch and the first release. While its row
  reads `running` the session that owns `<repo>` does no work there, and no checkpoint
  runs.
- **After the first release** the module is ordinary: its track develops it in the open,
  and its checkpoints tag it. Its AGENTS.md "Public repository" section holds: every push
  is public at once, and the pre-push hook and CI run leak-check and gitleaks. Credentials,
  {{never_exported}} never go into it.

| Module | Public name | Waits on | Decided |
|---|---|---|---|
| None yet | | | |
