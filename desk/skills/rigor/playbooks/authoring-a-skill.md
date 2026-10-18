# Authoring a skill

**You own the skill's voice.**

1. Put it where it belongs:
   - an engineering skill for every project: `desk/skills/<name>/` in the desk plugin's
     repository;
   - a project's own skill (a verification skill, say): `<project>/.claude/skills/<name>/`.
   Edit the source, never an installed copy.
2. Write it like its siblings in that folder: a frontmatter `name` and a `description`
   that leads with when to use it, then the steps. Big detail goes in `references/`, a
   script in `scripts/`.
3. Check it: the frontmatter parses, every referenced file exists, every link to another
   skill resolves. For a plugin skill, run `/reload-plugins` and confirm it shows in
   the skill list.
4. Run it once on real material in a fresh session, as its use would. Write test cases
   only when the skill is structural (it parses or produces a format); skip them for a
   judgment skill.
5. `code-review` on the diff, then the PR.

When in doubt, delete. Keep only prose that changes a decision. Tell it to do the thing
and skip the reason, unless the rule is confusing without one. Match the tone to the
scope. Point at structural sources (types, READMEs, config) instead of restating them
(`encode-lessons-in-structure`), and name other skills instead of copying them. A
workflow you keep hitting that no skill captures is a proposal for a new skill.

**Reply:** what the skill does, the key design choices, and how you checked it.
