---
name: reflect
description: "Mine the current session's transcript for durable learnings with three reviewers on different models, then route each to an edit of an existing skill, a new skill, a memory file or the plan's backlog, applied only after the operator approves. Use when the operator says reflect, or at the end of a long session that hit corrections or friction."
---

# Reflect

Mine the current conversation for durable learnings, then route them into skill edits.

Skip it when the conversation is trivial, off-topic, or already covered by a skill the
session followed correctly. One-offs are not learnings.

## 1. Find this session's transcript

Transcripts live at `~/.claude/projects/<slug>/<uuid>.jsonl`, where `<slug>` is the
working directory with each "/" turned into "-"; subagent transcripts sit under
`<uuid>/subagents/`. Read only this project's folder: other folders hold other projects'
private chats.

```bash
ls -t ~/.claude/projects/<slug>/*.jsonl | head -10
```

In a workspace several sessions write here at once, so the newest file is not always this
one. Grep the candidates for a distinctive phrase from this conversation (the opening
request, an error you hit) and take the file that holds it. If none matches, write a
tight digest of the session instead.

## 2. Spawn three reviewers in parallel

One message, three Agent tool calls, `subagent_type: "general-purpose"`. Tell each that
it is read-only: it reads, greps, runs read-only commands and looks up what the
transcript references through the MCP tools present, and it edits no file and runs no git
write. The models differ so the lenses don't share blind spots:

| Lens | Model | Prompt template |
|---|---|---|
| Judgment | `opus` | `references/judgment-reviewer.md` |
| Tooling | `sonnet` | `references/tooling-reviewer.md` |
| Divergent | `fable` | `references/divergent-reviewer.md` |

Pass each template as written, with the transcript path or the digest where marked.

## 3. Synthesize

One Agent call on `opus`, `subagent_type: "general-purpose"`, read-only like the
reviewers. Pass `references/synthesizer.md` with each reviewer's full output where
marked. It returns an Accepted / Rejected / Backlog list.

## 4. Check for a structural fix

Move to Backlog any Accepted row that a lint, script, hook, type or runtime check would
enforce better than prose (the `principles` skill, `encode-lessons-in-structure`). The
`correct` skill takes those.

## 5. Apply

Show the synthesizer's full Accepted / Rejected / Backlog output and wait for the
operator's approval before applying any Accepted row. The operator picks the rows and may
redirect a routing. A skill edit changes every future session, so never apply one on your
own.

Add each Backlog item to the plan (plan.md) as an open item in the track that owns it,
without waiting. Only the Accepted list waits.

Edit the source, not the link: a skill under `~/.claude/skills/` that links into
project-harness is edited in `tooling/global-skills/<name>/`, and a workspace's
`.claude/skills/<name>/` copied by `sp-claude-init` is edited in project-harness's
`tooling/skills/<name>/`. Then follow each approved row's routing:

- **A small edit** to an existing skill (a bullet, a tighter sentence, a stale fact): make
  it directly.
- **A larger edit** (a new section, a new table, more than about ten lines): draft it in
  the shape of the skill's siblings, load the skill in a fresh session, and run it once on
  real material.
- **`tune description: <skill path>`** (the skill exists but didn't fire when it should
  have): rewrite the description so its trigger words come first.
- **`new skill: <name>`**: draft it like its siblings in the folder it belongs to, and run
  `tooling/install` so it is linked.
- **`memory: <name>`**: write or update the memory file (`feedback` or `user`, with its
  why and how to apply) and its line in MEMORY.md.

The edits ship through a normal commit preview (git rules). A skill change that is code
or a script gets `code-review` first.

## 6. Summarize

A short list, no preamble:

- Edits applied: `<skill path>`, one line each on what changed.
- New skills: `<skill path>`, one line each.
- Memory: `<file>`, one line each.
- Backlog added to the plan: `<item>` (`<track>`), one line each.
- Dropped: one line per rejected finding, with the synthesizer's reason.

Adapted from pstack ([license](../LICENSE-pstack)).
