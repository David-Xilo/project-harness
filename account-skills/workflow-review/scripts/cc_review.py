#!/usr/bin/env python3
"""Measure how Claude Code is used on this machine and where time is lost.

Reads the session transcripts under ~/.claude/projects (one JSONL per session, plus
subagent transcripts), the prompt history and the permission settings of the user and of
each project. Writes a Markdown report and a JSON file with the same facts for a skill
to act on. Standard library only, read-only: nothing under ~/.claude is changed.

    python3 -I cc_review.py --days 7 --out ~/Desktop/random/projects/workflow-review

Signals, per session and summed over the window:

- permission denials (a tool call David rejected) and the seconds he spent answering them
- likely permission waits: a non-shell tool whose result arrived late, or a shell command
  that took very long, so a prompt probably sat waiting
- interrupted turns, context compactions, tool errors, repeated identical commands
- sessions restarted on the same task (same project, soon after, same opening prompt)
- Stop-hook blocks (the ikarus `stop-checks.py` reason text)
- shell commands that could be allowlisted: run often, read-only, not auto-allowed and
  not already in a settings file
"""

import argparse
import collections
import datetime as dt
import json
import os
import re
import shlex
import sys

HOME = os.path.expanduser("~")

DENIAL_MARKERS = (
    "The user doesn't want to proceed with this tool use",
    "The user doesn't want to take this action",
)
QUESTION_TOOLS = {"AskUserQuestion", "ExitPlanMode"}
INTERRUPT_MARKER = "[Request interrupted by user"
STOP_HOOK_MARKERS = ("Stop hook", "stop hook", "The fast checks of the changed packages failed")

# Tools whose latency is never a prompt wait on their own (they run long by nature).
LONG_RUNNING_TOOLS = {"Bash", "Agent", "Task", "WebFetch", "WebSearch", "Monitor", "Workflow"}
# A non-shell tool answered later than this most likely sat on a permission prompt.
PROMPT_WAIT_SECONDS = 15
# A shell command answered later than this either ran long or sat on a prompt.
SLOW_BASH_SECONDS = 120
# A user reply this long after Claude's last message counts as a wait, not as being away.
REPLY_WAIT_CAP_SECONDS = 4 * 3600
# Gaps between records longer than this are not counted as active session time.
ACTIVE_GAP_SECONDS = 30 * 60

# Claude Code never prompts for these (any arguments). Source: readOnlyValidation.ts.
AUTO_ALLOWED_ANY = {
    "cal", "uptime", "cat", "head", "tail", "wc", "stat", "strings", "hexdump", "od", "nl",
    "id", "uname", "free", "df", "du", "locale", "groups", "nproc", "basename", "dirname",
    "realpath", "cut", "paste", "tr", "column", "tac", "rev", "fold", "expand", "unexpand",
    "fmt", "comm", "cmp", "numfmt", "readlink", "diff", "true", "false", "sleep", "which",
    "type", "expr", "seq", "tsort", "pr", "echo", "ls", "cd",
    # validated with safe flags
    "xargs", "file", "sed", "sort", "man", "help", "netstat", "ps", "base64", "grep",
    "egrep", "fgrep", "sha256sum", "sha1sum", "md5sum", "tree", "date", "hostname", "lsof",
    "pgrep", "tput", "ss", "fd", "fdfind", "rg", "jq", "uniq", "history", "arch",
    "ifconfig", "find", "printf", "test", "pwd", "whoami", "alias",
}
AUTO_ALLOWED_SUB = {
    "git": {"status", "log", "diff", "show", "blame", "branch", "tag", "remote", "ls-files",
            "ls-remote", "rev-parse", "describe", "reflog", "shortlog", "cat-file",
            "for-each-ref", "worktree", "stash", "config"},
    "gh": {"pr", "issue", "run", "workflow", "repo", "release", "api", "auth"},
    "docker": {"ps", "images", "logs", "inspect"},
}
# gh/git subcommands above are only auto-allowed for their read-only verbs.
AUTO_ALLOWED_VERBS = {
    ("git", "worktree"): {"list"}, ("git", "stash"): {"list"}, ("git", "config"): {"--get"},
    ("gh", "pr"): {"view", "list", "diff", "checks", "status"},
    ("gh", "issue"): {"view", "list", "status"},
    ("gh", "run"): {"view", "list"}, ("gh", "workflow"): {"view", "list"},
    ("gh", "repo"): {"view"}, ("gh", "release"): {"view", "list"},
    ("gh", "auth"): {"status"},
}

