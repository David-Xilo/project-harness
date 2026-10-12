# Contributing

Issues and pull requests are welcome. For a large change, open an issue first.

- Branch from `development` and open the pull request against it. `main` only moves at a
  release.
- CI must pass. It runs the commands in [.github/workflows/ci.yml](.github/workflows/ci.yml);
  run the same ones locally before you push. `tooling/install` adds a pre-push hook that
  runs `leak-check`.
- A pull request is merged with a merge commit or squashed, never rebased.

Keep to these rules:

- No private names or paths in tracked files. Personal values belong in the local config
  ([tooling/config.example](tooling/config.example)).
- A change to a parsed file or heading updates [WORKFLOW.md](WORKFLOW.md) section 3 and
  its parsers in the same change.
- Commit subjects read `<area>: <what changed>`, in short plain sentences.

By contributing, you agree that your contribution is licensed under the
[MIT License](LICENSE).
