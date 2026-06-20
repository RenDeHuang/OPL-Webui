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
- AI development discipline: `contracts/web-development-profile.json`
- Long-lived surface ownership: `contracts/web-surface-inventory.json`
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
- Test proof taxonomy is now mandatory in the registry: every test declares testKind, proofLevel, claimScope, proves, and doesNotProve. Static/unit/http/browser evidence cannot be used to claim production readiness unless production evidence is freshly folded back.
- `contracts/web-surface-inventory.json` owns long-lived surface registration for scripts, contracts, tests, Go tests, recurring docs, workflows/deploy, and selected source owner surfaces. Ordinary implementation files are intentionally excluded so inventory does not become a second source tree.
- `npm run repo:bloat` now reads the surface inventory. Owned growth is report-only; orphan growth without owner/consumer/contract or machine boundary is a hard failure.
- `scripts/lane-advisory.mjs` maps changed files to targeted lanes for operator visibility; lane-check/gate evidence decides whether the required targeted lanes were actually run for the current diff.
- `contracts/web-development-profile.json` defines the AI development order, anti-bloat policy, task tiers, and completion boundaries; `npm run gate:ai` enforces claim freshness and workflow hygiene, and `npm run gate:review` runs it before lane evidence and current verify.
- Release evidence foldback is exposed as `npm run release:evidence -- --run-id <github-run-id>` so production rollout/browser/dogfood/availability evidence can update the release profile and status as a first-class workflow step.
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
- Production authenticated dogfood HTTP evidence executed successfully in GitHub Actions run `27866718228` for commit `3e69e3d38ed60b9aea96bd7d9c76ad65fe481135`, image `uswccr.ccs.tencentyun.com/webopl/opl-webui:3e69e3d`, after dry-run, production apply, canary/smoke, and availability probe success. This run includes production real ordinary chat completion and `chat.completed` audit evidence. It is not MedOPL runtime execution evidence.
- Real local Chromium browser e2e executed successfully through `npm run verify:browser`, covering register, login, API Key binding, ordinary chat with mock upstream, `@论文`/`@基金` runtime gates, sanitized audit evidence, and user-like CDP input.
- Browser e2e is now a CI release gate before image release: `.github/workflows/ci.yml` installs Chromium and runs `npm run verify:browser`; `Release Image` still depends on successful CI before pushing the cloud image.
- Research-task-first UX is implemented in the browser shell and page-state contract: the first-screen task templates cover `research_direction`, `paper_question`, `grant_plan`, `review_map`, and `materials_refs`; `@科研` ordinary chat now renders a structured result view model with `research_plan`, `evidence_refs`, and `next_steps`; `@论文`/`@基金` runtime gates render a runtime task card with MedOPL deep link and forbidden Web execution metadata. This is UI view-model evidence only, not artifact body, storage, or runtime execution.
- Production browser e2e executed successfully in GitHub Actions run `27866718228` through the secret-gated real Chromium/CDP lane `node tests/browser/research-main-path-runner.mjs --production` and `Cloud Rollout` input `production_browser_e2e=true`. It ran after production apply and used the production dogfood account to verify real browser login, API Key binding, ordinary research chat, `@论文`/`@基金` runtime gates, and sanitized audit evidence against `https://opl.medopl.cn`.
- Production dogfood can optionally verify existing MedOPL-owned readonly projections with `OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1`: runtime status, materials/deliverables projection, and billing summary. For run `27866718228`, `OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY` is not publicly confirmable from GitHub job metadata, so MedOPL readonly production coverage remains unclaimed. This proves sanitized projection availability and forbidden Web mutation flags only when the switch evidence is folded back; it does not prove MedOPL runtime execution, payment, storage mutation, node lifecycle, or production MedOPL API integration.
- Production availability probe executed successfully in GitHub Actions run `27866718228` after production apply on image `uswccr.ccs.tencentyun.com/webopl/opl-webui:3e69e3d`. The no-secret public HTTP probe checks `/healthz`, `/readyz`, `/metricsz`, and `/` repeatedly without kubeconfig, image, DB, dogfood secrets, MedOPL token, or TCR credentials.
- Production observability baseline v1 is now folded back to run `27866718228`: `/metricsz` exposes `observabilitySchemaVersion=1`, `releaseProbeContract=production_observability_baseline_v1`, and public probe endpoints; `node scripts/cloud-rollout.mjs --availability-probe` emits per-endpoint sample/success/failure/max-duration summaries without raw logs or secrets. This is release-facing baseline evidence, not dashboarding, alerting, error budget, or HA evidence. Long-term operations readiness remains pending: scheduled canary, dashboard, alerting, error budget, and rollback record.
- Production HA readiness is design-ready but not executed. `contracts/web-release-profile.json` now records the required evidence boundary: `replicas=2`, two Ready Pods, distinct nodes, `PDB minAvailable=1`, topology spread constraints, rolling update `maxUnavailable=0`, at least two healthy Ingress/CLB backends, canary/smoke, and production availability probe. Until cloud execution evidence is folded back, this repo cannot claim multi-node HA, CLB two-backend health, or zero-downtime rollout evidence.
- Manual production rollback evidence is now supported by `Cloud Rollout` input `rollback=true` and `node scripts/cloud-rollout.mjs --rollback`. It requires production environment approval, kubeconfig, image allowlist validation, rollout status, canary db, canary opl-cli, HTTPS smoke, and optional availability probe after rollback. This is manual rollback evidence, not automatic rollback or data migration rollback.
- Commercial account lifecycle projection is implemented as authenticated readonly Web account status: `GET /api/account/commercial-status` returns personal SaaS account state, tenant role, lifecycle state, `teamReadiness=single_user_owner`, allowed next action `view_medopl_billing`, and forbidden team/invite/RBAC/payment/billing-source mutation flags. The browser settings surface now renders lifecycle, team readiness, tenant role, quota, and audit summaries from existing readonly projections. It reuses the existing account/session and tenant membership surface; it does not add team management, RBAC, invite, payment, plan, subscription, storage, node pool, or runtime ownership.
- User-facing reliability UX is implemented for current Web states: the data layer converts auth-required, API-key-required, quota, upstream failure, service-unavailable, and network-unreachable results into sanitized view models; the browser shell renders a stable reliability status surface without raw upstream bodies, API keys, DB URLs, or private state.

