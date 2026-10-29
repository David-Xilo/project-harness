---
name: refactor
description: Refactors without changing behaviour. From a project root, surveys the hotspots and writes a "Refactor pass" plan row per module worth it; given a module, pins its behaviour with tests, subtracts, reshapes, adds a guard and opens a pull request with before and after numbers. Use for /refactor, "refactor", "simplify", "clean up", "tech debt".
argument-hint: [module] | survey
disable-model-invocation: true
---

# Refactor

Make one module smaller, simpler and easier to change while it does exactly what it did
before, and leave a guard so it stays that way. `$ARGUMENTS`: a module path runs the pass
on it; nothing, or `survey`, surveys the project, writes plan rows and stops.

## Where you are

You run from a project's root folder. Read its `AGENTS.md` first; it says where the plan
and the ready work live, what one unit of work is, the hard lines, the check command and
the git rules (a section such as `## Operator contract`); those are the project rules
this skill follows. Without such a section, look for `plan.md`, `decisions.md` and each
module's `*/plan.md`, and say in the reply what you assumed.

## Survey

Measure before choosing; read-only. Score each file by commits over the last year times
its lines today (deleted files drop out):

```sh
git log --since="12 months ago" --name-only --pretty=format: -- . | grep -v '^$' | sort | uniq -c | sort -rn | head -60 | while read n f; do [ -f "$f" ] && echo "$((n * $(wc -l < "$f"))) $n $f"; done | sort -rn | head -20
```

Leave out lockfiles, generated and vendored paths, prose unless the module is prose, the
paths the project reserves for David, and whatever it says to skip in git scans; in a
root whose modules are their own repositories, run it inside each module. Code files that
keep changing in the same commits across folders are a leaking boundary. Add the stack's
own counts where a tool exists (dead code, unused dependencies, functions over the
tool's complexity threshold, else 10, import cycles). Write one row "Refactor pass: run
`/refactor <module>`; <the evidence in one line>" per module worth it, at most three and
often none, in the shape and place the project lists ready work; commit that file alone
by the project's git rule; stop. Reply with the ranking.

## Pass

0. Claim: nobody else in the module (open PRs, the locks the project names, worktrees
   with uncommitted or unpushed work; a clean stale worktree is not a claim). Create a worktree on a new branch off the base as the project's rules
   say, else `git worktree add ../<repo>-refactor -b refactor/<module>-<date> <base>`.
1. Baseline: run the module's check as the project states it. Keep the commands and
   numbers in the reply. A red check on the base is not yours to fix: write a plan row
   and stop.
2. Pin: before touching a hotspot, make sure a test fails if its behaviour changes.
   Where none does, write characterisation tests of what the code does today, odd
   outputs included (a snapshot, golden files, a script that diffs old and new output on
   recorded input). An odd output is the contract until a plan row says otherwise.
   Before reshaping code that looks wrong on purpose, read why it is there (`git log -L`,
   the PR, the callers); a reason found is a constraint to keep or turn into a check.
   Commit the pins that guard tricky logic: `test(<module>): pin <behaviour> before
   refactor`.
3. Subtract: comments that restate the code, stale TODOs and section markers; dead code,
   unused dependencies, options and files, docs of what no longer exists. Prove each
   removal of anything reached by name (config keys, routes, serialised fields,
   reflection, templates, CLI entry points, other repositories) by running code that
   fails if the fact is false; grep is not proof. One commit per area, check green after
   each.
4. Reshape, inside the module only: break cycles, hide internals, give each piece of
   state one owner, delete the second way of doing a task, derive hand-synced lists from
   one source, collapse pass-through layers, merge copies only when they must change
   together. Move every caller and delete the old path in the same commit; no shims, no
   old and new side by side. A change across the module's contract (shared packages,
   wire or storage formats, another repository) becomes a plan row with what it fixes
   and costs, and goes where the project keeps David's decisions when it needs one.
   Commit each move alone: `refactor(<module>): <move>`.
5. Guard: make the cleanup stick at the highest level that works: the wrong thing
   cannot be written (one owner, internals unreachable), then the bad state does not
   compile, then a lint or check in the module's gate with a baseline so it fails only
   on new cases, then a test. Prove each guard fails once by reintroducing a removed
   violation, then revert. Commit: `chore(<module>): guard <rule>`.
6. Verify: the full check against the baseline; the before and after numbers (lines,
   dead code, unused dependencies, cycles, functions over the complexity threshold, the
   top hotspots). Review the branch diff (`/code-review`); fix what holds. Revert any
   step that did not make the code easier to read somewhere: fewer branches, layers,
   names or paths.
7. Hand back: push the branch and open the PR against the base with the report as its
   body: the before and after table, each move in plain words (what moved where and
   why), the guards, the plan rows written, what was reverted and why. Where the project
   leaves the merge to David, add it where the project lists his steps. Reply with the
   numbers that moved, the commits, the PR and the plan rows.

## Rules

- Structure changes; behaviour does not. A bug or a missing feature found on the way
  becomes a plan row with its repro, never a fix on this branch.
- Tests: keep the ones that fail when behaviour breaks and pass when only internals
  change; delete tests of obvious code, restated constants and mocks that check
  themselves; never weaken a test to make it pass; the commit body lists each deleted
  test with its reason.
- Past about 800 changed lines (deletions do not count), stop at the next green commit
  and write the rest as a plan row.
- Plan rows written during a pass land in their own docs commit on the base where the
  git rule allows, else on a docs branch and PR, never only on the refactor branch.
- Never force-push or merge.
