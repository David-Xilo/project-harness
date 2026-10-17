---
name: correct
description: "Find the mistakes agents keep repeating in this repository and make each one impossible: architecture first, then types, then a check whose error names the fix, then a test, and docs last. Prove each check fails on a real past mistake. Use for /correct, and each time the operator corrects you for a mistake that was made before."
---

# Correct

The operator keeps correcting agents in this repository for the same mistakes. Change the
repository so the next agent can't make them.

Assume every contributor is an agent that sees only the files it opened, copies the
nearest example, and takes the shortest path that works. Design the repository so a
change that looks right from one file is right for the whole repository.

## Find the mistake classes

Read the record of past mistakes, then group them into classes. A class counts once it
has happened twice.

- **git:** recent commits, reverts, and fix-ups of the commit before (`git log`,
  `git log --grep`). Review comments on pull requests (`gh pr view <n> --comments`).
- **Instruction files:** CLAUDE.md, AGENTS.md (a workspace module's own), the git rules,
  and comments that explain a workaround.
- **The operator's corrections:** the auto memory's `feedback` files
  (`~/.claude/projects/<slug>/memory/`) hold corrections that were already written down. A
  correction that is there and happened again is a repeat. Transcripts at
  `~/.claude/projects/<slug>/*.jsonl` hold the rest. Grep them for the operator pushing
  back ("no", "don't", "I said", "again", "stop") and read only the matching turns.
  `<slug>` is the working directory with every character other than a letter or digit
  turned into "-". Read only this project's folder.
- **The commit gate:** `node <project-harness>/tooling/mods/session-reset/replay.mjs
  --list ~/.claude/projects/<slug>` replays this project's transcripts through
  session-reset and lists each approve that didn't restart, by cause. A cause that keeps
  coming back is a class. Its output holds private work, so keep it out of tracked files.

Send the transcript and replay reading to subagents (`sonnet`) and keep only their
findings: each class, two or more dated instances, and where each one is.

## Fix each class at the highest level that works

1. **Remove it with architecture.** Give each piece of state one owner and each task one
   supported way. Hide internals so the wrong import fails. Replace hand-synced lists
   with one source of truth. Delete old ways and dead code an agent would copy.
2. **Enforce it with types**, so the bad state can't be written. If bad code still
   compiles, add a check whose error names the file, type or function to use instead: a
   lint, a CI step, a hook (`tooling/hooks/`, the mods' gates) or a parser test. If the
   pattern is already common, fail only when a change adds more.
3. **Test the behaviour**, within the test budget (`principles`,
   `test-behavior-not-implementation`). Fix or delete any test that still passes when the
   behaviour it checks breaks, or that fails when only the internals change.
4. **Write docs or agent rules last**, only for judgment calls. Nothing fails when an
   agent skips them.

## Fix and prove

Fix the most frequent classes now, one commit each, each through its own preview (git
rules). Prove each new check fails on a real past mistake: replay the old commit, the
transcript's command or the instance's input, and show the failure in the preview. Run
the same command locally and in CI (`.github/workflows/ci.yml`). An exception goes on the
offending line with a reason, an expiry date and the operator's approval.

## Keep the rule table

Keep a table in the repository's agent instruction file (CLAUDE.md, or AGENTS.md where
the repository uses it) that pairs each rule with what enforces it:

| Rule | Enforced by |
|---|---|
| `<the rule, one line>` | `<the check, hook, type or test>`, or `judgment` |

When the operator corrects you, fix the mistake and add the rule. If the rule was already
there, or in a memory file, and nothing enforces it, that's a repeat: fix it at the
highest level in the same change. Drop a rule, and its memory file, once its mistake
can't happen.

**Reply:** each class with its evidence, the level you picked, and why a higher level
didn't work.

Adapted from pstack ([license](../LICENSE-pstack)).
