# One Person Lab Web Architecture

- owner: product-engineering owner
- purpose: current top-level architecture and boundaries.
- state: active_truth
- machine boundary: human-readable; contracts, source, deploy manifests, and tests are authoritative.

## Current Shape

```text
Browser WebUI
  -> same-origin Go control plane HTTP API
    -> PostgreSQL when OPL_DATABASE_URL is configured
    -> fixed gflabtoken OpenAI-compatible chat gateway for ordinary chat
    -> readonly OPL CLI snapshot surfaces
    -> sanitized status projections
```

The web layer must not import backend code. The Go control plane is the only backend business entry. OPL private state, private runtime, install, repair, module exec, and mutation surfaces remain forbidden unless a future contract explicitly admits them.

The architecture follows the one-person-lab-app owner split: this repo owns the Web product surface and projections, consumes one-person-lab framework/app contracts as external authority, and does not absorb MedOPL or MAS/MAG/RCA truth.

## Ownership Split

- One Person Lab Web owns the multi-tenant SaaS product entry, public account/session, tenant isolation, fixed provider binding, research capability launcher, ordinary chat fallback, WebUI-side quota precheck, page state, sanitized audit projection, Web release/deploy, and runtime gate display.
- This repo does not own desktop App packaging/updater, OPL Framework runtime truth, domain-agent judgment authority, billing source of truth, storage truth, node pool lifecycle, API gateway truth, OPL execution truth, or artifact/body authority.

## Contract Owners

- Product boundary: `contracts/web-product-profile.json`.
- Page state: `contracts/web-page-state-matrix.json`.
- HTTP API: `contracts/web-api.openapi.json`.
- Runtime gate and refs-only projection: `contracts/web-runtime-bridge.json`.
- Release readiness: `contracts/web-release-profile.json`.
