# One Person Lab Web Project

- owner: product-engineering owner
- purpose: current project role and product boundary.
- state: active_truth
- machine boundary: human-readable; contracts, API behavior, source, and tests are authoritative.

One Person Lab Web is the multi-tenant SaaS Web edition of One Person Lab at `opl.medopl.cn`. Its users are research staff, master's students, PhD students, principal investigators, and research teams. Its primary user path is the research capability workbench: users enter through `@科研`, `@论文`, `@基金`, `@综述`, and `@文件`, while ordinary chat remains a fallback.

This repo owns the Web product surface, multi-tenant account/session experience, tenant isolation, BYOK provider binding, research capability entry, ordinary chat fallback, page state, Web release/deploy, sanitized audit projection, and the Go control plane API.

The durable product boundary is `contracts/web-product-profile.json`. API shape is `contracts/web-api.openapi.json`. Page state is `contracts/web-page-state-matrix.json`. Runtime gate policy is `contracts/web-runtime-bridge.json`. Release readiness is `contracts/web-release-profile.json`.

This repo does not own desktop App packaging/updater, OPL Framework runtime truth, MAS/MAG/RCA domain judgment, billing source of truth, storage truth, node pool lifecycle, API gateway truth, OPL execution truth, or artifact/body authority.

The current implementation is a static web shell served by the Go control plane. Contract-defined runtime markers in `contracts/web-runtime-bridge.json` stop at a MedOPL Runtime gate until a Go-side contract, eval, whitelist, and authorization boundary exists.
