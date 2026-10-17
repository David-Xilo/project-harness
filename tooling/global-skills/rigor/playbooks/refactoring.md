# Refactoring

**You own the contract. The structure changes; the behaviour does not.** Unlike Feature,
which adds behaviour, and Bug fix, which corrects it.

If the cleanup reveals a missing feature or a real bug, split it out and ship the
structural change first, against the pinned contract. A redesign is allowed, but name it
and route it to Feature. Large or cross-cutting structural work belongs to
`figure-it-out`; this playbook is the small-to-medium change.

1. Pin the behaviour first. Learn the contract with `how`, then capture the current
   behaviour before any structure moves: a characterization test, a snapshot, or an
   equivalence script that diffs outputs. Type checks and lint are not a pin. A pin that
   is only for this change can stay out of the repository (the test budget).
2. Name the structure the code is missing (`model-the-domain`). Plain code stays when its
   shape is already clear and local. The reshape must delete branches or invalid states,
   not add indirection.
3. Name the target shape: the module layout, types and call graph you would build today
   (`foundational-thinking`, `redesign-from-first-principles`). If it crosses a function
   boundary, run `architect` on it first.
4. Subtract before you add: delete dead code, collapse one-caller wrappers, drop
   redundant validators and orphan references first (`subtract-before-you-add`). The
   smallest change that reaches the target ships (`laziness-protocol`).
5. Move in small steps that each keep the pin green. For an API reshape, move every
   caller and delete the old API in the same wave
   (`migrate-callers-then-delete-legacy-apis`): no shims, no parallel old and new paths.
   Check every rename against the files: renames miss uses in strings, prose and
   back-references. Hand the mechanical edits to a subagent (`sonnet`, `haiku` for pure
   renames) with the paths, the names being moved and the behaviour to hold.
6. Prove the behaviour unchanged on the real artifact (`prove-it-works`): run the
   equivalence check, or replay a recorded baseline against the new code.
7. Confirm it is worth keeping: it must lower reader load somewhere
   (`minimize-reader-load`). If it doesn't, revert it.
8. Small ordered commits, each through its preview: the subtraction, then the reshape,
   then any follow-on cleanup (`sequence-verifiable-units`).

**Reply:** the structure that changed, the pin it held against, the equivalence proof,
the reader-load difference, and what shipped and what was reverted. No new behaviour.
