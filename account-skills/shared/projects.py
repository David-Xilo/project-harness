#!/usr/bin/env python3
"""List the projects under a root and the operator contract each one declares.

A project is a folder at or under the root whose AGENTS.md has a `## Operator contract`
section. The skills read the contract instead of naming projects. Standard library only, read-only.

    python3 -I projects.py                  # every project, as JSON
    python3 -I projects.py <name>           # one project, by folder name or path
    python3 -I projects.py --root <dir>     # another root (default: the current folder)
"""

import argparse
import json
import os
import re
import sys

MARKER = "## Operator contract"
SKIP_ANY = {"node_modules", "worktrees"}
FIELD = re.compile(r"^- \*\*(?P<name>[^*]+?):\*\*\s*(?P<text>.*)$")


def is_worktree(folder):
    dot_git = os.path.join(folder, ".git")
    if not os.path.isfile(dot_git):
        return False
    with open(dot_git, encoding="utf-8", errors="replace") as f:
        return "/worktrees/" in f.read()


def contract(agents_md):
    with open(agents_md, encoding="utf-8", errors="replace") as f:
        lines = f.read().splitlines()
    if MARKER not in (line.rstrip() for line in lines):
        return None
    start = [line.rstrip() for line in lines].index(MARKER) + 1
    fields, current = {}, None
    for line in lines[start:]:
        if line.startswith("## "):
            break
        m = FIELD.match(line)
        if m:
            current = m["name"].strip()
            fields[current] = m["text"].strip()
        elif current and line.startswith("  ") and line.strip():
            fields[current] += " " + line.strip()
        else:
            current = None
    return fields


def find_projects(root):
    root = os.path.abspath(root)
    found = []
    for dirpath, dirnames, filenames in os.walk(root):
        rel = os.path.relpath(dirpath, root)
        dirnames[:] = sorted(
            d for d in dirnames if d not in SKIP_ANY and not d.startswith(".")
        )
        if rel != "." and is_worktree(dirpath):
            dirnames[:] = []
            continue
        if "AGENTS.md" in filenames:
            fields = contract(os.path.join(dirpath, "AGENTS.md"))
            if fields is not None:
                found.append({
                    "name": os.path.basename(dirpath),
                    "path": rel,
                    "contract": fields,
                })
                dirnames[:] = []
    return found


def main():
    ap = argparse.ArgumentParser(description="List the projects and their operator contracts.")
    ap.add_argument("project", nargs="?", help="folder name or path from the root")
    ap.add_argument("--root", default=os.getcwd())
    args = ap.parse_args()
    projects = find_projects(args.root)
    if args.project:
        want = args.project.strip("/")
        projects = [p for p in projects if want in (p["name"], p["path"])]
        if not projects:
            sys.exit(f"no project named {args.project!r} has an operator contract")
    json.dump(projects, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
