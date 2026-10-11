#!/usr/bin/env bash
# usage: tooling/tests/leak-check/run.sh
# Runs leak-check and the pre-push hook on scratch repositories with a scratch config: hits
# in the tracked files, in a range of commits, in their messages and in the history; nothing
# that matched is printed; untracked files, blank denylist lines and commits outside the range
# do not count; a push that sends a hit is refused and one that does not goes through.
set -uo pipefail
here=$(dirname "$(readlink -f "$0")")
repo=$(realpath "$here/../../..")
lc="$repo/tooling/bin/leak-check"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fails=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }
check() { if eval "$2" >"$tmp/out" 2>&1; then ok "$1"; else bad "$1"; sed 's/^/     /' "$tmp/out"; fi; }

# A scratch home: its own config and denylist, and git with no signing.
export HOME="$tmp/home" XDG_CONFIG_HOME="$tmp/home/.config" GIT_CONFIG_NOSYSTEM=1
export GIT_CONFIG_GLOBAL="$tmp/home/.gitconfig"
mkdir -p "$XDG_CONFIG_HOME/super-project"
printf '[user]\n\tname = Test\n\temail = test@example.com\n[commit]\n\tgpgsign = false\n[tag]\n\tgpgsign = false\n[init]\n\tdefaultBranch = main\n' >"$GIT_CONFIG_GLOBAL"
deny="$XDG_CONFIG_HOME/super-project/private-strings.txt"
printf '# a comment\n\nAcme-Internal\nsecret.example\r\n' >"$deny"
echo "PRIVATE_STRINGS=$deny" >"$XDG_CONFIG_HOME/super-project/config"
# A token gitleaks knows, made here so this file holds none.
token="ghp_$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 36)"

w="$tmp/work"
git init -q "$w" && cd "$w" || exit 1
echo "hello" >README.md && git add README.md && git commit -qm "init"
run() { "$lc" "$@" >"$tmp/run" 2>&1; echo $? >"$tmp/code"; }
code() { [ "$(cat "$tmp/code")" = "$1" ]; }
says() { grep -qF -- "$1" "$tmp/run"; }
silent() { ! grep -qiF -e hook-only-name -e acme-internal -e secret.example -e "$token" "$tmp/run"; }

run
check "a clean tree passes" "code 0 && says 'no hits in the tracked files'"
check "blank and comment lines in the denylist match nothing" "code 0"

printf 'see acme-internal\nand SECRET.EXAMPLE\n' >untracked.md
run
check "an untracked file does not count" "code 0"

mkdir -p "docs/a b" && mv untracked.md "docs/a b/notes.md" && git add docs
run
check "a tracked file hits in any case, with its count of lines" "code 1 && says 'denylist' && says '2  docs/a b/notes.md'"
check "what matched is not printed" "silent"
git commit -qm "notes"

echo "key = $token" >config.txt && git add config.txt
run
check "gitleaks finds a token in the tracked files" "code 1 && says 'gitleaks' && says 'config.txt (github-pat)'"
check "the token is not printed" "silent"
git rm -q --cached config.txt && rm config.txt && git rm -qr docs && git commit -qm "drop notes"

run
check "the tree is clean again" "code 0"
run --history
check "--history finds the string a later commit removed" "code 1 && says ': docs/a b/notes.md'"

base=$(git rev-parse HEAD)
echo "fine" >ok.md && git add ok.md && git commit -qm "about Acme-Internal"
run "$base..HEAD"
check "a commit message hits" "code 1 && says 'message' && ! says 'ok.md' && silent"
run "HEAD~2..HEAD~1"
check "a hit outside the range does not count" "code 0"
git commit -q --amend -m "fine"
run "$base..HEAD"
check "a range with no hit passes" "code 0 && says 'no hits in 1 commits'"
echo "key = $token" >config.txt && git add config.txt && git commit -qm "key"
run "HEAD~1..HEAD"
check "gitleaks finds a token in a range, with the commit" "code 1 && says \"\$(git rev-parse --short=7 HEAD): config.txt (github-pat)\" && silent"
git reset -q --hard HEAD~1

echo "nothing to deny" >"$deny"
mv "$deny" "$deny.off"
run
check "with no denylist, gitleaks alone runs and says so" "code 0 && says 'no denylist at' && says 'gitleaks only'"
mv "$deny.off" "$deny"

# The pre-push hook, against a bare remote. The history above holds the first strings, so the
# hook checks a string of its own.
printf 'Hook-Only-Name\n' >"$deny"
git init -q --bare "$tmp/remote.git"
git remote add origin "$tmp/remote.git"
ln -s "$repo/tooling/git-hooks/pre-push" .git/hooks/pre-push
push() { git push -q "$@" >"$tmp/run" 2>&1; }
check "a first push of clean commits goes through" "push -u origin main"
echo "hook-only-name" >leak.md && git add leak.md && git commit -qm "leak"
check "a push that sends a hit is refused" "! push origin main && says 'leak.md' && says 'stopped the push'"
check "the remote did not move" "[ \"\$(git rev-parse origin/main)\" = \"\$(git ls-remote '$tmp/remote.git' refs/heads/main | cut -f1)\" ] && [ \"\$(git rev-parse origin/main)\" != \"\$(git rev-parse HEAD)\" ]"
git switch -q -c side
check "a new branch with a hit is refused" "! push origin side && says 'leak.md'"
git switch -q main && git reset -q --hard origin/main && git branch -q -D side
echo "fine" >more.md && git add more.md && git commit -qm "more"
check "a clean push after the fix goes through" "push origin main"
check "a delete sends nothing and goes through" "git push -q origin main:gone && push origin :gone"

echo
[ $fails = 0 ] && echo "All checks pass." || echo "$fails failed."
exit $((fails > 0))
