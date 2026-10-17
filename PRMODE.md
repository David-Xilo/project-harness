# PR mode

`/pr on` puts one workspace session in PR mode. In approve mode, each commit waits for
the operator's approve, and each session owns its files so that sessions never collide.
In PR mode, the session commits with no approve on its own branch, in its own worktree.
The gate moves to the pull request. A verifier on another model checks the pushed head,
and the operator merges on GitHub. Two sessions may then change one repository and meet
at the merge.

The design is decision D16 in [plan.md](plan.md#decisions). It adapts pstack's
orchestrate, autopilot-stack, shipping and opening-a-pr playbooks and its
never-block-on-the-human principle
([license](tooling/global-skills/LICENSE-pstack)).

**Status:** designed, not built. T7 builds it: session-reset in PR-7.3, the workspace mod
in PR-7.4, the ops board in PR-7.5.

## 1. The command

```
/pr on       this session works in PR mode from its next step
/pr off      back to approve mode once the open step's PR is open
/pr          the mode, the step's branch and the session's open PRs
```

Run it in a session started with `/session <ID>`. session-reset keeps the mode in its
session state, as it keeps `/autopilot`, so the mode survives the restart after each
step. The band shows it: `S2 · PR S2/PAY-1.3 · #41 PASS`. A workspace can mix modes,
for example S1 in approve mode and S2 in PR mode.

PR mode and `/autopilot` work together. Under autopilot, the mod approves the PR's
preview itself if the preview passes the checks in [AUTOPILOT.md](AUTOPILOT.md)
section 3, with `gh pr create` added to the commands it may approve.

## 2. Work in a worktree, stay at the root

Each session gets one worktree per repository it changes, at
`<root>/.worktrees/<ID>/<repo>`. The root's `.gitignore` lists `.worktrees/`. The first
step that touches a repository shows a preview that makes the worktree:

````
```commit
git -C /home/me/work/shop/pay fetch origin
git -C /home/me/work/shop/pay worktree add /home/me/work/shop/.worktrees/S2/pay -b S2/PAY-1.3 origin/development # approved
```
````

The worktree stays for the session's later steps. Each new step starts its own branch in
it.

The session itself stays at the root. It reads and writes by absolute path inside its
worktrees, and it pins every git command with `git -C <worktree>`. So one session can
hold worktrees of several repositories. Claude Code's `EnterWorktree` and `claude -w`
move a session into a single repository, and a cloud session carries neither the mods
nor the private submodules. PR mode uses neither of them.

The main checkouts (`<root>/<repo>`) stay in approve mode, and the session does not edit
code there. The root docs are the exception (D15). In both modes, the session keeps
plan.md, handoffs.md and the root's other `.md` files current in the root checkout and
leaves them uncommitted. A module's own docs (its plan.md and research.md) live in the
module's repository. In PR mode they change in the worktree, on the step's branch, and
merge with the code.

The workspace mod's write guard lets a session in PR mode write its own
`.worktrees/<ID>/` and the root docs. File ownership between sessions no longer applies
there.

Before it builds anything, PR-7.3 checks that a worktree of a submodule works, because
a submodule's config holds a shared `core.worktree`. If it does not work, the session's
worktree is a clone of the module's repository at the same path, and the rest of this
document holds as written.

## 3. One branch per step

- Each step gets a branch `<ID>/<step>`, for example `S2/PAY-1.3`, from
  `origin/development`.
- A step that builds on the session's own unmerged PR starts from that PR's branch. Its
  PR names the PR below it, and the operator merges them bottom up. Only the session
  that owns a stack changes it.
- When `development` moves and the branch conflicts, or when the PR below merged, the
  session merges `origin/development` into its branch and pushes. It never rebases and
  never force-pushes, so a pushed head is never rewritten.
- To pause, the session commits its work as one `wip:` commit and pushes it
  (section 6).

## 4. What runs, and who approves it

| Who approves | Commands |
|---|---|
| Nobody, in the session's own worktrees | `git add`, `git commit` (a `wip:` commit too), `git switch -c <ID>/…`, `git fetch`, `git merge origin/development`, `git push origin <ID>/…` without `--force` or `--delete` |
| The operator, from a preview (autopilot may approve) | `gh pr create --base development --head <ID>/<step>`, and `gh pr comment` on the session's own PR |
| The operator, from a preview | the `fetch` and `worktree add` that make a worktree, and its `worktree remove` (never `--force`) |
| Nobody: session-reset refuses them | a merge into `development` or `main`, a push to any other branch, a force-push, a branch delete, a PR retarget, close or merge, a rebase |

Rule 3 of the git rules still holds: the commits are the operator's, signed, with the git
config as it is and no trailer. The main checkouts keep every approve-mode rule.

A commit on the step's branch needs no preview and no review of its own. The review
moves to the step's whole diff (section 5), and the PR's preview carries the `Review:`
line. session-reset holds an approve of a `gh pr create` preview that has no `Review:`
line, as it holds an approve of a commit without one.

## 5. A step, from start to merge

1. **Start.** `git fetch`, then `git switch -c S2/PAY-1.3 origin/development` in the
   worktree. A stacked step starts from the previous step's branch instead.
2. **Build.** Commit as often as it helps. Push after each slice worth keeping, so the
   work outlives the session and the ops board sees it (section 9).
3. **Review and clean up.** Run `code-review` on the step's diff
   (`origin/development...HEAD`) and fix or keep each finding with its reason. Run
   `no-comments`. Clean up the docs as [AUTOPILOT.md](AUTOPILOT.md) section 4 asks:
   commit the module's docs on the branch, and leave the root docs current and
   uncommitted. Push the head.
4. **Verify.** Spawn a verifier on another model with the brief in section 7. It checks
   the pushed head: `interrogate` on the diff, then proof that the change works on the
   real artifact. Its verdict is `PASS`, `PASS+NOTES`, `FAIL` or `BLOCKED`. On `FAIL`, the
   session fixes the branch, pushes, and verifies the new head. `BLOCKED` is not a pass:
   the session says why and asks the operator.
5. **Record.** Write the verdict's row in the ledger (section 8).
6. **Open the PR.** Show a preview with the `Review:` line, the PR's body (section 8) and
   the `gh pr create` command. The operator approves it, or autopilot does.
7. **Restart.** Once the PR is open, session-reset restarts the session with
   `/session <ID>`, as it does after a commit in approve mode. The next step starts at 1.
8. **Merge.** The operator reads the PR and merges it on GitHub. The session never
   merges.

If the operator asks for changes on an open PR, the session fixes the same branch,
pushes, verifies the new head and records its row. It then posts the new verdict and
head with `gh pr comment`, from a preview.

## 6. Decide inside the branch, ask about the rest

Work on the step's branch is reversible: the operator reads it before it merges. So
inside the branch, the session makes the reversible calls itself and shows them after.
Such calls are names, structure, test layout, or a choice between two designs that the
PR can undo. Each one goes in the PR body, and the lasting ones also go in the module's
`research.md`.

The session still asks, in one question with the recommended option first, about:
- a decision that becomes an `SD` or `D` row, or that contradicts one;
- product direction;
- a step whose "done" is unclear;
- anything irreversible or outside its own branch.

While the question waits, the session goes on with the work that does not depend on the
answer. A step only the operator can do becomes an `O<n>` entry, as in approve mode.

**Pausing.** To stop mid-step, the session finishes or backs out of its current edit and
starts nothing new. It commits everything as one `wip:` commit on the branch and pushes.
The commit's body is the resume note: what is done, what is verified, and the next
action. If the tree is broken, the body says so in one line. The next `/session <ID>`
finds the branch and goes on. Approve mode has no `wip:` commits.

## 7. The brief for a spawned agent

A spawned agent cannot ask the session a question, so its brief carries everything. The
session uses these fields for the verifier and for any other agent it spawns. If the
session cannot fill a field, the task is not scoped yet.

```
GOAL        one sentence: the outcome, clear to someone with no access to the chat
SCOPE       the paths it may write and the paths it may not; for a verifier, nothing
            in the repositories, only a scratch folder
CONTEXT     the step's row and its "Done when", the head SHA and the diff range, the
            decisions the step rests on
ACCEPTANCE  checkable criteria, one per line
VERIFY      the exact commands, the real artifact to run, and known traps
TIMEBOX     a rough limit; when it runs out, report what is known and stop
FORBIDDEN   no commit, push or gh write; no merge, rebase or retarget; no fix
            outside the scope
REPORT      the verdict, the head SHA, what it ran and the output, the findings
            sorted into interrogate's four buckets, and follow-ups
```

The verifier runs on a different model from the session, for example `model: sonnet`
when the session runs Opus. It never wrote the code it checks. A green CI run or a bot's
review is input to a verdict, never a verdict.

## 8. The PR and the ledger

**The PR.** The title follows the repository's style: `PAY-1.3: a refund reverses one
charge`. The body is a briefing a reviewer reads in a minute, written with the
`technical-writing` and `unslop` skills, under 40 lines, with no trailer. Its sections
come in this order, and a section with nothing to say is left out:
- `## Why`: the problem and the approach.
- `## What changed`: one to three bullets.
- `## Scope`: what it covers and what it leaves out.
- `## Decisions`: the calls the session made inside the branch (section 6).
- `## Blast radius`: who or what it touches, and why that is safe or risky.
- `## Verification`: the verdict, the model, the head SHA it covers, and what the
  verifier ran.
- `## Stack`: for a stacked PR, "Builds on #40. Merge #40 first."

**The ledger.** `<root>/.worktrees/ledger.tsv` is out of git and has one row per verdict:

```
date        session  repo  branch       head SHA  verdict     model
2026-10-20  S2       pay   S2/PAY-1.3   4f1c2e9…  PASS+NOTES  sonnet
```

A row covers one head of one repository. A new head on the branch voids the row, so a
fix after a verdict needs a new verdict. The session appends rows and never edits old
ones. The ledger answers "was this head verified", which neither the transcript nor
memory does.

## 9. Judge a session by what it pushes

The operator and the ops board judge a session in PR mode by its side effects: pushes to
its branch, ledger rows, and changes to its PRs. A session's own account of its progress
is not evidence. To see how a session is doing, read its branch and its PRs, and do not
prompt it to ask. The ops board (PR-7.5) shows each session's open PRs, each PR's
verdict for its current head (`unverified` when the ledger has none), and the last push
to its branch.

## 10. Merges and checkpoints

The operator merges each PR into `development` on GitHub. After a squash merge, the PR
above it in a stack gets `origin/development` merged in by its session before its next
push.

A session's checkpoint row reads `reached` once its PRs for the milestone are merged.
`CP<m>` works as today: it pins the submodules to merged commits on `development`,
commits the root, tags, and pushes.

A session's worktrees stay until the session ends for good. Then a preview removes them
with `git worktree remove`, never `--force`. `opsboard --worktrees` (PR-7.5) lists the
worktrees with no open work, and never deletes one.

## 11. An example

S2 in workspace `shop` runs `/pr on`, then `/autopilot PAY-1.4`.

For PAY-1.3, S2 shows the preview that makes `.worktrees/S2/pay`, and the operator
approves it. S2 builds the refund in three commits and pushes after each. It runs
`code-review` and fixes one finding, runs `no-comments`, and commits the module's
plan.md. It updates the root plan's queue without committing it.

S2 spawns a verifier on Sonnet with the head `4f1c2e9`. The verifier's `interrogate`
finds nothing to act on. It runs the refund against the local stack, and its verdict is
`PASS+NOTES` (one note on a log line). S2 writes the ledger row and shows the PR's
preview with `Review: code-review, 1 finding, fixed`. Autopilot approves it, the PR
opens as #41, and the session restarts.

PAY-1.4 builds on the refund, so S2 branches `S2/PAY-1.4` from `S2/PAY-1.3`. Its PR
says "Builds on #41. Merge #41 first." The operator merges #41 with a squash, so S2
merges `origin/development` into `S2/PAY-1.4` and pushes. Autopilot stops after PAY-1.4,
its target. Meanwhile S1 changed `pay` in its own worktree, and the operator settles the
overlap when the two PRs merge.
