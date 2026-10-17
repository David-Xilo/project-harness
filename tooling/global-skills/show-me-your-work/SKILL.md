---
name: show-me-your-work
description: "Keep a reviewable decision trail for long or unattended work: a TSV log with one row per decision (what, why, evidence, result), kept out of git. Use for /show-me-your-work, autopilot runs, multi-phase work, or anything the operator reviews after stepping away."
---

# Show me your work

Keep one trail per piece of work.

## The format

One TSV file, one row per decision. Cells stay on one line. Evidence is a pointer, not
prose. `references/decision-log-template.tsv` is the header row. Columns:

- **ts.** ISO 8601 timestamp, in UTC.
- **phase.** The phase, step or workstream (`ENG-6.8`, `frame`, `review`).
- **decision.** What was chosen or done, in one line.
- **why.** The reason in plain words. If a principle drove it, say what it means, not
  its name.
- **evidence.** A pointer that proves it: a commit hash, a PR number, `file:line`, or the
  path of an output, trace or screenshot. Never a paragraph.
- **result.** The outcome: `tests pass`, `reverted`, `INCONCLUSIVE`, `open`.

An example, plain enough to read at a glance:

```
ts	phase	decision	why	evidence	result
2026-05-24T09:02:00Z	frame	counted the work first, about 100 components and 75 hours	wanted the size before a long run	commit 3a9f1c2	found 5 things to sort out first
2026-05-24T09:40:00Z	harness	took screenshots of the old version before changing anything	to compare old against new and catch any visual change	scripts/snapshot.sh, baseline/	saved 120 reference screenshots
2026-05-24T11:15:00Z	widget	moved the widget styles over without changing how it looks	keep the change small and the result identical	commit 7c21e0a, pixel-diff 0	looks identical, tests pass
2026-05-24T12:30:00Z	widget	threw out a helper's work because its screenshots were blank	checked the real files instead of trusting its summary	worktree reset	reverted, tightened the brief
```

## Logging a row

Write each row the way you'd tell a teammate what you did: plain words, concrete actions
(the `unslop` skill applies here too).

```bash
~/.claude/skills/show-me-your-work/scripts/log.sh <logfile> <phase> <decision> <why> <evidence> <result>
```

It stamps `ts`, writes the header on first use, turns tabs and newlines into spaces, and
puts a quote before a cell that starts with `=`, `+`, `-` or `@`, so a spreadsheet never
runs it as a formula. Evidence can be generated text (a PR title, a file name), so use
the script rather than a bare `printf`.

Log decision points and checkpoints, not every action: a fork chosen, a unit done with its
check, a pivot or a revert with what caused it, a blocker, a gate fixed. One row per loop
iteration. Skip the trivial.

A run is one Claude Code session, including its later turns and a compacted summary of
it. A restart (`/clear`, `/session <ID>`, a new chat) starts a new run. When a run adds to
a trail that already has rows, its first row has phase `start`, and so does its first row
after another run's `start` row. So a run that comes back to a trail in a later turn reads
its last rows first, to see whether another run wrote since. A `start` row names the `ts`
range of the earlier rows this run did not write, and its evidence names this run (its
session ID, the name of its transcript file below). Use phase `start` for nothing else.
Under autopilot, the session where the operator ran `/autopilot` also writes a row with
phase `autopilot` (its target and maximum), so the end of the run knows where it began.

## Where it lives

The trail is a working file, kept out of git: `.audit/<name>.tsv` in the repository or
workspace root, where `<name>` is the workspace session (`S3`, `CP1`) or the task. The
script writes `.audit/.gitignore` with its first row, so nothing under `.audit/` is ever
staged.

If a reviewer needs the trail to trust a result, copy the rows that matter into the PR
body or the step's docs, and show that in the commit preview. The trail itself stays
local.

## Rules

- Append only. A wrong call gets a new row that supersedes it. Never edit or delete a row.
- Prefer evidence a committed script produced over a one-off (the `principles` skill,
  `encode-lessons-in-structure`).

## Check the trail against the transcript

At the end of the run, before handing back, check that the trail told the truth. This
run's transcript is `~/.claude/projects/<slug>/<uuid>.jsonl`, where `<slug>` is the
working directory with every character other than a letter or digit turned into "-";
read only that folder. Several sessions share it in a workspace, so find the file by its
content, not its age: session-reset's log (`${XDG_STATE_HOME:-~/.local/state}/super-project/session-reset/<uuid>.jsonl`)
holds one file per Claude session, and the files whose events carry `"id":"<ID>"` are
that workspace session's. Elsewhere, grep the newest transcripts for a phrase from this
run. Walk this run's rows against what happened. A stretch starts at one of this run's `start` rows, or at the
first row if this run made the trail, and ends at the next `start` row of another run.

- Every row maps to a real decision or action.
- Every row's evidence resolves and shows what the row claims.
- A fork, pivot or dropped approach that shaped the work but has no row is a gap: add it.

Correct the trail, not the story. Never edit or remove a row, even an invented one: add a
row that supersedes it with what happened and a pointer that resolves. Rows outside this
run's stretches are not checked, unless this run's work shows one is wrong.

Under autopilot, every restart is a run but the check and the review below run once, at
the end of the autopilot run (AUTOPILOT.md section 2), over every stretch since its
`autopilot` row. A commit preview never carries an Attention section.

## A review on another model

Before handing back, spawn an Agent tool subagent on a different model from the one that
did the work (`sonnet` or `fable` when the session runs on `opus`, `opus` otherwise),
read-only. It reads the trail, the run's session-reset log and `git log`, opens the
transcripts only where a row needs checking, and flags what the operator should
look at. It does not redo the work. It looks for:

- decisions with weak or no evidence;
- checks skipped, or claimed with no proof in the transcript;
- choices that look risky in hindsight (premature, scope creep, a symptom patched over);
- gaps the operator would miss on a skim.

Every reply that ends a run with a trail ends with an **Attention** section: the line
`reviewed by <model>`, then each flag, pointing at the rows or moments. "No flags" is a
valid answer. The model line is always there.

## Reading a trail

Read it top to bottom, follow the pointers and spot-check. `column -s$'\t' -t <trail>`
shows it as a table in a terminal.

## Used by other skills

Other skills and modes (autopilot, `rigor`'s playbooks) keep their trail here instead of
inventing one. Name this skill and let it own the format.

Adapted from pstack ([license](../LICENSE-pstack)).
