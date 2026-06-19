# One Person Lab Web Status

- owner: product-engineering owner
- purpose: current status, can/cannot-claim boundary, and next development priorities.
- state: active
- machine boundary: human-readable status; contracts, source, tests, scripts, API behavior, deploy artifacts, and Sentrux rules are authoritative.

## Current State

One Person Lab Web is the SaaS Web edition of One Person Lab App. The repo currently owns the public Web product surface, Go control plane API, account/session path, BYOK binding, ordinary chat entry, page state, sanitized audit projection, release/deploy evidence, and MedOPL Runtime gate projection.

The current stage is development-system realignment landing. New product expansion should pause only until this fixed-truth workflow diff is reviewed and landed; after that, product work should resume one gap at a time through contracts, source, tests, and fresh evidence.

## Machine Truth

- Product boundary: `contracts/web-product-profile.json`
- Page state: `contracts/web-page-state-matrix.json`
- HTTP API: `contracts/web-api.openapi.json`
- Runtime gate and refs-only projection: `contracts/web-runtime-bridge.json`
- Release readiness: `contracts/web-release-profile.json`
- Historical process evidence: `docs/history/process/closeouts.md`
- Production runbook evidence: `deploy/web-cloud/RUNBOOK.md`

Markdown docs explain those contracts. If docs and contracts disagree, update the contract or retire the stale prose in the same diff.

## Development System Status

- `changes/active` is retired as the default development system.
- Fixed truth entries are `README.md`, `AGENTS.md`, `TASTE.md`, `docs/project.md`, `docs/status.md`, `docs/decisions.md`, `docs/architecture.md`, `docs/invariants.md`, `docs/docs_portfolio_consolidation.md`, and `contracts/*.json`.
- `docs/status.md` keeps the current gap and handoff boundary.
- `docs/history/process/closeouts.md` is historical provenance only; it must not become current truth.

## Can Claim

- One Person Lab Web is the public SaaS Web edition of One Person Lab App at `opl.medopl.cn`.
- The Web UI calls only the same-origin Go control plane HTTP API.
- Users bind their own API Key while provider `base_url` remains fixed at `https://gflabtoken.cn/v1`.
- Runtime, node pool, storage, billing, API gateway, OPL execution, artifact body authority, and MAS/MAG/RCA domain judgment are not owned by this repo.
- Runtime-requiring markers such as `@基金` and `@论文` stop at a MedOPL Runtime gate unless future Go-side contract, eval, whitelist, and authorization boundaries admit more.
- Local no-secret readiness is machine-owned by `contracts/web-release-profile.json` as HTTP contract plus static shell evidence.

## Cannot Claim

- 还不是完整 production-ready SaaS。
- 本阶段没有执行 production authenticated dogfood e2e。
- 本阶段没有执行 Playwright、Puppeteer 或 Chromium-driven browser automation。
- 本阶段没有新增真实 chat、billing、storage、runtime bridge、OPL worker、object storage、artifact body endpoint 或 production MedOPL runtime bridge。
- 不能执行 OPL install、repair、module exec、family-runtime mutation、engine install/update/remove。
- 不能返回 artifact body、memory body、domain verdict、private state path、mutation result 或 raw provider secret。

## Next Priorities

1. Land the fixed-truth workflow diff after review.
2. Resume product work one gap at a time: contract first, tests registered, cleanup complete, verification fresh.
3. Production authenticated dogfood e2e evidence when manually enabled with approved secrets.
