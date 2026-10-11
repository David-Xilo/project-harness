# {{name}} capabilities

What an operator can use at each release, how to try it, and what tests it. Details and
flags are in each module's README. The release rules are in the [root
plan](plan.md#releases-and-versions); terms are in the [glossary](glossary.md).

## Goals checklist

What {{name}} sets out to do ([root plan](plan.md#{{slug}})), and where each
goal stands on {{date}}. `[x]` works today through a documented entry point; `[ ]` is
open.

{{#milestones}}
**{{title}}** ({{id}}, planned)
{{#goals}}
- [ ] {{.}}
{{/goals}}

{{/milestones}}
<!-- `CP<m>` adds one section per release, newest first, below this comment:

## v0.<m>.0: M<m>, <title> (<date>)

<one line: library versions in this release>

### What is new since v<previous>
- <by area: CLI, API, browser, operations>

### Try it
```sh
cd <root>
<commands>
```

### CP<m> checkpoint run
| Check | Result |
|---|---|

### Known gaps
- <what does not work yet, and the step that fixes it>
-->

## Planned

| Release | Milestone | Adds |
|---|---|---|
{{#milestones}}
| {{version}} | {{id}} | {{delivers}} |
{{/milestones}}
