# Active Truth

- owner: product-engineering owner
- purpose: current stage, can/cannot-claim boundary, and next development entry.
- state: active
- machine boundary: contracts, source, tests, scripts, closeouts, and Sentrux rules.

## Current Stage

当前是 One Person Lab Web contract-truth baseline。仓库 canonical 叙事已经收敛为 One Person Lab Web，durable machine truth 由 contracts、source、tests、scripts 和 closeouts 持有。

## Machine Truth

- Product boundary: `contracts/web-product-profile.json`
- Product ID: `one-person-lab-web`
- Page state: `contracts/web-page-state-matrix.json`
- HTTP API: `contracts/web-api.openapi.json`
- Runtime gate and refs-only projection: `contracts/web-runtime-bridge.json`
- Release readiness: `contracts/web-release-profile.json`

Markdown docs explain those contracts. If docs and contracts disagree, contracts win and the prose must be corrected or retired in the same change.

## Active Change Work

No active change is open. 正式开发开始前必须创建 `changes/active/<change-id>/`，关闭时 compact archive 并删除 active package。

## Can Claim

- One Person Lab Web is the public Web edition of One Person Lab App at `opl.medopl.cn`.
- The Web UI calls only the same-origin Go control plane HTTP API.
- Users bind their own API Key while provider `base_url` remains fixed at `https://gflabtoken.cn/v1`.
- Runtime, node pool, storage, billing, API gateway, OPL execution, artifact body authority, and MAS/MAG/RCA domain judgment are not owned by this repo.
- Runtime-requiring markers such as `@基金` and `@论文` stop at a MedOPL Runtime gate unless future Go-side contract, eval, whitelist, and authorization boundaries admit more.
- Prior production evidence remains archived in `changes/archive/closeouts.md` and `deploy/web-cloud/RUNBOOK.md`; active truth does not duplicate one-off rollout prose.

## Cannot Claim

- 还不是完整 production-ready SaaS。
- 本阶段没有执行 production authenticated dogfood e2e。
- 本阶段没有新增真实 chat、billing、storage、runtime bridge、OPL worker、object storage、artifact body endpoint 或 production MedOPL runtime bridge。
- 不能执行 OPL install、repair、module exec、family-runtime mutation、engine install/update/remove。
- 不能返回 artifact body、memory body、domain verdict、private state path、mutation result 或 raw provider secret。

## Next Priorities

1. Browser e2e readiness: cover register/login/API Key/chat/runtime gate/audit without production secrets.
2. Production authenticated dogfood e2e evidence when manually enabled with approved secrets.
