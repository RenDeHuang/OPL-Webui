# OPL-WebUI Architecture

- owner: product-engineering owner
- purpose: current top-level architecture and boundaries.
- state: active_truth
- machine boundary: human-readable; source, deploy manifests, and tests are authoritative.

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

## Ownership Split

- OPL-WebUI owns public account/session, fixed provider binding, ordinary chat request flow, WebUI-side quota precheck, sanitized audit projection, and MedOPL Runtime gate display.
- MedOPL owns recharge, runtime, node pool, storage, billing, resource lifecycle, and commercial back office truth.
- Upstream OPL owns framework/runtime semantics; OPL-WebUI may only consume explicit readonly/refs-only surfaces.
