#!/usr/bin/env bash
# usage: tooling/tests/publish-check/run.sh
# Runs publish-check on scratch repositories with a scratch config: one that passes every
# gate, then one copy of it that fails each gate in turn; --snapshot, a stub zizmor, and a
# path that is not a repository. What leak-check matched is never printed.
set -uo pipefail
here=$(dirname "$(readlink -f "$0")")
repo=$(realpath "$here/../../..")
pc="$repo/tooling/bin/publish-check"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fails=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }
check() { if eval "$2" >"$tmp/out" 2>&1; then ok "$1"; else bad "$1"; sed 's/^/     /' "$tmp/run"; fi; }

# A scratch home: its own config and denylist, and git with no signing. A stub zizmor comes
# first on PATH; it prints $tmp/zizmor.json and exits with $tmp/zizmor.code.
export HOME="$tmp/home" XDG_CONFIG_HOME="$tmp/home/.config" GIT_CONFIG_NOSYSTEM=1
export GIT_CONFIG_GLOBAL="$tmp/home/.gitconfig"
mkdir -p "$XDG_CONFIG_HOME/super-project" "$tmp/stub"
printf '[user]\n\tname = Test\n\temail = test@example.com\n[commit]\n\tgpgsign = false\n[tag]\n\tgpgsign = false\n[init]\n\tdefaultBranch = main\n' >"$GIT_CONFIG_GLOBAL"
deny="$XDG_CONFIG_HOME/super-project/private-strings.txt"
printf 'Acme-Internal\n' >"$deny"
echo "PRIVATE_STRINGS=$deny" >"$XDG_CONFIG_HOME/super-project/config"
printf '#!/bin/sh\ncat "%s/zizmor.json"\nexit "$(cat "%s/zizmor.code")"\n' "$tmp" "$tmp" >"$tmp/stub/zizmor"
chmod +x "$tmp/stub/zizmor"
zz() { printf '%s\n' "$1" >"$tmp/zizmor.json"; echo "${2:-0}" >"$tmp/zizmor.code"; }
zz '[]'
nozizmor=$PATH
export PATH="$tmp/stub:$PATH"
sha=0123456789abcdef0123456789abcdef01234567

# The repository that passes: the public files, a hardened workflow, Dependabot, the hook,
# signing (set after the commits, which stay unsigned) and AGENTS.md with its section.
base="$tmp/base"
git init -q "$base" && cd "$base" || exit 1
for f in LICENSE README.md SECURITY.md CONTRIBUTING.md CHANGELOG.md; do echo "# $f" >"$f"; done
echo "*.tmp" >.gitignore
mkdir -p .github/workflows
cat >.github/workflows/ci.yml <<EOF
name: CI
on: push
permissions:
  contents: read
jobs:
  checks:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@$sha # v7
        with:
          persist-credentials: false
      - uses: ./.github/actions/local
      - uses: "docker://alpine:3"
      - run: tooling/bin/leak-check --history
EOF
printf 'version: 2\nupdates:\n  - package-ecosystem: "github-actions"\n    directory: /\n    schedule:\n      interval: weekly\n' >.github/dependabot.yml
printf '# Agents\n\n## Public repository\n\nEvery file is public.\n' >AGENTS.md
git add -A && git commit -qm "init"
ln -s "$repo/tooling/git-hooks/pre-push" .git/hooks/pre-push
git config commit.gpgsign true
git config user.signingkey "test-key"

w="$tmp/w"
fresh() { cd "$tmp" && rm -rf "$w" && cp -a "$base" "$w" && cd "$w" || exit 1; }
save() { git add -A && git -c commit.gpgsign=false commit -qm "${1:-change}"; }
run() { "$pc" "$@" >"$tmp/run" 2>&1; echo $? >"$tmp/code"; }
code() { [ "$(cat "$tmp/code")" = "$1" ]; }
says() { grep -qF -- "$1" "$tmp/run"; }
gate() { grep -qE "^$1 +[0-9] $2 " "$tmp/run"; } # gate ok|FAIL|warn <name>
only() { [ "$(grep -cE '^(FAIL|warn) ' "$tmp/run")" = 1 ] && gate FAIL "$1"; } # $1 fails, every other gate is ok

fresh
run
check "a hardened repository passes every gate" "code 0 && says 'every gate passes' && [ \$(grep -c '^ok ' '$tmp/run') = 8 ]"
check "the history is checked" "says 'no hits in 1 commits'"
run --snapshot
check "--snapshot skips the history" "code 0 && says 'history skipped (--snapshot)' && ! says 'commits'"
cd "$tmp" || exit 1
run "$w"
check "a path names the repository" "code 0 && says 'publish-check: $w'"
run "$w/.github"
check "a folder inside it names the same repository" "code 0 && says 'publish-check: $w'"
mkdir -p "$tmp/plain"
run "$tmp/plain"
check "a path that is not a repository cannot be checked" "code 2 && says 'not in a git repository'"
run "$w" "$w"
check "two repositories are refused" "code 2"

# 1 clean
fresh
echo "new" >notes.md
run
check "an untracked file fails clean, by name" "code 1 && only clean && says '?? notes.md'"
rm notes.md && echo "more" >>README.md
run
check "a changed file fails clean" "code 1 && only clean && says 'M README.md'"
git init -q "$tmp/empty"
run "$tmp/empty"
check "a repository with no commits fails clean" "code 1 && gate FAIL clean && says 'no commits yet'"

