# Working in {{repo}}

## Common working rules

{{common_rules}}

## Module boundaries and checks

- Own {{owns}} ({{code}}). {{never_does}}
{{#invariants}}
- {{.}}
{{/invariants}}
- Checks, each distinct, before any change is called done:

  ```sh
  {{checks_indented}}
  ```

  CI runs the same.
- Prove user-facing behaviour with the verify skill in
  `.claude/skills/verify-{{repo}}/`.
  `create-verification-skill` writes it when there is none. Fix a bug test-first with
  `tdd` when a cheap local test exists. Every test follows the test budget (the
  `test-behavior-not-implementation` principle, in the `principles` skill): it stays only
  if it fails when the behaviour breaks and passes when only the internals change.
