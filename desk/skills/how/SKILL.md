---
name: how
description: "Use for \"how does X work\", \"teach me this\", \"help me really understand X\", code walkthroughs before changing something, and placement / ownership / layering questions (\"where should this live\", \"which package owns this\", \"is this the right layer\"). Explains subsystem architecture, runtime flow, onboarding mental models; teach mode adds the why and explains it plainly at the person's pace. Use why for motivation alone."
---

# How

Explore the codebase to answer "how does X work?" questions. Produce architectural explanations at the level of a senior engineer onboarding onto a subsystem, enough to build a working mental model, not so much that it reads like annotated source code.

Every spawn is an Agent tool subagent, `subagent_type: "general-purpose"`, told it is read-only (it reads, greps and runs read-only commands, and edits nothing). Explorers run on `sonnet`, which is fast; every explainer runs on `opus`.

## 1. Assess complexity

If the scope is ambiguous, state your interpretation and explore. The user can redirect.

- **Simple** (a single module, a small utility, a narrow question such as "how does function X work"): no explorers. Spawn one explainer that explores and explains in one pass, built from `references/explainer-prompt.md` without the explorer-findings section. Go to step 4.
- **Complex** (a subsystem spanning multiple files or services, a cross-cutting feature, a full architectural overview): go to step 2.

When in doubt, take the simple path.

## 2. Explore (complex only)

Decompose the question into 2 to 4 angles, each a distinct slice of the subsystem. Spawn all explorers in a single message, each with `references/explorer-prompt.md` and its angle filled in.

## 3. Synthesize (complex only)

Once all explorers have returned, spawn one explainer with `references/explainer-prompt.md` and every explorer's findings filled in.

## 4. Present

Present the explainer's output. Light edits for clarity or context from the conversation are fine. Do not substantially rewrite it.

## Teach mode

When the person wants to understand a change or subsystem rather than get a reference answer ("teach me this", "help me really understand X", "explain this change to me"), follow `references/teach.md`. It runs these steps and `desk:why`, then explains the result plainly, one layer at a time.

## Output format

The explanation uses the sections defined in `references/explainer-prompt.md`, dropping any that do not apply: Overview, Key Concepts, How It Works, Where Things Live, Gotchas.

Adapted from pstack ([license](../LICENSE-pstack)).
