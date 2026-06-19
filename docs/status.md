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
- Test workflow now uses fixed main lanes plus dynamic targeted lane selection. `current = smoke + contract + health + go`; `browser`, `deploy`, `regression`, and `full` are explicit lanes for changed surfaces and release-risk work.
- `scripts/test-classification.mjs` is the machine registry for lane membership, cost, lifecycle role, risk triggers, verify suites, and regression retirement metadata.
- `scripts/lane-advisory.mjs` maps changed files to targeted lanes for operator visibility; lane-check/gate evidence decides whether the required targeted lanes were actually run for the current diff.
- `regression` can be empty. Active `regression-guard` tests must carry retirement metadata, and when the condition is met the test, registry entry, and any needed tombstone cleanup happen in the same change.

## Can Claim

- One Person Lab Web is the multi-tenant SaaS Web edition of One Person Lab at `opl.medopl.cn`.
- Research staff, master's students, PhD students, principal investigators, and research teams enter through `@科研`, `@论文`, `@基金`, `@综述`, and `@文件`.
- Ordinary chat is a fallback entry, not the primary product positioning.
- The Web UI calls only the same-origin Go control plane HTTP API.
- Users bind their own API Key while provider `base_url` remains fixed at `https://gflabtoken.cn/v1`.
- Desktop App packaging/updater, OPL Framework runtime truth, domain-agent judgment authority, billing source of truth, storage truth, node pool lifecycle, API gateway truth, OPL execution truth, and artifact/body authority are not owned by this repo.
- Runtime-requiring markers such as `@论文`, `@基金`, `@综述`, and `@文件` stop at a MedOPL Runtime gate unless a Go-side contract, eval, whitelist, and authorization boundary admits more.
- Local no-secret readiness is machine-owned by `contracts/web-release-profile.json` as HTTP contract, static shell evidence, and browser e2e evidence. The explicit browser lane ran real Chromium/CDP automation through `npm run verify:browser`.
- Production authenticated dogfood HTTP evidence executed successfully in GitHub Actions run `27833052951` for commit `116a56ce18e14c730be10628731d1a5fff9591c2` after dry-run, production apply, and canary/smoke success. With `OPL_PRODUCTION_DOGFOOD_REAL_CHAT=1`, this run includes production real ordinary chat completion and `chat.completed` audit evidence. It is not browser e2e and not MedOPL runtime execution evidence.
- Real local Chromium browser e2e executed successfully through `npm run verify:browser`, covering register, login, API Key binding, ordinary chat with mock upstream, `@论文`/`@基金` runtime gates, sanitized audit evidence, and user-like CDP input.
- Browser e2e is now a CI release gate before image release: `.github/workflows/ci.yml` installs Chromium and runs `npm run verify:browser`; `Release Image` still depends on successful CI before pushing the cloud image.
- Research-task-first UX is implemented in the browser shell and page-state contract: the first-screen task templates cover `research_direction`, `paper_question`, `grant_plan`, `review_map`, and `materials_refs`; `npm run verify:browser` clicks the `research_direction` template before ordinary chat fallback and still verifies `@论文`/`@基金` runtime gates.
- Production dogfood can optionally verify existing MedOPL-owned readonly projections with `OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1`: runtime status, materials/deliverables projection, and billing summary. This proves sanitized projection availability and forbidden Web mutation flags only; it does not prove MedOPL runtime execution, payment, storage mutation, node lifecycle, or production MedOPL API integration.
- Production availability probe harness is ready as a no-secret public HTTP probe through `node scripts/cloud-rollout.mjs --availability-probe` and the `Cloud Rollout` input `availability_probe=true`. It checks `/healthz`, `/readyz`, `/metricsz`, and `/` repeatedly without kubeconfig, image, DB, dogfood secrets, MedOPL token, or TCR credentials.
- Commercial account lifecycle projection is implemented as authenticated readonly Web account status: `GET /api/account/commercial-status` returns personal SaaS account state, tenant role, lifecycle state, and forbidden team/invite/payment/billing-source mutation flags. It reuses the existing account/session and tenant membership surface; it does not add team management, RBAC, invite, payment, plan, subscription, storage, node pool, or runtime ownership.

## Cannot Claim

- 还不是完整 production-ready SaaS。
- 本阶段没有执行 production browser e2e；当前浏览器证据是 local no-secret Chromium/CDP evidence。
- 本阶段没有执行 production readonly projection dogfood；需要用新镜像部署后设置 `OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1` 才能 claim production readonly projection evidence。
- 本阶段没有执行 production availability probe；需要用新镜像运行 `availability_probe=true` 后才能 claim current-image production availability probe evidence。
- 本阶段没有证明 multi-node HA；当前 availability probe 只证明 public HTTP endpoints 的重复可用性。
- 本阶段没有新增 team invite、RBAC、pricing、subscription、payment mutation、billing source of truth、workspace-visible UI 或 commercial admin console。
- 本阶段没有新增 billing、storage、runtime bridge、OPL worker、object storage、artifact body endpoint 或 production MedOPL runtime bridge。
- 不能执行 OPL install、repair、module exec、family-runtime mutation、engine install/update/remove。
- 不能返回 artifact body、memory body、domain verdict、private state path、mutation result 或 raw provider secret。

## Next Priorities

1. Run Cloud Rollout with `OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1` on the next deployed image, then fold back compressed production readonly projection evidence.
2. Run Cloud Rollout with `availability_probe=true` on the next deployed image, then fold back compressed production availability probe evidence.
3. Add team/commercial account lifecycle expansion only after there is a real consumer for invite/RBAC/payment state and a contract that preserves MedOPL billing authority.
