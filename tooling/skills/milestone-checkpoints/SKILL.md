---
name: milestone-checkpoints
description: Turn a coordinated workspace's checkpoints into one per milestone - a `CP<m>` session per milestone, release commits recorded in `release.md`, release branches that merge back and are never rebased, a checkpoint that is always open, and one ID per operator task. Use when the operator says "one checkpoint per milestone", "turn milestones into checkpoints", "checkpoints should follow the milestones", or runs /milestone-checkpoints.
argument-hint: [first milestone to cover, e.g. M5]
---

# Milestone checkpoints

Reshape a workspace so its sessions follow the milestone cycle: each session works up to
its part of the open milestone, records the commits that go into the release, and waits
for that milestone's checkpoint session. The template's `workspace/plan.md` "Milestone
checkpoints", `release.md`, `handoffs.md` and `operator.md` show the target shape.

## 1. Preconditions

- Run at a workspace root that has `AGENTS.md`, `plan.md` (milestones with releases, a
  "Session IDs" section and a checkpoint section), `handoffs.md` (a "Checkpoint status"
  table) and `operator.md`. Name anything missing and stop. A `prompt.md` is migrated
  first with `/balance-sessions` (its step 0).
- If a checkpoint row reads `running`, stop: a checkpoint is in progress.
- Work in plan mode until the operator approves the plan. Root files change here only
  because the operator asked.

## 2. Read

- `plan.md`: the milestones, their gates and releases; the tracker by milestone; the
  checkpoint section and table; the session table (which session writes which
  repositories); the versioning and release rules; the decisions table (or the root
  file the plan names for it, such as `decisions.md`).
- `handoffs.md` checkpoint status, `operator.md` entries, the plan's "Session rules", and
  `capabilities.md` or a README if present.
- Forward references to the old checkpoint names in root and module plans:
  `grep -rn 'CP[0-9]' --include=plan.md .` (history in `research.md` stays as written).
- The documented release procedure (for example an orchestration README "Release"
  section) and every repository's worktree state (`git status --porcelain`).

## 3. Ask the operator

One AskUserQuestion call, each question with a recommended first option:
- **Numbering.** Match the milestone (`CP5` closes M5; recommended, the number says which
  milestone) or sequential from 1.
- **After reaching.** Work ahead on next-milestone steps whose inputs and gates are met,
  with release commits recorded in `release.md` (recommended), or strict wait.
