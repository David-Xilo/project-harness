# Autopilot

`/autopilot` runs one workspace session on its own for a while. The session works as it
always does: a step, a review, the docs, a Ready to commit preview, the commit, the
restart, the next step. The only difference is who says "approve": while autopilot is
on, the session-reset mod approves each preview itself, if the preview passes its checks.
It keeps going until a target, and stops sooner whenever the operator is needed.

Nothing runs outside Claude Code. Each session is still a terminal the operator opens; to
work in parallel, run `/autopilot` in several. `/balance-sessions` still says which
sessions to run.

**Status:** released in v0.2.0, after an end-to-end run on a real workspace.

## 1. The command

```
/autopilot                  until this session reaches its checkpoint preconditions
/autopilot PAY-1.3          until the commit that finishes step PAY-1.3
/autopilot --max 5          the same, with at most 5 commits instead of 100
/autopilot off              back to approving by hand
```

Run it in a session started with `/session <ID>`. It turns autopilot on for that session,
and the session goes on with its next step. The band shows it:
`S2 · autopilot 3/100 → PAY-1.3`. With no step, it does not start when the session's
checkpoint row already reads `reached`; name a step to work ahead.

Each restart passes the note "under autopilot" to `/session`, with the target step when
there is one, so the restarted session knows to go on (section 4) and to end the preview
that finishes the target with `Step done: <step>`. When autopilot stops, the note tells the
session to name its next step and wait.

## 2. When it stops

Autopilot stops, and the session waits for the operator as it does today, when:

| Why | What the operator sees |
|---|---|
| The target is reached: the commit whose preview says `Step done: <the named step>` (a commit of one slice of it goes on), or the session's checkpoint row reads `reached` | The restarted session shows its next step and waits |
| The maximum number of commits ran (100 by default) | The same |
| The session needs the operator: a decision, a step whose "done" is unclear, a checkpoint, a new objective, a live operation | The session asks, as today. Autopilot stays on: once answered, the session goes on |
| A preview fails the checks in section 3 | The preview, waiting for a typed "approve", and a toast that says why |
| A command of the preview fails | The failure. Autopilot turns off |
| The operator runs `/autopilot off`, `/clear`, `/resume` or `/session` with another ID, or commits by hand and says "committed" | Autopilot is off |

An answer the operator types never turns autopilot off, so answering a question lets the
session go on alone. To take over, run `/autopilot off`.

**A trail, and a catch-up at the end.** Under autopilot the session logs its decisions
with the `show-me-your-work` skill in `<root>/.audit/<ID>.tsv`, which stays out of git.
The run starts with a row with phase `autopilot` (its target and maximum), and each
restarted session reads the last rows and opens its stretch with a `start` row. When the
target, the maximum or the checkpoint is reached, the restarted session that names its
next step and waits has a reviewer on another model check the run's rows, from that
`autopilot` row on, against session-reset's log of the run and `git log`, opening a
transcript only where a row needs it. Then it opens with a `ketchup` of the whole run and
ends with the reviewer's Attention flags. When autopilot stops for another reason, such
as a failed command, the session says why, and the trail is what the operator reads.

## 3. What autopilot approves

The mod approves a preview itself only when all of these hold. Otherwise it waits for a
typed "approve", as today.

- **Reviewed.** The preview has a `Review:` line, and it leaves no finding open: "no
  findings", "docs only, reread", "1 finding, fixed", "2 findings, both fixed", "9
  findings, 5 fixed, 4 kept". A kept (or moot) finding is the session's call, with its
  reason in the preview. Anything else waits for the operator: numbers that don't add up
  ("3 findings, 2 fixed"), a finding left open, skipped, deferred or recorded, or a line
  that says no review ran ("none"). A finding that needs the operator's call is not
  kept: the session asks about it (section 4). Every `Review:` line in the answer
  counts. Every preview needs that line, autopilot or not (section 4).
- **Only commits.** Each command is one `git add <paths>` or `git commit` (with `git -C
  <repo>` allowed) that the gate allows; an `--amend`, `--fixup` or `--squash` commit
  waits. A push, tag, switch, merge or `gh` command is the operator's, so
  nothing leaves the machine under autopilot. The commits stay local until the operator
  pushes, usually at the checkpoint. The workspace mod's write guard keeps the session's
  edits in its own repositories.
- **Within the count.** It is not past the maximum.

All the rules that hold today still hold. session-reset runs the commands one by one as
shown and refuses anything forbidden. git-guard blocks `clean`, `reset --hard`, `rebase`
and `restore`. The commits are the operator's, signed, with no trailer.

## 4. Rules for every step, in both modes

Autopilot leans on these, but they hold with or without it.

