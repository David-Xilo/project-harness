# Hardening a public repository on GitHub

Every GitHub setting a repository needs before and after it goes public, in the order to
set them. Each item gives the settings page and the REST call (API version 2022-11-28),
so it can be set by hand or by `gh api`. Every call needs admin rights on the repository.
Below, `R` stands for `repos/<owner>/<repo>`, and the protected branches are `main` and
`development`.

The plan behind it: [plan.md, publishing in the open](../../plan.md#publishing-in-the-open-d11).

## 1. Once per account (operator)

| Setting | Where | How |
|---|---|---|
| Your commit signing key is known to GitHub, or every signed commit shows as unverified and a "signed commits" rule rejects your pushes | Settings → SSH and GPG keys → New SSH key, Key type **Signing Key** | `gh ssh-key add <key>.pub --type signing --title <name>`. The token needs `admin:ssh_signing_key`: `gh auth refresh -s admin:ssh_signing_key` |
| Vigilant mode: unsigned commits show as unverified | Settings → SSH and GPG keys → **Flag unsigned commits as unverified** | UI only |
| Two-factor authentication | Settings → Password and authentication | UI only |

## 2. Before the repository is public

| Setting | Where | How (set; check) |
|---|---|---|
| Features: no wiki or projects; issues on | Settings → General → Features | `PATCH R` `{"has_wiki":false,"has_projects":false,"has_issues":true}`; `GET R` |
| Merges: merge commits and squash; no rebase merge, which drops signatures; delete head branches | Settings → General → Pull Requests | `PATCH R` `{"allow_merge_commit":true,"allow_squash_merge":true,"allow_rebase_merge":false,"delete_branch_on_merge":true}`; `GET R` |
| Actions: only GitHub's actions and ones you list; every action pinned to a full commit SHA | Settings → Actions → General → Actions permissions | `PUT R/actions/permissions` `{"enabled":true,"allowed_actions":"selected","sha_pinning_required":true}` and `PUT R/actions/permissions/selected-actions` `{"github_owned_allowed":true,"verified_allowed":false,"patterns_allowed":[]}`; `GET` the same paths |
| Workflow token: read only; Actions cannot approve pull requests | Settings → Actions → General → Workflow permissions | `PUT R/actions/permissions/workflow` `{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}`; `GET` |
| Workflows from outside contributors wait for approval | Settings → Actions → General → Fork pull request workflows | `PUT R/actions/permissions/fork-pr-contributor-approval` `{"approval_policy":"all_external_contributors"}`; `GET`, `.approval_policy` |
| Private vulnerability reporting | Settings → Advanced Security | `PUT R/private-vulnerability-reporting`; `GET`, `{"enabled":true}` |
| Dependabot alerts (turns on the dependency graph) | Settings → Advanced Security | `PUT R/vulnerability-alerts`; `GET` answers 204 when on and 404 when off |
| Dependabot security updates (needs the alerts) | Settings → Advanced Security | `PUT R/automated-security-fixes`; `GET`, `{"enabled":true}` |
| Immutable releases: a published release cannot change | Settings → General → Releases | `PUT R/immutable-releases`; `GET`, `{"enabled":true}` |

## 3. The switch (operator only)

Settings → General → Danger Zone → Change visibility → Public, or
`PATCH R` `{"visibility":"public"}`. It exposes the whole history and every Actions log,
and it cannot be undone in practice. No script or session makes this change.

## 4. After the switch

These are free only on a public repository.

| Setting | Where | How (set; check) |
|---|---|---|
| Secret scanning and push protection | Settings → Advanced Security → Secret Protection | `PATCH R` `{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}`; `GET R`, `.security_and_analysis` |
| Code scanning, CodeQL default setup | Settings → Advanced Security → Code scanning | `PATCH R/code-scanning/default-setup` `{"state":"configured","query_suite":"default","languages":["actions", …]}` (409: a setup run is in progress, try again); `GET`, `.state` |

## 5. Rulesets, once CI has passed on each protected branch

A required check rejects a push whose commit has not passed it. A commit that already
passed on another branch can be pushed, so fast-forwarding `main` to a commit that passed
on `development` works. Create them with `POST R/rulesets`, list them with
`GET R/rulesets` and match on `name`, and change one with `PUT R/rulesets/<id>`. Settings
→ Rules → Rulesets shows the same. No bypass list.

| Ruleset | Target | Rules |
|---|---|---|
| `main` | `refs/heads/main` | `deletion`, `non_fast_forward`, `required_signatures`, `required_status_checks` with the CI job's name (here `Checks`) |
| `development` | `refs/heads/development` | `deletion`, `non_fast_forward`, `required_signatures` |
| `release-tags` | tag `refs/tags/v*` | `update` (`update_allows_fetch_and_merge: false`), `deletion`, `non_fast_forward` |

The body of the `main` ruleset:

```json
{"name": "main", "target": "branch", "enforcement": "active", "bypass_actors": [],
 "conditions": {"ref_name": {"include": ["refs/heads/main"], "exclude": []}},
 "rules": [{"type": "deletion"}, {"type": "non_fast_forward"}, {"type": "required_signatures"},
  {"type": "required_status_checks", "parameters": {"strict_required_status_checks_policy": false,
   "required_status_checks": [{"context": "Checks"}]}}]}
```

Requiring a pull request on `main` is optional. If you want it, add a `pull_request` rule,
whose parameters must all be given: `required_approving_review_count` (0 when you work
alone), `dismiss_stale_reviews_on_push`, `require_code_owner_review`,
`require_last_push_approval` and `required_review_thread_resolution`. Releases then reach
`main` through a pull request instead of a fast-forward.

## Not needed, or not available

- Secret scanning's validity checks, non-provider patterns and AI detection: paid plans
  only, with no repository-level switch.
- The `advanced_security` and `code_security` switches are not needed on a public
  repository.
