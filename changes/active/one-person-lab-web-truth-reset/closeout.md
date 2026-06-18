# one-person-lab-web-truth-reset Closeout

- owner: product-engineering owner
- purpose: completion evidence for this phase.
- state: active_change
- machine boundary: verification commands.

## Summary

- Added five durable One Person Lab Web contracts under `contracts/`.
- Retired old active prose truth files: `specs/product/spec.md`, `specs/runtime/spec.md`, `specs/source/spec.md`, `docs/status.md`, and `docs/decisions.md`.
- Compacted four already-closed active change packages into `changes/archive/closeouts.md` and removed their detailed active directories.
- Updated AGENTS, TASTE, core docs, lifecycle docs, stale guard, lifecycle tests, web data tests, and test registry to point at contracts as machine truth.
- Kept no compatibility layer or active tombstone files for the retired specs/status/decisions surfaces.

## Verification

- RED verified first: targeted tests failed on missing `contracts/web-product-profile.json` and stale AGENTS/docs references.
- Targeted GREEN: `node --test tests/contract/one-person-lab-web-data.test.mjs tests/contract/change-package-lifecycle.test.mjs tests/health/governance-hardening.test.mjs tests/health/stale-retirement-guard.test.mjs` -> 25/25 pass.
- Post-compaction targeted GREEN: `node --test tests/contract/change-package-lifecycle.test.mjs tests/health/repo-bloat.test.mjs tests/health/governance-hardening.test.mjs` -> 18/18 pass.
- `git diff --check` -> pass.
- `npm run verify` -> health 21/21 pass, contract 40/40 pass plus Go package tests, smoke 6/6 pass.
- `npm run gate:review` -> pass.
- `npm run repo:bloat` -> pass, files `85/85`, markdown docs `12/24`, active change docs `7`, tests `17/17`, max file `apps/web/src/onePersonLabWeb.mjs` 294-line advisory warning only.
- `sentrux --version` -> `sentrux 0.5.7`.
- `sentrux check .` -> 9 rules checked, quality `7354`, all rules pass.

## Cannot Claim

- No new UI behavior.
- No production rollout.
- No runtime execution.
- No MedOPL runtime status bridge.
- No production authenticated dogfood e2e execution.
