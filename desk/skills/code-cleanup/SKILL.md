---
name: code-cleanup
description: "Run a maintenance pass on a repository or path: fewer, truer comments, no dead code or stale docs, merged duplicates, simpler code, only the tests that earn their place, and a verdict on the design. Behaviour stays the same, each area is its own reviewed commit, and design changes come back as plan steps. Use for /desk:code-cleanup, 'clean up this repo', or a maintenance pass after a run of feature work."
argument-hint: "[<repo or path>]"
disable-model-invocation: true
---

# Code cleanup

Arguments: $ARGUMENTS (a repository or a path in it; empty means the current repository)

Feature work adds code step by step, and nothing takes a step back: comments go stale, tests
pile up on obvious code, helpers duplicate each other, and the abstractions drift from
what the code does now. This pass is the step back.

## Rules

- **Behaviour stays the same.** Every area ends with the same baseline results it started
  with. A change a user could see is not cleanup: write it as a proposal (area 6).
- **One commit per area**, after `code-review` on its diff, with the subject
  `cleanup: <area>`. An area with nothing to do says so and makes no commit. The pass
  goes on one branch and one PR, or one PR per area when the areas are large.
- **Design changes are proposals**, written as plan steps, never applied in the pass.
- **Stay in scope.** Only the named repository or path. Leave other uncommitted work
  alone.

## Before the first area

1. Record the baseline: run the repository's checks (its AGENTS.md or CLAUDE.md checks,
   or what CI runs) and its verification skill when there is one. Keep
   the commands and their results; every area is compared against them.
2. Map the scope in subagents when it is large (`sonnet`, read-only, one slice each):
   each returns file pointers for the areas below, not dumps (`guard-the-context-window`).
   The edits stay in this session.

## The areas, in order

1. **Comments.** Run the `desk:no-comments` skill on the scope (the `comment-sicko` agent).
   Keep only the comments that say why: a workaround, a constraint, a choice the code
   cannot show.
2. **Clutter and staleness.** Dead code, unused options and files, leftovers of dropped
   designs, docs that describe what no longer exists. Prove each removal safe with the
   `desk:blast-radius` skill: look past grep for callers by string, config, scripts, CI and
   docs, and run the real code.
3. **Duplication.** Merge copies only when they must change together. Two identical
   pieces that will evolve apart stay apart.
4. **Simplify.** Run the built-in `/simplify` skill on the scope. Then apply the
   code-quality lens (`interrogate/references/code-quality-review.md`) to what it leaves,
   the scope and not only a diff: shorter paths, fewer layers, plain names, the "code
   judo" move that deletes a branch. Compare with the baseline after each change.
5. **Tests.** Judge each test by the two edits of the `test-behavior-not-implementation`
   principle (the `desk:principles` skill) and its test budget. Keep each feature's end-to-end
   path, the tests of tricky logic and the tests of bugs that were seen. Delete tests of
   obvious code, restated constants, mocks that check themselves and tests that repeat
   others; rewrite a test pinned to the internals so it checks the behaviour. Never
   weaken a test to make it pass. The commit body lists each deleted test with its reason.
6. **Design.** Judge the abstractions, the module shape and the architecture with the
   lens and the `desk:architect` skill's red flags (`architect/references/design-red-flags.md`).
   Fix the small things in this area's commit. Anything that changes the design is a
   proposal for the user: write it as steps with the Multi-phase plan playbook
   (`rigor/playbooks/multi-phase-plan.md`), with what it fixes and what it costs. Then stop; the user decides.

## Reply

Per area: what changed or was removed (with counts), the baseline check after it, and
the commit. Then the design proposals and where they are written, and anything left open.
