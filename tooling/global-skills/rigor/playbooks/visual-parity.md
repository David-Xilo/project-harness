# Visual parity

**You own pixel-exact equivalence. The baseline is the spec, and you don't touch it.**
Equivalence is checked by image diff, not by eye.

1. Set up the baseline before any migration: a visual regression harness that
   screenshots the current component in each of its states, and the target when
   matching two implementations. No baseline, no parity claim. This blocks the rest.
2. State and hold these rules: no changes to the harness, no touching the baseline, no
   restructuring a component to make a diff pass. If the baseline looks wrong, stop and
   ask; don't edit it.
3. Migrate one component at a time. Parallel owners each get their own component and
   their own worktree (`isolation: "worktree"`, `separate-before-serializing-shared-state`).
   Shared primitives migrate first, as a blocking phase.
4. Check each component against its baseline by image diff on the real surface (the
   module's `verify-<module>` skill, or the browser tools). A non-zero diff is a fail:
   look at the pixel delta. `/loop` per component until the diff is zero.
5. A commit preview per component or per safe batch.

**Reply:** the components migrated, each one's diff result, where the baseline harness
lives, and what is left.