# 2 leaks
fresh
echo "see acme-internal" >notes.md && save
run
check "a private string in the files fails leaks, with its file" "code 1 && only leaks && says 'notes.md'"
check "what matched is not printed" "! grep -qi acme-internal '$tmp/run'"
git rm -q notes.md && save
run
check "a private string in the history fails leaks" "code 1 && only leaks && says ': notes.md'"
run --snapshot
check "--snapshot passes the same repository" "code 0"
mv "$deny" "$deny.off"
run --snapshot
check "with no denylist, leaks warns and passes" "code 0 && gate warn leaks && says 'gitleaks only'"
mv "$deny.off" "$deny"

# 3 files
fresh
git rm -q SECURITY.md && : >CHANGELOG.md && save
run
check "a missing and an empty public file fail files" "code 1 && only files && says 'missing: SECURITY.md' && says 'empty: CHANGELOG.md'"
mkdir -p .github && echo "# Security" >.github/SECURITY.md && echo "# Changes" >CHANGELOG.md && save
run
check ".github/SECURITY.md counts" "code 0"
fresh
echo "*.md" >.gitignore && git rm -q --cached README.md && save
run
check "an untracked public file fails files" "code 1 && only files && says 'missing: README.md'"

# 4 ci
fresh
git rm -q .github/workflows/ci.yml && save
run
check "no workflow fails ci" "code 1 && only ci && says 'no workflow in .github/workflows/'"
fresh
sed -i '/^permissions:/,/contents: read/d' .github/workflows/ci.yml && save
run
check "a workflow without top-level permissions fails ci" "code 1 && only ci && says 'ci.yml: no top-level permissions'"
fresh
printf '      - uses: actions/setup-node@v4\n      - uses: "actions/cache@main" # v4\n' >>.github/workflows/ci.yml && save
run
check "uses: not pinned to a SHA fail ci, with their count" "code 1 && only ci && says 'ci.yml: 2 actions not pinned'"
fresh
sed -i 's|tooling/bin/leak-check --history|echo leaks # leak-check|' .github/workflows/ci.yml && save
run
check "no step that runs gitleaks or leak-check fails ci" "code 1 && only ci && says 'no workflow step runs gitleaks'"
sed -i 's|echo leaks # leak-check|gitleaks git --redact .|' .github/workflows/ci.yml && save
run
check "a step that runs gitleaks passes" "code 0"
fresh
zz '[{"ident":"artipacked","locations":[{"symbolic":{"key":{"Local":{"given_path":".github/workflows/ci.yml"}}}}]},{"ident":"x","locations":[{"symbolic":{"key":{"Local":{"given_path":".github/workflows/ci.yml"}}}}]}]' 13
run
check "zizmor findings fail ci, counted per file" "code 1 && only ci && says 'zizmor: 2 findings in .github/workflows/ci.yml'"
zz 'fatal: no audit was performed' 1
run
check "a zizmor that fails cannot be checked" "code 2 && gate FAIL ci && says 'cannot check: zizmor failed (exit 1)'"
zz '[]'
if PATH=$nozizmor command -v zizmor >/dev/null; then
  ok "zizmor is installed here, so its absence is not tested"
else
  PATH=$nozizmor run
  check "with no zizmor, ci warns and passes" "code 0 && gate warn ci && says 'zizmor is not installed'"
fi

# 5 dependabot
fresh
git rm -q .github/dependabot.yml && save
run
check "no dependabot.yml fails dependabot" "code 1 && only dependabot"
fresh
sed -i 's/github-actions/npm/' .github/dependabot.yml && echo '# package-ecosystem: github-actions' >>.github/dependabot.yml && save
run
check "a dependabot.yml without github-actions fails" "code 1 && only dependabot && says 'does not cover github-actions'"

# 6 hook
fresh
rm .git/hooks/pre-push
run
check "no pre-push hook fails hook" "code 1 && only hook && says 'no pre-push hook at .git/hooks/pre-push'"
printf '#!/bin/sh\nexit 0\n' >.git/hooks/pre-push
run
check "another pre-push hook fails hook" "code 1 && only hook && says 'is not tooling/git-hooks/pre-push'"
git config core.hooksPath "$repo/tooling/git-hooks"
run
check "core.hooksPath naming tooling/git-hooks passes" "code 0"

# 7 signing
fresh
git config commit.gpgsign false
run
check "unsigned commits fail signing" "code 1 && only signing && says 'commit.gpgsign is not true'"
git config commit.gpgsign true && git config --unset user.signingkey
run
check "no signing key fails signing" "code 1 && only signing && says 'user.signingkey is not set'"

# 8 agents
fresh
sed -i 's/^## Public repository/## Public notes/' AGENTS.md && save
run
check "AGENTS.md without its section fails agents" "code 1 && only agents"
git rm -q AGENTS.md && save
run
check "no AGENTS.md passes" "code 0 && says 'no AGENTS.md'"

echo
[ $fails = 0 ] && echo "All checks pass." || echo "$fails failed."
exit $((fails > 0))
