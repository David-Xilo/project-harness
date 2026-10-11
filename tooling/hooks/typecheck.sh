#!/usr/bin/env bash
# Typecheck gate. "track" (PostToolUse on Edit/Write) records the TypeScript project or Go
# package of each edited file. "gate" (Stop) checks those once at the end of the turn and,
# on a failure, makes Claude keep fixing: tsc -b (or the package's typecheck script, or
# tsc --noEmit -p) and go vet. After three failed stops in a row it lets the turn end.
set -u
mode=${1:-}
input=$(cat)
session=$(jq -r '.session_id // "none"' <<<"$input")
state=${XDG_RUNTIME_DIR:-/tmp}/claude-typecheck
list=$state/$session.list
tries=$state/$session.tries
max_tries=3

# Nearest ancestor of $1 that holds file $2, below $HOME.
nearest() {
  local dir=$1
  while [[ $dir == "$HOME"/* ]]; do
    [[ -e $dir/$2 ]] && { echo "$dir"; return; }
    dir=${dir%/*}
  done
}

if [[ $mode == track ]]; then
  file=$(jq -r '.tool_input.file_path // empty' <<<"$input")
  [[ -z $file || $file == */node_modules/* ]] && exit 0
  case $file in
    *.ts | *.tsx | *.mts | *.cts)
      root=$(nearest "${file%/*}" tsconfig.json)
      [[ -n $root ]] && entry="ts	$root"
      ;;
    *.go)
      root=$(nearest "${file%/*}" go.mod)
      dir=${file%/*}
      [[ -n $root ]] && entry="go	$root	.${dir#"$root"}"
      ;;
  esac
  if [[ -n ${entry:-} ]]; then
    mkdir -p "$state"
    grep -qxF "$entry" "$list" 2>/dev/null || echo "$entry" >>"$list"
  fi
  exit 0
fi

[[ $mode == gate && -s $list ]] || exit 0

failures=""
run() { # dir, label, command...
  local dir=$1 label=$2 out
  shift 2
  out=$(cd "$dir" && timeout 240 "$@" 2>&1) && return
  failures+="== $label failed in $dir"$'\n'"$(head -n 60 <<<"$out")"$'\n'
}

while IFS=$'\t' read -r kind root _; do
  [[ -d $root ]] || continue
  if [[ $kind == ts ]]; then
    if jq -e '.scripts.typecheck' "$root/package.json" >/dev/null 2>&1; then
      run "$root" "npm run typecheck" npm run -s typecheck
    elif grep -q '"references"' "$root/tsconfig.json"; then
      run "$root" "tsc -b" npx --no-install tsc -b
    else
      run "$root" "tsc --noEmit" npx --no-install tsc --noEmit -p .
    fi
  fi
done < <(grep '^ts' "$list" | sort -u)

while IFS= read -r root; do
  pkgs=()
  while IFS= read -r pkg; do
    compgen -G "$root/$pkg/*.go" >/dev/null && pkgs+=("$pkg")
  done < <(awk -F'\t' -v r="$root" '$1 == "go" && $2 == r { print $3 }' "$list" | sort -u)
  ((${#pkgs[@]})) && run "$root" "go vet ${pkgs[*]}" go vet "${pkgs[@]}"
done < <(awk -F'\t' '$1 == "go" { print $2 }' "$list" | sort -u)

if [[ -z $failures ]]; then
  rm -f "$list" "$tries"
  exit 0
fi

n=$(($(cat "$tries" 2>/dev/null || echo 0) + 1))
if ((n >= max_tries)); then
  rm -f "$list" "$tries"
  jq -n --arg m "typecheck gate: still failing after $max_tries tries; the turn ends with type errors." \
    '{systemMessage: $m}'
  exit 0
fi
echo "$n" >"$tries"
printf 'typecheck gate (try %d of %d): fix these before you finish, or say why they stay.\n%s' \
  "$n" "$max_tries" "$failures" >&2
exit 2
