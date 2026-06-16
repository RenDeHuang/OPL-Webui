# Design

- owner: figma-v3-preview
- state: active

## Final Vision

长期愿景是 OPL formal deliverable workbench：用户用中文 prompt 发起正式交付，系统在 tenant/workspace 边界内生成可追踪 task、证据、活动和 deliverable projection，后续接入 auth、artifact storage、queue/worker 和授权后的 OPL execution。

本变更只推进第一层：Figma V3 Preview。它让线上体验从旧 shell 变成可评估的 Genspark-like workbench，但不扩大运行边界。

## Reachability Assessment

最终愿景可以实现，但必须分层实现，不能一次把 UI、SaaS tenancy、OPL execution 和云端运营全部混在一个变更里。

- 短期可达：Figma V3 Preview。用现有 Go control plane projection 派生首页和轻量项目工作区，让公网入口先像目标产品。
- 中期可达：真实 SaaS workspace MVP。新增 Go-side workspace contract、auth/session、artifact storage、task history 和 tenant boundary tests。
- 长期可达：正式 OPL deliverable workbench。新增授权白名单、queue/worker、OPL execution eval、审计日志和人工确认边界。

当前仓库已经具备短期推进条件：有上线入口、有 Go control plane、有 `/api/mvp/task` 与 `/api/opl/snapshot`、有 lifecycle/gate/test 分类。当前不具备直接 claim 中长期愿景的条件：没有真实 auth、tenant admin、artifact store、queue/worker 或授权 OPL mutation contract。

## Gap-Based Development

开发以 gap 为单位推进：

`Current Truth -> Target Truth -> Gap List -> Phase Gate -> Closed Gap`

当前 truth 是 `cloud_mvp` shell；目标 truth 是 Figma `23:2 / 06 Genspark风格 V3`；约束 truth 是 Go control plane、OPL readonly 和 no mutation。

选择 gap-based development 是正确的：它把“最终愿景”拆成可验收差距，避免文档愿景膨胀、UI 先行失真、或测试只覆盖旧 shell。每个 gap 必须同时有 owner surface、测试/截图/eval 证据和 cannot-claim 边界。

## Gap Inventory

- UI gap: 旧 shell 缺少 V3 nav、登录/免费开始、大 prompt controls、工具胶囊、最近交付、提醒卡和项目工作区。
- Data gap: 现有 projection 只有 task、artifact、route 和 OPL readiness；V3 需要 project、stage、evidence、activity、deliverable preview view model。
- Test gap: 当前 smoke 只验证旧 shell 关键词，不验证 V3 structure。
- Visual gap: 当前没有本地 desktop/mobile screenshot 对照 Figma。
- Runtime gap: 当前没有 workspace overview contract；preview 阶段先不新增，后续真实 SaaS 工作区再补 Go-side contract。

## Phase Plan

1. Goal & Change Package: 建立本 change 包和动态验收。
2. Target Lock: 锁定 Figma target 和必须出现的 UI 区块。
3. Gap Inventory: 把 UI/data/test/visual/runtime gaps 转成 backlog。
4. Tests First: 让旧页面在 V3 smoke/contract tests 下失败。
5. UI Implementation: 实现 V3 Preview，不引入前端框架。
6. Local Visual Loop: 本地浏览器 desktop/mobile 截图对照 Figma。
7. Local Release Gate: `npm run verify`、`npm run gate:review`、Sentrux、console/network smoke。
8. Cloud Rollout & Online Acceptance: build/push、rollout、canary、HTTPS smoke、线上截图、compact closeout。

## Development Model

后续开发按 loop 执行，而不是先写完整 UI 再统一验收：

1. 选一个 gap。
2. 写 failing test 或截图验收点。
3. 实现最小闭环。
4. 本地跑 test、visual 和 gate。
5. 记录证据，关闭该 gap。
6. 进入下一个 gap。

第一轮只关闭 V3 Preview gap；真实 SaaS gap 和 OPL execution gap 进入后续 active change。

## Boundary

`apps/web` 只调用 Go control plane HTTP API。任何真实 OPL CLI mutation、runtime mutation、install、repair 或 module exec 都不属于本变更。
