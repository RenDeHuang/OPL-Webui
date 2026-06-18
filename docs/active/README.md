# Active Truth

- owner: product-engineering owner
- purpose: 当前阶段、可宣称范围和下一步唯一入口。
- state: active
- machine boundary: source、contracts、tests、scripts 和 Sentrux rules。

## Current Stage

当前是 `dogfood-e2e-readiness-parity-map-local`：`9cbb4a3` 已 production verified，`95ec6ee` 是 closeout 文档提交；本阶段在 `figma-2-21-ui-alignment-production` 后不 rollout，只做本地连续开发。Slice A 建立 dogfood e2e harness，用 mock upstream 串联 register/login/current session/API Key binding/raw key 不回显/fixed gateway/普通 chat/quota/sanitized audit/@基金 MedOPL gate。Slice B 固化 one-person-lab-app parity v1：Web 承接 chat-first、purpose routing、progress/files/deliverables refs 和 runtime gate 产品语义，不承接 desktop packaging、local CLI mutation、artifact body、runtime 生命周期、storage 或 billing。

## Active Change Work

- 当前没有必须保留的 active preview blocker。历史 `figma-v3-preview` 已退役为 archive；当前主线是 one-person-lab-web，最近 UI alignment source 是 Figma `2:21`。

## Can Claim

- Web UI 只调用同源 Go control plane HTTP API；Go control plane 是唯一后端业务入口。
- OPL-Webui 是 Web 版 One Person Lab App 前台入口，不是 MedOPL runtime/node pool/storage/billing 后台，也不拥有 API gateway。
- UI 是 Genspark-like one-person-lab-web，并提供低门槛 ChatGPT-like base chatbot 首屏；首屏主张是“严肃工作的 AI 工作台”；不再使用旧 `demoData.mjs`、旧 demo artifact、`demo://` 或用户可见 workspace preview。
- UI alignment 本地可 dogfood：顶部导航包含 Chat、Capabilities、Settings、MedOPL；首屏保留大 prompt console 和能力 capsules，并显著展示 Figma `2:21` 的五件事：选择专业工作、绑定真实材料、推进长任务、沉淀交付物、管理运行时；Capabilities 是 Foundry 启动中心；`#settings` 聚焦账号与凭据状态区；消息列表、设置表单和 runtime gate 已产品化。
- Capability view model 已从纯手写数组推进为 source-path pinned manifest：source 指向 `one-person-lab-app/contracts/app-product-profile.json` 和 `one-person-lab/contracts/opl-framework/domains.json`；暴露 MAS/MAG/RCA 对应的 Research/Grant/Presentation parity，并声明 `dynamicSync=false`。GitHub `ls-remote` 本轮 TLS/连接失败，因此还不能 claim commit-SHA pinned dynamic sync。
- 支持 public account 本地 contract：`POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/session/current`，使用 bcrypt password hash 和 HttpOnly `opl_session`。
- 每个 public account 自动拥有 hidden default personal workspace 和 personal tenant，用于隔离、计费投影和未来扩展；UI 不展示 workspace 产品。
- 支持用户 API Key binding 本地 contract：`GET/PUT /api/settings/model-provider`；base_url 固定为 `https://gflabtoken.cn/v1`，不允许客户端传入或覆盖 base_url；后端不返回 raw API Key。
- API Key 持久化必须使用 `OPL_API_KEY_ENCRYPTION_SECRET` 加密；session 使用独立 `OPL_SESSION_SECRET`；`OPL_CHAT_MODEL` 是 server-side 默认模型配置。
- 支持普通 chat 本地 contract：`POST /api/chat` 会用用户 API Key 调 OpenAI-compatible `https://gflabtoken.cn/v1/chat/completions`；未登录返回 `AUTH_REQUIRED`，未绑 Key 返回 `API_KEY_REQUIRED`，上游错误结构化返回。
- 支持 Webui-side dogfood guardrail 本地 contract：普通 chat 在 upstream 前执行 per-user monthly quota/abuse precheck，超额返回 `429 CHAT_QUOTA_EXCEEDED` 且不调用 upstream；`GET /api/account/audit-events` 只返回当前用户 sanitized audit events，覆盖 `account.registered`、`account.login`、`api_key.saved`、`runtime_gate.required`、`chat.completed`、`chat.quota_exceeded`、`chat.upstream_failed`，不记录 password、raw API Key、session secret 或 DB URL。
- 支持本地 dogfood e2e readiness contract：只用 fake/mock upstream，不连接真实 gflabtoken、MedOPL production、PostgreSQL 或真实 API Key；`@OPL` runtime gate 不消耗普通 chat quota，也不触发 upstream。
- 支持 `GET /api/chat/conversations` 与 `GET /api/chat/conversations/{conversationId}`；user A 不能读取 user B conversation。
- 支持 @OPL capability gate 本地 contract：`@基金`、`@论文`、`@综述`、`@长任务`、`@文件` 返回 `RUNTIME_REQUIRED` 和 `https://medopl.medopl.cn` deep link，不调用 sub2api，不伪造 OPL execution。
- 保留 `/api/opl/snapshot`、`canary db`、`canary opl-cli` 的 OPL readonly/canary 能力；readonly route 不能写成真实 execution。
- `deploy/cloud-mvp/opl-webui.k8s.json` 已引用 `OPL_DATABASE_URL`、`OPL_TENANT_AUTH_SECRET`、`OPL_SESSION_SECRET`、`OPL_API_KEY_ENCRYPTION_SECRET`、`OPL_CHAT_MODEL` SecretRef；runbook 记录 cloud MVP handoff、daily rollout、canary、HTTPS smoke、HA/安全组和 rollback。
- 既有线上 evidence 仍有效：`24ba41f` session/auth boundary rollout revision `9` 已验证 `/healthz` 200、`/readyz` 200、`/metricsz` 200、首页 200、DB canary pass、OPL CLI canary pass；`fa3bcb7` hidden tenant/workspace isolation projection v1 已 production verified；`bc0403d` usage/quota precheck/projection v1 已 production rollout + unauth guard verified。
- `44dd574` one-person-lab-web 已 production verified：镜像 `uswccr.ccs.tencentyun.com/webopl/opl-webui:44dd574`，rollout revision `13`；Pod `opl-webui-control-plane-69c859465f-v9crb` `1/1 Running`、restarts `0`、image tag `44dd574`；`/healthz` 200、`/readyz` 200 `missing=[]`、`/metricsz` 200 `missingDependencyCount=0`、首页 200；DB canary `open,ping,schema,write,read,delete` pass；OPL CLI canary `system.initialize,connect.modules,contract.domains` pass；unauth guard：`/api/auth/login` 401 `INVALID_CREDENTIALS`、`/api/chat` 401 `AUTH_REQUIRED`；public smoke：`https://opl.medopl.cn/healthz` HTTP/2 200、`https://opl.medopl.cn/readyz` HTTP/2 200 `missing=[]`。
- `1fc361d Figma workbench UI 已 production verified`：镜像 `uswccr.ccs.tencentyun.com/webopl/opl-webui:1fc361d`，rollout revision `14`；Running Ready Pod `opl-webui-control-plane-54546f5bff-h8xcq` `1/1 Running`；Error/Failed Pod none；`/healthz` 200、`/readyz` 200 `missing=[]`、`/metricsz` 200、`/` 200、`/#settings` 200 且返回新版 One Person Lab Web HTML；页面包含“严肃工作的 AI 工作台”、“OPL WebUI 应承接的五件事”和 fixed gateway `https://gflabtoken.cn/v1`；unauth guard：`POST /api/chat` no cookie 401 `AUTH_REQUIRED`、`GET /api/chat` 405 `METHOD_NOT_ALLOWED`、wrong credentials `POST /api/auth/login` 401 `INVALID_CREDENTIALS`。
- `9cbb4a3 dogfood guardrails + capability source-path manifest 已 production verified`：镜像 `uswccr.ccs.tencentyun.com/webopl/opl-webui:9cbb4a3`，rollout revision `15`；Running Ready Pod `opl-webui-control-plane-6c6f59bf5f-vpmvk` `1/1 Running`；Error/Failed Pod none；`/healthz` 200、`/readyz` 200 `missing=[]`、`/metricsz` 200、`/` 200；页面包含“严肃工作的 AI 工作台”和 fixed gateway `https://gflabtoken.cn/v1`；public JS 暴露 capability manifest evidence `syncMode: 'source_path_pinned_manifest'` 且 `dynamicSync=false`；`@基金` / MedOPL Runtime gate evidence 存在，页面包含 `@基金`、`MedOPL Runtime`，JS appends `需要 MedOPL Runtime`；contract-backed dogfood guardrails 保留 `CHAT_QUOTA_EXCEEDED` 与 sanitized audit；No real OPL runtime was executed or created；unauth guard：`POST /api/chat` no cookie 401 `AUTH_REQUIRED`、wrong credentials `POST /api/auth/login` 401 `INVALID_CREDENTIALS`。
- 云端受控修复已同步回 truth：`opl-webui-auth` 保留 `OPL_TENANT_AUTH_SECRET`，并新增 `OPL_SESSION_SECRET`、`OPL_API_KEY_ENCRYPTION_SECRET`、`OPL_CHAT_MODEL`；Deployment manifest 声明这些 `secretKeyRef`，不保存 secret value。
- usage/quota v1 是 Webui-side precheck/projection；最终计费归 MedOPL/sub2api。
- chat quota/audit guardrail 是 Webui-side abuse protection 和审计投影，不是 billing source of truth；最终计费仍归 MedOPL/sub2api。
- MedOPL 是充值、runtime、node pool、storage、账单和资源后台；OPL-Webui 不拥有 node pool 生命周期、billing source of truth 或 API gateway。

