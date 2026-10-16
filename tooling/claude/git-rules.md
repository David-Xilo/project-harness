# Git: show, then run on approve

This applies in every repository. Claude runs git only after the operator approves a
preview, and every commit must look as if the operator made it. `tooling/install` links
this file to `~/.claude/git-rules.md`; import it from `~/.claude/CLAUDE.md` with a line
`@~/.claude/git-rules.md`, and keep personal lines (how your commits are signed) there.
The session-reset mod enforces these rules; the git-guard hook blocks the destructive
commands.

1. **Ready to commit.** Before it, run the `code-review` skill on the diff and fix what
   it finds, or say why a finding stays. When work is ready, say "Ready to commit" and
   show, per repository and in the order they will run:
   - the changed files (`git status --short`) and `git diff --stat`;
   - a `Review:` line: what `code-review` found and what was fixed (`Review: code-review,
     2 findings, both fixed`), or `Review: docs only, reread` when no code changed;
   - the exact commit message;
   - every command you plan to run, word for word, in one fenced code block tagged
     `commit`, one command per line: `git add <explicit paths>` (never `-A` or `.`),
     `git commit -m "…"`, and any `push`, `tag -a`, `switch`, `merge` or `gh release`.
     Pin each line to its repository: `git -C <absolute path> …`, `gh … --repo
     <owner>/<name>`, `push-all <absolute root>`; a command that must run inside its
     checkout (`gh release create --notes-from-tag`, which refuses `--repo`) as `cd
     <absolute path> && <command>`. No other `cd` or `&&`, no placeholders, and no
     comment but the `# approved` that rule 2 asks for. Reads (`git log -1`) may stand in
     the block but are not checked. Diffs, status and messages go in other blocks, which
     are never read as commands.

   ````
   ```commit
   git -C /home/me/work/acme/web add src/app.ts plan.md
   git -C /home/me/work/acme/web commit -m "WEB-2.1: the app shell"
   ```
   ````

   Then stop and wait. Run the block's lines one by one, as shown. A block that breaks
   these rules opens no preview: the session-reset mod says why in a toast, and an
   approve of it lets nothing run. A batch with no commit (a checkpoint's switches or
   tags) is shown the same way under a heading that starts with "Preview", with its
   `commit` block and no `Review:` line; the block, not the heading, makes it a preview.
2. **"approve"** (or "commit", `/approve`, `/commit`) means run those commands, in that
   order. Any preview counts, whatever its title (a checkpoint's batch of switches or
   tags too). In that turn the session-reset mod lets any other git or gh write run that
   is not forbidden (rules 3 and 5), so a small correction (a path, a command split in
   two) needs no new preview; say what changed in the result. A commit the preview did
   not show still needs the preview's `Review:` line. An "approve" that carries a
   question or a condition ("approve, but is it just that one?", "approve but don't
   push") is not an approval: answer it, show the preview again if needed, and wait. Nor
   is an "approve" of a preview that commits with no `Review:` line: review, then show it
   again. **"request changes: …"** means make the changes and show a new preview. An
   approval covers only the turn that answers it; it is never standing. A command that
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
   session owns. There, a session that does not own the root (`S<n>`, `publish-<repo>`)
   keeps the root docs (plan.md, handoffs.md, operator.md and the root's other `.md`
   files) current as the work goes and never stages them: the operator, the checkpoint
   session or the root's own session (`W`) commits the root in one commit. Push only when
   the step needs it.
   Never stage submodule pointers outside a checkpoint session.
6. **After running**, show the result per repository (`git log -1 --format='%h %an %G?
   %s'`, and any push or tag output).
   - In a workspace session started with `/session <ID>`, after a commit stop there and
     start no new work: once the commands succeed, the session is cleared and restarted
     with `/session <ID>` (the session-reset mod). "approve, then <note>" hands the note
     to the restarted session. The same restart follows when the operator commits and
     says "committed" or runs `/committed`. So record the step's result and next step in
     the docs before the preview. A batch with no commit (a checkpoint's switches or
     tags) keeps the session: go on.
   - Elsewhere, go on with the work.
