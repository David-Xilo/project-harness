# project-harness

Engineering skills for Claude Code, packaged as one plugin: `desk`. Use them to
understand code before you change it, design and verify changes, review diffs, and write
docs. They work in any project, in the CLI and in the Claude desktop app, and they
assume no particular workflow.

Until v0.2.0, this repository also held a harness for running several sessions in
parallel: mods, hooks, git rules and workspace templates. That is gone. The
[CHANGELOG](CHANGELOG.md) says what was removed, and git history keeps it.

## Install

Add this repository as a plugin marketplace, then install the plugin for your user, so
every project gets it:

```sh
claude plugin marketplace add David-Xilo/project-harness
claude plugin install desk@project-harness --scope user
```

To run the skills from a local checkout instead, pass its path to `marketplace add`.

Restart any open session, then type `/desk:` to list the skills.

## The skills

| Skill | Use it to |
|---|---|
| `/desk:rigor` | Run non-trivial work through a playbook (bug fix, feature, perf, refactoring, and more), verified on the real thing |
| `/desk:how`, `/desk:why` | Understand code before you change it, and the reasons behind it; ask `/desk:how` to teach you for a plain, layered explanation |
| `/desk:recall` | Pick up your recent work on a topic from your past chats, or (`/desk:recall this chat`) catch up on what changed here while you were away |
| `/desk:sharpen` | Restate the goal in your own words and frame the task before you start it |
| `/desk:principles` | Load the engineering rules before a design choice or before calling work done |
| `/desk:architect`, `/desk:arena` | Design a change from competing sketches on two models, and pick or merge the best |
| `/desk:figure-it-out` | Plan an auditable run when no narrower skill fits, such as a large migration you review after stepping away |
| `/desk:swarm` | Fan out parallel workers for coverage, races or exploration, and get one report back |
| `/desk:tdd` | Fix a bug test-first, within the test budget |
| `/desk:blast-radius` | Find what a change could break outside its diff |
| `/desk:interrogate` | Review a diff from subagents on other models |
| `/desk:code-cleanup` | Run a maintenance pass: comments, dead code, duplication, tests and a verdict on the design |
| `/desk:show-me-your-work` | Keep a log of each decision and its evidence during a long run, and check it at the end |
| `/desk:reflect` | Turn what went wrong in a chat into fixes for the project's skills and CLAUDE.md; `/desk:reflect correct` makes a mistake agents keep repeating impossible (architecture, types, a lint, then a test) |
| `/desk:create-verification-skill`, `/desk:maintain-verification-skill` | Give the project a skill that drives the real app to verify a change, and keep it true |
| `/desk:benchmark-checklist` | Vet a performance measurement before you report or act on it |
| `/desk:typescript-best-practices` | Write TypeScript with types that make bad states impossible |
| `/desk:no-comments` | Strip comments that restate the code, with the `desk:comment-sicko` agent |
| `/desk:technical-writing`, `/desk:unslop` | Write docs, commit messages and PR bodies |

Not sure which skill fits? Ask `/desk:rigor help`.

Most skills are manual-only (`disable-model-invocation: true`): they cost nothing until you
type them. `how`, `sharpen`, `blast-radius`, `tdd`, `principles`, `show-me-your-work`,
`no-comments`, `unslop` and `typescript-best-practices` also load on their own when a task
matches.

`kickoff`, `refactor` and `workflow-review` are account skills, not plugin skills. Their
source is in [account-skills/](account-skills/), and each runs as `/kickoff`, `/refactor` or
`/workflow-review`.

## More

- [CHANGELOG.md](CHANGELOG.md), [CONTRIBUTING.md](CONTRIBUTING.md),
  [SECURITY.md](SECURITY.md), [LICENSE](LICENSE) (MIT).
- Many skills are adapted from
  [pstack](https://github.com/cursor/plugins/tree/main/pstack) (MIT,
  [its license](desk/skills/LICENSE-pstack)).
