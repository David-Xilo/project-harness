# Changelog

Each release is a milestone or a patch between milestones; its tag notes list what it
brings.

## v0.2.0 (2026-10-14)

- `/autopilot [<step>] [--max N]` in a session: the session-reset mod approves its
  reviewed `git add` and `git commit` previews itself (every finding fixed, or kept with
  its reason), until the commit whose preview says `Step done: <step>`, the session's
  `reached` checkpoint row or N commits (100 by default). A question, any other command or
  a failure stops it for the operator; nothing is pushed. `/autopilot off` ends it, and
  the band shows the count and the target.
- The ops band reads a session's tracks from its ID, Track and Code cells only, so the
  bold labels of its work cell ("**CP3:**") are no longer taken for tracks.
- Every commit is reviewed first: a preview that commits carries a `Review:` line, and
  session-reset holds an approve of one without it. Each step ends with a cleanup of the
  session's own docs, including its tracks' queue cells in the root plan.
- session-reset takes any preview, whatever its title, and the operator's approve lets
  any git or gh write that is not forbidden run in that turn; a commit the preview did
  not show needs its `Review:` line. It restarts the session only after a commit, so a
  checkpoint's switches and tags keep it.
- The ops board shows each session: its state (reached, ready, blocked, idle), next step,
  how much is ready, what blocks it, its checkpoint row and its autopilot, in `opsboard`,
  `--md`, `--tsv` and the `/ops` pane.
- `/balance-sessions` sizes the sessions to the workload: how many to run for the next
  stretch and which on `/autopilot`, with a review of the decisions. Its drift check
  stays as a fallback and names the session that skipped its cleanup.

## v0.1.1 (2026-10-12)

- Developed in the open: this repository is now the development home. `development` is
  the working branch, `main` the latest release, and the plan is public.
- `publish-check [--snapshot] [<repo>]`: the local gates a repository passes before it
  goes public, one line each.
- `gh-harden <owner/repo> [--apply]`: reads, and sets, the GitHub settings of a public
  repository; the rulesets ship in `tooling/publish/rulesets/`.
- `tooling/publish/templates/`: the public files, a gitleaks workflow and Dependabot for
  any repository going public; `tooling/install --hook <repo>…` links the pre-push hook
  into it.
- `/go-public <repo>` plans a public release, in place or as a snapshot: the steps P1–P6
  with their gates, the records and the operator tasks. The `publish` skill works them,
  for a workspace module or a standalone repository.
- The workspace templates, WORKFLOW.md and SETUP.md follow the new publishing model.
  `PUBLISHED_DIR` and the `<repo>-oss` names are gone; an old `PUBLISHED_DIR` line in the
  config is ignored.
- session-reset: a note with an apostrophe in a preview's command block no longer hides
  the commands after it, so their approve runs them.
- Renamed `project-harness` (from `project-template`). `sp-claude-init` writes
  `.claude/project-harness.lock` and moves a root's `project-template.lock` on its next
  run; the `sp-*` commands and the `super-project` folders keep their names.

## v0.1.0 (2026-10-11)

- Document templates for a super project (`workspace/`) and its modules (`module/`).
- `/new-project` and `sp-new`: set up a project from one `project.toml`.
- Git rules: a "Ready to commit" preview, then the operator's approve. The session-reset
  mod enforces them and restarts the session after a commit.
- The workspace mod: a write guard per session, the runtime rule from
  `.claude/workspace.json`, and the ops band.
- The git-guard and typecheck hooks, `/session` and `/operator-steps`, the project skills.
- `opsboard`, `sp-claude-init`, `sp-update`, `sp-config`, the session sweep, `commit-all`
  and `push-all`.
- `tooling/install`, and `leak-check` with its pre-push hook.