## Cannot Claim

- 还不是完整公网 production ready SaaS。
- 还没有 Figma 精确还原、Genspark 线上对照验收或真实用户端到端业务写路径证据。
- 还不能 claim Figma 精确还原或真实 Genspark 线上对照验收。
- 还没有真实用户注册/login write-path online e2e、真实 API Key binding online e2e、真实 chat completion online e2e、真实 authenticated quota/audit write-path online evidence、真实邮箱验证、找回密码、workspace invitation、复杂 RBAC、支付 provider、MedOPL runtime status bridge、OPL worker、object storage、完整 billing、上游 commit-SHA pinned dynamic sync 或真实 OPL execution/mutation。
- 还没有 OPL task/progress/artifact refs projection endpoint；任何 projection 只能是 refs-only，不能返回 artifact body、memory body、domain verdict 或私有 state path。
- 还不能执行 OPL install、repair、module exec、family-runtime mutation。
- 还不能 claim `@OPL` 能力已经真实运行；当前只是 runtime gate projection。

## Next Cursor

下一步进入 refs-only OPL task/progress/artifact projection 或 MedOPL runtime status bridge：projection 来源只能是白名单 OPL CLI JSON surface 或 MedOPL status projection，`@OPL` 仍只能返回 `RUNTIME_REQUIRED`，不能伪造 runtime ready 或 execution。

## Next Priorities

1. MedOPL runtime status bridge。
2. 上游 capability manifest commit-SHA pin。
3. @OPL run/artifact projection。
4. API Key rotation/revocation 和 account hardening。
5. 真实注册/login write-path online e2e、API Key binding online e2e 和 chat completion online e2e。
