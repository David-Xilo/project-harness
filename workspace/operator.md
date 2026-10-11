# Operator steps

What only the operator can do to unblock a track: supply a file, add a secret, make a
decision, or run a host or web action. No session can do these (root
[SD4](decisions.md)). Requests between sessions go to [handoffs.md](handoffs.md)
instead. Updated {{date}}.

- **Who writes.** The session holding a track writes that track's entries. A need that
  spans tracks goes under General, written by the session that needs it.
- **One ID, one task (root SD4).** Each entry `### O<n> <task>` is exactly one thing you
  finish, with the next free number. Numbers are never reused; the next free one is O2.
  A task with steps on different days is split into one entry per day. Each entry gives:
  - **Opened:** date and session/track.
  - **Session:** the session to tell, for example `S1`.
  - **Unblocks:** the steps, rows or checkpoints that wait on it.
  - **When:** `now`, the date of the action (`YYYY-MM-DD`) when it waits for a day,
    `standing` for a repeated task, or the event it waits for. The ops board shows `now`,
    the date (`now` from that day), `standing` or `when asked`. A missing field means
    `now`.
  - **Steps:** numbered, with absolute paths, exact commands and web navigation. Any file
    you save has a fixed path, so the session needs nothing more than the ID.
  - **Status:** `open`, `standing; last run <date>`, or `done <date>`.
- **Done.** Tell the session named in the entry "O<n> done" (for a decision: "O<n> done:
  <your choice>"). You may also set `done <date>` here. The session checks the result,
  records the evidence in its own plan and `research.md`, and deletes the entry. For a
  standing task it records the date as the last run and keeps the entry.
- **Commands** start with `cd {{root}}` and use paths relative to it. The operator saves
  downloads straight to their target path, so an entry names that path instead of a move
  from `~/Downloads`.
- Commits are not entries: each session shows a "Ready to commit" preview and runs it
  when you answer "approve" (root SD7).
- **Sessions.** Open a terminal at the root, run `claude` and type `/session <ID>`
  ([session IDs](plan.md#session-ids)); the same command resumes a session after a reset.
  `/balance-sessions` checks the plan against the work and says which sessions to run
  next (root SD8).

## General

### O1 Create the GitHub repositories and add the modules as submodules

- **Opened:** {{date}}, workspace setup.
- **Session:** `S1`
- **Unblocks:** every first step; `CP1`.
- **When:** now
- **Status:** open.

**Steps:**
1. Publish the root, which already has its first commit:

   ```sh
   cd {{root}}
   gh repo create {{owner}}/{{dir}} --private --source . --remote origin
   git push -u origin main development
   ```

2. Per module, create the private repository with a README, so it has a first commit,
   and make `development` its default branch:

   ```sh
   cd {{root}}
{{#modules}}

   R={{owner}}/{{repo}}
   gh repo create "$R" --private --add-readme --description "{{name}}: {{owns}} ({{code}})"
   SHA=$(gh api "repos/$R/git/ref/heads/main" -q .object.sha)
   gh api "repos/$R/git/refs" -f ref=refs/heads/development -f sha="$SHA"
   gh repo edit "$R" --default-branch development
{{/modules}}
   ```

3. Per module, add it as a submodule that tracks `development` and check it:

   ```sh
{{#modules}}
   git submodule add -b development git@github.com:{{owner}}/{{repo}}.git {{repo}}
   git config -f .gitmodules --get submodule.{{repo}}.branch   # development
   git -C {{repo}} branch --show-current                       # development
{{/modules}}
   ```

4. Commit and push the root (sessions never stage submodule pointers outside a
   checkpoint):

   ```sh
   git add .gitmodules{{#modules}} {{repo}}{{/modules}}
   git commit -m "docs: module submodules added (O1)"
   git push
   ```

5. Tell `S1` "O1 done". The session fills each repository from the template
   (`sp-new --modules {{root}}`) and shows its first commit there.

{{#tracks}}
## {{id}} {{track_name}}

Nothing open.

{{/tracks}}
## CP Checkpoint

Nothing open. One checkpoint per milestone is always open, now `CP1` (M1, {{m1.version}};
[rules](plan.md#milestone-checkpoints)). Each session records its release commits in
[release.md](release.md) and sets its row in the [checkpoint
status](handoffs.md#checkpoint-status) to `reached`; it may then work ahead. When every
`S1`–`S{{n}}` row reads `reached`, the ops board shows the task `CP1`: commit each
session's work, close the sessions and run `/session CP1`. It asks for your go-ahead and
gives you the branch, commit, tag and release commands ([rules](plan.md#session-rules)).
Start no other session while its row reads `running`.
