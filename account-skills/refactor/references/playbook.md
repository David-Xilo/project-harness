# Refactor playbook

The how-to for each phase of the refactor skill. Every section stands on its own; the
phase names the section it uses.

## Why a line is there

Before deleting or reshaping code that looks wrong on purpose, find out why it exists.
Run `git log -L <start>,<end>:<file>` on the lines, read the commits and the pull
requests they came from (`gh pr view <n>`), and read the callers. A reason found there
(a workaround, an ordering rule, an outside constraint) is a contract: keep the code, or
move the reason into a check before removing it. No reason found after that search is an
answer too; say so in the commit body.

## Comments

Keep a comment only when it says why: a workaround, a constraint, or a choice the code
cannot show. Delete the rest: comments that restate the code, narrate steps, mark
sections, carry stale TODOs, or describe code that no longer exists.

- A comment that explains a workaround in our own code is a sign the code needs a
  reshape. Fix the code where it is in scope and delete the comment; otherwise write the
  reshape as a plan step.
- A constraint comment ("do not remove", "keep this order", "talk to X before
  changing") stays only when it is about something we cannot change. Otherwise turn it
  into the cheapest check that enforces it (a type, a test, a lint) and delete the
  comment; when no check fits in scope, delete it and record the constraint in the report.
- Lint and type suppressions count as comments. A suppression that hides a correctness or
  safety finding is removed and the finding fixed.

## Proving a removal safe

A list of callers is not proof; grep finds them in seconds. The risk is what grep misses.

1. Name the one fact the removal is safe because of ("nothing reads this config key",
   "this route has no client"). Most removals hinge on one fact; spend the effort there.
2. Look where grep stops: names built from strings, config files, scripts, CI, docs,
   templates, serialised field names, reflection (`getattr`, `reflect`), routes, CLI
   entry points, another language reading the same data, other repositories.
3. Prove the fact by running code: a script or test that calls the real thing and fails
   loudly if the fact is false. Pointing at a line is weaker; a written argument is
   weakest. Say which level you reached.
4. A proof worth keeping goes into the change as a test, within the test budget below.

## Duplication

Merge two copies only when they must change together. Two pieces that look the same
today but will evolve apart stay apart.

## Design red flags

Read the top hotspots for these. Each is a reason to reshape, inside the module when its
public contract allows, else as a plan step.

- **Shallow module.** A large interface over little hidden work: callers combine several
  calls for one operation, or options expose internal stages. Prefer a small interface
  over a lot of behaviour.
- **Leakage.** The same internal decision (a representation, a policy, a wire or storage
  format) appears in more than one module, so one change needs edits in several places.
  Parse outside data into domain types at the edge; keep wire and storage types private.
- **Split by execution order.** Separate load, validate, transform and save stages that
  each repeat the same representation and its rules. Group code by the knowledge it owns.
- **Pass-through layer.** A function that forwards the same arguments to another of the
  same shape. Remove it unless it adds policy or adaptation.
- **Split ownership.** More than one module writes the same state or keeps its own copy.
  Give each piece of state one owner.
- **Two ways to do one task.** Keep one; move every caller to it and delete the others
  in the same change.
- **Importable internals.** Callers can import internals, so they become the interface.
  Make them unreachable from outside the module so such an import fails the build.
- **Hand-synced lists.** The same items listed in several places. Derive the copies from
  one list, or make the build fail when they disagree.

Assume the next contributor sees only the files it opened, copies the nearest example and
takes the shortest path that compiles. Prefer the shape where a change that looks right
from one file is right for the whole module.

## Simplifying a hotspot

Look for the restructuring that makes a branch, a mode, a helper or a layer disappear,
not one that moves the same complexity somewhere else. Then check, in this order:

1. Ad-hoc conditionals and special cases scattered through a flow: move them into one
   helper, table or state machine.
2. A file pushed past about 1,000 lines: split it by the knowledge each part owns.
3. Wrappers, identity helpers and generic mechanisms that hide a simple data shape:
   inline them.
4. Loose types (`any`, `unknown`, casts, options that are always set) and silent
   fallbacks over an unclear rule: make the type or the boundary explicit.
5. Logic in the wrong layer, or a one-off that duplicates an existing helper: move it to
   its owner or use the helper.
6. Updates that can leave state half applied, or independent work run in sequence for no
   reason: make the update atomic, run the work in parallel.

A change stays only if it makes the code easier to read somewhere: fewer branches,
fewer layers, fewer names to learn, shorter paths. If it does not, revert it.

## Moving code

1. Name the target shape first: which package owns which state and decision, which way
   dependencies point, what the public surface is. Write the callers' usage first and
   derive the types and signatures from it. For a move across more than one function
   boundary, sketch two structurally different shapes, check both against the red flags,
   and pick the one with the smaller interface over more hidden work.
2. Subtract first: delete dead code, collapse one-caller wrappers, drop redundant
   validation and orphaned references before reshaping anything.
3. Move in small steps, each keeping the pins green. When a function or API changes
   shape, move every caller and delete the old one in the same commit: no shims, no old
   and new paths side by side.
4. Check every rename against the files: renames miss uses in strings, prose, configs
   and docs. Hand purely mechanical renames and moves to a cheaper subagent with the
   paths, the names and the behaviour to hold, and check its diff.
5. If the sketch keeps producing the same workaround, special cases, casts or callers
   that must know its internals, the shape is wrong: drop it and sketch again from what
   you now know, smaller than before.

## Writing a plan step

Use the plan format the project already has; with none, a row
`| [ ] | <priority> | <ID>: <what lands> | <depends on> | <done when> |`.

- One step is one change small enough for one reviewed pull request.
- "Done when" names the check on the real thing: the command, the flow, the stored value
  or the number, and who runs it.
- A step that changes what a user sees or decides says so, so it waits for review.
- Order the steps riskiest unknown first, checks before the changes they guard, and name
  each step's dependencies.
- Reasons, rejected alternatives and risks go in the plan's notes, not in the steps.

## The test budget

A test stays only if it fails when the behaviour breaks and passes when only the
internals change. Keep each feature's end-to-end path, tests of tricky logic and tests of
bugs that happened. Delete tests of obvious code, restated constants, mocks that check
themselves and tests that repeat others. Rewrite a test pinned to internals so it checks
behaviour. Never weaken a test to make it pass. The commit body lists each deleted test
with its reason. A new test replaces one that checks the same thing, or its commit says
in one line why it is needed.

## Guards

Make a cleanup stick at the highest level that works, in this order:

1. **Architecture:** the wrong thing cannot be written (one owner, one way, internals
   unreachable, one source for each list).
2. **Types:** the bad state does not compile.
3. **A lint or CI check** whose error names what to use instead. When the pattern is
   already common, fail only on new cases (a baseline file, `--new-from-rev`, an
   `expect` with a reason).
4. **A behaviour test.**

Prove each new guard fails: reintroduce one removed violation, watch the gate go red,
revert.

## Reviewing the branch

Run `/code-review` on the branch diff. For a large branch or one that touches a
boundary, also spawn two read-only reviewer subagents on different models with the same
brief: the diff, the design red flags and the "Simplifying a hotspot" checks above, and
"report each finding with `file:line`, why it matters, and the fix". Keep the findings
both agree on or that you can confirm in the code; fix them and commit.

## Writing the report

Plain sentences, active voice, one idea each. Name mechanisms and numbers, not feelings.
No filler ("in order to", "it is important to note"), no hedging, no em dashes, no
inline bold labels, no words like crucial, robust, leverage, seamless or delve. Each
structural change says what moved where and why, so the reader's picture of the code
stays true.
