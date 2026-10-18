# Session pickup

**You own the resume point. Read the prior trail; don't redo it.** This playbook is for
taking over a specific chat, branch or PR.

1. Find the prior trail: its transcript (`~/.claude/projects/<slug>/<uuid>.jsonl`, this
   project's folder only), a `desk:show-me-your-work` trail in `.audit/`, a pushed branch
   or open PR, or the repository's plan. Read the last messages first, then
   scan back for the decision points. Parse a long transcript in a subagent and keep the
   reduced timeline here (`guard-the-context-window`).
2. Rebuild the working state: the branch, what already landed (`git log`, `git diff`
   against the base), uncommitted edits, open todos, the decisions made. The prior trail
   is authoritative input; resist re-deriving it.
3. Diff done against pending. Name the resume point. Don't rerun the prior repro or redo
   finished work: a "let me verify from scratch" pass treats an authoritative trail as
   untrustworthy.
4. Route the rest to the matching playbook and pick the verdict: go on with the work,
   ship a finished recommendation, confirm or overturn a prior conclusion, or write up a
   failed run. This playbook ends here; the routed playbook owns the rest.
5. Check the inherited claims against the original goal on the real artifact
   (`prove-it-works`). A passing self-report from before is not the proof.

**Reply:** where the prior work stopped, what you inherited and what you redid (ideally
nothing), the resume point, and the outcome.
