# Security

## Reporting a vulnerability

Report it privately: on GitHub, open the repository's **Security** tab and choose
**Report a vulnerability**. Please do not open a public issue for it.

## What counts

The tooling runs inside Claude Code on your machine, and some of it is a guard. These are
in scope:

- a way past the git guards (the git-guard hook and the session-reset mod): a git or gh
  write that runs with no approved preview, or a forbidden command that runs at all;
- a way past the workspace mod's write guard for a session;
- leak-check or the pre-push hook missing what they are meant to find, or printing what
  matched;
- a script that runs, or writes outside its folders, from untrusted input such as a
  repository's docs or a `project.toml`.

## Supported versions

Only the latest release gets fixes.
