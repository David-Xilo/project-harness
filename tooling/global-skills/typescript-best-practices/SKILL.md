---
name: typescript-best-practices
description: "TypeScript rules for reading or editing .ts and .tsx files: discriminated unions, branded types, unknown over any, no as casts, exhaustive switches, validation at the boundary. Use when writing or reviewing TypeScript, such as the harness mods."
paths: ["**/*.ts", "**/*.tsx"]
---

# TypeScript best practices

Apply the `type-system-discipline` principle (the `principles` skill) first, and the
`boundary-discipline` principle where data comes in.

| Rule | Summary |
|------|---------|
| Discriminated unions | Model variants with a `kind` literal so impossible states can't be written. No bags of optional fields. |
| Branded types | Brand a primitive with `& { readonly __brand: "X" }` so two kinds can't be mixed up. Validate once, at the boundary. |
| Constructive modeling | Build the shape so the illegal value can't be made: `[T, ...T[]]` for non-empty, `[T, T][]` for even length, `start` plus `duration` for a range. Not a runtime guard. |
| Simplest total type | Keep `T[]` while every operation on it stays total. Strengthen to `NonEmpty<T>` only where the loose type forces `!`, a cast or a "should never happen" throw. |
| `unknown` over `any` | External data is `unknown`. |
| Schemas before guards | Before writing a property-by-property type guard, use the repository's schema library and infer the type from the schema (`z.infer`). Don't add a library for one guard. |
| No `as` casts | Cast only after validation. |
| Narrowing order | Discriminant switch, then `in`, then `typeof`/`instanceof`, then a type guard, then `as`. |
| Type guards | A guard must check what it claims. A lying guard is worse than `as`, because the name says it's safe. Name them `isX` or `hasX`. |
| Exhaustiveness | `const _exhaustive: never = x;` in default arms, so a new variant fails to compile. |
| `satisfies` over `as` | It checks the value without widening literal types. |
| Boundary validation | Parse where data comes in (hook input, `JSON.parse`, files, environment variables) into a named type. `Record<string, unknown>` stops at that parse; trust the types inside. |
| Derived types | Reach for `Pick`, `Omit`, `Parameters`, `ReturnType`, `Awaited` and `typeof` before declaring a new interface. |
| Object arguments | Pass an object, not positional arguments, so the order can't be swapped. Skip it on hot paths (render loops, tokenizers, parsers). |
| Real tests | Don't mock what you can run. Tests follow the test budget (the `test-behavior-not-implementation` principle), and behaviour is proved on the real thing (`prove-it-works`). |
| Diagnostics | Log with enough context to debug from an ID. No stray `console.log` in shipped code. |

Examples: `references/patterns.md`.

Adapted from pstack ([license](../LICENSE-pstack)).
