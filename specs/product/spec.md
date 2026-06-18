# Product Spec

- owner: product owner
- purpose: 产品定位和 MVP 主链路 durable spec。
- state: active
- machine boundary: contract 和验收在 tests。

## Requirements

- `product.web.identity`: OPL-Webui 是 Genspark-like one-person-lab-web with ChatGPT-like base chatbot，是 Web 版 One Person Lab App。
- `product.sources`: `one-person-lab` 是 framework/runtime/contract truth；`one-person-lab-app` 是 chat-first、complex knowledge work、research/grant/presentation foundry、progress/files/deliverables 的产品语义参考。
- `product.low-friction`: 用户访问 `opl.medopl.cn` 后注册/登录；用户填写自己的 API Key，即可普通聊天。
- `product.ui-shell`: 顶部导航必须暴露 One Person Lab Web、Chat、Capabilities、Settings、MedOPL；首屏是 Genspark-like hero prompt 和能力入口，主张必须表达“严肃工作的 AI 工作台”，不能退回普通后台表单。
- `product.figma-2-21-alignment`: 首页必须显著展示 Figma `2:21` 的五件事：选择专业工作、绑定真实材料、推进长任务、沉淀交付物、管理运行时；Capabilities 必须更像 Foundry 启动中心，而不是普通后台卡片网格。
- `product.settings`: `#settings` 必须聚焦账号/API Key 设置；展示登录状态、API Key 绑定状态、固定 `https://gflabtoken.cn/v1` 且不可编辑、masked key、保存/更新和退出登录。
- `product.chat-state`: anonymous 可看首页和能力但发送提示登录；authenticated_unbound 可绑定 API Key，普通 chat 提示绑定；authenticated_bound 可发送普通 chat。
- `product.fixed-provider`: base_url 固定为 `https://gflabtoken.cn/v1`，不允许用户自定义 base_url；API Key 属于用户自带 credential。
- `product.hidden-isolation`: backend 自动创建 hidden default personal workspace 和 personal tenant，用于隔离、计费投影和未来扩展；UI 不展示 workspace 产品。
- `product.medopl-boundary`: MedOPL 是充值、runtime、node pool、storage、账单和资源后台；OPL-Webui 不拥有 node pool 生命周期、billing source of truth 或 API gateway。
- `product.opl-gate`: `@基金`、`@论文`、`@综述`、`@长任务`、`@文件` 等能力需要 runtime/storage/node pool 时，只返回 MedOPL 开通提示，不伪造执行。
- `product.readonly`: OPL readonly snapshot/canary 可以展示 framework readiness，但不能写成真实 execution。
- `product.usage-quota`: usage/quota v1 是 Webui-side precheck/projection；最终计费归 MedOPL/sub2api。
- `product.chat-guardrails`: 普通 chat 必须有 Webui-side quota/abuse guardrail；超额停止在 `CHAT_QUOTA_EXCEEDED`，不能调用上游模型；该 guardrail 不等同于 billing，最终计费仍归 MedOPL/sub2api。
- `product.audit`: 注册、登录、API Key binding、普通 chat、runtime gate、quota exceeded 和 upstream failure 必须写 sanitized audit projection；audit 不能包含 password、raw API Key、session secret、DB URL 或真实 secret value。
- `product.production-required-env`: one-person-lab-web production rollout 需要 `opl-webui-postgres` 提供 `OPL_DATABASE_URL`，并需要 `opl-webui-auth` 提供 `OPL_TENANT_AUTH_SECRET`、`OPL_SESSION_SECRET`、`OPL_API_KEY_ENCRYPTION_SECRET`、`OPL_CHAT_MODEL`；仓库只保存 key 名和 manifest 引用，不保存 secret value。
- `product.production-evidence`: `1fc361d Figma workbench UI 已 production verified`，生产页面包含“严肃工作的 AI 工作台”、“OPL WebUI 应承接的五件事”、fixed gateway `https://gflabtoken.cn/v1` 和 MedOPL runtime gate 边界；生产 guard 已验证 unauth chat `401 AUTH_REQUIRED`、GET chat `405 METHOD_NOT_ALLOWED`、wrong credentials `401 INVALID_CREDENTIALS`。

## Cannot Claim

- `44dd574` 已有 one-person-lab-web production rollout evidence，但还不能宣称真实用户注册/login write-path online e2e、真实 API Key binding online e2e 或真实 chat completion online e2e。
- `1fc361d` 已有 Figma `2:21` UI alignment production evidence，但还不能宣称真实用户注册/login write-path online e2e、真实 API Key binding online e2e 或真实 chat completion online e2e。
- 当前不能宣称真实 OPL execution、MedOPL runtime status bridge、完整 billing、真实支付 provider、真实线上 chat quota/audit evidence 或完整 production ready SaaS。
