# Future module steps

A reference file of the [root plan](plan.md).

The modules below have no repository yet. Their steps move into each module's plan when
its first implementation creates the repository; the IDs are fixed here.

| Module | Track | May do now | Waits for |
|---|---|---|---|
{{#future}}
| {{module}} (`{{repo}}`) | {{track}} | {{may_do_now}} | {{waits_for}} |
{{/future}}
{{^future}}
| None yet | | | |
{{/future}}
{{#future}}

**{{module}} (`{{repo}}`)**
{{#fsteps}}
- [ ] **{{id}}** {{definition}}.
{{/fsteps}}
{{/future}}
