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
