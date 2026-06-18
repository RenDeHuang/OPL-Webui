# Line Budget Policy Calibration Closeout

- owner: product-engineering owner
- purpose: closeout evidence for this active change.
- state: active_change
- machine boundary: verification commands below.

## Summary

- Calibrated repo line budget to match the OPL-style policy: line count is advisory by default and strict only through an explicit structure entrypoint.
- Removed `maxFileLines` from default hard bloat budgets.
- Added `lineBudgetPolicy` and `lineBudgetFindings` to `scripts/repo-bloat-audit.mjs`.
- Added `npm run repo:bloat:strict` for explicit strict line budget checks.
- Updated `AGENTS.md`, `TASTE.md`, and `changes/README.md` to describe `260/400/600` as local structural signals, not big-company or long-term hard standards.

## Verification

- RED: `node --test tests/health/repo-bloat.test.mjs` failed on old `maxFileLines` hard budget.
- RED: `node --test tests/health/workflow-entrypoint.test.mjs` failed before `repo:bloat:strict` existed.
- GREEN targeted: `node --test tests/health/repo-bloat.test.mjs tests/health/workflow-entrypoint.test.mjs tests/health/governance-hardening.test.mjs`.
- GREEN strict line entry: `npm run repo:bloat:strict`.
- GREEN diff hygiene: `git diff --check`.
- GREEN full verify: `npm run verify`.
- GREEN review gate: `npm run gate:review`.
- GREEN default bloat gate: `npm run repo:bloat`.
- GREEN structure gate: `sentrux check .`.

## Cannot Claim

- This phase did not split `apps/web/src/onePersonLabWeb.mjs`.
- This phase did not change Web UI product behavior.
- This phase did not change Go control-plane API behavior.
- This phase did not make production dogfood, MedOPL integration, billing, or real OPL execution complete.
