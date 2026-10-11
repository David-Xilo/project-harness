#!/usr/bin/env bash
# Read-only status of every session in the coordinated workspaces, before you open
# terminals: next step, runnable or blocked (and on what), uncommitted changes.
# Usage: session-sweep.sh [workspace ...]   (a name under `sp-config PROJECTS_DIR` or a path;
# default: every root in `sp-config ROOTS`). Uses Sonnet, Read tools only.
set -u
config="$(dirname "$(readlink -f "$0")")/sp-config"
base=$("$config" PROJECTS_DIR)
cfg=$("$config" ROOTS)
if (($# == 0)); then
  [[ -f $cfg ]] || { echo "No workspaces: pass them or list them in $cfg" >&2; exit 1; }
  mapfile -t roots < <(sed -e 's/[[:space:]]*#.*//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' "$cfg" | grep -v '^$')
  set -- "${roots[@]}"
fi
dirs=()
for ws; do [[ $ws == */* ]] && dirs+=("${ws/#\~/$HOME}") || dirs+=("$base/$ws"); done
set -- "${dirs[@]}"
out=$(mktemp -d)
# Ctrl-C stops the background sweeps and their claude runs too.
trap 'trap - INT TERM; kill 0 2>/dev/null; rm -rf "$out"; exit 130' INT TERM

sweep() {
  local dir=$1 n=$2 ws changes=""
  ws=$(basename "$dir")
  local repo
  while IFS= read -r repo; do
    repo=${repo%/.git}
    local st
    st=$(git -C "$repo" status --short 2>/dev/null | head -n 15)
    rel=${repo#"$dir"}; rel=${rel#/}
    [[ -n $st ]] && changes+="### ${rel:-.}"$'\n'"$st"$'\n'
  done < <(find "$dir" -maxdepth 3 -name .git -not -path '*/node_modules/*' | sort)
  (cd "$dir" && claude -p --model sonnet --tools "Read,Grep,Glob" --strict-mcp-config \
    --no-session-persistence "Status sweep of the $ws workspace. Do not edit anything.
Read plan.md (its session IDs section and the tracker rows), handoffs.md (checkpoint and
publish status, open rows) and operator.md. For each session ID print one line:
ID | next step (task ID) | runnable, or blocked on what (O<n>, a dated file, a service,
another session's handoff) | uncommitted changes in the repositories it writes.
Then one line: the operator tasks (O<n>) that would unblock the most sessions.
Uncommitted changes (git status --short per repository, '.' is the root):
${changes:-none}") >"$out/$n.txt" 2>&1
}

n=0; for dir; do sweep "$dir" "$n" & n=$((n + 1)); done
wait
n=0; for dir; do printf '== %s\n%s\n\n' "$(basename "$dir")" "$(cat "$out/$n.txt")"; n=$((n + 1)); done
rm -rf "$out"
