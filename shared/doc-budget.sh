#!/usr/bin/env bash
# Fail when a plan file is over its size budget or still holds finished rows.
# Usage: doc-budget.sh [--keep-done | --done <regex>] <file>:<max KB>...
# Copy it into a project and call it from the project's check command.
set -euo pipefail

usage() {
  echo "usage: doc-budget.sh [--keep-done | --done <regex>] <file>:<max KB>..." >&2
  exit 2
}

# A finished row: a ticked checkbox, or a table cell that starts with "Done" ("Done when" is not one).
done_row='^[[:space:]]*[-*] \[[xX]\]|^\|(.*\|)?[[:space:]]*(\*\*)?Done([.:*]| \(|[[:space:]]*\|)'

while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --keep-done) done_row="" ;;
    --done)
      [[ $# -ge 2 ]] || usage
      done_row="$2"
      shift
      ;;
    *) usage ;;
  esac
  shift
done
[[ $# -gt 0 ]] || usage

failed=0
for arg in "$@"; do
  file="${arg%:*}"
  budget="${arg##*:}"
  [[ "$arg" == *:* && "$budget" =~ ^[1-9][0-9]*$ ]] || usage
  if [[ ! -f "$file" ]]; then
    echo "missing  $file"
    failed=1
    continue
  fi
  size=$((($(wc -c <"$file") + 1023) / 1024))
  if ((size > budget)); then
    echo "over     $file is $size KB, budget $budget KB"
    failed=1
  else
    echo "ok       $file is $size KB, budget $budget KB"
  fi
  [[ -n "$done_row" ]] || continue
  found="$(awk -v re="$done_row" '$0 ~ re { n++; if (!first) first = NR } END { if (n) print n, first }' "$file")"
  if [[ -n "$found" ]]; then
    echo "done     $file has finished rows: ${found% *}, the first on line ${found#* }"
    failed=1
  fi
done
exit "$failed"
