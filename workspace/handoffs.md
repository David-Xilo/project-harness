# Handoffs between tracks

Requests between tracks ([track rules](plan.md#track-rules)). A track never edits another
track's repository; it asks here instead.

- **Open:** the requesting track adds a row with the next free `H` number. It names the
  owner track, the need, what it unblocks and how the requester will know it is done.
- **Acknowledge, deliver, close:** only the owner changes the status, in this order:
  `open` → `acknowledged` (planned in its own plan, with a step ID) → `delivered` (with
  the commit or evidence link) → `closed` (the requester confirmed). A row may also end
  `declined`, with the reason.
- **Read** this file at the start of every session and before picking the next step.
- **Edit only your own rows.** The requester edits what it opened; the owner edits the
  status column of rows addressed to it. Keep each row to one line; details live in the
  owner's plan.
- The checkpoint session (`CP<m>`) removes `closed` rows at each checkpoint; their
  evidence stays in the owners' research. IDs are never reused; the next free one is H1.

Tracks: {{tracks_line}}, CP Checkpoint ([tracks](plan.md#tracks-and-checkpoints)).
Sessions ([session IDs](plan.md#session-ids)): {{sessions_line}}, `CP<m>` holds CP for
milestone M*m* (`CP1` now); `publish-<repo>` releases a module marked public. A request
between two tracks of one session needs no row.

## Checkpoint status

Where each session stands toward the open milestone checkpoint
([rules](plan.md#milestone-checkpoints)); one is always open. Each session edits only its
own row. `S1`–`S{{n}}`: `working` (on its scope), `reached` (scope done, release commits
in [release.md](release.md); it may work ahead). The checkpoint session: `idle`, or
`running` (then `S1`–`S{{n}}` start no work, except a fix it asks for on a release
branch). Read it before every step.

| Session | Checkpoint | Status | Since |
|---|---|---|---|
{{#sessions}}
| `{{id}}` {{session_name}} | CP1 | working | {{date}} |
{{/sessions}}
| `CP1` Checkpoint | CP1 | idle | {{date}} |

## Publish status

One row per module marked public ([rules](plan.md#public-release)); the `go-public` skill
adds it. `publish-<repo>` edits only its own row: `planned`, `running` (no other session
works in that repository, and no checkpoint runs), `published <date>`.

| Repository | Status | Since |
|---|---|---|

## Rows

| ID | Opened | From → to | Need | Unblocks | Status |
|---|---|---|---|---|---|
