# Third-party skills

Skills written by other people, installed unchanged into `~/.claude/skills/`. This folder
holds no skill text: [sources.tsv](sources.tsv) names each skill, its repository, its path
there and the commit it is pinned to, and [sync.sh](sync.sh) keeps the installed copies
equal to those commits.

| Skill | From | What it does |
|---|---|---|
| `socratic-tutor` | [janestreet/agent_skills](https://github.com/janestreet/agent_skills) | Teaches a topic by questions, with a skill map and a final assessment. |
| `security-audit` | [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) | Security guidance, or a full audit with a coverage ledger and checked findings. |
| `grill-me`, `grilling` | [mattpocock/skills](https://github.com/mattpocock/skills) | Questions you about a plan or design, one question at a time. |
| `diagnosing-bugs` | mattpocock/skills | A diagnosis loop for hard bugs and performance regressions. |
| `prototype` | mattpocock/skills | Builds a throwaway prototype to answer one design question. |
| `wizard` | mattpocock/skills | Writes an interactive script that walks a person through steps only they can do. |
| `handoff` | mattpocock/skills | Writes a handoff document for a fresh session. |
| `writing-for-agents` | mattpocock/skills | Rules for writing skills, `AGENTS.md` and `CLAUDE.md`. |

## Use

```sh
cd third-party-skills
./sync.sh --check            # is each installed copy the pinned commit?
./sync.sh --install          # install every skill at its pinned commit
./sync.sh --diff             # fetch, then list what changed upstream since each pin
./sync.sh --diff wizard      # the full upstream diff for one skill
./sync.sh --accept wizard    # move that pin to the fetched commit and install it
```

`--check` exits 1 when a copy is missing or differs. `--accept` with no name accepts every
changed skill. It never fetches, so it accepts only what the last `--diff` showed. Commit
`sources.tsv` after an accept.

A skill is text an agent follows with your permissions. Read the diff before you accept it.

## Where the repositories come from

Set `SKILL_CLONES` to a folder that already holds clones named after each repository, and
the script reads those. Without it, the script clones each repository once into
`~/.cache/third-party-skills/`.

## Add a skill

Add one line to `sources.tsv`, tab-separated: the skill's name, the repository URL, the
skill folder's path in that repository, and the full commit hash you reviewed. Then run
`./sync.sh --install`.
