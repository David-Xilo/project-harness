# Autopilot

`/autopilot` runs one workspace session on its own for a while. The session works as it
always does: a step, a review, the docs, a Ready to commit preview, the commit, the
restart, the next step. The only difference is who says "approve": while autopilot is
on, the session-reset mod approves each preview itself, if the preview passes its checks.
It keeps going until a target, and stops sooner whenever the operator is needed.

Nothing runs outside Claude Code. Each session is still a terminal the operator opens; to
work in parallel, run `/autopilot` in several. `/balance-sessions` still says which
sessions to run.

**Status:** planned for v0.2.0 ([plan, T4](plan.md#t4-autopilot-m2)). Only the rules
for every step (section 4) hold so far; the command does not run yet.

## 1. The command

```
/autopilot                  until this session reaches its checkpoint preconditions
/autopilot PAY-1.3          until the commit of step PAY-1.3
/autopilot --max 5          the same, with at most 5 commits instead of 100
/autopilot off              back to approving by hand
```

Run it in a session started with `/session <ID>`. It turns autopilot on for that session,
and the session goes on with its next step. The band shows it:
`S2 · autopilot 3/100 → PAY-1.3`.

## 2. When it stops

Autopilot stops, and the session waits for the operator as it does today, when:

| Why | What the operator sees |
|---|---|
| The target is reached: the commit of the named step, or the session's checkpoint row reads `reached` | The restarted session shows its next step and waits |
| The maximum number of commits ran (100 by default) | The same |
| The session needs the operator: a decision, a step whose "done" is unclear, a checkpoint, a new objective, a live operation | The session asks, as today. Autopilot stays on: once answered, the session goes on |
| A preview fails the checks in section 3 | The preview, waiting for a typed "approve" |
| A command of the preview fails | The failure. Autopilot turns off |
| The operator runs `/autopilot off`, `/clear` or `/resume` | Autopilot is off |

An answer the operator types never turns autopilot off, so answering a question lets the
session go on alone. To take over, run `/autopilot off`.

## 3. What autopilot approves

The mod approves a preview itself only when all of these hold. Otherwise it waits for a
typed "approve", as today.

- **Reviewed.** The preview has a `Review:` line, and it reports no open finding. Every
  preview needs that line, autopilot or not (section 4).
- **Only commits.** Its commands are `git add <paths>` and `git commit`, in the session's
  repositories. A push, tag, switch, merge or `gh` command is the operator's, so nothing
  leaves the machine under autopilot. The commits stay local until the operator pushes,
  usually at the checkpoint.
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
- which sessions to start, park, split or merge to match.

It also re-reads the recorded decisions against what the work has shown. Its drift check
and cleanup stay as a fallback: with sessions cleaning up after each step they should
find almost nothing, so every fix is reported as a sign that a session skipped its
cleanup.

The ops board shows every session of a workspace (`opsboard --md`, and the `/ops` pane):
its state, its next step, how much is ready, and what blocks it. For a session on
autopilot it also shows the target, the count, and whether it is waiting for the
operator:

```
shop · CP1: reached S2 · 3 sessions
  S1  CAT   autopilot 4/100 → CP1 · CAT-1.4 · 2 more ready
  S2  PAY   reached CP1
  S3  SHIP  autopilot 1/100 → SHIP-1.3 · waiting for you: a question
  O7  Amounts as integer cents or decimal strings?   now · unblocks SHIP-1.2, SHIP-1.3
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

```
Ready to commit
Review: code-review, 1 finding, fixed
...
git add src/charge.ts plan.md research.md
git commit -m "PAY-1.1: a charge records one payment"
```

The mod approves it. The commands run, the session restarts with `/session S2`, and the
band reads `S2 · autopilot 1/100 → PAY-1.3`.

At PAY-1.2, S2 finds a decision nobody made: integer cents or decimal strings? It asks,
recommending integer cents, and waits. The operator answers "1" whenever they look.
S2 records the decision, builds PAY-1.2 and PAY-1.3, and stops after the PAY-1.3 commit:
the target is reached.

In terminal 1, S1 works CAT-1.1 to CAT-1.3, sets its checkpoint row to `reached` in the
last commit, and stops there. When every session reads `reached`, the operator runs
`/session CP1` as today, and the checkpoint pushes.
