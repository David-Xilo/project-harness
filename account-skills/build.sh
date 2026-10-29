#!/usr/bin/env bash
# Build each account skill as a self-contained folder and zip under dist/, ready to upload.
# Usage: build.sh [--install]   (--install also replaces ~/.claude/skills/<name>/ with the build)
set -euo pipefail
cd "$(dirname "$0")"

SKILLS=(decisions next kickoff refactor workflow-review)
USES_CONTRACT=(decisions next kickoff refactor)

rm -rf dist && mkdir dist
for s in "${SKILLS[@]}"; do
  cp -r "$s" "dist/$s"
  if [[ " ${USES_CONTRACT[*]} " == *" $s "* ]]; then
    mkdir -p "dist/$s/scripts" "dist/$s/references"
    cp shared/projects.py "dist/$s/scripts/"
    cp shared/operator-contract.md "dist/$s/references/"
  fi
  find "dist/$s" -name __pycache__ -prune -exec rm -rf {} +
  (cd dist && zip -qr "$s.zip" "$s")
  if [[ "${1:-}" == --install ]]; then
    rm -rf "$HOME/.claude/skills/$s"
    cp -r "dist/$s" "$HOME/.claude/skills/$s"
  fi
done
ls dist/*.zip
