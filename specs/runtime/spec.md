# Runtime Spec

- owner: runtime owner
- purpose: Go control plane 和运行边界 durable spec。
- state: active
- machine boundary: 机器接口在 `services/control-plane-go`、`packages/contracts/opl/*.json` 和 tests。

## Requirements

- `runtime.go.mvp-task`: Go control plane 的 `POST /api/mvp/task` 创建 tenant-scoped task/artifact projection。
- `runtime.go.chat-front-door`: Go control plane 是 OPL-Webui 唯一后端业务入口，服务 ChatGPT-like OPL 前台；Web UI 不直接调用 sub2api、MedOPL 或 OPL CLI。
- `runtime.go.fixed-sub2api`: 用户 API Key binding 后只能走固定 sub2api base_url；不允许用户自定义 base_url。当前还未实现 API Key binding 或 sub2api 转发。
- `runtime.go.medopl-resource-boundary`: MedOPL 是充值、runtime、node pool、storage、账单和资源后台；OPL-Webui 只消费 MedOPL 状态，不拥有 node pool 生命周期、billing source of truth 或 API gateway。
- `runtime.go.tenant-auth-boundary`: cloud/production 的 `medopl_launch_token` 模式必须用 HMAC Bearer launch token 注入 `tenantId`、`workspaceId`、`userId`；body identity 冲突返回 `TENANT_BOUNDARY_MISMATCH`，缺 token 返回 `AUTH_REQUIRED`。
- `runtime.go.session-boundary`: cloud/production 支持 `POST /api/session/launch` 用有效 `medopl_launch_token` 换取 HttpOnly `opl_session` cookie；后续 task create / lookup 可用该 cookie 注入 tenant/workspace/user。
- `runtime.go.session-current`: cloud/production 支持 `GET /api/session/current` 返回当前已认证 tenant/workspace/user projection，不返回 token、secret 或外部 IdP 数据。
- `runtime.go.hidden-workspace-persistence-v1`: control plane schema 包含 `users`、`tenants`、`tenant_memberships`、`workspaces` 和 `workspace_memberships`，作为 hidden default personal workspace isolation/projection，不是用户可见 workspace 产品。
- `runtime.go.workspace-current`: `GET /api/workspaces/current` 只从 bearer/session auth boundary 解析 tenant/workspace/user；缺 auth 返回 `AUTH_REQUIRED`，缺 membership 返回 `MEMBERSHIP_REQUIRED`；该 API 是内部投影边界，不要求 UI 展示 workspace 概念。
- `runtime.go.saas-task-api`: `GET /api/tasks`、`POST /api/tasks` 和 `GET /api/tasks/{taskId}` 只使用 auth-derived tenant/workspace/user；客户端 body 自报 identity 会被 strict JSON 拒绝。
- `runtime.go.saas-task-isolation`: tenant/workspace/user 不匹配 fail closed；tenant A 不能读取 tenant B task。
- `runtime.go.boundary-stable-id`: `tenantId`、`workspaceId`、`userId` 必须是 stable boundary ID，禁止 path separator、空格和过长值进入 task projection 或 launch-token claims。
- `runtime.go.task-store`: Task projection 必须通过 `TaskStore` 边界保存；当前默认是内存 store，后续 Postgres adapter 只能替换该接口。
- `runtime.go.postgres-task-store`: Postgres adapter 只实现 `TaskStore` 边界和 schema 常量，不引入 ORM，不改变 HTTP task lifecycle。
- `runtime.go.postgres-task-user`: Postgres `task_projections` 必须显式保存 `user_id`，为后续 usage/quota/audit 提供 user boundary。
- `runtime.go.usage-ledger`: Postgres task write path 必须在 transaction 中写入 tenant/workspace/user scoped `usage_events`，记录 `task.created` event。
- `runtime.go.usage-quota-v1`: `POST /api/tasks` 必须在保存 task projection 前执行 hidden tenant/workspace task quota precheck；未超额时 task projection 和 usage event 同边界写入，超额时返回 `QUOTA_EXCEEDED` 且不写 task projection 或 usage event。
- `runtime.go.workspace-usage-quota`: `GET /api/workspaces/current` 必须返回最小 usage/quota projection，包括 plan、task quota、usage period、used count 和 remaining count，不返回 secret、token 或 payment provider 数据；最终计费归 MedOPL/sub2api。
- `runtime.go.task-store-wiring`: runtime 启动时按 `OPL_DATABASE_URL` 选择 store；未配置时用 memory store，配置后用 pgx-backed Postgres store，打开、ping 或 schema 初始化失败时 fail closed。
- `runtime.go.static`: Go control plane 同进程服务 `apps/web` 静态页面和 `/api/mvp/task`。
- `runtime.deploy.container`: Dockerfile 构建 Go control plane 容器，并复制 `apps/web`。
- `runtime.deploy.cloud-image`: `Dockerfile.cloud` 构建 TKE 镜像，并从外部 OPL build context 复制 `bin/opl`、`contracts/opl-framework` 和 production `node_modules` 到 `/opt/opl`，同时从 OPL `src` 在构建期重新生成 `/opt/opl/dist`。
- `runtime.deploy.address`: 本机默认监听 `127.0.0.1:4173`；容器通过 `HOST=0.0.0.0` 和 `PORT=4173` 对外监听。
- `runtime.deploy.opl-cli`: 容器默认读取 `OPL_CLI_PATH=/opt/opl/bin/opl`；OPL CLI 是外部只读运行依赖，不随 WebUI 镜像复制。
- `runtime.deploy.healthz`: `GET /healthz` 返回 JSON 健康状态，供云平台探活。
- `runtime.deploy.readyz`: `GET /readyz` 返回生产依赖就绪状态；当前 cloud MVP 要求 auth、database 和 OPL CLI。queue、object store、billing、worker、node pool 和 storage readiness 属于 MedOPL/resource bridge 后续，不是 OPL-Webui 的 source of truth。
- `runtime.deploy.metricsz`: `GET /metricsz` 返回只读 JSON monitoring projection，复用 runtime readiness truth，只暴露 service、environment、ready、missing dependency count 和 missing dependency keys；cloud rollout helper 必须把它纳入 HTTPS smoke。
- `runtime.deploy.production-gate`: `OPL_WEBUI_ENV=production` 且 `/readyz` 未就绪时，`POST /api/mvp/task` 必须 fail closed。
- `runtime.deploy.cloud-mvp-profile`: `OPL_WEBUI_ENV=cloud_mvp` 要求 `OPL_CLI_PATH`、`OPL_DATABASE_URL`、`OPL_TENANT_AUTH_MODE` 和 `OPL_TENANT_AUTH_SECRET`；queue、object store、billing、worker、node pool 和 storage 由 MedOPL/resource bridge 后续提供。
- `runtime.deploy.db-canary`: control-plane binary 提供 `canary db`，只从环境变量读取 `OPL_DATABASE_URL`，验证 Postgres open/ping/schema/write/read/delete，并且 JSON 报告不能泄露连接串。
- `runtime.deploy.opl-cli-canary`: control-plane binary 提供 `canary opl-cli`，只调用无 Codex/API key 依赖的 OPL snapshot readonly allowlist surfaces，不执行 install、repair、module exec、task-route passthrough 或 mutation。
- `runtime.deploy.cloud-mvp-shape`: `deploy/cloud-mvp/opl-webui.k8s.json` 固定 `opl.medopl.cn`、namespace、`uswccr` cloud stable HTTPS image、imagePullSecret、nodeSelector、resources、`qcloud` ingress class、TLS Secret `opl-webui-tls`、NodePort `32258`、`4173`、`/healthz`、`/readyz`、`cloud_mvp` env、`OPL_DATABASE_URL` 和 `OPL_TENANT_AUTH_SECRET` secretKeyRef。
- `runtime.deploy.cloud-mvp-runbook`: `deploy/cloud-mvp/RUNBOOK.md` 提供云端/VPC runner handoff 步骤，覆盖 TCR/CCR build/push、Postgres Secret 创建、qcloud HTTPS Secret 创建、镜像替换、apply、canary、HTTPS smoke、DNS、HA/安全组收敛设计和 rollback；真实 kubeconfig、数据库密码、证书 ID、云 API key 只能由外部路径或执行环境注入。
- `runtime.deploy.ha-sg-target`: HA/安全组目标态是两个可调度 TKE node、`replicas=2`、跨 `kubernetes.io/hostname` 分布、`PDB minAvailable=1`、公网只进 CLB `80,443`，NodePort `32258` 只接受 CLB 到节点访问。
- `runtime.opl.snapshot`: `GET /api/opl/snapshot` 通过 Go control plane 聚合真实 OPL CLI 只读 JSON surfaces。
- `runtime.opl.task-route`: `POST /api/mvp/task` 通过 Go control plane 读取 `opl domain resolve-request --json` 与 `opl contract handoff-envelope --json`，只返回 route/handoff evidence。
- `runtime.opl.cli-allowlist`: snapshot 允许 `opl system initialize --json`、`opl connect modules --json`、`opl contract domains --json`；task route 允许 `opl domain resolve-request --json` 和 `opl contract handoff-envelope --json`。
- `runtime.opl.fail-closed`: OPL CLI 调用必须通过 Go-side allowlist；命令失败只返回 degraded projection，不执行替代 mutation。
- `runtime.opl.no-mutation`: install、repair、module exec、family-runtime mutation 默认禁止。

## Cannot Claim

- 当前 runtime 不包含 ChatGPT-like base chatbot、用户 API Key 加密绑定、fixed sub2api 转发、MedOPL runtime opening deep link、runtime status bridge、多节点 HA/安全组收敛、HTTP->HTTPS 强制跳转、真实支付/计费 provider、OPL worker、完整 production ready 运行证据或真实 OPL mutation。
