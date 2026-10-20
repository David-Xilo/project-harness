---
name: refactor
description: "Refactor one module's architecture and code without changing behaviour: rank targets from git history and per-stack tools, pin behaviour, subtract clutter, fix boundaries, simplify the hotspots, then add guards so it stays clean. Use for /refactor <project> [module], 'refactor', 'simplify', 'clean up', 'remove clutter', 'tech debt pass'."
argument-hint: "<project> [<module>] [survey]"
---

# Refactor

Make one module smaller, simpler and easier to change while it does exactly what it did
before, and leave guards behind so it stays that way. This skill decides where to spend
the effort and in what order; the existing desk skills do each step.

Arguments: $ARGUMENTS

- `<project> <module>`: the full pass on that module (`ikarus ikarus-features`,
  `games pokersim`, `safehouse traffic-sniffer`, `portfolios portfolio-swe`).
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
- **Delete before you reshape, reshape before you polish** (`subtract-before-you-add`).
- **Rank by evidence.** Work goes where change is frequent and code is complex
  (hotspots), not where it looks ugly. Code nobody touches stays as it is unless it is dead.
- **Commit without asking, never push.** Commits follow the project's AGENTS.md
  conventions. The push and PR are David's, handed over as exact commands.
- **Plan edits go to `development`.** `/next`, `/kickoff` and `/decisions` read the plans
  in the main checkout, so every plan step or "Waiting on David" entry this skill writes
  is a separate docs commit there (`docs(<module>): refactor follow-ups`), never only on
  the refactor branch.
- **Pick the default and continue.** Ask only when a choice changes the goal or a
  contract another module or a user depends on; that becomes a plan step for David.
- **Keep the branch reviewable.** Past about 800 changed lines (pure deletions do not
  count), stop at the next green commit and write the rest as a follow-up plan step.

## Where it runs

On xillz, in Claude Code (desktop app or CLI), or from a project thread through a Remote
Control session there: the survey tools and the gate need the machine. Reports go to
`~/Desktop/random/projects/refactor/<project>-<module>-<YYYY-MM-DD>/`, outside the repos.

If the desk plugin is not installed, read a named skill from
`~/Desktop/random/projects/project-harness/desk/skills/<name>/SKILL.md`. This skill's
files are `<skill>/references/stack-tools.md` and `<skill>/scripts/hotspots.py`, where
`<skill>` is `${CLAUDE_SKILL_DIR}` or
`~/Desktop/random/projects/project-harness/desk/skills/refactor`.

## Start

Open a todo list with one entry per phase (`TodoWrite`, or the progress checklist in a
thread): 0 Claim, 1 Baseline, 2 Survey, 3 Pin, 4 Subtract, 5 Boundaries, 6 Simplify,
7 Guard, 8 Verify, 9 Hand back. In survey mode, phases 0 to 2 then 9.

## Phase 0: Claim the module

1. Check nobody else is in it: `git worktree list` in the repo, lane locks in ikarus
   `status.md`, `kick-*` streams in the kickoff README for the project. Busy: take the
   next module from the survey ranking and say so.
2. Create a worktree on a new branch off the working branch, where the project's
   AGENTS.md puts worktrees; without a convention:
   `git worktree add ../<repo>-refactor -b refactor/<module>-<YYYY-MM-DD> development`.
3. Respect the project's hard lines: ikarus never prints `data/ibkr/gateway/paper.env`
   and touches no order path behaviour; safehouse makes no live-host change and runs heavy
   checks one at a time under `systemd-run --user --scope -p MemoryMax=8G <cmd>`.

## Phase 1: Baseline

Run the module's gate as its AGENTS.md or CLAUDE.md states it. Known gates:

| Module type | Gate |
|---|---|
| Go | `go test ./... -race -cover && go vet ./... && golangci-lint run` |
| Python/uv | `make check`, or `uv run pytest && uv run ruff check .` |
| Rust | `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test` |
| TS/Vite, Astro | `npm run check` (portfolio-swe adds `test:unit`, `build:draft`, `links`) |
| Lean 4 (ikarus-risk) | `make check` |
| game-theory experiments | run each `experiments/eNN_*.py` with `python3` and keep its output; outputs are seeded, so the baseline output is the pin |

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
3. A design read of the top hotspots against `architect/references/design-red-flags.md`
   (shallow modules, leakage, pass-throughs, split ownership, two ways to do one task,
   importable internals, hand-synced lists). For a large module, spread this across
   read-only subagents (`sonnet`, one slice each) that return file pointers, not dumps.

Write `survey.md`: the counts, the top hotspots, the coupled pairs and a ranked worklist
(mechanical removals first, then boundary moves, then hotspot simplifications). Each
item names its evidence.