## Cannot Claim

- 还不是完整 production-ready SaaS。
- 本阶段没有可公开确认的 production readonly projection dogfood；run `27866718228` 的 dogfood job 成功，但公开 GitHub metadata 不暴露 `OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY` 变量值或 dogfood stdout，因此不能 claim production readonly projection evidence。
- 本阶段没有证明 multi-node HA；当前 availability probe 只证明 public HTTP endpoints 的重复可用性。
- 本阶段没有长期 canary monitoring、dashboard、alerting、error budget enforcement 或 automatic rollback。
- 本阶段没有新增 team invite、RBAC、pricing、subscription、payment mutation、billing source of truth、workspace-visible UI 或 commercial admin console。
- 本阶段没有新增 billing、storage、runtime bridge、OPL worker、object storage、artifact body endpoint 或 production MedOPL runtime bridge。
- 不能执行 OPL install、repair、module exec、family-runtime mutation、engine install/update/remove。
- 不能返回 artifact body、memory body、domain verdict、private state path、mutation result 或 raw provider secret。

## Next Priorities

1. Continue product development from the current production evidence: keep framework/governance frozen unless a real product gap requires a source, contract, test, or deploy change.
2. If `OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1` is enabled in a future product rollout, fold back log or variable evidence; do not run readonly-only just to chase evidence.
3. Add team/commercial account lifecycle expansion only after there is a real consumer for invite/RBAC/payment state and a contract that preserves MedOPL billing authority.
