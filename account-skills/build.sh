#!/usr/bin/env bash
# Install the account skills: copy each <skill>/SKILL.md to ~/.claude/skills/<skill>/.
# Usage: build.sh --install
set -euo pipefail
cd "$(dirname "$0")"
[[ "${1:-}" == --install ]] || { echo "usage: build.sh --install" >&2; exit 2; }

dest="$HOME/.claude/skills"
for d in */; do
  s="${d%/}"
  [[ -f "$s/SKILL.md" ]] || continue
  rm -rf "$dest/$s"
  mkdir -p "$dest/$s"
  cp "$s/SKILL.md" "$dest/$s/SKILL.md"
  echo "installed $s"
done
