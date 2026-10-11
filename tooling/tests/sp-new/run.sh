#!/usr/bin/env bash
# usage: tooling/tests/sp-new/run.sh
# Renders the example and the minimal fixture into a scratch folder and runs SETUP's checks
# on them: no token or template note left, the docs contract headings, the ops board shows
# only O1, every link resolves (module links after a simulated O1), the same file renders
# the same files twice, and a bad file is refused with every mistake named.
set -uo pipefail
here=$(dirname "$(readlink -f "$0")")
repo=$(realpath "$here/../../..")
new="$repo/tooling/bin/sp-new"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fails=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }
check() { if eval "$2" >"$tmp/out" 2>&1; then ok "$1"; else bad "$1"; sed 's/^/     /' "$tmp/out"; fi; }

links() { # every local link and anchor in the given files resolves
  python3 - "$@" <<'PY'
import re, os, sys
def slug(h): return re.sub(r'[^\w\- ]', '', h.strip().lower()).replace(' ', '-')
def anchors(f):
    a, fence = set(), False
    for l in open(f):
        if l.startswith('```'): fence = not fence
        if not fence and re.match(r'#{1,6} ', l): a.add(slug(re.sub(r'^#+ ', '', l)))
    return a
bad = 0
for f in sys.argv[1:]:
    t = re.sub(r'```.*?```', '', open(f).read(), flags=re.S)
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
    t = re.sub(r'`[^`\n]*`', '', t)
    for m in re.finditer(r'\]\(([^)\s]+)\)', t):
        u = m.group(1)
        if re.match(r'(https?|mailto):', u) or '<' in u: continue
        path, _, anc = u.partition('#')
        tgt = os.path.normpath(os.path.join(os.path.dirname(f), path)) if path else f
        later = os.environ.get('LATER', '').split()
        if not os.path.exists(tgt) and path.split('/')[0] in later: continue
        if not os.path.exists(tgt): print(f, 'missing', u); bad += 1
        elif anc and tgt.endswith('.md') and anc not in anchors(tgt): print(f, 'anchor', u); bad += 1
sys.exit(1 if bad else 0)
PY
}

contract() { # SETUP step 5 on a fresh root $1
  local r=$1
  check "$2: no token or template note" "! grep -rn -e '{{' -e '<!-- template' '$r' --include='*.md' --include='.gitignore'"
  check "$2: Session IDs and Shared files" "grep -q '^### Session IDs' '$r/plan.md' && grep -q '^- \*\*Shared files' '$r/plan.md'"
  check "$2: status tables" "grep -q '^## Publish status' '$r/handoffs.md' && grep -q '^## Checkpoint status' '$r/handoffs.md'"
  check "$2: ops board shows only O1" "[ \"\$('$repo/tooling/bin/opsboard' --tsv '$r' | awk -F'\t' '\$1 == \"op\" { print \$9 }')\" = O1 ]"
  local later
  later=$(python3 -c "import tomllib,sys; print(' '.join(m['repo'] for m in tomllib.load(open(sys.argv[1],'rb'))['modules']))" "$r/.claude/project.toml")
  check "$2: root links resolve (module links after O1)" "cd '$r' && LATER='$later' links *.md"
}

modules() { # simulate O1, fill the modules, check every link
  local r=$1 repo_dir
  for repo_dir in $(python3 -c "import tomllib,sys; print(' '.join(m['repo'] for m in tomllib.load(open(sys.argv[1],'rb'))['modules']))" "$r/.claude/project.toml"); do
    git init -q "$r/$repo_dir" && echo "# $repo_dir" > "$r/$repo_dir/README.md"
  done
  check "$2: --modules fills each module" "'$new' --modules '$r'"
  check "$2: no token left in modules" "! grep -rn -e '{{' -e '<!-- template' '$r' --include='*.md'"
  check "$2: every link resolves" "cd '$r' && links \$(find . -name '*.md' -not -path './.git/*')"
  local first
  first=$(python3 -c "import tomllib,sys; print(tomllib.load(open(sys.argv[1],'rb'))['modules'][0]['repo'])" "$r/.claude/project.toml")
  echo "operator note" >> "$r/$first/plan.md"
  check "$2: --modules leaves a filled module alone" "'$new' --modules '$r' | grep -q 'left $first alone' && tail -1 '$r/$first/plan.md' | grep -q 'operator note'"
  check "$2: module AGENTS carries the root's common rules" "grep -q 'Build the smallest slice' '$r'/*/AGENTS.md"
}

