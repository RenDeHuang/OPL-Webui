# Line Budget Policy Calibration Proposal

- owner: product-engineering owner
- purpose: calibrate repo line budget policy against OPL-like structural governance.
- state: active_change
- machine boundary: `scripts/repo-bloat-audit.mjs`, `tests/health/repo-bloat.test.mjs`, and review gate behavior.

## Why

The repo currently treats `maxFileLines: 260` as a hard bloat gate. That made sense as an early cleanup ratchet, but it is too strict as a long-term development rule. One Person Lab treats line budget as a structural signal by default and reserves hard failure for explicit strict structure lanes.

## Scope

- Keep durable file, markdown, script, and test counts as hard bloat budgets.
- Change line count from default hard failure to advisory policy.
- Add explicit strict behavior for files above the split-required threshold.
- Update governance prose to match the new behavior.

## Non-goals

- No product behavior change.
- No UI split in this phase.
- No Go package restructure in this phase.
- No compatibility layer.
