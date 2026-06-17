# Product Spec

- owner: product owner
- purpose: 产品定位和 MVP 主链路 durable spec。
- state: active
- machine boundary: 非机器接口；contract 和验收在 `packages/contracts` 与 `tests/**`。

## Requirements

- `product.mvp.chatbot`: OPL-Webui 是 ChatGPT-like OPL 前台入口；用户访问 `opl.medopl.cn` 登录后先使用普通 chatbot。
- `product.mvp.api-key`: 用户需要填写自己的 API Key；base_url 固定为 sub2api，不允许用户自定义 base_url。
- `product.mvp.hidden-isolation`: backend 可以保留 hidden default personal workspace，用于隔离、计费投影和未来扩展；UI 不展示 workspace、runtime、node pool、storage 概念。
- `product.mvp.medopl-boundary`: MedOPL 是充值、runtime、node pool、storage、账单和资源后台；OPL-Webui 不拥有 node pool 生命周期、billing source of truth 或 API gateway。
- `product.mvp.opl-capability-gate`: 当用户调用需要 OPL runtime 的能力，例如 `@基金`、`@论文`、长任务或文件处理时，才提示去 `medopl.medopl.cn` 开通 runtime / storage / node pool。
- `product.mvp.loop`: MVP 主链路是 chat -> optional @OPL capability gate -> task/run projection -> artifact projection。
- `product.mvp.tenant`: 后端 API projection 必须带 `tenantId`、`workspaceId` 和 `userId`，但这些是 hidden isolation ID，不是用户可见 workspace 产品。
- `product.mvp.style`: Genspark-like 只作为历史视觉参考；下一阶段交互目标是 ChatGPT-like base chatbot。
- `product.mvp.opl-readonly`: WebUI 必须显示真实 OPL readiness、domain modules 和 admitted domains，但不能把只读 snapshot 写成真实任务执行。
- `product.mvp.opl-route`: Task 卡片必须显示真实 OPL readonly route/handoff evidence，例如 routed domain 和 routing status。
- `product.mvp.usage-quota`: usage/quota v1 是 Webui-side precheck/projection；最终计费归 MedOPL/sub2api，不包含真实支付 provider 或复杂 plan 管理。

## Cannot Claim

- 未部署前不能宣称云端可用。
- 当前只接入真实 OPL readonly CLI snapshot 与 route/handoff evidence，不能宣称真实 OPL execution。
- 当前 usage/quota 只是 Webui-side precheck/projection，不能宣称完整 billing、真实支付或 MedOPL/sub2api 计费完成。
