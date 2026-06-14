# Product Spec

- owner: product owner
- purpose: 产品定位和 MVP 主链路 durable spec。
- state: active
- machine boundary: 非机器接口；contract 和验收在 `packages/contracts` 与 `tests/**`。

## Requirements

- `product.mvp.workspace`: UI 是中文 AI workspace，不是传统后台 dashboard。
- `product.mvp.loop`: MVP 主链路是 intake -> task run -> artifact projection -> review-ready output。
- `product.mvp.tenant`: 所有 API projection 必须带 `tenantId`、`workspaceId` 和 `userId`。
- `product.mvp.style`: Genspark-like 只作为交互参考，产品语义服务于 OPL formal deliverable workbench。
- `product.mvp.opl-readonly`: WebUI 必须显示真实 OPL readiness、domain modules 和 admitted domains，但不能把只读 snapshot 写成真实任务执行。
- `product.mvp.opl-route`: Task 卡片必须显示真实 OPL readonly route/handoff evidence，例如 routed domain 和 routing status。

## Cannot Claim

- 未部署前不能宣称云端可用。
- 当前只接入真实 OPL readonly CLI snapshot 与 route/handoff evidence，不能宣称真实 OPL execution。
