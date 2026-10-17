#!/usr/bin/env bash
# usage: log.sh <logfile> <phase> <decision> <why> <evidence> <result>
# Appends one row to a show-me-your-work decision trail (TSV). Writes the header on first
# use and stamps ts in UTC. A trail under a folder named .audit stays out of git: the first
# row writes .audit/.gitignore, so no repository's own .gitignore needs a line.
set -euo pipefail
if [ "$#" -ne 6 ]; then
  echo 'usage: log.sh <logfile> <phase> <decision> <why> <evidence> <result>' >&2
  exit 1
fi
log=$1
shift
dir=$(dirname "$log")
mkdir -p "$dir"
if [ "$(basename "$dir")" = .audit ] && [ ! -e "$dir/.gitignore" ]; then
  echo '*' >"$dir/.gitignore"
fi
# Append even the header: on a network mount -s can miss a log that exists, and then the
# cost is one stray header line, not the rows.
if [ ! -s "$log" ]; then
  printf 'ts\tphase\tdecision\twhy\tevidence\tresult\n' >>"$log"
fi
# Each cell stays on one line, trimmed, and a cell a spreadsheet would read as a formula
# (=, +, -, @) gets a leading quote, since evidence can be generated text such as a PR
# title. A harmless "-1" gets the quote too: telling it from "-cmd" is not worth the risk.
clean() {
  local v
  v=$(printf '%s' "$1" | tr '\t\n\r' '   ')
  v=${v#"${v%%[![:space:]]*}"}
  v=${v%"${v##*[![:space:]]}"}
  case $v in
    [=+@-]*) printf "'%s" "$v" ;;
    *) printf '%s' "$v" ;;
  esac
}
printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$(clean "$1")" "$(clean "$2")" "$(clean "$3")" "$(clean "$4")" "$(clean "$5")" >>"$log"
