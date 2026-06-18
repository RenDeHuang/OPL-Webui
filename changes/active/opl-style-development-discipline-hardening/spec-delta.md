# OPL-Style Development Discipline Hardening Spec Delta

- owner: product-engineering owner
- purpose: describe the governance delta for formal development discipline.
- state: active_change
- machine boundary: governance docs and tests.

## Delta

Formal development is explicitly triggered by changes to code, docs, contracts, tests, scripts, deploy assets, specs, or API behavior.

Formal development must proceed through:

1. lifecycle package
2. cleanup / retirement
3. tests and test registration
4. verification gates

The repo also adopts lightweight OPL-style rules:

- ideal-state first
- old implementation is migration input, not long-term architecture
- no compatibility pollution
- worktree for substantial or parallel work
- subagent use only when write sets are separable and main session verifies the result
- Plan Completion Audit when the user asks for complete/fully landed work

## Boundaries

The repo keeps a lightweight WebUI taxonomy. It can add `docs/product/`, `docs/runtime/`, `docs/policies/`, and `contracts/` when a stable owner exists, but it must not copy One Person Lab's full directory volume by default.
