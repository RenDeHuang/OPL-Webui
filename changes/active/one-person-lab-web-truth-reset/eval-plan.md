# one-person-lab-web-truth-reset Eval Plan

- owner: product-engineering owner
- purpose: validation plan for this phase.
- state: active_change
- machine boundary: command output and gate status.

## Static Structure Accepted

Run:

```bash
node --test tests/contract/one-person-lab-web-data.test.mjs tests/contract/change-package-lifecycle.test.mjs tests/health/governance-hardening.test.mjs tests/health/stale-retirement-guard.test.mjs
```

Expected: pass after contracts and cleanup land.

## Local Gate Accepted

Run:

```bash
npm run verify
npm run gate:review
npm run repo:bloat
sentrux check .
```

Expected: all pass.

## Cannot Claim

- No new UI behavior.
- No production rollout.
- No runtime execution.
- No MedOPL bridge implementation.
