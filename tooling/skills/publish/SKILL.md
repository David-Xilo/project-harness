---
name: publish
description: Run a publish session for one repository of this workspace (`/session publish-<repo>`). Use when the session ID is publish-<repo>, or when asked to audit, clean up, export or release a repository as public open source into the published folder (`sp-config PUBLISHED_DIR`)/<repo>-oss.
---

# Publish session

You are `publish-<repo>`. You make one repository of this workspace public, or release a
new version of it. The workspace's root `plan.md` has a public release section, or names
the root file that holds it (such as `public-release.md`), with the rules, steps and order
that apply here. Read it first; where it differs from this skill, the plan wins.

## Before you start

1. The root `handoffs.md` "Publish status" table must have a row for `<repo>`. No row means
   no one decided to publish it: stop and say so. (The `go-public` skill adds the row.)
2. If the workspace has a "Checkpoint status" table and the checkpoint session's row
   (`CP` or `CP<m>`) reads `running`, stop.
3. `git -C <repo> status --short` must be empty and the branch must be `development`
   (or the repo's working branch). If not, the owning session has uncommitted work: stop
   and name it.
4. Set the `<repo>` row to `running` with today's date, by exact replacement. From now on
   the session that owns `<repo>` does no work in it.

## What you write

- The private `<repo>`: audit fixes, cleanup, refactors, public files, CI, the allowlist
  (`public-files.txt`) and the export script (`scripts/export-public`), and the release
  steps' status and evidence (counts only) in `<repo>/plan.md`.
- `$(sp-config PUBLISHED_DIR)/<repo>-oss`: the exported tree and its local
  commits. The operator creates the folder with `git init -b main` before your first run.
- Your row in the root `handoffs.md` "Publish status" table, handoff rows you open, and the
  public release section of the root `operator.md`.

Nothing else. Commit, push and tag only from a Ready to commit preview the operator
approves (`~/.claude/git-rules.md`). Never create a GitHub repository or change
repository settings.

## Steps (P1–P6)

Follow the plan's step table. In short:
1. **P1 Security audit.** Threat model: untrusted inputs, privileges, network, files
   written, subprocesses, what leaves the host. Dependency advisories for the repo's
   languages (govulncheck, cargo audit and cargo deny, npm audit or osv-scanner,
   pip-audit). gitleaks over the full history. The private-strings grep (below) over the
   tree and the history. Fix each finding with an end-to-end test.
2. **P2 Cleanup.** Dead code and unused dependencies; no config knob without a caller; no
   private paths, hostnames or defaults; strict lints clean; docs without live numbers or
   links into the private workspace.
3. **P3 Refactor.** Only for problems P1 and P2 named. Tests pass before and after.
4. **P4 Public files.** `LICENSE`, `NOTICE`, a README for strangers, `SECURITY.md`,
   `CONTRIBUTING.md`, `CHANGELOG.md`, `.gitignore`. Add the "Public repository" section
   (below) to `<repo>/AGENTS.md`, before any commit goes to `<repo>-oss`.
5. **P5 CI and export.** GitHub Actions pinned by SHA with `permissions: contents: read`,
   zizmor clean, Dependabot. The allowlist and the export script, tested. `plan.md`,
   `AGENTS.md`, `docs/evidence/` and anything with live data are never exported.
6. **P6 Export and commit.** Run the export into `<repo>-oss`. Run the checks there, not
   in the private repo: a clean build and test from the exported tree, the licence report,
   gitleaks, the private-strings grep. Then show one Ready to commit preview for the
   commit in `<repo>-oss` and the private repository's commits, and run it on approve: the
   first release is one orphan commit (`git checkout --orphan <branch> # approved`) under
   the operator's identity and signature; later releases are one new commit each. Push
   `<repo>-oss` only from a second preview, after the operator has read every exported
   file. Hand the operator the GitHub settings from the plan (private vulnerability
   reporting, secret scanning with push protection, Dependabot, a read-only workflow
   token, fork PR approval, a ruleset on `main`), and ask them to read every exported
   file.

A failure found in `<repo>-oss` is fixed in the private repo; the export starts again.
Changes only flow private → public. An outside contribution comes back as a patch to the
private repo, never as a merge.

## Private strings

The operator keeps one denylist of private strings, outside every repository, at
`sp-config PRIVATE_STRINGS` (one string per line). Grep the tree and history with it:
`git -C <repo> grep -n -I -F -f "$(sp-config PRIVATE_STRINGS)"` and
`git -C <repo> log -p | grep -n -F -f "$(sp-config PRIVATE_STRINGS)"`. Report only counts and
file names, never the matched strings. If the file is missing, stop and ask the operator
to create it.

## The "Public repository" section

Add this to `<repo>/AGENTS.md` in P4, adapted to the repo, before the first commit in
`<repo>-oss`:

```markdown
## Public repository

This repository is published as `<repo>-oss` by exporting the files in `public-files.txt`.
- Every allowlisted file is public at the next export. Write it for strangers.
- No captured data, secrets, personal paths, private hostnames or links into the private
  workspace in those files.
- Before the commit preview, run the private-strings grep
  (`git grep -n -I -F -f "$(sp-config PRIVATE_STRINGS)"`); a hit blocks the commit.
- Keep commit messages neutral. The private history is never exported, but treat it as if
  it might be.
- A new file is private until it is added to `public-files.txt`.
```

## When you finish

Set the `<repo>` row in "Publish status" to `published <date>` (first release) or back to
`published <date>` with the new version, or `idle` if you stopped before exporting. Tell the
operator the owning session can resume, after the approved commits and push have run.
