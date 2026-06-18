# Active Truth

- owner: product-engineering owner
- purpose: current stage, can/cannot-claim boundary, and next development entry.
- state: active
- machine boundary: contracts, source, tests, scripts, closeouts, and Sentrux rules.

## Current Stage

当前是 `one-person-lab-web-truth-reset`：本阶段把仓库 canonical 叙事收敛为 One Person Lab Web，并把 durable machine truth 从 Markdown specs/status/decisions 迁到 contracts。现阶段不新增产品行为、不 rollout、不实现 MedOPL runtime bridge。

## Machine Truth

- Product boundary: `contracts/web-product-profile.json`
- Page state: `contracts/web-page-state-matrix.json`
- HTTP API: `contracts/web-api.openapi.json`
- Runtime gate and refs-only projection: `contracts/web-runtime-bridge.json`
- Release readiness: `contracts/web-release-profile.json`

Markdown docs explain those contracts. If docs and contracts disagree, contracts win and the prose must be corrected or retired in the same change.

## Active Change Work

- `changes/active/one-person-lab-web-truth-reset/`: contract-first truth reset, stale prose truth retirement, and governance test update.

## Can Claim

- One Person Lab Web is the public Web edition of One Person Lab App at `opl.medopl.cn`.
- The Web UI calls only the same-origin Go control plane HTTP API.
- Users bind their own API Key while provider `base_url` remains fixed at `https://gflabtoken.cn/v1`.
- Runtime, node pool, storage, billing, API gateway, OPL execution, artifact body authority, and MAS/MAG/RCA domain judgment are not owned by this repo.
- Runtime-requiring markers such as `@基金` and `@论文` stop at a MedOPL Runtime gate unless future Go-side contract, eval, whitelist, and authorization boundaries admit more.
- Prior production evidence remains archived in `changes/archive/closeouts.md` and `deploy/cloud-mvp/RUNBOOK.md`; active truth does not duplicate one-off rollout prose.

## Cannot Claim

- 还不是完整 production-ready SaaS。
- 本阶段没有执行 production authenticated dogfood e2e。
- 本阶段没有新增真实 chat、billing、storage、runtime bridge、OPL worker、object storage、artifact refs endpoint 或 MedOPL runtime status bridge。
- 不能执行 OPL install、repair、module exec、family-runtime mutation、engine install/update/remove。
- 不能返回 artifact body、memory body、domain verdict、private state path、mutation result 或 raw provider secret。

## Next Priorities

1. API contract implementation: make Go handlers and frontend calls fully traceable to `contracts/web-api.openapi.json`.
2. Page-state productization: drive future UI work from `contracts/web-page-state-matrix.json`.
3. Browser e2e readiness: cover register/login/API Key/chat/runtime gate/audit without production secrets.
4. MedOPL runtime status bridge as refs-only projection.
5. Production authenticated dogfood e2e evidence when manually enabled with approved secrets.
