# Changelog

Each release is a milestone; its tag notes list what it brings.

## Unreleased

### v0.1.0: public

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
