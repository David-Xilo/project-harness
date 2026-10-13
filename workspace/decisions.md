# Decisions

A reference file of the [root plan](plan.md). The plan is authoritative; this map says
where each system decision came from. Module decisions live in module plans and research
(`D<n>`). Root decisions are `SD<n>`, so they never clash with the session IDs `S<n>`.
Add a row with the next free ID; rewrite "Meaning today" in place when a later decision
supersedes one, and name the newer ID.

| IDs | Meaning today |
|---|---|
| SD1 | ({{date}}, workspace setup) One home per fact: status in the module plan's "Current state" and "Next", evidence in module `research.md`, order, gates and releases in the root plan, requests in [handoffs](handoffs.md), operator tasks in [operator.md](operator.md), release commits in [release.md](release.md), what works in [capabilities](capabilities.md) |
| SD2 | ({{date}}, workspace setup) [Tracks](plan.md#tracks-and-checkpoints): one writing track per repository; requests between tracks go through root [handoffs](handoffs.md); root files change only at checkpoints, or when the operator asks |
| SD3 | ({{date}}, workspace setup) At most four track sessions run at once, each holding one or more tracks; a request between tracks of one session needs no handoff row |
| SD4 | ({{date}}, workspace setup) Steps only the operator can do live in root [operator.md](operator.md), one section per track plus General, one ID per task (`O<n>`) with full paths, commands and web steps; the operator says "O<n> done" to the session the entry names |
| SD5 | ({{date}}, workspace setup) [Session IDs](plan.md#session-ids) `S1`–`S{{n}}`, `CP<m>` and `publish-<repo>`; `/session <ID>` starts each one from the root plan and handoffs.md |
| SD6 | ({{date}}, workspace setup) One checkpoint per milestone, run by its own session `CP<m>` ([rules](plan.md#milestone-checkpoints)). One is always open; each session works up to its scope, records its repositories' release commits in [release.md](release.md) and marks `reached`, then may work ahead. The checkpoint runs only when all have, and no one works meanwhile. A fix for a recorded release goes on `release/<tag>` from that commit and is merged back into `development` with `--no-ff`, never rebased |
| SD7 | ({{date}}, operator) Sessions run git after the operator's approve: a "Ready to commit" preview lists the files, message and exact commands per repository, and on "approve" the session runs them as the operator (their identity, signed, repository message style, no Co-Authored-By or other trailer). It covers commits, pushes, tags, release branches and GitHub releases; rebase, `reset --hard`, `clean` and `restore` stay with the operator. Rules in `~/.claude/git-rules.md`, which the global `~/.claude/CLAUDE.md` imports |
| SD8 | ({{date}}, workspace setup) The plan's [session rules](plan.md#session-rules) are the only session prompt (no `prompt.md`). `/balance-sessions` checks the plan for drift, reorders the queues and says which sessions to run next; `CP<m>` runs it when it opens the next checkpoint |
| SD9 | ({{date}}, workspace setup) [Releases and versions](plan.md#releases-and-versions): the system version is the milestone; libraries keep their own lines; no system patch releases between milestones |
| SD10 | ({{date}}, workspace setup) [Public release](plan.md#public-release): a module goes public under its own name and is developed in the open, in place when its history is clean or else as one audited snapshot in a new repository; `/go-public <repo>` plans it and its `publish-<repo>` session works the steps |
| SD11 | ({{date}}, workspace setup) IDs: milestones `M<m>`, gates `G<m>-<name>`, steps `<CODE>-<m>.<n>` (milestone `0` is maintenance), handoffs `H<n>`, operator tasks `O<n>`, root decisions `SD<n>`, module decisions `D<n>`. Published IDs are never renumbered or reused |
