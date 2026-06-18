# Line Budget Policy Calibration Eval Plan

- owner: product-engineering owner
- purpose: verification plan for this active change.
- state: active_change
- machine boundary: command output and closeout.

## Targeted Evals

- RED: `node --test tests/health/repo-bloat.test.mjs` fails because `maxFileLines` is still a hard budget.
- GREEN: `node --test tests/health/repo-bloat.test.mjs` passes after script changes.
- Registry coverage remains in `npm run verify:health`.

## Full Gates

- `npm run verify`
- `npm run gate:review`
- `npm run repo:bloat`
- `sentrux check .`

## Cannot Claim

- This phase does not make the Web UI product complete.
- This phase does not split frontend or backend source files.
- This phase does not change production deployment behavior.
