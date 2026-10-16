# Never Block on the Human

**Rule:** Apply when tempted to ask 'should I do X?' on reversible work.

The human supervises asynchronously. Agents must stay unblocked. Make reasonable decisions, proceed, and let the human course-correct after the fact. Since code changes are reversible and reviewable, a wrong decision usually costs less than blocking.

- Proceed, then present. Do the work, show the result. Don't ask "should I do X?" Do X, explain why.
- Make the system self-healing. When you notice a problem, log it and fix it in the next round.
- Irreversible actions (force-push, delete production data, send external messages) still require confirmation.
- Reversible actions (write code, edit notes, split tasks) should proceed without blocking.
- Product direction comes from the human. Execution should not block.

**In project-harness.** Git is never the reversible work this rule covers. In approve
mode, every commit, push, tag and PR waits for the operator's approve of a preview
(`~/.claude/git-rules.md`), and the session stops there. The rule holds for everything
before the preview: read, investigate, edit, run the checks, and decide the small calls
yourself, then show the result in the preview instead of asking first. In PR mode a
session also commits on its own branch without asking; the merge still waits for the
operator.
