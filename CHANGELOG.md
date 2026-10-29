# Changelog

Each release is a milestone or a patch between milestones; its tag notes list what it
brings.

## Unreleased (v1.1.0)

The desk plugin drops from 31 skills to 23, and only 9 of them load on their own. The
version moves to 1.1.0 so `claude plugin update desk@project-harness` picks the change up.

- `desk:teach` is now teach mode inside `desk:how` ("teach me this").
- `desk:in-your-own-words` is now the first step of `desk:sharpen`.
- `desk:ketchup` is now `desk:recall this chat`.
- `desk:correct` is now `desk:reflect correct`.
- `desk:adopt` is retired: its one-off migration is done.
- `kickoff`, `refactor` and `workflow-review` leave the plugin. Their source moves to
  `account-skills/`, and the account copies (`/kickoff`, `/refactor`,
  `/workflow-review`) are the ones that load.
- `interrogate`, `rigor`, `code-cleanup`, `why`, `recall`, `technical-writing` and
  `benchmark-checklist` are manual-only (`disable-model-invocation: true`). Skills that
  call a manual-only skill now read its SKILL.md and follow it, because the Skill tool
  refuses it.
- `desk:interrogate` picks the most likely intent and says so, instead of asking, and its
  reviewers flag only gaps that affect correctness or the stated requirements.
- `desk:code-cleanup` simplifies with the built-in `/simplify` instead of the `rigor`
  Refactoring playbook.
- `architect` and `interrogate` set `effort: high`.
- `account-skills/` is the single source for all five account skills: `decisions` and
  `next` join `kickoff`, `refactor` and `workflow-review`. Their frontmatter matches the
  account copies (`name` and `description` only). `/decisions` reads each plan's "Waiting
  on David" and safehouse's Needs columns instead of the deleted `games/operator.md` and
  `safehouse/sessions.md`, writes `board/rows.json`, and leaves `kick-` rows alone. `/next`
  owns only `ready-` rows and reads only "Ready for Claude" where a plan has it.
  `workflow-review` keeps the account copy's text with the analyzer path in
  `account-skills/`.
- The five account skills name no project. Each project declares its plans, ready work,
  operator steps, decision log, work unit, hard lines, check and git route in a
  `## Operator contract` section of its root `AGENTS.md`
  ([account-skills/shared/operator-contract.md](account-skills/shared/operator-contract.md)), and the
  skills find projects by that heading at any depth under `~/Desktop/random/projects`.
  `account-skills/shared/projects.py` lists them with their contracts.
- The account skills are self-contained and name nothing in this repository: each upload
  carries its own scripts and references, built by `account-skills/build.sh`.
- `refactor` and `kickoff` no longer call desk skills: `refactor` carries what it used from
  them in its own `references/playbook.md`, and `kickoff` describes its read-only fan-out
  itself.
- The account skills link nothing outside this machine. The Operator Board, its sync and
  comment relay, and the claude.ai project-thread mode are gone; open items live in
  `operator/waiting.md`, and `/decisions apply` records answers David gives in chat.

## v1.0.0 (installed, not tagged)

The repository is now one Claude Code plugin, `desk`, and nothing else. The harness is
gone: the session-reset and workspace mods, the git-guard and typecheck hooks, the git
rules, `/session`, `/new-project`, `/operator-steps`, the ops board, the sp-* and publish
scripts, and the workspace and module templates. v0.2.0 is the last release with them.

- The plugin sits at `desk/`, and the marketplace manifest at the repository root.
- `desk:rigor` and `desk:code-cleanup` join the plugin, without the commit previews,
  sessions and autopilot steps.
- The skills that pointed at a missing `desk:desk` skill now point at `desk:rigor`.
- `desk:adopt` no longer needs `sp-claude-desktop` to run first.
- `automate-me` is dropped.
- `desk:kickoff` reads one project's plan, asks one round of questions, and starts the
  ready work in parallel: project threads through the coordinator, or `claude --bg -w`
  sessions on the desktop, each with a brief in `kickoff/<project>-<date>/` and a
  `kick-*` row on the Operator Board.