**Survey mode** (whole project): run steps 1 and 2 on every module, rank the modules by
hotspot score and finding counts, write `~/Desktop/random/projects/refactor/<project>-<date>/survey.md`,
add a step "Refactor pass: run `/refactor <project> <module>` (see <survey path>)" to the
"Next" list of the top three modules' `plan.md` (or the project plan where modules
have none), commit those plan edits, and go to phase 9.

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
  there (`desk:why`, or `git log -L` on the lines). Agents break unwritten invariants
  most often here.

Pins that only serve this refactor may stay out of the repository; pins that guard
tricky logic stay, within the `desk:tdd` test budget. Commit kept pins first:
`test(<module>): pin <behaviour> before refactor`.

## Phase 4: Subtract

Run the `desk:code-cleanup` skill's areas 1 and 2 on the module: comments
(`desk:no-comments`), then dead code, unused dependencies, unused options and files,
leftovers of dropped designs, and docs describing what no longer exists. Use the counts
from phase 2 as the worklist. Prove each removal of anything public or reached by name
(CLI entry points, config keys, routes, serde fields, `getattr`, templates) with
`desk:blast-radius`. One commit per area, gate green after each.

## Phase 5: Boundaries

Fix the architecture inside the module, then write down the rest.

1. Name the target shape: which package owns which state and decision, which way
   dependencies point, what the public surface is. Run `desk:architect` when the change
   crosses more than one function boundary.
2. Apply the moves that stay inside the module and keep its public contract: break
   cycles, hide internals (`internal/`, `pub(crate)`, no re-exports of wire or storage
   types), merge split ownership into one owner, delete the second way of doing a task,
   derive hand-synced lists from one source, collapse pass-through layers. Follow the
   `desk:rigor` Refactoring playbook: move every caller and delete the old path in the
   same wave, no shims.
3. Changes that cross the module's contract (ikarus `contracts`, wire formats, a
   database schema, another repo's imports) are not applied. Write each as a plan step in
   the module's `plan.md` with what it fixes, what it costs and the order of steps
   (`desk:rigor` Multi-phase plan playbook). When it changes what the system does or
   costs David a decision, put it under "Waiting on David" with options and a
   recommendation, so `/decisions` shows it on the Operator Board.

Commit each move on its own: `refactor(<module>): <move>`.

## Phase 6: Simplify

1. Duplication: `desk:code-cleanup` area 3. Merge copies only when they must change
   together.
2. Hotspots, top first: `desk:code-cleanup` area 4 with the code-quality lens
   (`interrogate/references/code-quality-review.md`). Look for the move that deletes a
   branch, a mode or a layer, not one that spreads the same complexity around. Hand pure
   mechanical edits (renames, moves) to a `sonnet` or `haiku` subagent with the paths and
   the names.
3. Tests: `desk:code-cleanup` area 5. Delete tests of obvious code and tests pinned to
   internals; never weaken a test to make it pass.
4. Run the built-in `/simplify` on the branch diff and keep what it finds that holds.

Each commit body names the refactoring moves it applied (extract function, inline,
move, replace conditional with polymorphism, and so on) and the pin it held against.

## Phase 7: Guard

Make the cleanup stick, with the `desk:correct` order: architecture first, then types,
then a lint, then a test.

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
   `baseline.md`: same tests passing, same outputs for the game-theory experiments,
   same Lean statements and `#print axioms`.
2. Rerun the phase 2 tools and fill the before/after table: lines of code, dead-code
   findings, unused dependencies, cycles, functions over the complexity threshold,
   duplicated blocks, top hotspot sizes.
3. Review the whole branch with `/code-review` (or `desk:interrogate` when the branch is
   large or touches a boundary). Fix what holds and commit.
4. A step that did not lower reader load gets reverted (`minimize-reader-load`).

## Phase 9: Hand back

1. Write `report.md` in the report folder: the before/after table, each structural
   change in plain words (what moved where and why, so David's picture of the code stays
   true), the guards added, the plan steps written, what was reverted and why. Run it
   through `desk:unslop`.
2. Add the push to the module's `plan.md` under "Waiting on David", with every command
   and the folder it runs from:

   ```sh
   cd <repo path>
   git log --oneline development..refactor/<module>-<date>
   git push -u origin refactor/<module>-<date>
   gh pr create --base development --head refactor/<module>-<date> --title "refactor(<module>): <summary>" --body-file ~/Desktop/random/projects/refactor/<project>-<module>-<date>/report.md
   ```

   Commit it on `development` with the phase 5 plan steps. When the branch is merged,
   the next `/decisions apply` or the next run removes the entry.
3. Reply in one short message: the before/after numbers that moved, the commits, the
   plan steps and decisions written, and the path of `report.md`.
