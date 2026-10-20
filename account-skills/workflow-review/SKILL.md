---
name: workflow-review
description: Review how Claude Code was used on this machine over the last days (permission prompts, denials, waits, retries, compactions, restarts, hook blocks), apply the safe fixes, and hand David the rest with full commands. Use for /workflow-review, "how am I using Claude Code", "cut my bottlenecks", or the weekday morning review.
---

# Workflow review

Measure where time went in David's Claude Code sessions, fix what a settings file can fix,
and give him the rest as Operator Board rows with every step written out. Runs every
weekday morning after `/decisions` and `/next`; also on demand.

## 1. Measure

Run the analyzer over the last 7 days (the morning run) or the window given as the
argument (`/workflow-review 30` reads 30 days). It only reads `~/.claude` and the
projects' `.claude` folders; it writes nothing there.

```sh
cd ~/Desktop/random/projects
python3 -I project-harness/account-skills/workflow-review/scripts/cc_review.py --days 7
```

It prints the paths of `workflow-review/review-<date>.md` and `.json` (also
`latest.md` / `latest.json`). Read the Markdown report whole. Read a session file under
`~/.claude/projects/<slug>/` only when a finding needs the surrounding conversation
(what was asked before a denial, why a command was retried). Never quote a transcript
beyond the line that proves the finding.

## 2. Decide what each signal means

Turn the report into findings, one line each, with the number that backs it. A signal
that fired once is noise; one that fires across sessions or costs minutes is a finding.

| Signal | Usually means | Fix that is safe to apply now |
|---|---|---|
| A read-only or check command prompted or was denied repeatedly | the allowlist is missing it | add the rule from the report's "Allow rules worth adding" table to that project's `.claude/settings.json` (`permissions.allow`); never add interpreters, shells, `npm run *`, `make *`, `uv run *`, `sudo`, `git push` wildcards |
| A write or push was denied | the session tried a step David keeps for himself | a one-line rule in the project's AGENTS.md (or CLAUDE.md when there is no AGENTS.md) under its existing rules section, saying what the session asks before doing |
| Many interrupted turns in one session, same correction each time | an instruction is missing or buried | the same one-line rule, in the module's AGENTS.md, phrased as the thing to do, not the thing to avoid |
| Compactions in a session | the context filled: long tool outputs, big instruction files, or one session doing several tasks | flag instruction files over 8 KB in the report; suggest one task per session; no automatic edit |
| Sessions restarted on the same task within hours | the first one died or got lost | report it; if the opening prompt says why (crash, "lost context"), say so |
| Stop-hook blocks, or Stop-hook timeouts in a session's wall time | the Stop hook runs the full checks on every stop | report how many minutes it took; a change to the hook is David's call, give him the exact edit |
| The same shell command run 3+ times in one session | a retry loop, or a check re-run after each edit | if it is a check, suggest the project's `make check` or test subset instead; report the loop |
| Minutes between Claude's last message and David's next prompt, with `AskUserQuestion` calls | the session parked on a question it could have defaulted | note which questions; suggest a default rule for AGENTS.md when the same question recurs |

## 3. Apply the safe fixes

Safe means reversible by deleting a line and visible in `git diff`:

- Allow rules into `<project>/.claude/settings.json` (create it with `{"permissions": {"allow": []}}` when missing). Keep existing keys and order, de-duplicate, never touch `deny` or `ask`.
- One-line rules into AGENTS.md / CLAUDE.md, in the style of the lines around them.
- Nothing in `~/.claude/settings.json`, no hook changes, no commits: David commits.

Say what was changed, file by file, in the reply.

## 4. Hand David the rest

Everything that only David can do becomes a board row and a steps block, exactly as the
`/decisions` skill writes them: code `WF-<date>-<n>`, project `claude-code`, kind
`decision` or `action`, when `now`, the steps numbered with the `cd` first and every
command in a fenced `sh` block, a "Done when" line, and for a decision the options with
the recommended one marked and the sentence to send back ("WF-2026-10-20-1 done").

Write those rows into `projects/board/rows.json` under the shared project folder
(`/mnt/project-files/` when it exists, else `~/Desktop/random/projects/`): replace the rows
whose id starts with `wf-` and leave every other row as it is. `/decisions --json`
writes the file fresh before this skill runs in the morning, so run after it, not
before.

## 5. Reply

Under fifteen lines: the three largest time sinks with their minutes, what was fixed
(file and rule), what is on the board for David. Then the link to the report file. No
table of every session; the report has it.

## Morning run

The weekday 08:00 desktop task runs `/decisions --json`, then `/next`, then
`/workflow-review`, then refreshes the Operator Board from `rows.json`. On the morning
run keep the reply to the lines above and skip anything already on the board from an
earlier day unless its number grew.
