# Runtime Spec

- owner: runtime owner
- purpose: Go control plane 和运行边界 durable spec。
- state: active
- machine boundary: `services/control-plane-go` 和 tests。

## Requirements

- `runtime.webapp.entry`: Go control plane 是 OPL-Webui 唯一后端业务入口，服务 Genspark-like one-person-lab-web with ChatGPT-like base chatbot。
- `runtime.webapp.auth`: 支持 `POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/session/current`；password 使用 bcrypt hash；session 是 HttpOnly `opl_session`。
- `runtime.webapp.session-secret`: session 使用 `OPL_SESSION_SECRET`，不得复用 API Key encryption secret。
- `runtime.webapp.hidden-isolation`: 注册账号时创建 hidden personal tenant/workspace，用于隔离和未来计费；UI 不展示 workspace 产品。
- `runtime.webapp.provider`: `GET/PUT /api/settings/model-provider` 只支持 provider `gflabtoken` 和固定 base_url `https://gflabtoken.cn/v1`；JSON decoder 必须 DisallowUnknownFields，body 中出现 `base_url` 必须失败。
- `runtime.webapp.api-key`: raw API Key 不返回、不打印、不写日志；持久化必须用 `OPL_API_KEY_ENCRYPTION_SECRET` 加密，并只返回 masked key。
- `runtime.webapp.chat`: `POST /api/chat` 从 session 推导 user/tenant/workspace，未登录返回 `AUTH_REQUIRED`，未绑定 API Key 返回 `API_KEY_REQUIRED`，普通消息调用 `https://gflabtoken.cn/v1/chat/completions`。
- `runtime.webapp.chat-quota`: 普通 chat 在调用 upstream 前执行 per-user monthly quota/abuse precheck；超额返回 `429 CHAT_QUOTA_EXCEEDED`，不得调用 sub2api/gflabtoken；`@OPL` runtime gate 不消耗普通 chat quota。
- `runtime.webapp.chat-errors`: upstream timeout/error 结构化返回，不把 raw API Key、session secret、encryption secret 或 DB URL 写入 response。
- `runtime.webapp.audit`: `GET /api/account/audit-events` 只返回当前 session 用户的 sanitized audit events；register/login/API Key/chat/runtime gate/quota exceeded/upstream failure 都必须写 audit projection，且不得保存或返回 password、raw API Key、session secret、encryption secret 或 DB URL。
- `runtime.webapp.conversations`: `GET /api/chat/conversations` 和 `GET /api/chat/conversations/{conversationId}` 必须按 user boundary fail closed；user A 不能读取 user B conversation。
- `runtime.webapp.opl-gate`: `@基金`、`@论文`、`@综述`、`@长任务`、`@文件` 返回 `RUNTIME_REQUIRED` 和 MedOPL deep link，不调用 sub2api，不伪造 OPL execution。
- `runtime.webapp.retired`: `/api/mvp/*`、旧 demo workspace route 和 `demoData.mjs` 不再是公开主线接口；无 consumer contract 时删除。
- `runtime.deploy.container`: Dockerfile 构建 Go control plane 容器，并复制 `apps/web`。
- `runtime.deploy.cloud-image`: `Dockerfile.cloud` 从外部 OPL build context 复制 `/opt/opl/bin/opl`、`contracts/opl-framework` 和 production OPL runtime assets。
- `runtime.deploy.auth-secret`: production manifest 必须从 `opl-webui-auth` 注入 `OPL_TENANT_AUTH_SECRET`、`OPL_SESSION_SECRET`、`OPL_API_KEY_ENCRYPTION_SECRET`、`OPL_CHAT_MODEL`；`OPL_TENANT_AUTH_SECRET` 保留给既有 launch-token/canary 边界，其他三项支撑 public account session、API Key 加密和 server-side chat model。
- `runtime.deploy.readyz`: `OPL_WEBUI_ENV=cloud_mvp` 必须要求 `OPL_CLI_PATH`、`OPL_DATABASE_URL`、`OPL_SESSION_SECRET`、`OPL_API_KEY_ENCRYPTION_SECRET`、`OPL_CHAT_MODEL`。
- `runtime.deploy.healthz`: `GET /healthz` 返回 JSON 健康状态。
- `runtime.deploy.metricsz`: `GET /metricsz` 返回 service、environment、ready、missing dependency count 和 missing dependency keys，不泄露 secret。
- `runtime.deploy.canary`: binary 提供 `canary db` 和 `canary opl-cli`；只验证 Postgres open/ping/schema/write/read/delete 和 OPL readonly surfaces。
- `runtime.opl.snapshot`: `GET /api/opl/snapshot` 聚合真实 OPL CLI 只读 JSON surfaces。
- `runtime.opl.no-mutation`: OPL install、repair、module exec、family-runtime mutation 默认禁止，除非新增 Go-side contract、eval、allowlist 和人工授权边界。

## Cannot Claim

- 当前 runtime 不包含真实 MedOPL runtime status bridge、OPL worker、object storage、完整 billing provider、多节点 HA/安全组执行证据、线上 audit/quota rollout evidence 或真实 OPL mutation。
- 当前 production evidence 不包含真实用户注册/login write-path online e2e、真实 API Key binding online e2e 或真实 chat completion online e2e。
