---
name: principles
description: Engineering principles for rigorous work - an index of 24 one-rule references (laziness, data structures first, prove it works, fix root causes, test behaviour, guard the context window, encode lessons in checks, and more). Load it at the start of non-trivial code work, before a design choice, before declaring a task done, or when another skill names a principle.
---

# Principles

Read the index, pick the principles the task touches, and open only their references.
Each reference is short: the rule, why, and how to apply it. A skill that names a
principle means the reference of that name.

| Principle | Group | Rule |
|---|---|---|
| [laziness-protocol](references/laziness-protocol.md) | core | Bias toward deletion and the smallest change that solves the problem. |
| [foundational-thinking](references/foundational-thinking.md) | core | Before writing logic, get the core types and data structures right, so the code that follows becomes obvious. |
| [redesign-from-first-principles](references/redesign-from-first-principles.md) | core | Redesign as if the new requirement had been there from day one, instead of bolting it on. |
| [attack-the-premise](references/attack-the-premise.md) | core | When two fixes that share a premise fail the same check, write the premise down and test it before the next fix. |
| [subtract-before-you-add](references/subtract-before-you-add.md) | core | Remove dead weight, redundant validators and stub references first, then build on the simpler base. |
| [minimize-reader-load](references/minimize-reader-load.md) | core | Count the layers between a question and its answer; collapse one-caller wrappers and shrink mutable scope. |
| [outcome-oriented-execution](references/outcome-oriented-execution.md) | core | In a planned rewrite, converge on the target design; don't keep throwaway compatibility code for smooth middle states. |
| [experience-first](references/experience-first.md) | core | Choose the user's experience over implementation convenience; ship fewer, polished features. |
| [exhaust-the-design-space](references/exhaust-the-design-space.md) | core | Build two or three competing prototypes and compare them before committing to one. |
| [build-the-lever](references/build-the-lever.md) | core | For non-trivial work, build the script, codemod or check that does or proves it, so a reviewer can rerun it. |
| [model-the-domain](references/model-the-domain.md) | architecture | Encode the domain in a structure instead of scattered conditionals. |
| [boundary-discipline](references/boundary-discipline.md) | architecture | Put guards at system boundaries (CLI, config, network, external APIs); trust internal types and keep logic pure. |
| [type-system-discipline](references/type-system-discipline.md) | architecture | Make illegal states unrepresentable, parse external data at the boundary, exhaust variants, derive types from the schema. |
| [make-operations-idempotent](references/make-operations-idempotent.md) | architecture | Reach the same end state whatever a partial earlier run left behind. |
| [migrate-callers-then-delete-legacy-apis](references/migrate-callers-then-delete-legacy-apis.md) | architecture | Move every caller and delete the old API in the same wave; no compatibility layer. |
| [separate-before-serializing-shared-state](references/separate-before-serializing-shared-state.md) | architecture | Remove the sharing first; serialize access only when one shared writer is a real invariant. |
| [prove-it-works](references/prove-it-works.md) | verification | Before calling it done, check the real artifact: run it, read the value, inspect the diff. Not a proxy or "it compiles". |
| [fix-root-causes](references/fix-root-causes.md) | verification | Trace each symptom to the first place the system went wrong and fix it there; a guard is a fix only for a legitimate state. |
| [sequence-verifiable-units](references/sequence-verifiable-units.md) | verification | Split multi-step work into small units that each end in a checked state, and order commits so the sequence proves itself. |
| [test-behavior-not-implementation](references/test-behavior-not-implementation.md) | verification | A test asserts what users of the code can observe: it fails when the behaviour breaks and passes when only internals change. Holds the test budget. |
| [explain-the-number](references/explain-the-number.md) | verification | Before trusting a measured number, find what limits it and rule out that it measured something else. |
| [guard-the-context-window](references/guard-the-context-window.md) | delegation | Send bulk to subagents and keep summaries, not raw payloads, in the main thread. |
| [never-block-on-the-human](references/never-block-on-the-human.md) | delegation | Proceed on reversible work and present the result; commits on the task's branch included, the merge waits for the human. |
| [encode-lessons-in-structure](references/encode-lessons-in-structure.md) | meta | Turn a repeated instruction into a lint, a type, a runtime check or a script instead of more text. |

When two principles pull apart, the repository's own rules win, then
the task's goal; say which you followed and why.

Adapted from pstack's principle skills ([license](../LICENSE-pstack)).