# Read-only or side-effect-free checks worth an allow rule when they recur. Each entry is
# (command, subcommand or None) -> the rule to add. Interpreters, shells, package runners
# and task-runner wildcards are deliberately absent: they would allow arbitrary code.
ALLOWLISTABLE = {
    ("cargo", "check"): "Bash(cargo check:*)",
    ("cargo", "clippy"): "Bash(cargo clippy:*)",
    ("cargo", "test"): "Bash(cargo test:*)",

    ("cargo", "build"): "Bash(cargo build:*)",
    ("go", "test"): "Bash(go test:*)",
    ("go", "vet"): "Bash(go vet:*)",
    ("go", "build"): "Bash(go build:*)",
    ("gofmt", None): "Bash(gofmt -l:*)",
    ("golangci-lint", "run"): "Bash(golangci-lint run:*)",
    ("make", "check"): "Bash(make check)",
    ("make", "test"): "Bash(make test)",
    ("make", "lint"): "Bash(make lint)",
    ("make", "type"): "Bash(make type)",
    ("npm", "test"): "Bash(npm test)",
    ("npx", "tsc"): "Bash(npx tsc:*)",
    ("npx", "vitest"): "Bash(npx vitest:*)",
    ("npx", "playwright"): "Bash(npx playwright test:*)",
    ("npx", "biome"): "Bash(npx biome check:*)",
    ("lake", "build"): "Bash(lake build:*)",
    ("uv", "run"): None,  # handled by the uv table below
    ("ruff", None): "Bash(ruff check:*)",
    ("mypy", None): "Bash(mypy:*)",
    ("pytest", None): "Bash(pytest:*)",
    ("git", "add"): "Bash(git add:*)",
    ("git", "commit"): "Bash(git commit:*)",
    ("git", "fetch"): "Bash(git fetch:*)",
    ("git", "checkout"): "Bash(git checkout:*)",
    ("git", "switch"): "Bash(git switch:*)",
    ("git", "stash"): "Bash(git stash:*)",
    ("git", "worktree"): "Bash(git worktree:*)",
    ("git", "merge"): "Bash(git merge:*)",
    ("git", "rebase"): "Bash(git rebase:*)",
    ("gh", "pr"): "Bash(gh pr:*)",
    ("docker", "compose"): "Bash(docker compose ps:*)",
    ("systemctl", "--user"): "Bash(systemctl --user status:*)",
    ("journalctl", None): "Bash(journalctl:*)",
    ("mkdir", None): "Bash(mkdir:*)",
    ("touch", None): "Bash(touch:*)",
    ("cp", None): "Bash(cp:*)",
    ("mv", None): "Bash(mv:*)",
    ("chmod", None): "Bash(chmod:*)",
    ("curl", None): "Bash(curl:*)",
    ("wget", None): "Bash(wget:*)",
    ("python3", "-I"): None,  # arbitrary code; reported but never suggested
}
UV_RUN_RULES = {
    "pytest": "Bash(uv run pytest:*)",
    "ruff": "Bash(uv run ruff:*)",
    "mypy": "Bash(uv run mypy:*)",
    "--frozen": None,  # resolved against the token after it
}
NPM_RUN_RULES = {"check", "test", "lint", "build", "measure", "e2e", "test:unit", "test:e2e",
                 "format:check", "typecheck", "links", "budgets", "build:draft"}

ENV_PREFIX = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=\S*$")


def parse_ts(s):
    if not s:
        return None
    try:
        return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def iso(t):
    return t.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if t else None


