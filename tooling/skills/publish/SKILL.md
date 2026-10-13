---
name: publish
description: Run the public release of one repository (`/session publish-<repo>` in a workspace, `/publish` in a standalone repository). Use when the session ID is publish-<repo>, or when asked to work the public release steps P1–P6 that `/go-public` planned: audit, clean up, add the public files and CI, pass the gates and go public.
---

# Publish session

You are `publish-<repo>`. You work the steps `<CODE>-P1`–`P6` that `/go-public` wrote:
in the module plan `<repo>/plan.md` in a workspace, or in a standalone repository's
`plan.md` "Public release" section. They say whether the repository goes public in place
or as a snapshot. Where the plan differs from this skill, the plan wins.

The tooling's files are found through `publish-check`'s link:
`tool=$(dirname "$(readlink -f "$(command -v publish-check)")")/..`. The templates are in
`$tool/publish/templates/`; `gh-harden` names each GitHub setting and the command that
sets it.

## Before you start

In a workspace:
1. The root `handoffs.md` "Publish status" table must have a row for `<repo>`, `planned`
   or `running` (a run that is resuming). No row means nobody decided it: stop and point
   the operator at `/go-public <repo>`.
2. If the "Checkpoint status" row of `CP<m>` reads `running`, stop.
3. `git -C <repo> status --short` must be empty, on `development` (or the repository's
   working branch). If not, the owning session has uncommitted work: stop and name it.
4. Set the `<repo>` row to `running` with today's date, by exact replacement. From now on
   the session that owns `<repo>` does no work in it.

In a standalone repository, only step 3 applies.

## What you write

The repository `<repo>` (its code, docs, public files, CI and its plan's release steps
with their evidence, counts only), your row in the root "Publish status" table, handoffs
you open, and the operator tasks of this release in `operator.md`. Nothing else. Git and
`gh-harden --apply` run only from a Ready to commit preview the operator approves
(`~/.claude/git-rules.md`). Never create, rename or archive a GitHub repository, and
never change its visibility: those are operator tasks.

## Steps

Commit each step from its own preview. Run `publish-check <repo>` (a snapshot:
`publish-check --snapshot <repo>`) after each one; it prints counts and file names only.
Never print what `leak-check` matched.

1. **P1 Security audit.** Threat model: untrusted inputs, privileges, network, files
   written, subprocesses, what leaves the host. Dependency advisories for the
   repository's languages (govulncheck, cargo audit and cargo deny, npm audit or
   osv-scanner, pip-audit). `leak-check` and `leak-check --history`, run inside the
   repository. Fix each finding, or record why it is accepted in a decision.
2. **P2 Cleanup.** Dead code and unused dependencies; no config knob without a caller; no
   private paths, hostnames or defaults; strict lints clean; docs for strangers, without
   live numbers or links into a private workspace. A hit in the history only does not
   block a snapshot: the snapshot does not carry it.
3. **P3 Public files.** Copy from the templates and fill every `<placeholder>`: LICENSE,
   SECURITY.md (what is in scope for this repository), CONTRIBUTING.md, CHANGELOG.md,
   `gitignore` as `.gitignore` (merge with one that exists). Write the README for
   strangers. Add the "Public repository" section (below) to `<repo>/AGENTS.md`.
4. **P4 CI and the hook.** `leaks.yml` into `.github/workflows/` (or a gitleaks step in
   the repository's CI), `dependabot.yml` into `.github/`. Every action pinned by SHA,
   `permissions: contents: read`, no kept credentials; zizmor clean when installed.
   Link the pre-push hook: `$tool/install --hook <repo>`. Commits are signed: the
   operator's git config has `commit.gpgsign` and `user.signingkey`.
5. **P5 Gates.** `publish-check` passes (exit 0). Then the operator reads every tracked
   file and signs off (their task in `operator.md`). Fix what they find and start P5
   again.
6. **P6 Go public.** Each git and `gh-harden --apply` command from a preview.
   - **In place:** push `development`; CI passes on it.
   - **A snapshot:** once the operator has renamed the old repository and created the
     new empty one (their task), make the snapshot: `git -C <repo> checkout --orphan
     public # approved` keeps the tree in the index, then one commit
     (`release: v0.1.0, the first public version`, signed), `git -C <repo> remote add
     public git@github.com:<owner>/<repo>.git` and `git -C <repo> push public
     public:development public:main`. CI passes on both. Then the operator archives the
     old repository and replaces the checkout (their tasks).
   - Then, either way: `gh-harden <owner>/<repo> --apply` (the settings before the
     switch); the operator switches visibility; `main` at the release commit (in place:
     `git -C <repo> push origin development:main`) and CI passes on it; `gh-harden
     <owner>/<repo> --apply` again (secret scanning, CodeQL, the rulesets); `gh-harden
     <owner>/<repo>` prints only `ok` and `ui`.
   - The first release: the annotated, signed tag (`git -C <repo> tag -s v0.1.0 -m
     "<notes>"`), pushed, and `gh release create v0.1.0 --verify-tag --notes-from-tag`
     run inside the checkout (it refuses `-R`). CI passes on the tag.

## The "Public repository" section

Add this to `<repo>/AGENTS.md` in P3, adapted to the repository:

```markdown
## Public repository

This repository is public and developed in the open.
- Every push is public at once: tracked files, commit messages, branch and tag names.
  Write for strangers.
- No captured data, secrets, personal paths, private hostnames or links into a private
  workspace.
- The pre-push hook runs leak-check on what a push sends, and a hit stops the push. CI
  runs gitleaks over the tree and the history.
- Keep commit messages neutral.
```

## When you finish

Set the `<repo>` row in "Publish status" to `published <date>`, or back to `planned` if
you stopped before P6. Record each step's evidence (counts, CI run IDs, the tag) in the
plan. Tell the operator the owning session can resume once the approved commands have
run. After the first release the repository is ordinary: its sessions develop it in the
open, its checkpoints tag it, and no publish session runs for it again.
