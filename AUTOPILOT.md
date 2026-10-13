# Autopilot

Autopilot runs the operated workflow ([WORKFLOW.md](WORKFLOW.md)) without the operator at
the keyboard. The same sessions work the same plan, with the same tracks, handoffs,
operator tasks and checkpoint rows. A local driver starts them, commits their reviewed
work and decides when to rebalance. The operator answers the questions the sessions
raise and runs each checkpoint.

The core is small on purpose: no new documents, no branches or pull requests, and no
second kind of session. What makes it safe is a few rules that also hold in operated
mode.

**Status:** planned for v0.2.0 ([plan, T4](plan.md#t4-autopilot-m2)). Nothing here runs
yet. [Section 8](#8-open-until-the-spike) lists what the headless spike must confirm.

## 1. The loop

```
sp-autopilot <root> [--until <step>]
  1. balance   claude -p "/balance-sessions auto"    the next stretch: which sessions, how many
  2. stretch   each session in the stretch, in parallel up to the cap:
                 claude -p "/session <ID>"            one step, then the run ends
                 the driver reads the step's result and commits it
               again, until the session is dry, waiting, reached or failed
  3. stop?     the target is reached, nothing is ready, a step failed, or
               .claude/autopilot.stop exists: one notification, then exit
               otherwise back to 1
```

- **The target** is the open checkpoint by default: the driver stops when every session
  reads `reached`, and the operator runs `CP<m>`. With `--until <step>` it stops once
  that step is done, and the stretches work only that step and what it depends on.
- **A stretch** is a run of steps with a fixed set of sessions. It ends when every
  session in it has stopped, or after `stepsPerStretch` steps each. Then balance plans
  the next one, which may run more sessions or fewer.
- **Nothing is pushed.** The commits stay local and signed until the operator runs the
  checkpoint, which pushes as it does today.
- **Running the checkpoint itself** is the later goal, after M2.

## 2. Rules for every step, in both modes

These hold in operated mode too; autopilot only checks them without a person.

1. **Review before every commit.** The session runs `code-review` on its diff (and
   `simplify` when the slice grew), then fixes or records each finding. Operated: the
   Ready to commit preview has a `Review:` line (`code-review: 2 findings, both fixed`,
   or `docs only: reread`), and session-reset holds an approve when the line is missing.
   Autopilot: the step's result carries the review, and the driver refuses to commit a
   step with no review or with an open finding.
2. **Clean up after every step.** The session leaves its own docs true:
   - the module plan's "Current state" and "Next";
   - its queue in the root plan;
   - its handoff rows: close what was delivered to it, mark what it delivered;
   - the `O` entries it verified, which it deletes;
   - nothing stale that it wrote.

   Drift is then a bug, not a chore. Balance still checks for it, as a fallback.
3. **Ask about anything that matters.** A decision the step cannot make alone becomes an
   `O<n>` entry in `operator.md`, with its options and the recommended one first. The
   session builds nothing on it until the answer comes. It moves on to other unblocked
   work, or stops and names what it waits for.
4. **Check the decisions a step rests on.** Before building, the session reads the `SD`
   and `D` rows the step depends on. If what it has learned contradicts one, it writes an
   `O<n>` "Revisit SD<n>" with the options. This holds even when the operator decided it
   long ago.

Small choices inside a step, such as names, structure or test layout, the session makes
itself and records in the module's `research.md`.

## 3. One step per run

In autopilot each `claude -p "/session <ID>"` does exactly one step and ends. Every step
starts with a fresh context, so the restart that session-reset does after a commit is
not needed. As in operated mode, what is not in the docs is lost.

The run ends by writing `.claude/autopilot/<ID>.json`, which the driver reads:

```json
{"status": "done", "step": "PAY-1.1", "note": "PAY-1.2 needs the amount type",
 "review": {"ran": "code-review", "findings": 1, "fixed": 1, "open": 0},
 "commit": [{"repo": "pay", "paths": ["src/charge.ts", "plan.md", "research.md"],
             "message": "PAY-1.1: a charge records one payment"}]}
```

| Status | Meaning | The driver |
|---|---|---|
| `done` | The step is built, reviewed and its docs are clean | Commits it, then starts the session's next step |
| `waiting` | The step needs an `O<n>` answer | Commits the docs change, then tries the session's other work |
| `dry` | Nothing ready for this session | Ends the session for this stretch |
| `reached` | The session's checkpoint scope is done | Commits, ends the session for this stretch |
| `failed` | The checks fail and the session cannot fix them | Retries once (`retries`), then stops the run |

The `note` reaches the session's next run, as "approve, then <note>" does in operated
mode.

## 4. Git: the driver commits, the session never does

In `claude -p` the session-reset mod already denies every git and `gh` write, because no
person can approve. So the model never runs git in autopilot. The driver commits instead:

1. It reads the result. A missing review or an open finding fails the step.
2. It checks every path: inside a repository the session owns, or one of the shared
   root files, which go in whole. Anything else fails the step.
3. It runs `leak-check` on what it is about to commit.
4. Holding one lock per root, it runs `git add <paths>` and `git commit -F <message>`,
   as the operator, signed, as the git config says.
5. It checks that `opsboard --tsv` still parses the root. If not, the docs are broken
   and the step fails.

The rules of `~/.claude/git-rules.md` stay: no trailers, no identity overrides, and
never force-push, rebase, `reset --hard`, `clean` or `restore`. git-guard still blocks
those for everyone.

## 5. Balance plans the workload

`/balance-sessions auto` runs before every stretch. It is the operated skill with no
questions asked; it decides, records what it decided, and hands its doc edits to the
driver to commit like a step.

- **Workload.** For each session it counts ready and blocked steps, and what blocks them.
  Handoffs come first in every queue.
- **Parallelism.** It picks how many sessions the next stretch runs, up to the cap. A
  milestone may start with 2, widen to many once the modules are independent, and narrow
  to 3 near the checkpoint. It parks, splits, merges or starts sessions to match.
- **Target.** With `--until`, it queues only the target step and its dependencies.
- **Decisions.** It reads the recorded decisions against what the work has shown. One
  that no longer holds becomes an `O<n>` to revisit.
- **Fallback cleanup.** It still runs the drift check and fixes what it finds: stale
  handoff rows, verified `O`s, queues and "Current state" that lag the work. With
  sessions cleaning up after each step this should find almost nothing, so every fix is
  logged as a sign that a session skipped its cleanup.

It writes the stretch as `.claude/autopilot/stretch`, one session ID per line. The file
is local and never committed.

## 6. What the operator sees

`opsboard` is the one parser of the docs. In autopilot the driver reads everything it
needs from `opsboard --tsv` and parses no markdown itself. Each session gets a `session`
row with:
- its repositories and state;
- its next step and how many steps are ready;
- what blocks it;
- its checkpoint status.

The driver also writes its live state to
`~/.local/state/super-project/autopilot/<root id>.json`: the stretch, and for each
session the running step and since when. The board joins that in.

The `/ops` pane and `opsboard --md` show a Sessions block per workspace, above the
operator steps:

```
shop · autopilot, stretch 2 · 3 sessions of cap 4 · CP1: reached S2
  S1  CAT   running CAT-1.4 since 14:02 · 2 more ready
  S2  PAY   reached CP1
  S3  SHIP  waiting O7 · 0 ready
  S4  DOCS  parked this stretch
  O7  Amounts as integer cents or decimal strings?   now · unblocks SHIP-1.2, SHIP-1.3
```

Session states: `running <step> since <time>`, `ready (<n>)`, `waiting <O…>`, `dry`,
`reached`, `parked` and `failed`. In operated mode the same block shows `ready`,
`waiting` and `reached` from the docs. Showing which sessions are live there is T3.

## 7. Using it

**Set up.** A workspace picks its mode in `.claude/workspace.json`. The mode changes only
at a checkpoint, so one milestone never mixes the two.

```json
{"mode": "autopilot", "autopilot": {"cap": 4, "stepsPerStretch": 6, "retries": 1}}
```

`sp-claude-init <root> --mode autopilot` writes it with these defaults. The `cap` is
yours to raise or lower.

**Run.**

```sh
sp-autopilot ~/projects/shop                    # until the open checkpoint is ready
sp-autopilot ~/projects/shop --until PAY-1.3    # until PAY-1.3 and what it needs are done
touch ~/projects/shop/.claude/autopilot.stop    # the running steps finish; none starts
opsboard --md ~/projects/shop                   # sessions and what waits on you; /ops shows the same
```

**Answer.** No session is listening while the driver is stopped, so answer an `O<n>` in
its entry: `**Status:** done 2026-11-02: 1 (integer cents)`. The next run records the
answer as a decision and goes on. For a task that is not a decision, do it and set
`done <date>` the same way.

**An example.** A toy project `shop` has two modules, CAT and PAY, and milestone M1.

```
$ sp-autopilot ~/projects/shop
balance  stretch 1: 2 sessions (S1 CAT, S2 PAY)
S1  CAT-1.1  done     review: 1 finding, fixed    committed a41c0e2 (cat), 77d01b9 (root)
S2  PAY-1.1  done     review: clean               committed 9b7e2d4 (pay)
S2  PAY-1.2  waiting  O7: amounts as integer cents or decimal strings? (blocks PAY-1.2, PAY-1.3)
S2  dry      nothing ready without O7
S1  CAT-1.2  done     review: 2 findings, fixed   committed 0c3d5aa (cat)
S1  CAT-1.3  done     review: clean               committed 5e8f210 (cat)
S1  reached  CP1
balance  stretch 2: no session has ready work
stop     waiting on you: O7 (blocks PAY-1.2, PAY-1.3). Nothing pushed.
```

The operator reads O7 in `operator.md`, answers `done 2026-11-02: 1`, and starts again:

```
$ sp-autopilot ~/projects/shop
balance  stretch 1: 1 session (S2 PAY); O7 answered, recorded as SD12
S2  PAY-1.2  done     review: clean               committed 1f9a3c7 (pay), 4b2e8d0 (root)
S2  PAY-1.3  done     review: 1 finding, fixed    committed 8d6c4f1 (pay)
S2  reached  CP1
stop     CP1 is ready: run claude, then /session CP1. Nothing pushed.
```

Then the operator runs `CP1` by hand, as today: acceptance, the tags, `main` and the push.

A decision made long ago that no longer holds stops work the same way. At CAT-2.1, S1
finds that SD4 ("the catalog is read-only") conflicts with what PAY now needs. It writes
O8, "Revisit SD4: keep it, or let PAY update prices", and builds nothing on SD4 until O8
is answered.

## 8. Open until the spike

The driver runs locally, not in the cloud: a cloud session cannot sign with the
operator's key, load the local mods or keep the data private. The headless spike checks
the rest, and this section records each finding with its command:

- whether the mods and hooks load in `claude -p`;
- whether `/session <ID>` sets the session there, so the workspace guard applies;
- that session-reset denies every git write there;
- whether the driver can sign with no terminal, from the signing agent's cached approval
  (operator task O4 sets the agent up first);
- whether two sessions editing a shared root file at once lose an edit, or the edit
  tool's check for a changed file catches it;
- what `--output-format json` gives the driver.
