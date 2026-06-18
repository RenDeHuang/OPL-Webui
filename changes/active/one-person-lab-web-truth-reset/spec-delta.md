# one-person-lab-web-truth-reset Spec Delta

- owner: product-engineering owner
- purpose: describe how current truth changes in this phase.
- state: active_change
- machine boundary: contract files and tests.

## Before

- Durable product/runtime/source truth lived in `specs/product/spec.md`, `specs/runtime/spec.md`, and `specs/source/spec.md`.
- Current status and decisions also lived in `docs/status.md` and `docs/decisions.md`.
- Lifecycle tests asserted long Markdown phrases, making prose a machine interface.

## After

- Durable machine truth lives in:
  - `contracts/web-product-profile.json`
  - `contracts/web-page-state-matrix.json`
  - `contracts/web-api.openapi.json`
  - `contracts/web-runtime-bridge.json`
  - `contracts/web-release-profile.json`
- Core docs explain the contracts and keep human-readable can/cannot-claim boundaries.
- Old specs/status/decisions are retired instead of kept as compatibility docs.
- Tests assert contract structure and retirement, not prose wording.

## Cannot Claim

- This does not add new product behavior.
- This does not prove production authenticated dogfood e2e.
- This does not make WebUI own runtime, node pool, storage, billing, API gateway, or OPL execution.
