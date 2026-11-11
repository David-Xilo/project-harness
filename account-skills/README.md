# Account skills

Four Claude Code skills, one `SKILL.md` each, no scripts and no reference files. Each
runs from a project's root folder and reads that project's `AGENTS.md` to learn where its
plan, its items waiting on the operator (the person the session works for), its decision
log, its check command and its git rules live. They name no project and keep no files
between runs: the plan rows, git and the desktop session list are the state.

| Skill | What it does |
|---|---|
| `/kickoff` | Reads the plan, asks one round of questions, starts each ready unit as a desktop session with its brief, then stays up as the hub. |
| `/decisions` | One table of everything only the operator can do, with full steps for what is due now; `apply` records their chat answers in the plans. |
| `/refactor` | Surveys hotspots into plan rows, or refactors one module: pin, subtract, reshape, guard, PR with numbers. |
| `/analyze-workflow` | Reads the Claude Code transcripts and names the three biggest time sinks with copy-paste fixes. |

Install or update them all, from the root of your checkout:

```sh
cd account-skills
./build.sh --install
```

The script copies each skill to `~/.claude/skills/<name>/` and replaces a skill of the same
name already there. Claude Code picks the change up without a restart.
