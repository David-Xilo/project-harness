# project-template

A workflow for building one system with several Claude Code sessions in parallel, where
the operator owns the decisions and the big picture and Claude does the rest.

A project is a **super project**: a root git repository whose modules are git
submodules. The root holds the plan: milestones with gates and acceptance criteria,
tracks that each own some repositories, and sessions that run the tracks in parallel. Each
session is the only writer of its repositories and coordinates with the others through a
few shared files. Requests go through handoffs, and tasks only the operator can do go into
a list of operator tasks. Each milestone ends in a checkpoint that runs acceptance and
tags a release. Claude runs git only after the operator approves an exact preview, and
commits as the operator.

This repository ships the document templates for a new project and the tooling that
enforces the workflow: Claude Code mods, hooks, commands and skills, plus a few scripts.
[WORKFLOW.md](WORKFLOW.md) explains every piece.

## Requirements

- Linux (macOS is untested), with [Claude Code](https://docs.claude.com/en/docs/claude-code).
- git, the GitHub CLI `gh` (logged in), `jq` and Python 3.11 or newer.
- [gitleaks](https://github.com/gitleaks/gitleaks), for `leak-check` and the pre-push hook
  `tooling/install` puts in this checkout.
- Optional: a commit signing key in your git config. Commits are made as you, with your
  git config as it is.

## Install

```sh
git clone https://github.com/<owner>/project-template-oss.git
cd project-template-oss
tooling/install          # links the tooling into ~/.claude and BIN_DIR (default ~/.local/bin)
```

`tooling/install` backs up anything it replaces, and running it again changes nothing.
It never edits `~/.claude/settings.json`: it prints the hooks and plugin dirs to merge
into it by hand. Then add this line to `~/.claude/CLAUDE.md`, with any personal git lines
(for example how your commits are signed) next to it:

```
@~/.claude/git-rules.md
```

The defaults put new projects in `~/projects` and keep the list of registered roots in
`~/.config/super-project/`. To change a default, copy
[tooling/config.example](tooling/config.example) to `~/.config/super-project/config` and
keep only the lines you change. `tooling/install --check` says what is still missing.

## Quick start

Open Claude Code anywhere and run `/new-project`. It asks every setup question in one
message, each with a recommended answer, and writes your answers to one file,
`project.toml`. `sp-new` renders every document from that file, so nothing is filled by
hand. Claude then follows [SETUP.md](SETUP.md):
1. It wires the tooling with `sp-claude-init`.
2. It shows the first commit.
3. It writes your one operator task, `O1`: create the repositories.

You may also write `project.toml` yourself from [the example](tooling/project.example.toml)
and run `/new-project <file>`.

After that, open one terminal per session and run `/session S1`, `/session S2`, and so
on. Each session works its queue and shows a Ready to commit preview after each step;
"approve" runs it. `/ops` lists what is waiting on you.

## What is here

| Path | What |
|---|---|
| [WORKFLOW.md](WORKFLOW.md) | How the workflow runs: global hooks, mods, commands and skills; IDs; the docs contract the tooling parses; the session, handoff, operator, checkpoint, rebalance and publish lifecycles |
| [SETUP.md](SETUP.md) | Steps for creating a workspace from one `project.toml` |
| [tooling/project.example.toml](tooling/project.example.toml) | Every value a new project needs, each key documented |
| [workspace/](workspace) | Root files: AGENTS, README, plan, handoffs, operator, release, acceptance, decisions, capabilities, future-steps, glossary, operations (optional), `.gitignore` |
| [module/](module) | Files for each module repository: AGENTS, plan, research, README |
| [tooling/](tooling) | The scripts (`bin/`), hooks, mods, commands, project skills, the git rules (`claude/git-rules.md`), the pre-push hook (`git-hooks/`), the config example and `install` |
| [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CHANGELOG.md](CHANGELOG.md), [LICENSE](LICENSE) | How to contribute and run the checks, how to report a vulnerability, what each release brings, and the MIT License |
| [.github/](.github) | CI (shellcheck, the tests, the mod tests and gitleaks) and Dependabot for the actions |

The templates use a small mustache subset (`{{key}}`, `{{#list}}…{{/list}}`) that only
`sp-new` fills; a finished workspace has none left ([SETUP.md](SETUP.md#changing-the-templates)).

## Updating

`sp-update` brings your roots, and with `--global` the installed tooling, to a newer
version of this repository. It updates the skills it placed in each root and lists the
template doc changes to merge by hand. When the workflow changes in a live workspace (a
new rule in its plan, a changed skill), bring it back here so the next project starts
from it.