- `desk:refactor <project> [<module>]` runs a behaviour-preserving refactor of one module:
  hotspots and change coupling from git history (`scripts/hotspots.py`), per-stack survey
  tools (`references/stack-tools.md`: Go, Python/uv, Rust, TypeScript/Astro, Lean 4),
  pins, subtraction, boundary fixes, hotspot simplification, then guards in the gate with
  a ratchet. With a project alone it surveys every module and writes the top three into
  their plans.

## v0.2.0 (2026-10-14)

- `/autopilot [<step>] [--max N]` in a session: the session-reset mod approves its
  reviewed `git add` and `git commit` previews itself (every finding fixed, or kept with
  its reason), until the commit whose preview says `Step done: <step>`, the session's
  `reached` checkpoint row or N commits (100 by default). A question, any other command or
  a failure stops it for the operator; nothing is pushed. `/autopilot off` ends it, and
  the band shows the count and the target.
- The ops band reads a session's tracks from its ID, Track and Code cells only, so the
  bold labels of its work cell ("**CP3:**") are no longer taken for tracks.
- Every commit is reviewed first: a preview that commits carries a `Review:` line, and
  session-reset holds an approve of one without it. Each step ends with a cleanup of the
  session's own docs, including its tracks' queue cells in the root plan.
- session-reset takes any preview, whatever its title, and the operator's approve lets
  any git or gh write that is not forbidden run in that turn; a commit the preview did
  not show needs its `Review:` line. It restarts the session only after a commit, so a
  checkpoint's switches and tags keep it.
- The ops board shows each session: its state (reached, ready, blocked, idle), next step,
  how much is ready, what blocks it, its checkpoint row and its autopilot, in `opsboard`,
  `--md`, `--tsv` and the `/ops` pane.
- `/balance-sessions` sizes the sessions to the workload: how many to run for the next
  stretch and which on `/autopilot`, with a review of the decisions. Its drift check
  stays as a fallback and names the session that skipped its cleanup.

## v0.1.1 (2026-10-12)

- Developed in the open: this repository is now the development home. `development` is
  the working branch, `main` the latest release, and the plan is public.
- `publish-check [--snapshot] [<repo>]`: the local gates a repository passes before it
  goes public, one line each.
- `gh-harden <owner/repo> [--apply]`: reads, and sets, the GitHub settings of a public
  repository; the rulesets ship in `tooling/publish/rulesets/`.
- `tooling/publish/templates/`: the public files, a gitleaks workflow and Dependabot for
  any repository going public; `tooling/install --hook <repo>…` links the pre-push hook
  into it.
- `/go-public <repo>` plans a public release, in place or as a snapshot: the steps P1–P6
  with their gates, the records and the operator tasks. The `publish` skill works them,
  for a workspace module or a standalone repository.
- The workspace templates, WORKFLOW.md and SETUP.md follow the new publishing model.
  `PUBLISHED_DIR` and the `<repo>-oss` names are gone; an old `PUBLISHED_DIR` line in the
  config is ignored.
- session-reset: a note with an apostrophe in a preview's command block no longer hides
  the commands after it, so their approve runs them.
- Renamed `project-harness` (from `project-template`). `sp-claude-init` writes
  `.claude/project-harness.lock` and moves a root's `project-template.lock` on its next
  run; the `sp-*` commands and the `super-project` folders keep their names.

## v0.1.0 (2026-10-11)

- Document templates for a super project (`workspace/`) and its modules (`module/`).
- `/new-project` and `sp-new`: set up a project from one `project.toml`.
- Git rules: a "Ready to commit" preview, then the operator's approve. The session-reset
  mod enforces them and restarts the session after a commit.
- The workspace mod: a write guard per session, the runtime rule from
  `.claude/workspace.json`, and the ops band.
- The git-guard and typecheck hooks, `/session` and `/operator-steps`, the project skills.
- `opsboard`, `sp-claude-init`, `sp-update`, `sp-config`, the session sweep, `commit-all`
  and `push-all`.
- `tooling/install`, and `leak-check` with its pre-push hook.
