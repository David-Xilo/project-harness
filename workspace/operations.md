# Operations and evidence

A reference file of the [root plan](plan.md).

{{#runtime}}{{runtime_name}} is run by `{{runtime_session}}` ([track rules](plan.md#track-rules)); each
producer supplies its health and freshness signals. Protect irreplaceable evidence as it
accrues.

**Logging.** Bounded structured events with UTC time, severity, event name, service
name, version and any request or run IDs (searchable fields, not metric labels). Never
log credentials or unbounded bodies.

**Monitoring coverage:** {{monitoring}}

**Unattended-operation checks:**
{{#checks}}
- [ ] **{{check}}.** {{how}}
{{/checks}}
{{/runtime}}
