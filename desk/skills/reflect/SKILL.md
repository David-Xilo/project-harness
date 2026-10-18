---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect or runs /desk:reflect.
disable-model-invocation: true
---

# Reflect

Mine the current conversation for durable learnings, then route them into skill edits.

Invoke when the user says "reflect" or "/desk:reflect". Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## 1. Locate the active transcript

Before fanning out, find this conversation's transcript in `~/.claude/projects/<slug>/`. The slug is the project path with every character other than a letter or digit changed to `-`, so `/home/you/my_proj` is `-home-you-my-proj`. Do not glob across `~/.claude/projects/*/`. That crosses project boundaries and reads private chats from unrelated projects.

```bash
ls -t ~/.claude/projects/<slug>/*.jsonl ~/.claude/projects/<slug>/*/subagents/*.jsonl 2>/dev/null | head -10
```

That covers the session (`<session>.jsonl`) and subagent (`<session>/subagents/<agent>.jsonl`) layouts. The newest `.jsonl` directly in the folder is usually the current session, but another session in the same folder can be newer. Grep the candidates for a distinctive phrase from the conversation's opening user prompt and take the file that holds it. If none matches, pass a tight digest of the session instead.

## 2. Spawn three reviewers in parallel

One message, three Agent tool calls, `subagent_type: "general-purpose"`. Reviewers need MCP access to look up the tickets, chat threads, and observability traces the transcript references, and `general-purpose` keeps the session's MCP servers. Each prompt template tells the reviewer not to modify files.

Pick each subagent's reasoning level for the job, per the Subagents section of the `desk:rigor` skill. The defaults:

| Lens | `model` | `effort` | Prompt template |
|---|---|---|---|
| Judgment | `opus` | `xhigh` | `references/judgment-reviewer.md` |
| Tooling | `sonnet` | `high` | `references/tooling-reviewer.md` |
| Divergent | `opus` | `xhigh` | `references/divergent-reviewer.md` |

The tooling lens runs on a different model so its blind spots differ from the other two.

Pass each template verbatim, substituting the transcript path or digest where marked. Reviewers return findings in the Agent response body.

## 3. Synthesize

One Agent call, `subagent_type: "general-purpose"`, `model: "opus"`, `effort: "xhigh"`. It spot-verifies citations through MCP, so it keeps the session's MCP servers. Pass `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked. It returns an Accepted / Rejected / Backlog list.

## 4. Structural enforcement check

Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Backlog. See the [encode-lessons-in-structure](../principles/references/encode-lessons-in-structure.md) principle.

## 5. Apply

Present the synthesizer's full Accepted / Rejected / Backlog output and wait for explicit approval before applying any Accepted edit. The user picks the subset and may redirect routings. Skill changes affect every future agent on the project. Do not auto-apply.

File each Backlog item to your team's devex or backlog tracker without waiting. Only the Accepted list waits for approval.

Edit only what the project owns. A skill that ships in a plugin (a `<plugin>:<name>` skill, such as `desk:how`) is not edited in place:

- A lesson that belongs to this project goes in the project's `.claude/skills/` (a new or existing project skill) or in its CLAUDE.md (AGENTS.md when no CLAUDE.md exists).
- A lesson that would change the desk plugin for every project (a desk skill's text, its agents, its manifest) is a `desk change:` row. Report it to the user as a suggested change. Do not edit the plugin.

Follow each approved row's Routing exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): the parent does it directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): draft it in the shape of the skill's siblings, load the skill in a fresh session, and run it once on real material. Iterate until it does what the row asked.
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): rewrite the description so its trigger words come first, then check in a fresh session that it fires on the prompt that missed it.
- `new skill: <kebab-name>`: draft it in the project's `.claude/skills/<kebab-name>/SKILL.md`, in the shape of the skills around it, and run it once on real material. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done.

## 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Suggested desk changes: `<desk skill or file>`. The change and why, one line each.
- Dropped: one line per rejected finding + reason from the synthesizer.

Adapted from pstack ([license](../LICENSE-pstack)).
