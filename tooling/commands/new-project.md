---
description: Create a new super project - ask every setup question in one batch, write its project.toml, then render the root with sp-new
argument-hint: "[path/to/project.toml]"
---
Arguments: $ARGUMENTS

Set up a new super project from project-harness. Every value lives in one `project.toml`; `sp-new` renders every document from it, so nothing is filled by hand. The setup steps after the file are in the template's `SETUP.md`.

1. Find the template: `tpl=$(realpath "$(dirname "$(readlink -f "$(command -v sp-new)")")/../..")`. Read `$tpl/tooling/project.example.toml`: it names every key and what it means. Read `$tpl/SETUP.md`.
2. If the argument names a `project.toml`, use it and go to step 4.
3. Ask me every question in one message, numbered, each with your recommended answer drafted from what I already said (`ok` takes every recommendation; I answer only what I change). Cover, in this order:
   - name, folder and GitHub owner;
   - what it is: the summary, the vision paragraph and the defaults (scale, users, hosts, languages, what is deferred);
   - the modules M1 needs (code of 2-5 capitals, repository, what it owns, language, check and build commands), and the modules of later milestones;
   - tracks (which modules each writes) and sessions (one per track unless I group them; at most four);
   - milestones: what each delivers, its goal, gate and acceptance criteria, and which is v1.0.0 (first unattended production use);
   - the first steps of each module per milestone, with their dependencies;
   - a shared runtime only one session may run, if any: which session, its scripts, and the subcommands anyone may run;
   - the domain invariants, the private data never exposed or published, the rules every module follows, and any hard rule for every session;
   - the glossary groups.

   Ask again only about what an answer left unclear.
4. Write the file to `${XDG_STATE_HOME:-$HOME/.local/state}/super-project/new/<dir>.toml` (or keep the path I gave). Run `sp-new --check <file>` and fix every problem it names; when a fix is a choice, ask me. Show me its summary and the file's path, say I may edit the file, and wait for my go-ahead.
5. Run `sp-new <file>`. It creates the root and keeps the file in `<root>/.claude/project.toml`.
6. Continue with `SETUP.md` from "Wire the tooling": the repository preview, `sp-claude-init`, the checks and the root's first commit, then O1 and `sp-new --modules <root>`.

Version control runs only through the Ready to commit preview in `~/.claude/git-rules.md`.
