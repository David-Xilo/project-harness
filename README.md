# project-harness

A workflow for building one system with several Claude Code sessions in parallel. The
operator owns the decisions; Claude does the rest, and runs git only after the operator
approves an exact preview.

A project is a root git repository with its modules as submodules. The root holds the
plan: milestones, tracks that each own some repositories, and the sessions that run them.
This repository ships the document templates for a new project and the tooling that
enforces the workflow: Claude Code mods, hooks, commands, skills and a few scripts.

**Status:** early, and the workflow still changes between versions. `main` is the latest
release; `development` is work in progress. What each release brings is in the
[CHANGELOG](CHANGELOG.md), and what comes next in the [plan](plan.md).

## Install

Needs Linux, [Claude Code](https://docs.claude.com/en/docs/claude-code), git, `gh`, `jq`,
Python 3.11+ and [gitleaks](https://github.com/gitleaks/gitleaks).

```sh
git clone --branch main https://github.com/David-Xilo/project-harness.git
cd project-harness
tooling/install
```

`tooling/install` links the tooling into `~/.claude` and `~/.local/bin`, and prints the
`settings.json` lines to merge by hand. Then add `@~/.claude/git-rules.md` to
`~/.claude/CLAUDE.md`. `tooling/install --check` says what is still missing.

## Use

Run `/new-project` in Claude Code. It asks the setup questions in one message and builds
the project's documents. Then open one terminal per session and run `/session S1`,
`/session S2`, and so on; `/ops` lists what waits on you. `/autopilot` lets a session
approve its own reviewed commits up to a step, and `/balance-sessions` says how many
sessions to run.

## More

- [WORKFLOW.md](WORKFLOW.md): how it all works.
- [AUTOPILOT.md](AUTOPILOT.md): sessions that commit on their own until a target.
- [SETUP.md](SETUP.md): setting up a project, step by step.
- [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [LICENSE](LICENSE) (MIT).