def text_of(content):
    """The plain text of a message content (string or block list)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for b in content:
            if isinstance(b, dict):
                if b.get("type") == "text":
                    parts.append(b.get("text", ""))
                elif b.get("type") == "tool_result":
                    parts.append(text_of(b.get("content")))
            elif isinstance(b, str):
                parts.append(b)
        return "\n".join(parts)
    return ""


def permission_info(rec, block):
    """(decision, source, denial_kind, reason_type) recorded on a tool result by Claude Code 2.1+,
    or four Nones on older transcripts. A `source` of user_* is a prompt David answered;
    source config with reasonType classifier is the auto-mode classifier's call. Looked up on the record, on its
    toolUseResult and on the block itself, whichever carries it."""
    decision = source = kind = reason = None
    for d in (rec, rec.get("toolUseResult"), block):
        if not isinstance(d, dict):
            continue
        pd = d.get("permissionDecision")
        if isinstance(pd, dict):
            decision = decision or pd.get("decision") or pd.get("behavior")
            source = source or pd.get("source") or pd.get("decisionSource")
            reason = reason or pd.get("reasonType")
        elif isinstance(pd, str):
            decision = decision or pd
        source = source or d.get("permissionDecisionSource") or d.get("decisionSource")
        kind = kind or d.get("toolDenialKind")
    return decision, source, kind, reason


def split_segments(command):
    """The simple commands of a shell string, without a leading cd."""
    segs = []
    for seg in re.split(r"\s*(?:&&|\|\||;|\|)\s*", command.strip()):
        seg = seg.strip()
        if not seg:
            continue
        cmd, _sub, _head = lead_tokens(seg)
        if cmd is None or cmd == "cd":
            continue
        segs.append(seg)
    return segs


def lead_tokens(command):
    """The command and first subcommand of a shell string, skipping env prefixes, sudo,
    timeout and a leading `cd X &&`. Returns (cmd, sub, head) where head is the first few
    words for display."""
    command = command.strip()
    # Take the first simple command of a pipeline/list, but skip over a leading cd.
    segments = re.split(r"\s*(?:&&|\|\||;|\|)\s*", command)
    for seg in segments:
        try:
            toks = shlex.split(seg, posix=True)
        except ValueError:
            toks = seg.split()
        toks = [t for t in toks if t]
        while toks and ENV_PREFIX.match(toks[0]):
            toks = toks[1:]
        while toks and toks[0] in ("sudo", "timeout", "time", "nice", "env", "command"):
            toks = toks[1:]
            while toks and (toks[0].startswith("-") or ENV_PREFIX.match(toks[0])):
                toks = toks[1:]
        if not toks or toks[0] == "cd":
            continue
        cmd = os.path.basename(toks[0])
        sub = toks[1] if len(toks) > 1 else None
        return cmd, sub, " ".join(toks[:4])
    return None, None, command[:60]


def allow_rule_for(cmd, sub, toks_head):
    """The allow rule that would cover this command, or None when it must stay prompted."""
    if cmd is None:
        return None
    if cmd in AUTO_ALLOWED_ANY:
        return "auto"
    if cmd in AUTO_ALLOWED_SUB and sub in AUTO_ALLOWED_SUB[cmd]:
        verbs = AUTO_ALLOWED_VERBS.get((cmd, sub))
        if verbs is None:
            return "auto"
        words = toks_head.split()
        if len(words) > 2 and words[2] in verbs:
            return "auto"
    if cmd == "cargo" and sub == "fmt":
        return "Bash(cargo fmt --check)" if "--check" in toks_head.split() else None
    if cmd == "uv" and sub == "run":
        words = toks_head.split()
        rest = [w for w in words[2:] if not w.startswith("--")]
        if rest and rest[0] in UV_RUN_RULES and UV_RUN_RULES[rest[0]]:
            rule = UV_RUN_RULES[rest[0]]
            if "--frozen" in words:
                rule = rule.replace("uv run ", "uv run --frozen ")
            return rule
        return None
    if cmd == "npm" and sub == "run":
        words = toks_head.split()
        if len(words) > 2 and words[2] in NPM_RUN_RULES:
            return f"Bash(npm run {words[2]})"
        return None
    if cmd == "gh" and sub == "pr":
        words = toks_head.split()
        if len(words) > 2 and words[2] in ("create", "ready", "edit", "comment"):
            return f"Bash(gh pr {words[2]}:*)"
        return None
    if cmd == "git" and sub == "push":
        return None  # branch-specific; a human picks these
    rule = ALLOWLISTABLE.get((cmd, sub))
    if rule is None:
        rule = ALLOWLISTABLE.get((cmd, None))
    return rule


def rule_matches(rule, command):
    """Does an existing settings rule cover this shell command? Mirrors Claude Code's
    `Bash(prefix:*)` / `Bash(prefix *)` / exact forms well enough for counting."""
    m = re.match(r"^Bash\((.*)\)$", rule)
    if not m:
        return False
    pat = m.group(1)
    command = command.strip()
    if pat.endswith(":*"):
        return command.startswith(pat[:-2])
    if pat.endswith(" *"):
        return command.startswith(pat[:-2] + " ") or command == pat[:-2]
    if pat.endswith("*"):
        return command.startswith(pat[:-1])
    return command == pat


def load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def settings_files(project_dir, claude_dir):
    """Settings files that apply to a session in project_dir, nearest last."""
    out = [os.path.join(claude_dir, "settings.json"), os.path.join(claude_dir, "settings.local.json")]
    d = project_dir
    chain = []
    while d and d != os.path.dirname(d):
        chain.append(d)
        d = os.path.dirname(d)
    for d in reversed(chain):
        out.append(os.path.join(d, ".claude", "settings.json"))
        out.append(os.path.join(d, ".claude", "settings.local.json"))
    return [p for p in out if os.path.isfile(p)]


def allow_rules(paths):
    rules, denies = [], []
    for p in paths:
        s = load_json(p) or {}
        perms = s.get("permissions") or {}
        rules += perms.get("allow") or []
        denies += perms.get("deny") or []
    return rules, denies


def similar(a, b):
    wa = set(re.findall(r"[a-z0-9]{3,}", a.lower()))
    wb = set(re.findall(r"[a-z0-9]{3,}", b.lower()))
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / len(wa | wb)


def analyze_session(path, claude_dir, projects_root):
    s = {
        "file": path, "session_id": None, "cwd": None, "project": None, "version": None,
        "start": None, "end": None, "prompts": 0, "first_prompt": "", "assistant_turns": 0,
        "tool_calls": collections.Counter(), "bash_commands": [], "denials": [],
        "prompt_waits": [], "slow_bash": [], "interrupts": 0, "compactions": 0,
        "errors": [], "stop_hook_blocks": 0, "ask_user": 0, "reply_waits": [],
        "subagents": 0, "sidechain": False, "question_waits": [], "bash_records": [],
        "has_permission_info": False, "active_s": 0, "classifier_calls": 0,
    }
    pending = {}  # tool_use_id -> (name, input, ts)
    last_assistant_ts = None
    first_ts = last_ts = None
    try:
        f = open(path, encoding="utf-8", errors="replace")
    except OSError:
        return None
    with f:
        for line in f:
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            if not isinstance(rec, dict):
                continue
            ts = parse_ts(rec.get("timestamp"))
            if ts:
                first_ts = first_ts or ts
                if last_ts and 0 < (ts - last_ts).total_seconds() <= ACTIVE_GAP_SECONDS:
                    s["active_s"] += (ts - last_ts).total_seconds()
                last_ts = ts
            s["session_id"] = s["session_id"] or rec.get("sessionId")
            if rec.get("cwd") and not s["cwd"]:
                s["cwd"] = rec["cwd"]
            s["version"] = s["version"] or rec.get("version")
            if rec.get("isSidechain"):
                s["sidechain"] = True
            typ = rec.get("type")
            if typ == "system" and rec.get("subtype") == "compact_boundary":
                s["compactions"] += 1
                continue
            msg = rec.get("message") or {}
            content = msg.get("content")
            if typ == "assistant":
                s["assistant_turns"] += 1
                last_assistant_ts = ts or last_assistant_ts
                if isinstance(content, list):
                    for b in content:
                        if isinstance(b, dict) and b.get("type") == "tool_use":
                            name = b.get("name") or "?"
                            s["tool_calls"][name] += 1
                            pending[b.get("id")] = (name, b.get("input") or {}, ts)
                            if name == "AskUserQuestion":
                                s["ask_user"] += 1
                            if name == "Bash":
                                s["bash_commands"].append(str((b.get("input") or {}).get("command", "")))
            elif typ == "user":
                if rec.get("isCompactSummary"):
                    s["compactions"] += 1
                    continue
                blocks = content if isinstance(content, list) else []
                results = [b for b in blocks if isinstance(b, dict) and b.get("type") == "tool_result"]
                if results:
                    for b in results:
                        name, inp, t_use = pending.pop(b.get("tool_use_id"), ("?", {}, None))
                        body = text_of(b.get("content"))
                        wait = (ts - t_use).total_seconds() if (ts and t_use) else None
                        label = inp.get("command") if name == "Bash" else inp.get("file_path") or inp.get("description") or ""
                        label = str(label)[:120]
                        decision, source, kind, reason = permission_info(rec, b)
                        if decision or source or kind:
                            s["has_permission_info"] = True
                        is_question = name in QUESTION_TOOLS
                        denied = bool(kind) or decision in ("deny", "reject") or body.lstrip().startswith(DENIAL_MARKERS)
                        prompted = bool(source) and str(source).startswith("user")
                        if is_question:
                            if wait is not None:
                                s["question_waits"].append({"tool": name, "wait_s": round(wait), "at": iso(ts)})
                            continue
                        if denied:
                            s["denials"].append({"tool": name, "what": label, "wait_s": wait, "kind": kind or decision or "text", "at": iso(ts)})
                            continue
                        if b.get("is_error"):
                            s["errors"].append({"tool": name, "what": label, "tail": body.strip()[-200:], "at": iso(ts)})
                        if name == "Bash":
                            s["bash_records"].append({"command": str(inp.get("command", "")), "counted": prompted or reason == "classifier"})
                            if reason == "classifier":
                                s["classifier_calls"] += 1
                        if wait is None:
                            continue
                        if prompted:
                            s["prompt_waits"].append({"tool": name, "what": label, "wait_s": round(wait), "at": iso(ts), "source": source})
                        elif not s["has_permission_info"] and name not in LONG_RUNNING_TOOLS and wait >= PROMPT_WAIT_SECONDS:
                            s["prompt_waits"].append({"tool": name, "what": label, "wait_s": round(wait), "at": iso(ts), "source": "guessed"})
                        elif name == "Bash" and wait >= SLOW_BASH_SECONDS:
                            s["slow_bash"].append({"what": label, "wait_s": round(wait), "at": iso(ts)})
                    continue
                text = text_of(content)
                if INTERRUPT_MARKER in text:
                    s["interrupts"] += 1
                    continue
                if rec.get("isMeta") or text.lstrip().startswith(("<command-", "<local-command")):
                    continue
                if any(m in text for m in STOP_HOOK_MARKERS) and "hook" in text.lower():
                    s["stop_hook_blocks"] += 1
                    continue
                if not text.strip():
                    continue
                s["prompts"] += 1
                if not s["first_prompt"]:
                    s["first_prompt"] = " ".join(text.split())[:200]
                if ts and last_assistant_ts:
                    gap = (ts - last_assistant_ts).total_seconds()
                    if 0 < gap <= REPLY_WAIT_CAP_SECONDS:
                        s["reply_waits"].append(round(gap))
    s["start"], s["end"] = iso(first_ts), iso(last_ts)
    s["duration_s"] = round((last_ts - first_ts).total_seconds()) if first_ts and last_ts else 0
    s["active_s"] = round(s["active_s"])
    s["tool_calls"] = dict(s["tool_calls"])
    s["project"] = project_name(s["cwd"], projects_root) if s["cwd"] else None
    sub_dir = os.path.join(os.path.dirname(path), os.path.splitext(os.path.basename(path))[0], "subagents")
    if os.path.isdir(sub_dir):
        s["subagents"] = len([n for n in os.listdir(sub_dir) if n.endswith(".jsonl")])
    return s


def project_name(cwd, projects_root):
    cwd = os.path.abspath(cwd)
    root = os.path.abspath(projects_root)
    if cwd == root:
        return "(projects root)"
    if cwd.startswith(root + os.sep):
        return cwd[len(root) + 1:].split(os.sep)[0]
    return cwd.replace(HOME, "~")


def find_sessions(claude_dir, since):
    out = []
    base = os.path.join(claude_dir, "projects")
    if not os.path.isdir(base):
        return out
    for slug in os.listdir(base):
        d = os.path.join(base, slug)
        if not os.path.isdir(d):
            continue
        for name in os.listdir(d):
            p = os.path.join(d, name)
            if name.endswith(".jsonl") and os.path.isfile(p):
                try:
                    mtime = dt.datetime.fromtimestamp(os.path.getmtime(p), dt.timezone.utc)
                except OSError:
                    continue
                if mtime >= since:
                    out.append(p)
    return sorted(out, key=os.path.getmtime)


def history_counts(claude_dir, since):
    per_day = collections.Counter()
    per_project = collections.Counter()
    p = os.path.join(claude_dir, "history.jsonl")
    if not os.path.isfile(p):
        return per_day, per_project
    with open(p, encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            t = rec.get("timestamp")
            if isinstance(t, (int, float)):
                ts = dt.datetime.fromtimestamp(t / (1000 if t > 1e12 else 1), dt.timezone.utc)
            else:
                ts = parse_ts(t)
            if not ts or ts < since:
                continue
            per_day[ts.strftime("%Y-%m-%d")] += 1
            per_project[str(rec.get("project", "?")).replace(HOME, "~")] += 1
    return per_day, per_project


def config_inventory(claude_dir, projects_root):
    inv = {"user_settings": {}, "projects": [], "claude_md": []}
    for name in ("settings.json", "settings.local.json"):
        s = load_json(os.path.join(claude_dir, name))
        if s is not None:
            perms = s.get("permissions") or {}
            inv["user_settings"][name] = {
                "allow": len(perms.get("allow") or []), "deny": len(perms.get("deny") or []),
                "ask": len(perms.get("ask") or []), "defaultMode": perms.get("defaultMode"),
                "hooks": sorted((s.get("hooks") or {}).keys()),
                "model": s.get("model"), "env": sorted((s.get("env") or {}).keys()),
            }
    for name in ("CLAUDE.md", "AGENTS.md"):
        p = os.path.join(claude_dir, name)
        if os.path.isfile(p):
            inv["claude_md"].append({"path": p.replace(HOME, "~"), "bytes": os.path.getsize(p)})
    if not os.path.isdir(projects_root):
        return inv
    for proj in sorted(os.listdir(projects_root)):
        root = os.path.join(projects_root, proj)
        if not os.path.isdir(root) or proj.startswith(".") or proj in ("archived", "worktrees", "tests"):
            continue
        entry = {"project": proj, "settings": [], "hooks": [], "claude_md": []}
        dirs = [root] + [os.path.join(root, n) for n in sorted(os.listdir(root))
                         if os.path.isdir(os.path.join(root, n)) and not n.startswith(".")]
        for d in dirs:
            rel = os.path.relpath(d, projects_root)
            for name in ("settings.json", "settings.local.json"):
                p = os.path.join(d, ".claude", name)
                s = load_json(p)
                if s is None:
                    continue
                perms = s.get("permissions") or {}
                hooks = s.get("hooks") or {}
                entry["settings"].append({
                    "path": os.path.join(rel, ".claude", name), "allow": len(perms.get("allow") or []),
                    "deny": len(perms.get("deny") or []), "hooks": sorted(hooks.keys()),
                    "hook_timeouts": sorted({h.get("timeout") for ev in hooks.values() for g in ev
                                             for h in (g.get("hooks") or []) if h.get("timeout")}),
                })
            hd = os.path.join(d, ".claude", "hooks")
            if os.path.isdir(hd):
                entry["hooks"] += [os.path.join(rel, ".claude", "hooks", n) for n in sorted(os.listdir(hd))]
            for name in ("CLAUDE.md", "AGENTS.md"):
                p = os.path.join(d, name)
                if os.path.isfile(p):
                    entry["claude_md"].append({"path": os.path.join(rel, name), "bytes": os.path.getsize(p)})
        if entry["settings"] or entry["hooks"] or entry["claude_md"]:
            inv["projects"].append(entry)
    return inv


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--days", type=float, default=7)
    ap.add_argument("--claude-dir", default=os.path.join(HOME, ".claude"))
    ap.add_argument("--projects-root", default=os.path.join(HOME, "Desktop", "random", "projects"))
    ap.add_argument("--out", default=os.path.join(HOME, "Desktop", "random", "projects", "workflow-review"))
    ap.add_argument("--min-count", type=int, default=3, help="times a command must recur to be suggested")
    args = ap.parse_args()

    now = dt.datetime.now(dt.timezone.utc)
    since = now - dt.timedelta(days=args.days)
    files = find_sessions(args.claude_dir, since)
    sessions = []
    for p in files:
        s = analyze_session(p, args.claude_dir, args.projects_root)
        if s and (s["prompts"] or s["tool_calls"]):
            sessions.append(s)
    main_sessions = [s for s in sessions if not s["sidechain"] and "/subagents/" not in s["file"]]
    agent_sessions = [s for s in sessions if s not in main_sessions]

    # Restarts on the same task: same project, started within 3h of the previous end,
    # opening prompt that overlaps or says continue.
    restarts = []
    by_proj = collections.defaultdict(list)
    for s in sorted(main_sessions, key=lambda x: x["start"] or ""):
        by_proj[s["project"]].append(s)
    for proj, lst in by_proj.items():
        for prev, cur in zip(lst, lst[1:]):
            if not (prev["end"] and cur["start"]):
                continue
            gap = (parse_ts(cur["start"]) - parse_ts(prev["end"])).total_seconds()
            fp = cur["first_prompt"].lower()
            cont = fp.startswith(("continue", "resume", "keep going", "carry on", "where were we", "pick up"))
            if 0 < gap <= 3 * 3600 and cur["first_prompt"] and (cont or similar(prev["first_prompt"], cur["first_prompt"]) >= 0.5):
                restarts.append({"project": proj, "prev": os.path.basename(prev["file"]), "next": os.path.basename(cur["file"]),
                                 "gap_min": round(gap / 60), "prompt": cur["first_prompt"][:100]})

    # Commands worth an allow rule, per project, against the rules that already apply there.
    cmd_counts = collections.defaultdict(collections.Counter)   # project -> (rule) -> count
    cmd_examples = collections.defaultdict(dict)
    unknown_cmds = collections.defaultdict(collections.Counter)  # project -> head -> count
    repeated = []
    for s in main_sessions + agent_sessions:
        proj = s["project"] or "?"
        proj_dir = s["cwd"] or args.projects_root
        allow, _deny = allow_rules(settings_files(proj_dir, args.claude_dir))
        counter = collections.Counter(c.strip() for c in s["bash_commands"] if c.strip())
        for c, n in counter.items():
            if n >= args.min_count:
                repeated.append({"project": proj, "count": n, "command": c[:120], "session": os.path.basename(s["file"])})
        for rec in s["bash_records"]:
            if s["has_permission_info"] and not rec["counted"]:
                continue
            for seg in split_segments(rec["command"]):
                cmd, sub, head = lead_tokens(seg)
                if cmd is None:
                    continue
                rule = allow_rule_for(cmd, sub, head)
                if rule == "auto":
                    continue
                if any(rule_matches(r, seg) for r in allow):
                    continue
                if rule is None:
                    unknown_cmds[proj][head] += 1
                    continue
                cmd_counts[proj][rule] += 1
                cmd_examples[proj].setdefault(rule, seg[:100])
    suggestions = []
    for proj, counter in cmd_counts.items():
        for rule, n in counter.most_common():
            if n >= args.min_count:
                suggestions.append({"project": proj, "rule": rule, "count": n, "example": cmd_examples[proj][rule]})
    suggestions.sort(key=lambda x: -x["count"])

    denials = [dict(d, project=s["project"], session=os.path.basename(s["file"])) for s in main_sessions for d in s["denials"]]
    prompt_waits = [dict(d, project=s["project"], session=os.path.basename(s["file"])) for s in main_sessions for d in s["prompt_waits"]]
    slow_bash = [dict(d, project=s["project"], session=os.path.basename(s["file"])) for s in main_sessions for d in s["slow_bash"]]
    errors = [dict(d, project=s["project"], session=os.path.basename(s["file"])) for s in main_sessions for d in s["errors"]]
    error_by_cmd = collections.Counter()
    for e in errors:
        if e["tool"] == "Bash":
            cmd, sub, head = lead_tokens(e["what"])
            error_by_cmd[head] += 1
    tool_totals = collections.Counter()
    for s in sessions:
        tool_totals.update(s["tool_calls"])
    reply_waits = [w for s in main_sessions for w in s["reply_waits"]]
    question_waits = [dict(d, project=s["project"], session=os.path.basename(s["file"])) for s in main_sessions for d in s["question_waits"]]
    qw_by_project = collections.defaultdict(lambda: [0, 0])
    for q in question_waits:
        qw_by_project[q["project"]][0] += 1
        qw_by_project[q["project"]][1] += q["wait_s"]
    has_info = any(s["has_permission_info"] for s in main_sessions)
    denial_wait = sum((d["wait_s"] or 0) for d in denials)

    per_day, per_project = history_counts(args.claude_dir, since)
    inventory = config_inventory(args.claude_dir, args.projects_root)

    summary = {
        "window_days": args.days, "generated_at": iso(now),
        "sessions": len(main_sessions), "subagent_sessions": len(agent_sessions),
        "prompts": sum(s["prompts"] for s in main_sessions),
        "assistant_turns": sum(s["assistant_turns"] for s in main_sessions),
        "tool_calls": sum(tool_totals.values()),
        "session_hours": round(sum(s["duration_s"] for s in main_sessions) / 3600, 1),
        "active_hours": round(sum(s["active_s"] for s in main_sessions) / 3600, 1),
        "permission_info": has_info,
        "classifier_calls": sum(s["classifier_calls"] for s in main_sessions),
        "question_waits": len(question_waits), "question_wait_min": round(sum(q["wait_s"] for q in question_waits) / 60),
        "denials": len(denials), "denial_wait_min": round(denial_wait / 60),
        "prompt_waits": len(prompt_waits), "prompt_wait_min": round(sum(d["wait_s"] for d in prompt_waits) / 60),
        "slow_bash": len(slow_bash), "slow_bash_min": round(sum(d["wait_s"] for d in slow_bash) / 60),
        "interrupts": sum(s["interrupts"] for s in main_sessions),
        "compactions": sum(s["compactions"] for s in main_sessions),
        "errors": len(errors), "stop_hook_blocks": sum(s["stop_hook_blocks"] for s in main_sessions),
        "ask_user": sum(s["ask_user"] for s in main_sessions),
        "restarts": len(restarts),
        "reply_wait_min": round(sum(reply_waits) / 60), "reply_wait_median_s": sorted(reply_waits)[len(reply_waits) // 2] if reply_waits else 0,
    }
    report = {
        "summary": summary,
        "sessions": [{k: v for k, v in s.items() if k not in ("bash_commands", "reply_waits", "bash_records", "question_waits")} | {"file": s["file"].replace(HOME, "~")} for s in main_sessions],
        "restarts": restarts, "denials": denials,
        "question_waits_by_project": {p: {"count": v[0], "minutes": round(v[1] / 60)} for p, v in sorted(qw_by_project.items(), key=lambda kv: -kv[1][1])}, "prompt_waits": prompt_waits, "slow_bash": slow_bash,
        "errors": errors[:200], "error_by_command": error_by_cmd.most_common(20),
        "repeated_commands": sorted(repeated, key=lambda x: -x["count"])[:40],
        "allow_suggestions": suggestions,
        "unreviewed_commands": {p: c.most_common(15) for p, c in unknown_cmds.items()},
        "tool_totals": tool_totals.most_common(),
        "prompts_per_day": sorted(per_day.items()), "prompts_per_project": per_project.most_common(),
        "config": inventory,
    }

    os.makedirs(args.out, exist_ok=True)
    stamp = now.strftime("%Y-%m-%d")
    json_path = os.path.join(args.out, f"review-{stamp}.json")
    md_path = os.path.join(args.out, f"review-{stamp}.md")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1, default=str)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(render_md(report))
    for name in ("latest.json", "latest.md"):
        link = os.path.join(args.out, name)
        try:
            if os.path.lexists(link):
                os.remove(link)
            os.symlink(os.path.basename(json_path if name.endswith("json") else md_path), link)
        except OSError:
            pass
    print(md_path)
    print(json_path)
    return 0


def render_md(r):
    s = r["summary"]
    L = []
    L.append(f"# Claude Code workflow review, last {s['window_days']:g} days\n")
    L.append(f"Generated {s['generated_at']}.\n")
    L.append("## Totals\n")
    L.append(f"- {s['sessions']} sessions ({s['active_hours']} h active, {s['session_hours']} h first-to-last), {s['subagent_sessions']} subagent runs, "
             f"{s['prompts']} prompts, {s['assistant_turns']} assistant turns, {s['tool_calls']} tool calls")
    L.append(f"- Permission denials: {s['denials']} ({s['denial_wait_min']} min until answered)")
    if s["permission_info"]:
        L.append(f"- Permission prompts answered by hand: {s['prompt_waits']} ({s['prompt_wait_min']} min until answered)")
    else:
        L.append(f"- Likely permission waits (no decision record in these transcripts; non-shell tools >= {PROMPT_WAIT_SECONDS}s): {s['prompt_waits']} ({s['prompt_wait_min']} min)")
    L.append(f"- Sessions parked on a question or a plan approval: {s['question_waits']} ({s['question_wait_min']} min until answered); by project: " +
             ", ".join(f"{p} {v['count']}x {v['minutes']} min" for p, v in r["question_waits_by_project"].items()))
    L.append(f"- Shell commands over {SLOW_BASH_SECONDS}s (slow, or sat on a prompt): {s['slow_bash']} ({s['slow_bash_min']} min)")
    if s["permission_info"]:
        L.append(f"- Shell commands judged by the auto-mode classifier (an allow rule would skip the call): {s['classifier_calls']}")
    L.append(f"- Interrupted turns: {s['interrupts']}; context compactions: {s['compactions']}; tool errors: {s['errors']}; "
             f"Stop-hook blocks: {s['stop_hook_blocks']}; questions asked with AskUserQuestion: {s['ask_user']}")
    L.append(f"- Sessions restarted on the same task: {s['restarts']}")
    L.append(f"- Time between Claude's last message and your next prompt (gaps under 4 h): {s['reply_wait_min']} min total, median {s['reply_wait_median_s']} s\n")

    L.append("## Sessions\n")
    L.append("| start | project | active min | prompts | tools | denials | prompts answered | errors | compact | interrupts | first prompt |")
    L.append("|---|---|---|---|---|---|---|---|---|---|---|")
    for x in sorted(r["sessions"], key=lambda x: x["start"] or ""):
        L.append(f"| {(x['start'] or '')[:16]} | {x['project']} | {x['active_s'] // 60} | {x['prompts']} | {sum(x['tool_calls'].values())} | "
                 f"{len(x['denials'])} | {len(x['prompt_waits'])} | {len(x['errors'])} | {x['compactions']} | "
                 f"{x['interrupts']} | {x['first_prompt'][:60].replace('|', '/')} |")
    L.append("")

    if r["denials"]:
        L.append("## Denied tool calls\n")
        for d in r["denials"][:40]:
            L.append(f"- {d['project']}: `{d['tool']}` {d['what'][:90]} (waited {round(d['wait_s'] or 0)} s)")
        L.append("")
    if r["prompt_waits"]:
        L.append("## Permission prompts that waited longest\n")
        for d in sorted(r["prompt_waits"], key=lambda d: -d["wait_s"])[:30]:
            L.append(f"- {d['project']}: `{d['tool']}` {d['what'][:90]} waited {d['wait_s']} s")
        L.append("")
    if r["slow_bash"]:
        L.append("## Slow shell commands\n")
        for d in sorted(r["slow_bash"], key=lambda d: -d["wait_s"])[:30]:
            L.append(f"- {d['project']}: `{d['what'][:90]}` {d['wait_s']} s")
        L.append("")
    if r["restarts"]:
        L.append("## Restarted on the same task\n")
        for x in r["restarts"]:
            L.append(f"- {x['project']}: {x['gap_min']} min after the previous session ended: \"{x['prompt']}\"")
        L.append("")
    if r["allow_suggestions"]:
        L.append("## Allow rules worth adding (" + ("prompted or sent to the auto-mode classifier" if s["permission_info"] else "run") + " 3+ times, not auto-allowed, not yet in settings)\n")
        L.append("| project | rule | count | example |")
        L.append("|---|---|---|---|")
        for x in r["allow_suggestions"][:30]:
            L.append(f"| {x['project']} | `{x['rule']}` | {x['count']} | `{x['example'].replace('|', '/')}` |")
        L.append("")
    if r["unreviewed_commands"]:
        L.append("## Other recurring commands (decide by hand; interpreters and task runners never get wildcards)\n")
        for proj, lst in r["unreviewed_commands"].items():
            top = [f"`{h}` x{n}" for h, n in lst if n >= 3]
            if top:
                L.append(f"- {proj}: " + ", ".join(top[:12]))
        L.append("")
    if r["error_by_command"]:
        L.append("## Commands that errored most\n")
        for head, n in r["error_by_command"]:
            L.append(f"- `{head}` x{n}")
        L.append("")
    if r["repeated_commands"]:
        L.append("## Identical commands repeated within one session\n")
        for x in r["repeated_commands"][:20]:
            L.append(f"- {x['project']} x{x['count']}: `{x['command'].replace(chr(10), ' ')[:100]}`")
        L.append("")
    L.append("## Tools used\n")
    L.append(", ".join(f"{n} x{c}" for n, c in r["tool_totals"][:25]) + "\n")
    if r["prompts_per_day"]:
        L.append("## Prompts per day (history.jsonl)\n")
        L.append(", ".join(f"{d}: {n}" for d, n in r["prompts_per_day"]) + "\n")
    L.append("## Configuration in force\n")
    for name, u in r["config"]["user_settings"].items():
        L.append(f"- ~/.claude/{name}: {u['allow']} allow, {u['deny']} deny, {u['ask']} ask, mode {u['defaultMode']}, hooks {u['hooks'] or 'none'}")
    for c in r["config"]["claude_md"]:
        L.append(f"- {c['path']}: {c['bytes']} bytes")
    for p in r["config"]["projects"]:
        parts = [f"{x['path']} ({x['allow']} allow, {x['deny']} deny, hooks {x['hooks'] or 'none'}" +
                 (f", timeout {x['hook_timeouts']}" if x['hook_timeouts'] else "") + ")" for x in p["settings"]]
        big = [f"{c['path']} {c['bytes'] // 1024} KB" for c in p["claude_md"] if c["bytes"] > 8192]
        L.append(f"- {p['project']}: " + ("; ".join(parts) or "no settings") + (f"; large instruction files: {', '.join(big)}" if big else ""))
    L.append("")
    return "\n".join(L)


if __name__ == "__main__":
    sys.exit(main())
