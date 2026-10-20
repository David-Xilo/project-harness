# Survey and guard tools per stack

Run from the module's folder. Every command here is read-only unless marked `--fix`. Run
them through `uvx`, `npx` or `go run ...@latest` so nothing lands in the project; a
`cargo install --locked` for a missing Rust tool is fine. A tool that will not run is a
line in the survey ("knip: not run, <error>"), never a reason to stop.

Record each tool's count in the survey: the before/after table is built from these.

## Any language

| What | Command |
|---|---|
| Hotspots and change coupling | `python3 <skill>/scripts/hotspots.py . --months 12` (code only; `--docs` adds markdown) |
| Complexity (CCN over 15, functions over 80 lines) | `uvx lizard -C 15 -L 80 -w .` (add `-l python`, `-l go`, `-l rust` or `-l typescript` to narrow) |
| Duplication | `npx --yes jscpd --min-tokens 70 --reporters consoleFull --ignore "**/node_modules/**,**/target/**,**/dist/**,**/.venv/**" .` |
| Comments that restate code | the `desk:no-comments` skill |
| Stale docs | every path, command and symbol named in README, AGENTS.md, plan.md and docs/ still exists (`rg` each one) |

## Go

| What | Command |
|---|---|
| Unreachable functions (modules with a `main`) | `go run golang.org/x/tools/cmd/deadcode@latest -test ./...` |
| Unused identifiers (library modules too) | `golangci-lint run --enable-only unused` (v1: `--disable-all -E unused`) |
| Unused or missing modules | `go mod tidy -diff` (Go 1.23+) |
| Complexity and duplication | `golangci-lint run --enable-only gocognit,gocyclo,dupl` |
| Package graph | `go list -f '{{.ImportPath}} -> {{join .Imports " "}}' ./...` |
| Boundary guard | move internals under an `internal/` folder (the compiler then rejects outside imports); forbid imports with the `depguard` linter in `.golangci.yml` |
| Ratchet | `golangci-lint run --new-from-rev=origin/development` fails only on new issues |
| Pin strength (optional) | `go run github.com/go-gremlins/gremlins/cmd/gremlins@latest unleash ./<pkg>` |

Go forbids import cycles, so the boundary work is direction and leakage: exported names
used only inside their package, and wire or storage types crossing package lines.

## Python (uv)

| What | Command |
|---|---|
| Unused imports and variables, commented-out code, complexity | `uvx ruff check . --select F401,F841,ERA001,C901,PLR0912,PLR0915,SIM,RET --statistics` |
| Dead functions, classes, attributes | `uvx vulture . --min-confidence 80 --exclude .venv` |
| Unused, missing and transitive dependencies | `uvx deptry .` |
| Duplication | `uvx pylint --disable=all --enable=duplicate-code <package>` |
| Complexity per function | `uvx radon cc -s -n C <package>` |
| Import graph and layer rules | import-linter: add a `[tool.importlinter]` block to `pyproject.toml` (`root_packages`, then `layers`, `forbidden` or `independence` contracts) and run `uv run --with import-linter lint-imports` |
| Ratchet | vulture: `uvx vulture . --make-whitelist > vulture_allow.py` for findings kept on purpose; import-linter: `ignore_imports` per contract, each with a comment saying why |
| Pin strength (optional) | `uv run --with mutmut mutmut run` with `[tool.mutmut] paths_to_mutate` set to the hotspot only |

Vulture guesses: a function called by name from a framework, a CLI entry point or
`getattr` looks dead and is not. Prove each removal with `desk:blast-radius`.

## Rust

| What | Command |
|---|---|
| Lints, dead private code, complexity | `cargo clippy --all-targets --all-features -- -W clippy::pedantic -W clippy::cognitive_complexity -W unreachable_pub` (survey only; the gate keeps its own flags) |
| Dead `pub` items | `unreachable_pub` narrows them to `pub(crate)`; then rustc's `dead_code` sees the unused ones |
| Unused dependencies | `cargo shear` (install: `cargo install --locked cargo-shear`) or `cargo machete` |
| Module graph and cycles | `cargo modules dependencies --lib --no-externs --no-sysroot --acyclic` (install: `cargo install --locked cargo-modules`) |
| Crate graph | `cargo tree -e normal --workspace --depth 1` |
| Boundary guard | `pub(crate)` and private modules; crate-level bans in `deny.toml` `[bans]`, checked with `cargo deny check bans` |
| Ratchet | `#[expect(lint, reason = "...")]` on the line kept on purpose: it fails once the lint no longer fires |
| Pin strength (optional) | `cargo mutants --file <path>` (install: `cargo install --locked cargo-mutants`) |

## TypeScript, Vite, Astro

| What | Command |
|---|---|
| Unused files, exports, dependencies | `npx --yes knip` (`--fix` removes unused exports and dependencies; review its diff) |
| Unused locals and parameters | `npx tsc -p <tsconfig> --noEmit --noUnusedLocals --noUnusedParameters` |
| Dependency rules and cycles | `npx --yes dependency-cruiser --init` once, then `npx depcruise src --config .dependency-cruiser.cjs` |
| Cycles only | `npx --yes madge --circular --extensions ts,tsx src` |
| Astro | `npx astro check`; knip reads `.astro` files through its Astro plugin |
| Ratchet | `npx depcruise src --config .dependency-cruiser.cjs --output-type baseline > .dependency-cruiser-known-violations.json`, then run the gate with `--ignore-known` |
| Pin strength (optional) | Stryker: `npx --yes stryker init`, then `npx stryker run --mutate <file>` |

## Lean 4

| What | Command |
|---|---|
| Unused variables and other linter warnings | `lake build 2>&1 \| grep -c warning` (the linters run by default) |
| Unused imports | `lake exe shake` when the package provides it; otherwise skip |
| Unreferenced lemmas | for each `theorem`/`lemma`/`def` name, `rg -w <name>` outside its own line; none and not exported means dead |
| Proof holes | `rg -n '\bsorry\b\|\badmit\b'` must stay at its baseline count |

In Lean the theorem statements are the contract and the kernel is the pin: refactor
proofs and definitions freely while every statement and its `#print axioms` output stays
the same.

## Which guards join the gate

A guard joins the module's check (Makefile `check`, `npm run check`, CI) only when it is
deterministic, runs in under about 30 seconds, and the run made its rule true (zero
cycles, zero unused dependencies, the layer rules written down). Hotspots, complexity
counts, duplication and mutation runs stay survey-only: they rank work, they do not gate
it.
