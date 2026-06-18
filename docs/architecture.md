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
    -> future MedOPL status projections
```

The web layer must not import backend code. The Go control plane is the only backend business entry. OPL private state, private runtime, install, repair, module exec, and mutation surfaces remain forbidden unless a future contract explicitly admits them.

The architecture follows the one-person-lab-app owner split: this repo owns the Web product surface and projections, consumes one-person-lab framework/app contracts as external authority, and does not absorb MedOPL or MAS/MAG/RCA truth.

## Ownership Split

- One Person Lab Web owns public account/session, fixed provider binding, ordinary chat request flow, WebUI-side quota precheck, page state, sanitized audit projection, Web release/deploy, and MedOPL Runtime gate display.
- MedOPL owns recharge, runtime, node pool, storage, billing, resource lifecycle, and commercial back office truth.
- Upstream OPL owns framework/runtime semantics; One Person Lab Web may only consume explicit readonly/refs-only surfaces.
- MAS/MAG/RCA own domain judgment and deliverable authority; this repo can show refs/status only.

## Contract Owners

- Product boundary: `contracts/web-product-profile.json`.
- Page state: `contracts/web-page-state-matrix.json`.
- HTTP API: `contracts/web-api.openapi.json`.
- Runtime gate and refs-only projection: `contracts/web-runtime-bridge.json`.
- Release readiness: `contracts/web-release-profile.json`.
