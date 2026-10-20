#!/usr/bin/env python3
"""Rank refactoring targets from git history: hotspots and change coupling.

A hotspot is a file that is both large and changed often; that is where cleanup pays.
Change coupling is two files that keep changing in the same commits; across directories
it usually means a boundary leaks.

Usage: hotspots.py [PATH] [--months N] [--top N] [--min-shared N] [--tsv]
Run it from inside the repository. PATH narrows to one module (default: the whole repo).
Stdlib only, read-only.
"""

import argparse
import collections
import itertools
import os
import subprocess
import sys

SKIP_SUFFIXES = (
    ".lock", ".sum", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".snap",
    ".min.js", ".map", ".json", ".csv", ".parquet",
)
SKIP_NAMES = {"package-lock.json", "Cargo.lock", "uv.lock", "go.sum", "pnpm-lock.yaml"}
SKIP_DIRS = {"node_modules", "dist", "build", "target", "vendor", ".venv", "__snapshots__"}
BULK_COMMIT = 40


def git(*args):
    out = subprocess.run(["git", *args], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"git {' '.join(args)} failed: {out.stderr.strip()}")
    return out.stdout


def skipped(path):
    parts = path.split("/")
    name = parts[-1]
    return (
        name in SKIP_NAMES
        or name.endswith(SKIP_SUFFIXES)
        or any(p in SKIP_DIRS for p in parts[:-1])
    )


def commits(path, months):
    log = git("log", f"--since={months}.months", "--no-merges", "--name-only",
              "--format=--%H", "--", path)
    current = None
    for line in log.splitlines():
        if line.startswith("--"):
            if current:
                yield current
            current = set()
        elif line.strip() and current is not None and not skipped(line):
            current.add(line.strip())
    if current:
        yield current


def line_count(root, rel):
    try:
        with open(os.path.join(root, rel), "rb") as f:
            return sum(1 for _ in f)
    except OSError:
        return None


def area(rel, depth):
    parts = rel.split("/")
    return "/".join(parts[:depth]) if len(parts) > depth else "."


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("path", nargs="?", default=".")
    ap.add_argument("--months", type=int, default=12)
    ap.add_argument("--top", type=int, default=20)
    ap.add_argument("--min-shared", type=int, default=4)
    ap.add_argument("--tsv", action="store_true")
    a = ap.parse_args()

    root = git("rev-parse", "--show-toplevel").strip()
    prefix = os.path.relpath(os.path.abspath(a.path), root)
    depth = 1 if prefix == "." else prefix.count("/") + 2

    churn = collections.Counter()
    pairs = collections.Counter()
    for files in commits(a.path, a.months):
        churn.update(files)
        if len(files) <= BULK_COMMIT:
            pairs.update(itertools.combinations(sorted(files), 2))

    hot = []
    for rel, n in churn.items():
        lines = line_count(root, rel)
        if lines:
            hot.append((n * lines, n, lines, rel))
    hot.sort(reverse=True)

    coupled = []
    for (x, y), shared in pairs.items():
        if shared < a.min_shared or not (line_count(root, x) and line_count(root, y)):
            continue
        degree = shared / min(churn[x], churn[y])
        cross = area(x, depth) != area(y, depth)
        coupled.append((cross, degree, shared, x, y))
    coupled.sort(key=lambda c: (c[0], c[1], c[2]), reverse=True)

    if a.tsv:
        print("kind\tscore\tcommits\tlines\tfile\tother")
        for score, n, lines, rel in hot[: a.top]:
            print(f"hotspot\t{score}\t{n}\t{lines}\t{rel}\t")
        for cross, degree, shared, x, y in coupled[: a.top]:
            kind = "coupling-cross" if cross else "coupling"
            print(f"{kind}\t{degree:.2f}\t{shared}\t\t{x}\t{y}")
        return

    print(f"Hotspots in {prefix}, last {a.months} months (commits x lines)")
    print(f"{'score':>8} {'commits':>7} {'lines':>6}  file")
    for score, n, lines, rel in hot[: a.top]:
        print(f"{score:>8} {n:>7} {lines:>6}  {rel}")
    print()
    print(f"Change coupling (>= {a.min_shared} shared commits; * = across directories)")
    print(f"{'degree':>6} {'shared':>6}  files")
    for cross, degree, shared, x, y in coupled[: a.top]:
        mark = "*" if cross else " "
        print(f"{degree:>6.0%} {shared:>6} {mark} {x}  <->  {y}")
    if not hot:
        print("No history in range: try --months 24, or the module has no commits yet.")


if __name__ == "__main__":
    main()
