# one-person-lab-web-truth-reset Design

- owner: product-engineering owner
- purpose: implementation design for contract-first truth reset.
- state: active_change
- machine boundary: contracts, tests, and scripts.

## Shape

`contracts/` becomes the stable machine-readable truth layer. The contracts are small and direct:

- `web-product-profile.json` owns product role, owned surfaces, non-owned truth, fixed provider policy, and can/cannot claims.
- `web-page-state-matrix.json` owns visible routes and page states.
- `web-api.openapi.json` owns current HTTP API shape and error enums.
- `web-runtime-bridge.json` owns runtime gate, forbidden actions, and refs-only projection policy.
- `web-release-profile.json` owns release gates, required env keys, dogfood switches, and historical evidence pointers.

## Cleanup

Retire replaced prose truth:

- `specs/product/spec.md`
- `specs/runtime/spec.md`
- `specs/source/spec.md`
- `docs/status.md`
- `docs/decisions.md`

No tombstone files are kept because active docs and tests will point to the current contracts.

## Tests

Reuse existing tests to avoid bloat:

- `tests/contract/one-person-lab-web-data.test.mjs` validates contract JSON content.
- `tests/contract/change-package-lifecycle.test.mjs` validates truth files and retired docs.
- `tests/health/governance-hardening.test.mjs` validates docs taxonomy and AGENTS loop.
- `tests/health/stale-retirement-guard.test.mjs` scans `contracts/` instead of `specs/`.
