---
name: go-public
description: Plan how a repository goes public and is developed in the open (`/go-public <repo>`). Use when the operator says a repo, module or subrepo should go public, be open-sourced or published ("make X public", "mark X to go public"). Writes only plans, never the repository's code or its GitHub settings.
---

# Plan a repository's public release

The operator said which repository should go public; you plan the rest. The repository
goes public under its own name and is developed in the open from then on: there is no
export and no second copy. You only read the repository and write plans. A
`publish-<repo>` session (the `publish` skill) does the work.

**Where you run.** In a plain session at a workspace root, for one of its modules (a
submodule path in `.gitmodules`; if the name is ambiguous, ask which one). Or in a
standalone repository, for itself. Other sessions may be running: re-run `git status` and
re-read each file right before you edit it, edit by exact replacement, never a rewrite.

## 1. Read the repository

Run, from the repository's path (`<repo>`), and keep only counts and file names, never
what matched:

```sh
publish-check <repo>
publish-check --snapshot <repo>
gh repo view <owner>/<repo> --json nameWithOwner,visibility,defaultBranchRef
gh-harden <owner>/<repo>
```

`gh-harden` with no option only reads. Then decide:
- **Already public:** say so and stop. Nothing is left to plan but hardening: point the
  operator at `gh-harden <owner>/<repo>`.
- **In place**, when the `leaks` gate of `publish-check` is `ok`: the history is clean,
  so the repository itself turns public.
- **Snapshot**, when `leaks` fails only on the history (`publish-check --snapshot` has
  `leaks ok`): one audited snapshot of the tree becomes the first commit of a new
  repository with the same name; the old one is renamed `<repo>-private` and archived.
  History is never rewritten.
- A `leaks` hit in the tree is fixed in P2 either way; plan for in place if the history
  is clean, otherwise snapshot.

Note every failing gate (`clean`, `leaks`, `files`, `ci`, `dependabot`, `hook`,
`signing`, `agents`) and every `gh-harden` item that is not `ok`; the steps below clear
them.

## 2. Write the steps

Use the repository's step code `<CODE>` (from its plan's step IDs). In a workspace,
write them into the module plan `<repo>/plan.md` as a `### <CODE>-P Public release`
block under "Milestone steps", and add them to its "Next". In a standalone repository,
write them into its `plan.md` "Public release" section (add the section if it is
missing). Each step's "Done when" is the gate it clears:

| Step | What | Done when |
|---|---|---|
| `<CODE>-P1` Security audit | Threat model (untrusted inputs, privileges, network, files written, subprocesses, what leaves the host); dependency advisories for the repository's languages; `leak-check` on the tree and the history | Every finding fixed or accepted in a decision; counts only in the plan |
| `<CODE>-P2` Cleanup | Dead code, unused dependencies, private paths, hostnames and defaults; docs written for strangers | `leaks` ok on the tree (and the history, in place) |
| `<CODE>-P3` Public files | From `tooling/publish/templates/`: LICENSE, SECURITY.md, CONTRIBUTING.md, CHANGELOG.md, `.gitignore`, a README for strangers; the AGENTS.md "Public repository" section | `files` and `agents` ok |
| `<CODE>-P4` CI and the hook | CI from `leaks.yml` (or a CI workflow with a gitleaks step), `dependabot.yml`, the pre-push hook through `tooling/install --hook <repo>`, signed commits | `ci`, `dependabot`, `hook` and `signing` ok |
| `<CODE>-P5` Gates | `publish-check` (snapshot: `--snapshot`) passes; the operator reads every tracked file and signs off | Exit 0, and the sign-off task done |
| `<CODE>-P6` Go public | In place or the snapshot, then GitHub hardening, the switch and the first release | `gh-harden` prints only `ok` and `ui`; the first tag and Release exist; CI passes on `main` and the tag |

Write in P6 which way it goes (in place or snapshot) and, for a snapshot, the new
repository's name.

## 3. Write the records

In a workspace, at the root:
- The plan's "Public release" table: `| <repo> | <owner>/<repo> | <what it waits on> |
  <date> |`. It waits on the module's other planned work unless the operator says
  otherwise.
- A decision (the next free `SD<n>` in `decisions.md`): the operator decided `<repo>`
  goes public, in place or as a snapshot, and why (counts only).
- The `handoffs.md` "Publish status" table: `| <repo> | planned | <date> |`.

In a standalone repository, the decision goes in its plan's decisions.

## 4. Write the operator tasks

Each one as an `### O<n>` entry in the root `operator.md` (next free number, under the
module's track; the session to tell is `publish-<repo>`), or in a standalone repository's
plan under "Open operator tasks". Give exact commands or settings pages:
- **The account**, once per account, only the items `gh-harden` did not find `ok`: the
  signing key on GitHub as a signing key (`gh ssh-key add <key>.pub --type signing
  --title <name>`, after `gh auth refresh -s admin:ssh_signing_key`), vigilant mode
  (Settings → SSH and GPG keys → Flag unsigned commits as unverified), two-factor
  (Settings → Password and authentication). When: now.
- **The sign-off** of P5: read every tracked file (`git -C <repo> ls-files`). When: after
  P4.
- **A snapshot only**, when P5 is done: rename the old repository (`gh repo rename
  <repo>-private -R <owner>/<repo>`), create the new empty one (`gh repo create
  <owner>/<repo> --private`), and after the publish session's push, archive the old one
  (`gh repo archive <owner>/<repo>-private`). In a workspace, then replace the
  submodule's checkout:

  ```sh
  git -C <root> submodule deinit -f <repo>
  rm -rf <root>/.git/modules/<repo>
  git clone git@github.com:<owner>/<repo>.git <root>/<repo>
  git -C <root> submodule absorbgitdirs <repo>
  ```

  In a standalone repository, clone the new one at the old path instead. The next
  checkpoint records the new pin.
- **The switch**, after the first `gh-harden --apply`: Settings → General → Danger Zone →
  Change visibility → Public. Never a script, never a session. When: P6.

## 5. Commit

Tell the operator in a few lines: in place or snapshot, the failing gates by name, the
steps and the tasks you wrote. Then show the Ready to commit preview
(`~/.claude/git-rules.md`), one repository at a time: the root files, then the module's
`plan.md`. Run it on approve. The publish session starts with `/session publish-<repo>`
from the root, or in a standalone repository with `/publish`.
