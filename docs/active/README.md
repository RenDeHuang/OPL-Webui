# Active Truth

- owner: product-engineering owner
- purpose: 当前阶段、可宣称范围和下一步唯一入口。
- state: active
- machine boundary: source、contracts、tests、scripts 和 Sentrux rules。

## Current Stage

当前是 `one-person-lab-web-production-verified`：OPL-Webui 已重新校准为 Genspark-like one-person-lab-web with ChatGPT-like base chatbot，并已有 `44dd574` 生产 rollout evidence。`one-person-lab` 是 framework/runtime/contract truth；`one-person-lab-app` 是桌面端产品语义参考，包括 chat-first、complex knowledge work、research/grant/presentation foundry、progress/files/deliverables。

## Active Change Work

- 当前没有必须保留的 active preview blocker。历史 `figma-v3-preview` 已退役为 archive；当前主线是 one-person-lab-web。

## Can Claim

- Web UI 只调用同源 Go control plane HTTP API；Go control plane 是唯一后端业务入口。
- OPL-Webui 是 Web 版 One Person Lab App 前台入口，不是 MedOPL runtime/node pool/storage/billing 后台，也不拥有 API gateway。
- UI 是 Genspark-like one-person-lab-web，并提供低门槛 ChatGPT-like base chatbot 首屏；不再使用旧 `demoData.mjs`、旧 demo artifact、`demo://` 或用户可见 workspace preview。
- 支持 public account 本地 contract：`POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/session/current`，使用 bcrypt password hash 和 HttpOnly `opl_session`。
- 每个 public account 自动拥有 hidden default personal workspace 和 personal tenant，用于隔离、计费投影和未来扩展；UI 不展示 workspace 产品。
- 支持用户 API Key binding 本地 contract：`GET/PUT /api/settings/model-provider`；base_url 固定为 `https://gflabtoken.cn/v1`，不允许客户端传入或覆盖 base_url；后端不返回 raw API Key。
- API Key 持久化必须使用 `OPL_API_KEY_ENCRYPTION_SECRET` 加密；session 使用独立 `OPL_SESSION_SECRET`；`OPL_CHAT_MODEL` 是 server-side 默认模型配置。
- 支持普通 chat 本地 contract：`POST /api/chat` 会用用户 API Key 调 OpenAI-compatible `https://gflabtoken.cn/v1/chat/completions`；未登录返回 `AUTH_REQUIRED`，未绑 Key 返回 `API_KEY_REQUIRED`，上游错误结构化返回。
- 支持 `GET /api/chat/conversations` 与 `GET /api/chat/conversations/{conversationId}`；user A 不能读取 user B conversation。
- 支持 @OPL capability gate 本地 contract：`@基金`、`@论文`、`@综述`、`@长任务`、`@文件` 返回 `RUNTIME_REQUIRED` 和 `https://medopl.medopl.cn` deep link，不调用 sub2api，不伪造 OPL execution。
- 保留 `/api/opl/snapshot`、`canary db`、`canary opl-cli` 的 OPL readonly/canary 能力；readonly route 不能写成真实 execution。
- `deploy/cloud-mvp/opl-webui.k8s.json` 已引用 `OPL_DATABASE_URL`、`OPL_TENANT_AUTH_SECRET`、`OPL_SESSION_SECRET`、`OPL_API_KEY_ENCRYPTION_SECRET`、`OPL_CHAT_MODEL` SecretRef；runbook 记录 cloud MVP handoff、daily rollout、canary、HTTPS smoke、HA/安全组和 rollback。
- 既有线上 evidence 仍有效：`24ba41f` session/auth boundary rollout revision `9` 已验证 `/healthz` 200、`/readyz` 200、`/metricsz` 200、首页 200、DB canary pass、OPL CLI canary pass；`fa3bcb7` hidden tenant/workspace isolation projection v1 已 production verified；`bc0403d` usage/quota precheck/projection v1 已 production rollout + unauth guard verified。
- `44dd574` one-person-lab-web 已 production verified：镜像 `uswccr.ccs.tencentyun.com/webopl/opl-webui:44dd574`，rollout revision `13`；Pod `opl-webui-control-plane-69c859465f-v9crb` `1/1 Running`、restarts `0`、image tag `44dd574`；`/healthz` 200、`/readyz` 200 `missing=[]`、`/metricsz` 200 `missingDependencyCount=0`、首页 200；DB canary `open,ping,schema,write,read,delete` pass；OPL CLI canary `system.initialize,connect.modules,contract.domains` pass；unauth guard：`/api/auth/login` 401 `INVALID_CREDENTIALS`、`/api/chat` 401 `AUTH_REQUIRED`；public smoke：`https://opl.medopl.cn/healthz` HTTP/2 200、`https://opl.medopl.cn/readyz` HTTP/2 200 `missing=[]`。
- 云端受控修复已同步回 truth：`opl-webui-auth` 保留 `OPL_TENANT_AUTH_SECRET`，并新增 `OPL_SESSION_SECRET`、`OPL_API_KEY_ENCRYPTION_SECRET`、`OPL_CHAT_MODEL`；Deployment manifest 声明这些 `secretKeyRef`，不保存 secret value。
- usage/quota v1 是 Webui-side precheck/projection；最终计费归 MedOPL/sub2api。
- MedOPL 是充值、runtime、node pool、storage、账单和资源后台；OPL-Webui 不拥有 node pool 生命周期、billing source of truth 或 API gateway。

## Cannot Claim

- 还不是完整公网 production ready SaaS。
- 还没有真实用户注册/login write-path online e2e、真实 API Key binding online e2e、真实 chat completion online e2e、真实邮箱验证、找回密码、workspace invitation、复杂 RBAC、支付 provider、MedOPL runtime status bridge、OPL worker、object storage 或真实 OPL execution/mutation。
- 还不能执行 OPL install、repair、module exec、family-runtime mutation。
- 还不能 claim `@OPL` 能力已经真实运行；当前只是 runtime gate projection。

## Next Cursor

下一步进入 MedOPL runtime status bridge：`@OPL` 能力仍只能返回 `RUNTIME_REQUIRED`，需要先接入 MedOPL runtime/storage/node pool 状态 projection，再推进 OPL run/artifact projection。

## Next Priorities

1. MedOPL runtime status bridge。
2. @OPL run/artifact projection。
3. API Key rotation/revocation 和 account hardening。
4. 真实注册/login write-path online e2e、API Key binding online e2e 和 chat completion online e2e。
5. HA/安全组收敛云端执行验证。
