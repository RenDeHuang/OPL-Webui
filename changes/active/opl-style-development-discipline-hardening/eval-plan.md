# OPL-Style Development Discipline Hardening Eval Plan

- owner: product-engineering owner
- purpose: verification plan for governance hardening.
- state: active_change
- machine boundary: command output and closeout.

## Targeted Evals

- RED: `node --test tests/health/governance-hardening.test.mjs` fails before docs are updated.
- GREEN: `node --test tests/health/governance-hardening.test.mjs` passes after docs are updated.
- Lifecycle: `node --test tests/contract/change-package-lifecycle.test.mjs` passes with the active package.

## Full Gates

- `npm run verify`
- `npm run gate:review`
- `npm run repo:bloat`
- `sentrux check .`

## Cannot Claim

- This phase does not implement new WebUI behavior.
- This phase does not add OPL runtime execution.
- This phase does not make every future cleanup automatically detectable.
