# Release commits

The commit of each repository that goes into the open milestone release
([milestone checkpoints](plan.md#milestone-checkpoints), root SD6). The `CP<m>` session
builds, verifies and tags exactly these commits, so work done ahead on `development` stays
out of the release.

- **Who writes.** The session holding a repository writes its row, and only that row. The
  `CP<m>` session writes the root row and starts the next section when the checkpoint
  ends.
- **When.** Once the session's scope is done and committed (after the operator's approve):
  the full commit hash (`git -C <repo> rev-parse HEAD`) and the date. Then the session
  sets its row in the [checkpoint status](handoffs.md#checkpoint-status) to `reached`. A
  repository with no change since the last release records its current commit too.
- **Not released.** A repository that has nothing for this milestone (for example one
  created for the next milestone) records `not in this release`.
- **A fix after recording** never rewrites `development`. The session previews these
  commands and runs them when the operator answers approve (root SD7):

  ```sh
  cd {{root}}/<repo>
  git switch -c release/<tag> <recorded commit> # approved
  # (or, if the branch exists: git switch release/<tag> # approved)
  # the fix, committed through the same preview
  git switch development # approved
  git merge --no-ff release/<tag>
  ```

  It then sets the row's commit to the branch tip and notes `fix on release/<tag>`.
- **At the run** `CP<m>` switches each repository to `release/<tag>` at its commit, checks
  and verifies, tags the branch tip and merges the branch back where it has commits
  `development` lacks ([rules](plan.md#milestone-checkpoints)).
- Earlier sections are removed when the checkpoint ends; the tags keep the commits.

## CP1 (M1, {{m1.version}})

| Repository | Session | Commit | Recorded |
|---|---|---|---|
{{#modules}}
| `{{repo}}` | `{{session}}` | | |
{{/modules}}
| root `{{dir}}` | `CP1` | | |
