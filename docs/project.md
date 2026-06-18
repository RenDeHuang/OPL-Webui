# One Person Lab Web Project

- owner: product-engineering owner
- purpose: current project role and product boundary.
- state: active_truth
- machine boundary: human-readable; contracts, API behavior, source, and tests are authoritative.

One Person Lab Web is the public Web edition of One Person Lab App at `opl.medopl.cn`. It owns the Web product surface, account/session experience, BYOK provider binding, ordinary chat entry, page state, Web release/deploy, sanitized audit projection, and runtime gate projection.

The durable product boundary is `contracts/web-product-profile.json`. API shape is `contracts/web-api.openapi.json`. Page state is `contracts/web-page-state-matrix.json`. Runtime gate policy is `contracts/web-runtime-bridge.json`. Release readiness is `contracts/web-release-profile.json`.

MedOPL owns recharge, runtime, node pool, storage, billing, and resource back office truth. OPL-WebUI may consume MedOPL status projections, but it must not become the billing source of truth, API gateway, storage owner, or runtime owner.

The current implementation is a static web shell served by the Go control plane. Runtime-requiring `@OPL` capabilities stop at a MedOPL Runtime gate until a Go-side contract, eval, whitelist, and authorization boundary exists.
