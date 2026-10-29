---
name: "refactor"
description: "Refactor one module's architecture and code without changing behaviour (hotspots, per-stack survey, pin, subtract, boundaries, simplify, guards). Use for /refactor plus a project and optional module, refactor, simplify, clean up, tech debt."
---

# Refactor

Make one module smaller, simpler and easier to change while it does exactly what it did
before, and leave guards behind so it stays that way. This skill decides where to spend
the effort and in what order; `<skill>/references/playbook.md` says how to do each step.

Arguments: $ARGUMENTS

- `<project> <module>`: the full pass on that module. The project is a folder whose
  `AGENTS.md` has a `## Operator contract` section (on the desktop,
  `python3 -I <this skill's folder>/scripts/projects.py <name>`
  prints it); its **Work unit**, **Hard lines**, **Check** and **Git** fields are the
  project rules this skill follows.
- `<project>` alone, or `survey`: survey every module of the project, rank them, write
  the top ones into their plans as refactor steps, and stop. `/next` and `/kickoff`
  then pick them up like any other step.
- No project: ask which one, recommending the one with the most commits in the last
  month.

## Rules

- **Behaviour stays the same.** Structure changes; behaviour does not (Beck's "Tidy
  First": structure and behaviour never share a commit). A bug or a missing feature found
  on the way becomes a plan step with its repro, not a fix on this branch.
- **Small verified steps.** Every commit leaves the module's gate green. A red gate means
  revert the last step, not push on.
- **Delete before you reshape, reshape before you polish.**
- **Rank by evidence.** Work goes where change is frequent and code is complex
  (hotspots), not where it looks ugly. Code nobody touches stays as it is unless it is dead.
- **Commit and push without asking.** Commits follow the project's AGENTS.md
  conventions. Push the refactor branch and open its PR yourself; never force-push.
  Merging follows the contract's **Git** field.
- **Plan edits land apart.** `/next`, `/kickoff` and `/decisions` read the plans in the
  main checkout, so every plan step or "Waiting on David" entry this skill writes is a
  separate docs commit (`docs(<module>): refactor follow-ups`), never only on the
  refactor branch: on `development` where the **Git** field allows it, else on its own
  docs branch and pull request.
- **Pick the default and continue.** Ask only when a choice changes the goal or a
  contract another module or a user depends on; that becomes a plan step for David.
- **Keep the branch reviewable.** Past about 800 changed lines (pure deletions do not
  count), stop at the next green commit and write the rest as a follow-up plan step.

## Where it runs

In Claude Code on this machine (desktop app or CLI): the survey tools and the gate need
the machine. Reports go to
`~/Desktop/random/projects/operator/refactor/<project>-<module>-<YYYY-MM-DD>/`, outside the repos.

`<skill>` below is this skill's own folder. It holds `references/playbook.md` (how to do
each step; the phases name its sections), `references/stack-tools.md`,
`scripts/hotspots.py` and `scripts/projects.py`.

## Start

Open a todo list with one entry per phase (`TodoWrite`, or the session's task list):
0 Claim, 1 Baseline, 2 Survey, 3 Pin, 4 Subtract, 5 Boundaries, 6 Simplify,
7 Guard, 8 Verify, 9 Hand back. In survey mode, phases 0 to 2 then 9.

## Phase 0: Claim the module

1. Check nobody else is in it: `git worktree list` in the repo, the locks the
   contract's **Work unit** names, `kick-*` streams in the kickoff README for the
   project. Busy: take the next module from the survey ranking and say so.
2. Create a worktree on a new branch off the working branch, where the project's
   AGENTS.md puts worktrees; without a convention:
   `git worktree add ../<repo>-refactor -b refactor/<module>-<YYYY-MM-DD> development`.
3. Respect the contract's **Hard lines** for the whole run (secrets never printed, paths
   whose behaviour a refactor may not touch, memory caps on heavy checks).

## Phase 1: Baseline

Run the module's gate as its AGENTS.md or CLAUDE.md states it, else the contract's
**Check**. Known gates by stack:

| Module type | Gate |
|---|---|
| Go | `go test ./... -race -cover && go vet ./... && golangci-lint run` |
| Python/uv | `make check`, or `uv run pytest && uv run ruff check .` |
| Rust | `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test` |
| TS/Vite, Astro | `npm run check`, plus the scripts the module's AGENTS.md adds |
| Lean 4 | `make check` |
| Seeded experiment scripts | run each with `python3` and keep its output; outputs are seeded, so the baseline output is the pin |

Save the commands and results to `baseline.md` in the report folder. A red gate on
`development` is not this skill's to fix: record it, write a plan step, and stop.

## Phase 2: Survey

Measure before choosing. Read-only.

1. Hotspots and change coupling: `python3 <skill>/scripts/hotspots.py . --months 12`.
   The top files by commits x lines are the targets. Pairs marked `*` change together
   across directories: a leaking boundary, a candidate for phase 5. Docs are left out;
   add `--docs` when the module is mostly prose.
2. The stack's tools from `<skill>/references/stack-tools.md`: dead code, unused
   dependencies, complexity, duplication, the import graph and its cycles. Record each
   count.
3. A design read of the top hotspots against playbook "Design red flags" (shallow
   modules, leakage, pass-throughs, split ownership, two ways to do one task, importable
   internals, hand-synced lists). For a large module, spread this across
   read-only subagents (`sonnet`, one slice each) that return file pointers, not dumps.

Write `survey.md`: the counts, the top hotspots, the coupled pairs and a ranked worklist
(mechanical removals first, then boundary moves, then hotspot simplifications). Each
item names its evidence.

