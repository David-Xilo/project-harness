# Contributing

Issues and pull requests are welcome. For a large change, open an issue first. This
repository is exported from a private one, so a pull request that is taken lands as a
commit in the next export, with credit in the CHANGELOG, rather than as a merge.

Before you send a change, run the checks CI runs:

```sh
tooling/tests/sp-new/run.sh
tooling/tests/leak-check/run.sh
claude plugin test tooling/mods/session-reset
claude plugin test tooling/mods/workspace
shellcheck -S warning $(grep -lE '^#!.*\b(ba)?sh\b' tooling/install tooling/bin/* tooling/hooks/* tooling/git-hooks/* tooling/tests/*/*.sh)
tooling/bin/leak-check
```

Keep to these rules:

- No private names or paths in tracked files. Personal values belong in the local config
  ([tooling/config.example](tooling/config.example)).
- A change to a parsed file or heading updates [WORKFLOW.md](WORKFLOW.md) section 3 and its parsers in the
  same change.
- Commit subjects read `<area>: <what changed>`, in short plain sentences.

By contributing, you agree that your contribution is licensed under the
[MIT License](LICENSE).
