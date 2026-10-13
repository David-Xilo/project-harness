# Changelog

Each release is a milestone or a patch between milestones; its tag notes list what it
brings.

## Unreleased

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
