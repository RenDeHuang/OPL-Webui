# One Person Lab Web Project

- owner: product-engineering owner
- purpose: current project role and product boundary.
- state: active_truth
- machine boundary: human-readable; contracts, API behavior, source, and tests are authoritative.

One Person Lab Web is the Web interaction platform and browser entry for One Person Lab at `opl.medopl.cn`. Its users are research staff, master's students, PhD students, principal investigators, and research teams. Its primary user path is: open Web, log in, bind an API Key or use admitted account capability, choose `@科研`, `@论文`, `@基金`, `@综述`, `@文件`, `@PPT`, or `@书`, then see task state, progress refs, deliverable refs, blocker/next step, and MedOPL/OPL continuation when specialist execution is required.

This repo owns route/auth/account/BYOK, task intent, page state, refs projection, deeplink, account/session experience, hidden tenant isolation, research capability entry, ordinary chat fallback, Web release/deploy, sanitized audit projection, and the Go control plane API.

The durable product boundary is `contracts/web-product-profile.json`. API shape is `contracts/web-api.openapi.json`. Page state is `contracts/web-page-state-matrix.json`. Runtime gate policy is `contracts/web-runtime-bridge.json`. Release readiness is `contracts/web-release-profile.json`.

Ordinary users do not require runtime or storage by default. Specialist execution enters the MedOPL-managed runtime/resource path. one-person-lab owns framework and execution semantics; MedOPL owns runtime/resource/billing/storage; Foundry Agents own domain truth, quality, and artifact authority. This repo does not own desktop App packaging/updater, OPL Framework runtime truth, MAS/MAG/RCA domain judgment, billing source of truth, storage truth, node pool lifecycle, API gateway truth, OPL execution truth, or artifact/body authority.

The current implementation is a static web shell served by the Go control plane. Contract-defined runtime markers in `contracts/web-runtime-bridge.json` stop at a MedOPL Runtime gate until a Go-side contract, eval, whitelist, and authorization boundary exists.
