#!/usr/bin/env bash
# Keep the third-party skills in ~/.claude/skills equal to the commits pinned in sources.tsv.
# Usage: sync.sh --check | --install | --diff [skill] | --accept [skill...]
set -euo pipefail
shopt -s inherit_errexit
cd "$(dirname "$0")"

list=sources.tsv
dest="${SKILLS_DEST:-$HOME/.claude/skills}"
cache="${XDG_CACHE_HOME:-$HOME/.cache}/third-party-skills"
export GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND="ssh -oBatchMode=yes"

usage() {
  echo "usage: sync.sh --check | --install | --diff [skill] | --accept [skill...]" >&2
  exit 2
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Print the path of a clone of <url>: the one in $SKILL_CLONES when it has one, else a cached clone.
clone_of() {
  local url="$1" name
  name="$(basename "$url" .git)"
  if [[ -n "${SKILL_CLONES:-}" && -d "$SKILL_CLONES/$name/.git" ]]; then
    echo "$SKILL_CLONES/$name"
    return
  fi
  if [[ ! -d "$cache/$name/.git" ]]; then
    mkdir -p "$cache"
    git clone --quiet "$url" "$cache/$name" >&2
  fi
  echo "$cache/$name"
}

# Export <path> at <commit> from <repo> and print the folder that holds it.
export_at() {
  local repo="$1" commit="$2" path="$3" out
  git -C "$repo" cat-file -e "$commit^{commit}" 2>/dev/null || git -C "$repo" fetch --quiet origin
  out="$tmp/$(basename "$repo")-$commit"
  mkdir -p "$out"
  if ! git -C "$repo" archive "$commit" "$path" 2>/dev/null | tar -x -C "$out" 2>/dev/null || [[ ! -d "$out/$path" ]]; then
    echo "$path is not in $(basename "$repo") at ${commit:0:7}" >&2
    return 1
  fi
  echo "$out/$path"
}

# The newest upstream commit the clone knows about.
tip_of() {
  git -C "$1" rev-parse --verify --quiet origin/HEAD || git -C "$1" rev-parse HEAD
}

wanted() {
  local name="$1"
  shift
  [[ $# -eq 0 ]] && return 0
  local s
  for s in "$@"; do [[ "$s" == "$name" ]] && return 0; done
  return 1
}

install_one() {
  local name="$1" src="$2" commit="$3"
  [[ -d "$src" ]] || return 1
  rm -rf "${dest:?}/$name"
  mkdir -p "$dest"
  cp -r "$src" "$dest/$name"
  echo "installed $name @ ${commit:0:7}"
}

mode="${1:-}"
[[ -n "$mode" ]] && shift
case "$mode" in --check | --install | --diff | --accept) ;; *) usage ;; esac

failed=0
fetched=" "
while IFS=$'\t' read -r name url path commit; do
  [[ "$name" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "bad skill name in $list: $name" >&2; exit 1; }
  repo="$(clone_of "$url")"
  case "$mode" in
    --check)
      src="$(export_at "$repo" "$commit" "$path")"
      if [[ ! -d "$dest/$name" ]]; then
        echo "missing  $name"
        failed=1
      elif diff -rq "$src" "$dest/$name" >/dev/null; then
        echo "ok       $name @ ${commit:0:7}"
      else
        echo "differs  $name (installed copy is not ${commit:0:7})"
        failed=1
      fi
      ;;
    --install)
      src="$(export_at "$repo" "$commit" "$path")"
      install_one "$name" "$src" "$commit"
      ;;
    --diff)
      if [[ "$fetched" != *" $repo "* ]]; then
        git -C "$repo" fetch --quiet origin || echo "could not fetch $url; comparing with what the clone has" >&2
        fetched+="$repo "
      fi
      tip="$(tip_of "$repo")"
      if git -C "$repo" diff --quiet "$commit" "$tip" -- "$path"; then
        echo "unchanged  $name"
      elif [[ $# -gt 0 ]] && wanted "$name" "$@"; then
        git -C "$repo" --no-pager diff "$commit" "$tip" -- "$path"
      else
        echo "changed    $name (${commit:0:7} -> ${tip:0:7})"
        git -C "$repo" --no-pager diff --stat "$commit" "$tip" -- "$path"
      fi
      ;;
    --accept)
      wanted "$name" "$@" || continue
      tip="$(tip_of "$repo")"
      if git -C "$repo" diff --quiet "$commit" "$tip" -- "$path"; then
        echo "unchanged  $name"
        continue
      fi
      src="$(export_at "$repo" "$tip" "$path")"
      awk -v n="$name" -v c="$tip" 'BEGIN { FS = OFS = "\t" } $1 == n { $4 = c } { print }' "$list" >"$tmp/list"
      cat "$tmp/list" >"$list"
      install_one "$name" "$src" "$tip"
      ;;
  esac
done < <(grep -v -e '^#' -e '^$' "$list")
exit "$failed"
