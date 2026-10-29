# Operator contract

The account skills (`/decisions`, `/next`, `/kickoff`, `/refactor`, `/workflow-review`)
name no project. Each project declares what they need in its own root `AGENTS.md`, in a
section headed exactly `## Operator contract`. That heading is how the skills find the
project.

## How a project is found

- Search the folder the skill runs from, at any depth, for an `AGENTS.md` with the
  heading, so the skill works from one project or from a folder holding many.
- Skip hidden folders, `node_modules`, and any folder that is a git worktree (its `.git`
  file points into a `/worktrees/` git dir).
- The outermost match is the project; modules inside it are not searched.
- The project's name is its folder's basename (`study/<name>` is `<name>`). It is the
  skill argument.
- What a skill keeps between runs goes in the project's `.operator/` folder
  (`operator-folder.md` next to this file).

`python3 -I <skill folder>/scripts/projects.py` prints every project at or under the
current folder with its fields as JSON; `projects.py <name>` prints one.

## Fields

Each field is one bullet, `- **<Field>:** <text>`, wrapped lines indented. Paths are from
the project folder. A skill that needs a field the project leaves out says so in its
reply and skips that part for the project.

| Field | Says | Read by |
|---|---|---|
| Plans | the files and sections to read before choosing work | `/kickoff` |
| Ready work | where work for Claude is listed, which rows count, in what order | `/next`, `/kickoff` |
| Waiting on David | where the steps only David can do are kept, and how each one's kind (decision, action, play, others) is told | `/decisions` |
| Decisions | where decisions are recorded, their ID series, and how a choice or a "steps done" note David gives in chat is written back | `/decisions apply`, `/kickoff` |
| Work unit | what one unit of work is, where its session opens, how it starts, how many run at once, and the locks to respect | `/next`, `/kickoff`, `/refactor` |
| Hard lines | the gates and limits no session crosses | `/kickoff`, `/refactor` |
| Check | the command that proves work is done, at the root and per module | `/next`, `/kickoff`, `/refactor` |
| Git | where commits go, how work lands, and the repositories to skip in git scans | every skill that commits or scans |

## Template

```markdown
## Operator contract

Read by the account skills (`/decisions`, `/next`, `/kickoff`, `/refactor`,
`/workflow-review`). Paths are from this folder.

- **Plans:** `plan.md` (Status, Next, Waiting on David).
- **Ready work:** `plan.md` `## Next`, in written order; a row is ready when what it
  waits on is done.
- **Waiting on David:** `plan.md` `## Waiting on David`. A question is a decision; an
  install, an account or a console step is an action.
- **Decisions:** `decisions.md` (`D<n>`). A pick: write `Decided <date>: <choice>` under
  the entry and remove it from "Waiting on David".
- **Work unit:** one row of `## Next`, one session at the root; one at a time.
- **Hard lines:** none beyond the rules above.
- **Check:** `make check`.
- **Git:** commit and push your own work on `development`.
```

Rules a project states elsewhere in its `AGENTS.md` still hold; the contract points at
them rather than repeating them.
