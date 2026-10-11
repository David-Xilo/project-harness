# Milestone acceptance

A reference file of the [root plan](plan.md).

Use the status words **planned**, **implemented**, **locally verified**, **system
accepted**, **blocked** and **deferred** accurately ([glossary](glossary.md#codes)).
Each acceptance record names the release, the operator capabilities it adds (CLIs, API,
views), the owner and command, the release commits, input and config versions, and the
date, outcome and limits. A missing test or missing evidence is a failure, not a pass.
Evidence never contains secrets.

An accepted milestone shrinks to one paragraph: "System accepted <date>: <command> <n/n>
… ([evidence](<repo>/research.md#anchor))", plus its limits.
{{#milestones}}

## {{id}} — {{title}}

{{goal}}

- **Owners:** {{owners_text}}. **Release:** {{version}} at {{cp}}.
- **Operator capabilities:** {{capabilities}}
{{#acceptance}}
- [ ] **{{criterion}}** {{how}}
{{/acceptance}}
{{/milestones}}
