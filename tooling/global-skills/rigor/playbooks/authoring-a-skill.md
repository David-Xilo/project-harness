# Authoring a skill

**You own the skill's voice.**

1. Put it where it belongs:
   - an engineering skill for every project: `tooling/global-skills/<name>/` in
     project-harness, linked by `tooling/install`;
   - a workspace-workflow skill: `tooling/skills/<name>/` in project-harness, copied into
     workspaces by `sp-claude-init`;
   - a module's own skill (a `verify-<module>`): `<module>/.claude/skills/<name>/`.
   Edit the source, never the link or the copy.
2. Write it like its siblings in that folder: a frontmatter `name` and a `description`
   that leads with when to use it, then the steps. Big detail goes in `references/`, a
   script in `scripts/`.
3. Check it: the frontmatter parses, every referenced file exists, every link to another
   skill resolves. Run `tooling/install` for a new global skill and confirm it shows in
   the skill list.
4. Run it once on real material in a fresh session, as its use would. Write test cases
   only when the skill is structural (it parses or produces a format); skip them for a
   judgment skill.
5. The commit preview (git rules).

When in doubt, delete. Keep only prose that changes a decision. Tell it to do the thing
and skip the reason, unless the rule is confusing without one. Match the tone to the
scope. Point at structural sources (types, READMEs, config) instead of restating them
(`encode-lessons-in-structure`), and name other skills instead of copying them. A
workflow you keep hitting that no skill captures is a proposal for a new skill.

**Reply:** what the skill does, the key design choices, and how you checked it.
