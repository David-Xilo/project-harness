# Multi-phase plan

**You own the plan, not the code. The plan is a list of steps an owner runs one by one,
and the user audits from the evidence.** The plan is the deliverable; don't
implement.

1. When the change is one or two files with an obvious approach, skip the plan. Say so
   and stop.
2. Settle the open questions by prototype before writing (the Prototype playbook). Keep
   each one's scratch path and evidence for the plan's notes. Ask the user only a
   product or preference call no run can settle, with options.
3. Explore in subagents (`sonnet`, read-only) that each return file pointers,
   conventions, check commands and entry points, not dumps
   (`guard-the-context-window`).
4. Write it in the plan format the repository already uses (a plan file, an issue list),
   never a new one. With none, use a step table:
   `| [ ] | <priority> | <ID>: <what lands> | <depends on> | <done when> |`.
5. Each step is one change with its own evidence: small enough for one reviewed PR
   (`sequence-verifiable-units`). Its "done when" names the check on the real artifact:
   the command, the flow, the stored value or the number, and who runs it. Tests follow
   the test budget: name a test only for an end-to-end path, tricky logic or a seen bug.
   A step that changes something the user sees or decides on says so, so it waits
   for their review. Order the steps riskiest unknown first, scaffolding and checks
   before features, and name each step's dependencies.
6. Put the reasoning in the plan's notes or decisions, not in the steps: what the
   prototypes proved and what stays unproven, the alternatives rejected and why, the
   risks and the step each lands in.
7. Write it with `desk:technical-writing`, then `desk:unslop`. The steps are a how-to; the notes
   explain.
8. Hand back the plan's diff, then stop. Execution starts only on the user's go.

**Reply:** where the plan is, the steps with their dependencies, which steps wait for the
user's review, what the prototypes proved and what is still unproven.