- **Old checkpoints.** Past ones stay as history rows; say where each planned
  non-milestone checkpoint folds in (usually the next milestone's).
- **Milestones without a release** (a decision-only review) get no checkpoint; their
  decision is recorded at the next one.
- **Operator tasks.** One ID per task (`O<n>`, "O<n> done"), recommended.

## 4. Change

Edit root files by exact replacement, never a rewrite. Other sessions may be writing the
same files: check `git status` and re-read a file just before editing it. Module plans get
only small forward-reference edits, and only on clean worktrees.

1. **Decision row** (next free ID): one checkpoint per milestone run by `CP<m>`; always
   one open; release commits in `release.md`; work ahead after `reached`; fixes on
   `release/<tag>` merged back, never rebased; no system patch releases between
   milestones; one ID per operator task. Note older decisions it amends in their
   "meaning today" text.
2. **Session table and Session IDs:** a `CP<m>` row (`CP5`–`CP9`-style range); shared
   files gain the session's rows in `release.md`; "Checkpoint first" says one checkpoint
   is always open, work on its scope first, may work ahead once `reached`, and no work
   while the checkpoint row reads `running` except a fix it asks for.
3. **The checkpoint section,** renamed "Milestone checkpoints" (update every
   `#…checkpoints` link in root files), with these rules:
   - **Always one open:** the current milestone's; each session's scope is its tracks'
     steps for that milestone, or `none` (commit the current step).
   - **Reaching it:** scope done and committed, needed handoffs delivered, release commit
     of each repository it holds written in `release.md`, row set to `reached`.
   - **Working ahead:** next-milestone steps whose inputs are ready; a step behind a gate
     this checkpoint passes still waits; commits made ahead are not in the release.
   - **A fix after recording:** on `release/<tag>` from the recorded commit, merged back
     with `git merge --no-ff`, the row moves to the branch tip; never rebase.
   - **Running it:** only when every session row reads `reached` and no publish row reads
     `running`; every repository switches to `release/<tag>` at its commit → build →
     verifiers → evidence → tracker, capabilities, submodule pins → tag the branch tip,
     fast-forward `main` → merge back where needed → back on `development`. A failing
     check names the repository; only its owning session fixes it, on that branch.
   - **Ending it:** mark it done, open the next (scopes, a new `release.md` section, every
     row `working`), then run the `balance-sessions` flow (drift, sync, queues, load,
     the sessions to run next) and tell the operator which sessions to start.
   - **No system patch releases between milestones;** presentation work ships in the next
     milestone release; libraries keep their own lines.
4. **Checkpoint table:** `Checkpoint | Milestone, gates | Scope per session | Release |
   Unblocks`, one row per milestone; past checkpoints stay as `(history)` rows.
5. **Tracker and order:** "→ CPn" arrows and "Unblocks CPn" cells use the new names; the
   cross-track order stays acyclic.
6. **Versioning:** patches only for libraries between milestones; branches: release
   commits on `release/<tag>`, `main` fast-forwards to the tagged tip, fixes merge back.
   Milestone "Release:" lines lose separate UI patches.
7. **`release.md` (new):** rules (who writes which row, when, `not in this release`, the
   fix flow with its commands, what `CP<m>` does with the rows) and a section for the open
   checkpoint: `Repository | Session | Commit | Recorded`, one row per repository, the
   root row written by `CP<m>`.
8. **`handoffs.md` checkpoint status:** session rows `working` / `reached` on the open
   checkpoint; the checkpoint row `idle` / `running`; `free` is gone.
9. **`operator.md`:** entry format `### O<n> <task>` = one task; fields **Opened**,
   **Session** (whom to tell), **Unblocks**, **When** (`now`, a date, `standing` or an
   event), **Steps** with fixed paths, **Status**. The operator says "O<n> done"; a
   standing task keeps its entry with the new date. Split dated multi-step entries; the
   CP section says the ops board shows the `CP<m>` task when every session has reached it.
10. **Session rules** (the plan's section): the shared checkpoint rule, and the `CP<m>`
    bullet (what it reads, the run's own rules: release branches, the stack order,
    ending with the `balance-sessions` flow).
11. **`AGENTS.md`** boundaries paragraph, the glossary entry, skills that name `CP`, and
    the release procedure document (release branches, `--no-ff` merge back).

## 5. Check

- Links and anchors in every changed file resolve. Run this from the workspace root with
  the changed files as arguments:

  ```sh
  python3 - "$@" <<'EOF'
  import re, os, sys
  def slug(h): return re.sub(r'[^\w\- ]', '', h.strip().lower()).replace(' ', '-')
  def anchors(f):
      a, fence = set(), False
      for l in open(f):
          if l.startswith('```'): fence = not fence
          if not fence and re.match(r'#{1,6} ', l): a.add(slug(re.sub(r'^#+ ', '', l)))
      return a
  bad = 0
  for f in sys.argv[1:]:
      t = re.sub(r'```.*?```', '', open(f).read(), flags=re.S)
      for m in re.finditer(r'\]\(([^)\s]+)\)', t):
          u = m.group(1)
          if re.match(r'(https?|mailto):', u): continue
          path, _, anc = u.partition('#')
          tgt = os.path.normpath(os.path.join(os.path.dirname(f), path)) if path else f
          if not os.path.exists(tgt): print(f, 'missing', u); bad += 1
          elif anc and tgt.endswith('.md') and anc not in anchors(tgt): print(f, 'anchor', u); bad += 1
  print('bad', bad)
  EOF
  ```

- Leftover forward references: grep the old checkpoint names, `` `CP` ``, `free (no
  checkpoint`, and old patch versions; only history and decision records may keep them.
- `opsboard --md <root>` shows `CP<m>: working …` and the operator task IDs.

## 6. Report

Say what changed in which file and what was checked. Then show the Ready to commit preview
per repository (`~/.claude/git-rules.md`) and run it when the operator answers
"approve". Tell the operator which running sessions to restart with `/session <ID>`.