1. **Review before every commit.** The session runs `code-review` on its diff (and
   `simplify` when the slice grew), fixes or records each finding, and puts the result
   in the preview: `Review: code-review, 2 findings, both fixed`, or `Review: docs only,
   reread`. session-reset holds an approve, typed or automatic, when that line is missing.
2. **Clean up after every step.** Before its preview, the session leaves its own docs true:
   - its module plan's "Current state" and "Next";
   - its queue in the root plan;
   - its handoff rows: close what was delivered to it, mark what it delivered;
   - the `O` entries it verified, which it deletes;
   - nothing stale that it wrote.

   Drift is then a bug, not a chore. `/balance-sessions` still checks for it, as a
   fallback.
3. **Ask about anything that matters.** A decision the step cannot make alone is asked
   in one question, with options and the recommended one first. A step only the operator
   can do becomes an `O<n>` entry. Nothing is built on an open question.
4. **Check the decisions a step rests on.** Before building, the session reads the `SD`
   and `D` rows the step depends on. If what it has learned contradicts one, it asks
   whether to keep or revisit it, even when that decision was made long ago.

Small choices inside a step, such as names, structure or test layout, the session makes
itself and records in the module's `research.md`.

**Go-aheads under autopilot.** Today a step that spans repositories, or changes a handoff
between tracks, waits for a go-ahead on its plan. Under autopilot the session shows that
plan and goes on. It still stops for an unclear "done", a checkpoint, a new objective,
a decision or a live operation.

## 5. Balance, and seeing the sessions

`/balance-sessions` stays the operator's command, and its focus is the workload:
- how much ready and blocked work each session has, and what blocks it;
- handoffs first in every queue;
- how many sessions should run in parallel for the next stretch of work: a milestone may
  start with 2, widen to many once the modules are independent, and narrow to 3 near the
  checkpoint;
- which sessions to start, park, split or merge to match, and which to run on
  `/autopilot`, with a target step where their part of the stretch ends.

It takes the counts from the ops board's `session` rows below.

It also re-reads the recorded decisions against what the work has shown. Its drift check
and cleanup stay as a fallback: with sessions cleaning up after each step they should
find almost nothing, so every fix is reported as a sign that a session skipped its
cleanup.

The ops board shows every session of a workspace (`opsboard`, `--md`, `--tsv`, and the
`/ops` pane). A session's work is the "Next" items of its tracks' module plans that are
not done yet; an item is ready when every step its "Waits for" names is done or gone
from the plans, every handoff is delivered and every `O<n>` is closed. The board gives its state (`reached` from its
checkpoint row, else `ready`, `blocked`, `idle`, or `no plan` when none of its tracks
has a module plan), its next step, how much is ready,
and what blocks it. For a session on autopilot it also shows the count, the target, and
whether it waits for the operator:

```
shop · CP1: working S1, S3 · reached S2
  S1 ready · CAT-1.4 · 3 ready · autopilot 4/100 → checkpoint
  S2 reached · PAY-2.1 · 1 ready
  S3 blocked · SHIP-1.2 · blocked by O7 · autopilot 1/100 → SHIP-1.3, waiting for you: an answer
  O7 Amounts as integer cents or decimal strings?
    now · tell S3 · unblocks 2: SHIP-1.2, SHIP-1.3
```

## 6. An example

A toy project `shop` has two modules, CAT and PAY, and milestone M1. `/balance-sessions`
says to run S1 and S2. The operator opens two terminals:

```
terminal 1:  claude  →  /session S1  →  /autopilot
terminal 2:  claude  →  /session S2  →  /autopilot PAY-1.3
```

In terminal 2, S2 builds PAY-1.1. It runs `code-review` and fixes one finding, cleans up
its docs, and shows the preview:

````
Ready to commit
Review: code-review, 1 finding, fixed
Step done: PAY-1.1
...
```commit
git -C /home/me/work/shop/pay add src/charge.ts plan.md research.md
git -C /home/me/work/shop/pay commit -m "PAY-1.1: a charge records one payment"
```
````

The mod approves it. The commands run, the session restarts with `/session S2`, and the
band reads `S2 · autopilot 1/100 → PAY-1.3`.

At PAY-1.2, S2 finds a decision nobody made: integer cents or decimal strings? It asks,
recommending integer cents, and waits. The operator answers "1" whenever they look.
S2 records the decision, builds PAY-1.2 and PAY-1.3, and stops after the PAY-1.3 commit:
the target is reached.

In terminal 1, S1 works CAT-1.1 to CAT-1.3, sets its checkpoint row to `reached` in the
last commit, and stops there. When every session reads `reached`, the operator runs
`/session CP1` as today, and the checkpoint pushes.