# the example: two modules, two sessions, two milestones, a runtime, a future module
ex="$tmp/weatherdesk"
check "example: --check" "'$new' --check '$repo/tooling/project.example.toml'"
check "example: renders" "'$new' '$repo/tooling/project.example.toml' --root '$ex'"
contract "$ex" example
check "example: operations.md with a runtime" "[ -f '$ex/operations.md' ] && grep -q 'deskctl.sh' '$ex/AGENTS.md'"
check "example: workspace.json holds the runtime rule" "python3 -c 'import json,sys; r=json.load(open(sys.argv[1]))[\"runtime\"]; sys.exit(not (r[\"runners\"] == \"^(?:S2|CP\\\\d+)\$\" and r[\"scripts\"] == [\"deskctl.sh\"] and r[\"commitFirst\"][\"build\"]))' '$ex/.claude/workspace.json'"
check "example: file kept as the record" "cmp '$repo/tooling/project.example.toml' '$ex/.claude/project.toml'"
check "example: refuses an existing root" "! '$new' '$repo/tooling/project.example.toml' --root '$ex'"
mv "$ex" "$tmp/first" && "$new" "$repo/tooling/project.example.toml" --root "$ex" >/dev/null
check "example: renders the same twice" "diff -r '$tmp/first' '$ex'"
modules "$ex" example
# a later milestone's repository: refused while the module is still a future one, filled once moved
git init -q "$ex/weatherdesk-dashboard" && echo "# dashboard" > "$ex/weatherdesk-dashboard/README.md"
"$new" --modules "$ex" >"$tmp/mod" 2>&1; rc=$?
check "example: --modules names a future module whose repository exists" "[ $rc = 1 ] && grep -qF 'VIEW is still in [[future_modules]]' '$tmp/mod'"
python3 - "$ex/.claude/project.toml" <<'PY2'
import re, sys
p = sys.argv[1]; t = open(p).read()
t = re.sub(r'^(created_at|waits_for) = .*\n', '', t, flags=re.M).replace('[[future_modules', '[[modules')
t = t.replace('owns = "the dashboard page"\n', 'owns = "the dashboard page"\n' + ''.join(
    f'{k} = "{k}"\n' for k in ('description', 'purpose', 'never_does', 'checks', 'setup', 'exit_criteria'))
    + 'boundaries = ["b"]\ninvariants = ["i"]\n')
open(p, 'w').write(t)
PY2
check "example: a moved future module is filled, the rest left alone" "'$new' --modules '$ex' > '$tmp/mod' && grep -q 'filled weatherdesk-dashboard' '$tmp/mod' && ! grep -q 'filled weatherdesk-collector' '$tmp/mod' && grep -q 'VIEW-2.1' '$ex/weatherdesk-dashboard/plan.md'"

# the minimal file: one module, one milestone, no runtime, default sessions
mi="$tmp/tiny"
check "minimal: renders" "'$new' '$here/minimal.toml' --root '$mi'"
contract "$mi" minimal
check "minimal: no operations.md without a runtime" "[ ! -e '$mi/operations.md' ] && ! grep -q 'operations.md' '$mi/plan.md'"
check "minimal: no workspace.json without runtime scripts" "[ ! -e '$mi/.claude/workspace.json' ]"
check "minimal: default session per track" "grep -q '^| \`S1\` \*\*Tool\*\* | T1 Tool | \`tiny-tool-cli\` |' '$mi/plan.md'"
modules "$mi" minimal

