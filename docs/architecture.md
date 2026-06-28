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
    -> MedOPL API bridge for runtime gate, runtime runs, and billing ledger refs
    -> readonly OPL CLI snapshot surfaces
    -> sanitized status projections
```

The web layer must not import backend code. The Go control plane is the only backend business entry. OPL private state, private runtime, install, repair, module exec, and mutation surfaces remain forbidden unless a future contract explicitly admits them.

The architecture follows the One Person Lab owner split: this repo owns the Web interaction platform, browser entry, and projections; one-person-lab owns framework/execution semantics; MedOPL owns runtime/resource/billing/storage; Foundry Agents own domain truth, quality, and artifact authority. Ordinary users do not require runtime or storage by default. Runtime admission exists only for specialist execution markers and is driven by MedOPL account/resource state: package or plan, credit or billing, compute resource, storage space, and workspace/runtime/storage binding. The Web bridge can submit task intent and refs context to MedOPL, but it does not absorb MedOPL, one-person-lab, or Foundry Agent truth. `MEDOPL_API_BASE_URL` is operator deployment config for the Go control plane; selected/test/canary accounts can only be rollout/evidence fixtures, not product access policy.

The UI architecture has a separate source boundary: Figma Make `UI_UX for Commercial Launch` is the canonical visual/product surface source for Public Growth Layer and Account-based User Product Layer. Implementation translates its `src/app/App.tsx`, `src/styles/theme.css`, `src/styles/globals.css`, components, and images into this repo's static Web shell and Go control plane data flow. Generated Figma app dependencies, mock task history, and mock runtime/storage/payment copy cannot become Web-owned truth.

## Ownership Split

- One Person Lab Web owns the browser product entry, route/auth/account/BYOK, tenant isolation, fixed provider binding, research capability launcher, ordinary chat fallback, task intent, WebUI-side quota precheck, page state, refs projection, deeplink, sanitized audit projection, Web release/deploy, runtime gate display, MedOPL gate/run refs-only bridge, and billing ledger refs projection.
- MedOPL owns runtime gate truth, runtime run truth, package purchase, compute resource, storage space, workspace/runtime/storage binding, billing ledger, release, audit, and resource cleanup.
- Foundry Agents own domain truth, quality, and artifact authority for specialist outputs.
- This repo does not own desktop App packaging/updater, OPL Framework runtime truth, domain-agent judgment authority, billing source of truth, storage truth, node pool lifecycle, API gateway truth, OPL execution truth, or artifact/body authority.

## Contract Owners

- Product boundary: `contracts/web-product-profile.json`.
- Page state: `contracts/web-page-state-matrix.json`.
- HTTP API: `contracts/web-api.openapi.json`.
- Runtime gate and refs-only projection: `contracts/web-runtime-bridge.json`.
- Release readiness: `contracts/web-release-profile.json`.
