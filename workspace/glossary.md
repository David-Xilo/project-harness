# {{name}} glossary

Plain explanations of the domain, data and software terms used in the {{name}} plans.
Each entry says what the term means, how {{name}} uses it, and where to read more. Plans
link a term's first use to its entry here, for example `[term](../glossary.md#term)`.
Any session may append an entry.

Groups: {{#glossary_groups}}[{{group_name}}](#{{group_slug}}) · {{/glossary_groups}}[codes](#codes).

<!-- Entries look like this, 2–5 plain sentences each:

### As-of
"What did we know at time T?" An as-of query returns only the facts that were available
at T, even if later corrections exist. Related: [point-in-time](#point-in-time).
-->
{{#glossary_groups}}

## {{group_name}}
{{/glossary_groups}}

## Codes

- **Milestones:** M1–M{{last_m}} are the delivery stages ([root
  plan](plan.md#milestones-gates-and-module-work)).
- **Gates:** named checkpoints (`G<m>-<name>`, for example {{m1.gate_id}}). Dependent work
  waits until a gate has recorded evidence; see the [root plan](plan.md#gates).
- **Step IDs:** `<CODE>-<milestone>.<n>`, for example `{{first_step}}`. Milestone `0`
  means maintenance, allowed any time. IDs are never reused.
- **Tracks and checkpoints:** T1–T*n* are the tracks, each the only writer of its
  repositories; a session `S<n>` holds one or more. `CP<m>` is milestone M*m*'s
  checkpoint and the session that runs it. The **release commit** is the commit of a
  repository that goes into a milestone release, recorded in [release.md](release.md).
  H*n* are requests between tracks in [handoffs](handoffs.md); O*n* are operator tasks
  in [operator.md](operator.md). See the [root plan](plan.md#tracks-and-checkpoints).
- **Releases:** semver tags; the system version is the milestone; see
  [releases](plan.md#releases-and-versions).
- **Module codes:**

  | Code | Module |
  |---|---|
{{#codes}}
  | {{code}} | {{module}} |
{{/codes}}

- **Decisions:** SD*n* are system decisions in [decisions.md](decisions.md). D*n* are
  module decisions in that module's plan or research.
- **Status words:**
  - **planned:** written down only.
  - **implemented:** code exists.
  - **locally verified:** its tests or scenario passed on this host.
  - **system accepted:** a recorded milestone acceptance run passed.
  - **blocked:** waits on a named gate.
  - **deferred:** outside the current roadmap.
