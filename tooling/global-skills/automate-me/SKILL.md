---
name: automate-me
description: "Draft or revise the operator's personal -mode skill (e.g. dana-mode) from how they actually work: mine their recent transcripts and memory, ask them directly, and write a short skill that agents follow. Use for 'automate me', 'create/update my -mode skill', 'capture my working style', or wanting agents to work the way the operator does."
---

# Automate me

A guided flow that turns the operator's working conventions into a skill agents follow:
one `<handle>-mode` skill, used next to `/rigor`. It runs a mining pass, asks the operator,
and writes the skill with `unslop`.

## 0. Check for an existing skill

Look for `~/.claude/skills/*-mode/SKILL.md`, `.claude/skills/*-mode/SKILL.md` and
project-harness's `tooling/global-skills/*-mode/` for the operator's handle. If one
exists, ask whether to update it (the default) or start fresh (rare: ask why), unless
they already said.

To update:

- step 1 mines only history since the skill last changed (`git log -1 --format=%cI
  <path>`);
- step 2 asks what changed or is missing, not what to capture from zero;
- step 4 edits the file in place: keep the sections nothing contradicts, revise those
  with new evidence, and add a section only for a new rule.

## 1. Mine their history

Read only this project's transcripts, `~/.claude/projects/<slug>/*.jsonl` (`<slug>` is
the working directory with every character other than a letter or digit turned into
"-"), unless the operator names other projects. Read the auto memory too
(`~/.claude/projects/<slug>/memory/`): its `feedback` and `user` files are conventions
already written down. Their CLAUDE.md files (`~/.claude/CLAUDE.md`, the project's) are
rules already in force; don't copy them into the skill.

Spawn parallel subagents (`sonnet`, read-only) over slices of history (the last two to
four weeks, in three slices). Each greps its slice for the signals below, reads only the
matching turns, and returns a short list of patterns with evidence pointers (session
UUID and date):

- reply preferences: length, tone, format, "say it simpler" corrections;
- delegation: subagents, models, parallel work;
- verification: what "done" means, live repro or unit tests, reviewers;
- code and prose: style, principles cited, lint and format tools;
- process: commits, previews, branches, PRs, reviews;
- meta: fixing skills mid-task, proposing new ones.

Cross-check the slices. A pattern in two or more is strong; a lone one is weak and
usually dropped.

## 2. Ask the operator

Mining misses intent that hasn't come up yet. Ask with the AskUserQuestion tool: one or
two questions with four to six options each, multi-select for the areas ("Which matter
most?"), then a follow-up on the areas picked. End with one open question for anything
the options missed. Don't ask twenty questions.

## 3. Group the findings

Group the signals into sections, and use only those that apply:

- **Replies:** length, tone, format.
- **Autonomy:** what to do without asking.
- **Understand first:** which skills to reach for when scoping a change.
- **Subagents:** defaults, parallel work, which model for which job.
- **Code and prose:** principles, lint tools, style.
- **Review and verify:** repro, verify skills, live testing.
- **Process:** previews, commits, branches, PRs.
- **Skills:** authoring habits, fix-the-skill-first.

`/rigor`'s SKILL.md shows the granularity; read it for that, not its content. The
operator's rules are not rigor's.

## 4. Draft the skill

Follow the `rigor` skill's Authoring a skill playbook.

- **Where:** keep an existing skill's place. A new one goes in project-harness's
  `tooling/global-skills/<handle>-mode/` when the operator wants it everywhere (linked by
  `tooling/install`), or in the project's `.claude/skills/<handle>-mode/`.
- **Handle:** the operator's first name or chosen name.
- **Description:** triggers on their name, `/<handle>-mode` and "work in their style", not
  on generic words like "write code".
- **Invocation:** `disable-model-invocation: true` by default, so it loads only when
  asked; drop it only if they want the mode on every turn.

## 5. Iterate

Run every line through `unslop`. Show the draft and take feedback; expect several rounds.
Cut hard: a mode skill is not a manual.

## 6. Land it

A commit preview (git rules) once the operator is happy with it.

## Guardrails

- **Don't overfit to one chat.** A preference said once and contradicted later is noise.
  Codify only what recurs.
- **Don't be clever.** No restating other skills, no metaphors, no poetic prose for an
  agent reader. Keep it operational.
- **Name, don't paste.** Skills and docs the operator relies on appear by name or path.
- **Keep sections minimal.** A section only for a specific, non-default rule.
  "Communicate clearly" is not one; "Short paragraphs. Tables when comparing options." is.
- **Generic wording.** "The operator" in the instructions, not their first name.
- **No forced symmetry.** No process rules worth writing down means no Process section.

## Checking it

A mode skill is subjective, so no test loop: read it with the operator. Does it read like
them? Did it miss anything? Tune its description only if it turns out not to trigger.

## When not to use it

- A task-specific skill, not working conventions: the Authoring a skill playbook alone.
- One narrow workflow ("how I write commit messages"): a regular skill, not a mode.

Adapted from pstack ([license](../LICENSE-pstack)).
