# {{repo}} plan

Updated {{date}}. Track **{{track}} {{track_name}}** ([root
tracks](../plan.md#tracks-and-checkpoints)); this track is the only writer of this
repository. The [system plan](../plan.md) owns order, gates and acceptance; requests to
other tracks go through [handoffs](../handoffs.md). Terms: [glossary](../glossary.md).

## Purpose and boundaries

{{purpose}}

{{#boundaries}}
- {{.}}
{{/boundaries}}

## Current state

<!-- Authoritative status, one bullet per fact, each with evidence (a
research.md anchor, a commit, a CI run). Mark finished steps "**done <date>**". -->
- Repository created {{date}} (O1); no step started.

## Next

Work in this order; each line names what it waits for.

{{#next}}
{{num}}. **{{id}}** {{title}}.{{waits}}
{{/next}}

## Milestone steps

The [root plan](../plan.md#module-work-by-milestone) cites these IDs; never renumber or
reuse one. Milestone `0` is maintenance.

{{#milestone_steps}}
### {{id}}

Stop after the last {{id}} step until {{gate_id}}.

{{#steps}}
- [ ] **{{id}}** {{definition}}.
{{/steps}}

{{/milestone_steps}}
<!-- A finished step reads
- [x] **<CODE>-1.1** <definition>. *Done <date>: <outcome> ([evidence](research.md#anchor)).* -->

## Checks and exit

Checks are in [AGENTS.md](AGENTS.md). {{exit_criteria}} Record revisions, inputs, date,
command, outcome and limits in [research](research.md).

## Decisions

None yet. Module decisions are `D<n>`; root decisions are cited as SD*n*.
