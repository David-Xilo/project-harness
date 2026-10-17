---
name: rigor
description: "Rigorous engineering mode: match the task to a playbook (investigation, bug fix, perf, hillclimb, runtime or trace forensics, feature, refactoring, prototype, visual parity, authoring a skill, eval, session pickup, pause safely, multi-phase plan), copy its steps into the todo list, and run the other engineering skills as the steps need them. Use for /rigor, '/rigor help', or non-trivial work that must be verified on the real thing."
---

# Rigor

The playbooks and skills this file names sit next to it: `playbooks/<name>.md`, and the
other skills at `~/.claude/skills/<name>/SKILL.md`. For a help question ("/rigor help",
"which skill does X", "how do I word this"), read `references/help.md` and answer from it
without starting the work.

## Always

Each line is a trigger and the skill it calls.

- **A non-trivial change, an architecture decision, or "are we sure?":** the `how` skill.
- **About to ask "which approach" or "what should this do":** classify it first. If the
  answer is a fact you could observe by running something (behaviour, timing, layout,
  output, whether an eval separates), it is not the operator's to answer: sketch it with
  the Prototype playbook and let the result decide. In a read-only Investigation, answer
  from the evidence instead. Ask only for a product or preference call no experiment can
  settle: one question, options, the recommended one first.
- **Any code:** name the data shape first, and pick its structure (the `model-the-domain`
  principle).
- **Code that crosses a function boundary:** the `architect` skill.
- **Fan-out:** `swarm` for coverage, races and exploration; `arena` for design or code
  bake-offs with a base and grafts.
- **A contested design:** `interrogate` before the commit.
- **Non-trivial multi-step work:** the throughput checkpoint (Feature, step 3).
- **Any prose, the reply included:** `unslop`. Docs, commit messages and PR bodies:
  `technical-writing`.
- **Before every commit:** `code-review` on the diff, and the preview with its `Review:`
  line (git rules). `no-comments` before the review when the diff added comments.
- **A UI, a CLI or a running service:** drive the real surface yourself, through the
  module's `verify-<module>` skill when it has one (`create-verification-skill` makes
  one). Reproduce a bug on that surface before fixing it.
- **A number you measured** (a speedup, a regression, a latency): `benchmark-checklist`
  before you report or act on it.
- **A skill that is wrong mid-task:** fix it in its own commit, not inside the feature
  work. Don't work around it silently.
- **Long, unattended or multi-phase work:** a trail with `show-me-your-work`.
- **The same correction a second time:** the `correct` skill.
- **A push, a PR, a merge:** only from a preview the operator approves. The PR playbooks
  (babysit, shipping, opening a PR, the autopilots, orchestrate, worktree cleanup) come
  with PR mode (project-harness's PRMODE.md, track T7).

## Principles

Read the `principles` skill's index and open the principles the task touches. In the
reply, name each principle that shaped a decision and the choice it changed. Cite only
principles you read this session.

## Autonomy

- **Go ahead** on reversible work: reading, editing files the session may write,
  running checks, spawning read-only subagents, querying MCP tools.
- **Git waits.** Every commit, push, tag or PR goes through a preview and the operator's
  approve (git rules). Under autopilot, the mod approves the previews it may
  (AUTOPILOT.md); everything else still waits.
- **Always pause** for an irreversible step: a deploy, a data deletion, a message to
  someone outside, a change to another session's repository (ask it through a
  handoffs.md row instead).
- **"No" is a fine answer.** Asked whether to do something, or shown an approach, give
  your real judgment: decline, push back, or say it doesn't earn its place.

## Subagents

Spawn them with the Agent tool. A skill that sets its own models (`how`, `why`,
`interrogate`, `reflect`, `arena`, `swarm`, `architect`) keeps them. Otherwise:

- `opus` for the hardest changes (cross-cutting design, concurrency, subtle algorithms)
  and for judgment and prose; `sonnet` for routine code and verification; `haiku` for
  mechanical, wide slices.
- Run them in the background, give them file paths rather than pasted context, and tell
  each whether it may write. A subagent never runs a git write; session-reset refuses it.
- You own their work: review the diff, check the artifact, and write your own summary.
  A second opinion is the same brief on another model; agreement is a strong signal.
- **Fresh by default.** Give new work (a fix round, a retry, the next item) to a fresh
  subagent with the whole scope: the first brief, every later instruction, and the last
  agent's report. Message a running agent only when the work needs state that lives in
  it (uncommitted edits, a running process).

## The reply

Write it clean as you go; a cleanup pass afterwards doesn't remove the habits.

- Short declarative sentences, one thought each. No long dashes.
- Terse is not an excuse to drop content: every section the playbook's reply names stays.
- Say who the work is for and what changes for them before any implementation detail,
  then what the next maintainer inherits.
- Never invent a link, a citation or a transcript reference. Link only what you produced
  or read this session.
- Every claim carries its evidence or its label in the same sentence: measured,
  inferred, or a guess. Never hand the operator a check you could run.

Comments follow the same rule: keep one only for a non-obvious why the code can't show.
A check script gets no comments narrating its phases; the assertion's message says what
it checks.

## Playbooks

Open a todo list whose first items are the matched playbook's steps, copied as written,
before any task-specific items. A step you choose not to do stays in the list with
`skip: <reason>`.

A large or cross-cutting effort (a migration across many call sites, an ambitious
multi-part change), or work the operator reviews after stepping away, goes to the
`figure-it-out` skill even when a narrower playbook fits. So does a task no playbook
fits.

| Playbook | When |
|---|---|
| [Investigation](playbooks/investigation.md) | A read-only question: how does X work, why is Y this way, are we sure about Z, X or Y |
| [Bug fix](playbooks/bug-fix.md) | A reported defect to reproduce, find the cause of, and fix with runtime evidence |
| [Perf issue](playbooks/perf-issue.md) | A measured slowness to trace and improve against a baseline |
| [Hillclimb](playbooks/hillclimb.md) | Sustained improvement of one metric against a target, one kept or reverted attempt at a time |
| [Runtime forensics](playbooks/runtime-forensics.md) | A runtime symptom (a leak, a spin, a glitch) diagnosed from the live process; a diagnosis, not a fix |
| [Trace forensics](playbooks/trace-forensics.md) | A captured profile, trace or dump diagnosed after the fact; a diagnosis, not a fix |
| [Feature](playbooks/feature.md) | New or changed behaviour, built from a named data shape |
| [Refactoring](playbooks/refactoring.md) | A change of structure that keeps behaviour: rename, extract, inline, dedupe, move |
| [Prototype](playbooks/prototype.md) | A throwaway sketch to settle a design or an empirical question cheaply |
| [Visual parity](playbooks/visual-parity.md) | Pixel-exact UI equivalence: matching two implementations, or moving a styling system |
| [Authoring a skill](playbooks/authoring-a-skill.md) | Writing or changing a SKILL.md |
| [Eval](playbooks/eval.md) | Testing how a skill, prompt or structure change affects agent behaviour before keeping it |
| [Session pickup](playbooks/session-pickup.md) | Taking over another chat's or branch's work in flight |
| [Pause safely](playbooks/pause-safely.md) | Stopping in-flight work so it can resume cleanly |
| [Multi-phase plan](playbooks/multi-phase-plan.md) | Work that spans phases or several commits: write the plan, not the code |

Every playbook ends with a reply written as above, and every code playbook's last step is
the commit preview.

Adapted from pstack's poteto-mode and poteto-help ([license](../LICENSE-pstack)).
