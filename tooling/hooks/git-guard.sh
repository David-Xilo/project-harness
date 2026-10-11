#!/usr/bin/env bash
# Several sessions share one checkout, so commands that move HEAD or the index stay with
# the operator unless they ran through the "Ready to commit" preview (~/.claude/CLAUDE.md)
# and the operator answered approve: then the command carries a trailing "# approved".
# Commands that rewrite history or discard work stay blocked even when approved.
cmd=$(jq -r '.tool_input.command // empty')
g='git( -C [^ ]+)? '
if grep -Eq "${g}(clean|reset --hard|rebase|restore)" <<<"$cmd"; then
  echo "Blocked: this rewrites history or discards work. Ask the operator to run it: $cmd" >&2
  exit 2
fi
if grep -Eq "${g}(stash|checkout|switch|worktree add)" <<<"$cmd" && ! grep -Eq '# approved[[:space:]]*$' <<<"$cmd"; then
  echo "Blocked: shared checkout with other sessions. Show it in a Ready to commit preview and, after the operator approves, run it with a trailing '# approved': $cmd" >&2
  exit 2
fi
exit 0
