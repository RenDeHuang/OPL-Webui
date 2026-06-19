# One Person Lab Web Status

- owner: product-engineering owner
- purpose: current status, can/cannot-claim boundary, and next development priorities.
- state: active
- machine boundary: human-readable status; contracts, source, tests, scripts, API behavior, deploy artifacts, and Sentrux rules are authoritative.

## Current State

One Person Lab Web is the multi-tenant SaaS Web edition of One Person Lab. The repo currently owns the public Web product surface, Go control plane API, multi-tenant account/session path, tenant isolation, BYOK binding, research capability entry, ordinary chat fallback, page state, sanitized audit projection, and release/deploy evidence.

The current stage is research SaaS product engineering. Product work now moves one gap at a time through contracts, source, tests, cleanup, and fresh evidence.

`docs/active/README.md` now carries the lightweight current gap baton for worktree lanes and next-agent handoff. It supports the fixed truth set; it does not replace this status file or any machine contract.

## Machine Truth

- Product boundary: `contracts/web-product-profile.json`
- Page state: `contracts/web-page-state-matrix.json`
- HTTP API: `contracts/web-api.openapi.json`
- Runtime gate and refs-only projection: `contracts/web-runtime-bridge.json`
- Release readiness: `contracts/web-release-profile.json`
- Historical process evidence: `docs/history/process/closeouts.md`
- Active gap baton: `docs/active/README.md`
- Retired surface tombstones: `docs/history/tombstones/README.md`
- Production runbook evidence: `deploy/web-cloud/RUNBOOK.md`

Markdown docs explain those contracts. If docs and contracts disagree, update the contract or retire the stale prose in the same diff.

## Development System Status

- `changes/active` is retired as the default development system.
- Fixed truth entries are `README.md`, `AGENTS.md`, `TASTE.md`, `docs/project.md`, `docs/status.md`, `docs/decisions.md`, `docs/architecture.md`, `docs/invariants.md`, `docs/docs_portfolio_consolidation.md`, and `contracts/*.json`.
- `docs/status.md` keeps the current gap and handoff boundary.
- `docs/active/README.md` keeps the worktree lane baton for current/vision-driven development.
- `docs/history/process/closeouts.md` is historical provenance only; it must not become current truth.
- `docs/history/tombstones/README.md` records retired surfaces and no-resurrection rules.

## Can Claim

- One Person Lab Web is the multi-tenant SaaS Web edition of One Person Lab at `opl.medopl.cn`.
- Research staff, master's students, PhD students, principal investigators, and research teams enter through `@科研`, `@论文`, `@基金`, `@综述`, and `@文件`.
- Ordinary chat is a fallback entry, not the primary product positioning.
- The Web UI calls only the same-origin Go control plane HTTP API.
- Users bind their own API Key while provider `base_url` remains fixed at `https://gflabtoken.cn/v1`.
- Desktop App packaging/updater, OPL Framework runtime truth, domain-agent judgment authority, billing source of truth, storage truth, node pool lifecycle, API gateway truth, OPL execution truth, and artifact/body authority are not owned by this repo.
- Runtime-requiring markers such as `@论文`, `@基金`, `@综述`, and `@文件` stop at a MedOPL Runtime gate unless a Go-side contract, eval, whitelist, and authorization boundary admits more.
- Local no-secret readiness is machine-owned by `contracts/web-release-profile.json` as HTTP contract, static shell evidence, and a browser e2e runner contract. The actual Chromium run requires `OPL_BROWSER_BINARY` when the local environment does not provide Chrome/Chromium.
- Production authenticated dogfood is configured as secret-gated HTTP evidence, not browser e2e.

## Cannot Claim

- 还不是完整 production-ready SaaS。
- 本阶段没有执行 production authenticated dogfood e2e。
- 本阶段没有执行真实 Chromium-driven browser automation；已新增无依赖 CDP runner，但本地运行需要 `OPL_BROWSER_BINARY` 或系统 Chrome/Chromium。
- 本阶段没有新增真实 chat、billing、storage、runtime bridge、OPL worker、object storage、artifact body endpoint 或 production MedOPL runtime bridge。
- 不能执行 OPL install、repair、module exec、family-runtime mutation、engine install/update/remove。
- 不能返回 artifact body、memory body、domain verdict、private state path、mutation result 或 raw provider secret。

## Next Priorities

1. Run the browser-level e2e runner in an environment with Chrome/Chromium: register, login, bind API Key, ordinary chat fallback, `@论文`/`@基金` gate, and audit evidence.
2. Execute production authenticated dogfood only through approved secrets and explicit switches.
3. Continue richer research capability UX only after the local browser evidence path is runnable in CI or a documented developer environment.
