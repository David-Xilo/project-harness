# Git: show, then run on approve

This applies in every repository. Claude runs git only after the operator approves a
preview, and every commit must look as if the operator made it. `tooling/install` links
this file to `~/.claude/git-rules.md`; import it from `~/.claude/CLAUDE.md` with a line
`@~/.claude/git-rules.md`, and keep personal lines (how your commits are signed) there.
The session-reset mod enforces these rules; the git-guard hook blocks the destructive
commands.

1. **Ready to commit.** When work is ready, say "Ready to commit" and show, per
   repository and in the order they will run:
   - the changed files (`git status --short`) and `git diff --stat`;
   - the exact commit message;
   - every command, word for word: `git add <explicit paths>` (never `-A` or `.`),
     `git commit -m "…"`, and any `push`, `tag -a`, `switch`, `merge` or `gh release`.

   Then stop and wait.
2. **"approve"** (or "commit", `/approve`, `/commit`) means run exactly those commands, in
   that order, and nothing else. A change to the list needs a new preview. An "approve"
   that carries a question or a condition ("approve, but is it just that one?", "approve
   but don't push") is not an approval: answer it, show the preview again if needed, and
   wait. **"request changes: …"** means make the changes and show a new preview. An
   approval covers only the preview it answers; it is never standing. A command that
   moves HEAD (`switch`, `checkout`, `stash`, `worktree add`) runs with a trailing
   `# approved`, which the git-guard hook requires.
3. **As the operator.** Use the git config as it is. Never `-c user.*`, `--author`,
   `GIT_AUTHOR_*` or `GIT_COMMITTER_*` variables, `--no-gpg-sign`, `--no-verify` or a
   `commit.gpgsign` override. When signing asks for a confirmation (a key agent prompt),
   tell the operator to confirm it. If signing or a hook fails, stop and report it; never
   retry unsigned or skip hooks.
4. **Message rules.** Follow the repository's style: a subject `<step ID or area>: <what
   changed>` (for example `ORC-6.1: …` or `docs: …`), short plain sentences, and an
   optional body. No Co-Authored-By line, no "Generated with" line and no other trailer.
   The same holds for PR bodies, tag notes and release notes.
5. **Safety.** Never force-push, and never rebase or rewrite a published branch. Never
   run `reset --hard`, `clean` or `restore` on the operator's work; the hook blocks them.
   In a workspace shared by several sessions, stage only paths in the repositories this
   session owns; a shared root file goes in whole, with its full diff in the preview.
   Never stage submodule pointers outside a checkpoint session.
6. **After running**, show the result per repository (`git log -1 --format='%h %an %G?
   %s'`, and any push or tag output).
   - In a workspace session started with `/session <ID>`, stop there and start no new
     work: once the commands succeed, the session is cleared and restarted with
     `/session <ID>` (the session-reset mod). "approve, then <note>" hands the note to the
     restarted session. The same restart follows when the operator commits and says
     "committed" or runs `/committed`. So record the step's result and next step in the
     docs before the preview.
   - Elsewhere, go on with the work.
