#!/usr/bin/env bash
# usage: tooling/tests/sp-claude-init/run.sh
# Runs sp-claude-init on a scratch root with a scratch config: the first run, a run again,
# an edited skill, and the lock from before the rename (project-template.lock), alone or
# next to project-harness.lock.
set -uo pipefail
here=$(dirname "$(readlink -f "$0")")
repo=$(realpath "$here/../../..")
init="$repo/tooling/bin/sp-claude-init"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fails=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }
check() { if eval "$2"; then ok "$1"; else bad "$1"; sed 's/^/     /' "$tmp/out"; fi; }
run() { "$init" "$root" >"$tmp/out" 2>&1; }
says() { grep -qF -- "$1" "$tmp/out"; }
hash() { sha256sum <"$1" | cut -d' ' -f1; }

# A scratch home: its own config, roots registry and git config.
export HOME="$tmp/home" XDG_CONFIG_HOME="$tmp/home/.config" GIT_CONFIG_NOSYSTEM=1
export GIT_CONFIG_GLOBAL="$tmp/home/.gitconfig"
mkdir -p "$XDG_CONFIG_HOME/super-project"
printf '[user]\n\tname = Test\n\temail = test@example.com\n[init]\n\tdefaultBranch = main\n' >"$GIT_CONFIG_GLOBAL"

root="$tmp/root"
git init -q "$root" && cd "$root" || exit 1
touch AGENTS.md plan.md handoffs.md operator.md
new=.claude/project-harness.lock old=.claude/project-template.lock
skill=.claude/skills/publish/SKILL.md

run
check "the first run writes project-harness.lock" "[ -f $new ] && [ ! -f $old ]"
check "it places the shipped skills" "[ -f $skill ] && grep -q ' $skill\$' $new"
check "it registers the root" "grep -qxF '$root' '$XDG_CONFIG_HOME/super-project/roots'"
check "it names project-harness" "says 'at project-harness' && grep -q 'project-harness placed' $new"

run
check "a second run changes nothing" "! says added && ! says updated && ! says moved"

# The lock from before the rename, with an edited skill.
mv $new $old
echo edited >>$skill
run
check "the old lock is read and moved" "[ -f $new ] && [ ! -f $old ] && says 'moved $old to $new'"
check "an edited skill is still kept" "says 'kept $skill' && grep -q edited $skill"
run
check "after the move nothing is moved again" "! says moved && [ ! -f $old ]"

# Both locks, the old one newer (an older version ran since): the old one is read.
skill2=.claude/skills/go-public/SKILL.md
cp $new $old
echo edited >>$skill2
sed -i "\\| $skill2\$|s|^file [0-9a-f]* |file $(hash $skill2) |" $old
touch -d '+1 min' $old
run
check "the newer old lock is read, so its known copy is updated" "says 'updated $skill2' && ! grep -q edited $skill2 && [ ! -f $old ]"

# Both locks, project-harness.lock newer: the old one is ignored and removed.
cp $new $old
echo edited >>$skill2
sed -i "\\| $skill2\$|s|^file [0-9a-f]* |file $(hash $skill2) |" $old
touch -d '-1 min' $old
run
check "the older old lock is ignored and removed" "says 'kept $skill2' && says moved && [ ! -f $old ]"

echo
[ $fails = 0 ] && echo "All checks pass." || echo "$fails failed."
exit $((fails > 0))