# a bad file: refused, with each mistake named
"$new" --check "$here/bad.toml" >"$tmp/bad" 2>&1; rc=$?
check "bad: refused" "[ $rc = 1 ]"
check "bad: names the unknown key" "grep -qF 'project.colour: unknown key' '$tmp/bad'"
# with the shape right, every cross-reference mistake is named at once
sed '/^colour/d' "$here/bad.toml" > "$tmp/refs.toml"
"$new" --check "$tmp/refs.toml" >"$tmp/bad" 2>&1
for want in "no session holds T2" "ZZ-1.1 is not a step"; do
  check "bad: names '$want'" "grep -qF '$want' '$tmp/bad'"
done
# one-line and table-cell values
sed '/^colour/d; s/^owns = "o"/owns = "o | p"/; s/^title = "t"/title = "t\\nu"/' "$here/bad.toml" > "$tmp/cells.toml"
"$new" --check "$tmp/cells.toml" >"$tmp/bad" 2>&1
check "bad: names a | in a table cell" "grep -qF 'modules[1].owns: has a |' '$tmp/bad'"
check "bad: names a second line in a one-line value" "grep -qF 'milestones[1].title: should be one line' '$tmp/bad'"
# milestone order, future modules, and no error cascading from one bad ID or code
{ sed '/^colour/d' "$here/bad.toml"; cat <<'EOF'
[[milestones]]
id = "M2"
title = "t"
delivers = "d"
goal = "g"
capabilities = "c"
goals = ["g"]
gate = { name = "g", artifact = "a" }
[[milestones.acceptance]]
criterion = "c"
how = "h"
[[modules.steps]]
id = "AB-13"
title = "malformed"
[[modules.steps]]
id = "AB-1.4"
title = "waits on later work"
depends = ["AB-13", "AB-2.1"]
[[modules.steps]]
id = "AB-2.1"
title = "later"
[[future_modules]]
code = "Fu"
name = "F"
repo = "f"
owns = "o"
track = "T1"
created_at = "M2"
waits_for = "w"
[[future_modules.steps]]
id = "Fu-1.1"
title = "f"
[[future_modules]]
code = "EA"
name = "E"
repo = "e"
owns = "o"
track = "T1"
created_at = "M2"
waits_for = "w"
[[future_modules.steps]]
id = "EA-1.1"
title = "too early"
EOF
} > "$tmp/order.toml"
"$new" --check "$tmp/order.toml" >"$tmp/bad" 2>&1
check "bad: names a dependency on a later milestone" "grep -qF 'AB-1.4.depends: AB-2.1 is in a later milestone (M2)' '$tmp/bad'"
check "bad: names a future module's step before it is created" "grep -qF 'future_modules[2].steps: EA-1.1 before M2' '$tmp/bad'"
check "bad: names the malformed ID once" "[ \$(grep -c 'AB-13' '$tmp/bad') = 1 ]"
check "bad: names the bad code, not its steps" "grep -qF 'future_modules[1].code: Fu' '$tmp/bad' && ! grep -q 'Fu-1.1' '$tmp/bad'"
# with those fixed, the dependency cycle
sed '/^colour/d; s/, "ZZ-1.1"//; s/^tracks = \["T1"\]/tracks = ["T1", "T2"]/' "$here/bad.toml" > "$tmp/cyc.toml"
"$new" --check "$tmp/cyc.toml" >"$tmp/bad" 2>&1
check "bad: names the dependency cycle" "grep -qF 'dependency cycle AB-1.1 → AB-1.2 → AB-1.1' '$tmp/bad'"

echo; [ $fails = 0 ] && echo "all passed" || { echo "$fails failed"; exit 1; }