**Survey mode** (whole project): run steps 1 and 2 on every module, rank the modules by
hotspot score and finding counts, write `~/Desktop/random/projects/operator/refactor/<project>-<date>/survey.md`,
add a step "Refactor pass: run `/refactor <project> <module>` (see <survey path>)" to the
top three modules' work list, in the place the contract's **Ready work** names, commit
those plan edits, and go to phase 9.

## Phase 3: Pin the behaviour

Before moving anything in a hotspot, make sure a test fails if its behaviour changes.

- Covered by behaviour tests already: the pin exists. To check it is a real pin, run one
  mutation tool on that file only (optional, listed in stack-tools.md); surviving mutants
  on the lines you will touch mean the pin is weak there.
- Not covered: write characterization tests that record what the code does today,
  including its odd outputs (a snapshot, golden files, or an equivalence script that
  diffs old and new outputs on recorded inputs). Do not "fix" an odd output in a pin; it
  is the contract until a plan step says otherwise.
- Before deleting or reshaping something that looks wrong on purpose, read why it is
  there (playbook "Why a line is there"). Agents break unwritten invariants most often
  here.

Pins that only serve this refactor may stay out of the repository; pins that guard
tricky logic stay, within playbook "The test budget". Commit kept pins first:
`test(<module>): pin <behaviour> before refactor`.

## Phase 4: Subtract

Two areas, in order: comments (playbook "Comments"), then dead code, unused
dependencies, unused options and files, leftovers of dropped designs, and docs
describing what no longer exists. Use the counts from phase 2 as the worklist. Prove
each removal of anything public or reached by name (CLI entry points, config keys,
routes, serde fields, `getattr`, templates) with playbook "Proving a removal safe". One
commit per area, gate green after each.

## Phase 5: Boundaries

Fix the architecture inside the module, then write down the rest.

1. Name the target shape: which package owns which state and decision, which way
   dependencies point, what the public surface is (playbook "Moving code", step 1; sketch
   two shapes when the change crosses more than one function boundary).
2. Apply the moves that stay inside the module and keep its public contract: break
   cycles, hide internals (`internal/`, `pub(crate)`, no re-exports of wire or storage
   types), merge split ownership into one owner, delete the second way of doing a task,
   derive hand-synced lists from one source, collapse pass-through layers. Follow
   playbook "Moving code": move every caller and delete the old path in the same commit,
   no shims.
3. Changes that cross the module's contract (a shared contracts package, wire formats,
   a database schema, another repo's imports) are not applied. Write each as a plan step in
   the module's `plan.md` with what it fixes, what it costs and the order of steps
   (playbook "Writing a plan step"). When it changes what the system does or
   costs David a decision, put it where the contract's **Waiting on David** says, with
   options and a recommendation, so `/decisions` lists it.

Commit each move on its own: `refactor(<module>): <move>`.

## Phase 6: Simplify

1. Duplication: playbook "Duplication". Merge copies only when they must change
   together.
2. Hotspots, top first: playbook "Simplifying a hotspot". Look for the move that deletes
   a branch, a mode or a layer, not one that spreads the same complexity around. Hand pure
   mechanical edits (renames, moves) to a `sonnet` or `haiku` subagent with the paths and
   the names.
3. Tests: playbook "The test budget". Delete tests of obvious code and tests pinned to
   internals; never weaken a test to make it pass.
4. Run the built-in `/simplify` on the branch diff and keep what it finds that holds.

Each commit body names the refactoring moves it applied (extract function, inline,
move, replace conditional with polymorphism, and so on) and the pin it held against.

## Phase 7: Guard

Make the cleanup stick, in the order of playbook "Guards": architecture first, then
types, then a lint, then a test.

- Wire into the module's gate the guards this run made true, chosen from
  stack-tools.md "Which guards join the gate": zero cycles, the layer rules, no unused
  dependencies, no unused exports.
- Where findings remain on purpose, use the tool's ratchet (a baseline file, an
  `#[expect(..., reason)]`, `--new-from-rev`) so the gate fails only on new ones.
- Prove each new guard fails: reintroduce one removed violation, watch the gate go red,
  revert.

Commit: `chore(<module>): guard <rule>`.

## Phase 8: Verify

1. The full gate, plus the module's verification skill when it has one. Compare with
   `baseline.md`: same tests passing, same outputs for seeded scripts, same Lean
   statements and `#print axioms`.
2. Rerun the phase 2 tools and fill the before/after table: lines of code, dead-code
   findings, unused dependencies, cycles, functions over the complexity threshold,
   duplicated blocks, top hotspot sizes.
3. Review the whole branch as playbook "Reviewing the branch" says. Fix what holds and
   commit.
4. A step that did not make the code easier to read somewhere gets reverted.

## Phase 9: Hand back

1. Write `report.md` in the report folder: the before/after table, each structural
   change in plain words (what moved where and why, so David's picture of the code stays
   true), the guards added, the plan steps written, what was reverted and why. Write it
   as playbook "Writing the report" says.
2. Push the branch and open the PR, from the repository:

   ```sh
   cd <repo path>
   git push -u origin refactor/<module>-<date>
   gh pr create --base development --head refactor/<module>-<date> --title "refactor(<module>): <summary>" --body-file ~/Desktop/random/projects/operator/refactor/<project>-<module>-<date>/report.md
   ```

   Where the project leaves the merge to David, add it where the contract's **Waiting
   on David** says, with the PR link, and land that with the phase 5 plan steps as
   "Plan edits land apart" says. When the branch is merged, the next `/decisions apply` or the next run
   removes the entry.
3. Reply in one short message: the before/after numbers that moved, the commits, the PR,
   the plan steps and decisions written, and the path of `report.md`.
