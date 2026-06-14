# Runtime Spec

- owner: runtime owner
- purpose: Go control plane 和运行边界 durable spec。
- state: active
- machine boundary: 机器接口在 `services/control-plane-go`、`packages/contracts/opl/*.json` 和 tests。

## Requirements

- `runtime.go.mvp-task`: Go control plane 的 `POST /api/mvp/task` 创建 tenant-scoped task/artifact projection。
- `runtime.go.task-store`: Task projection 必须通过 `TaskStore` 边界保存；当前默认是内存 store，后续 Postgres adapter 只能替换该接口。
- `runtime.go.postgres-task-store`: Postgres adapter 只实现 `TaskStore` 边界和 schema 常量，不引入 ORM，不改变 HTTP task lifecycle。
- `runtime.go.task-store-wiring`: runtime 启动时按 `OPL_DATABASE_URL` 选择 store；未配置时用 memory store，配置后用 pgx-backed Postgres store，打开、ping 或 schema 初始化失败时 fail closed。
- `runtime.go.static`: Go control plane 同进程服务 `apps/web` 静态页面和 `/api/mvp/task`。
- `runtime.deploy.container`: Dockerfile 构建 Go control plane 容器，并复制 `apps/web`。
- `runtime.deploy.address`: 本机默认监听 `127.0.0.1:4173`；容器通过 `HOST=0.0.0.0` 和 `PORT=4173` 对外监听。
- `runtime.deploy.opl-cli`: 容器默认读取 `OPL_CLI_PATH=/opt/opl/bin/opl`；OPL CLI 是外部只读运行依赖，不随 WebUI 镜像复制。
- `runtime.deploy.healthz`: `GET /healthz` 返回 JSON 健康状态，供云平台探活。
- `runtime.deploy.readyz`: `GET /readyz` 返回生产依赖就绪状态；production 缺 auth、database、queue、object store、billing 或 worker 配置时返回 `503`。
- `runtime.deploy.production-gate`: `OPL_WEBUI_ENV=production` 且 `/readyz` 未就绪时，`POST /api/mvp/task` 必须 fail closed。
- `runtime.deploy.cloud-mvp-profile`: `OPL_WEBUI_ENV=cloud_mvp` 要求 `OPL_CLI_PATH`、`OPL_DATABASE_URL` 和 `OPL_TENANT_AUTH_MODE`；queue、object store、billing 和 worker 仍属于 production 后续阶段。
- `runtime.deploy.db-canary`: control-plane binary 提供 `canary db`，只从环境变量读取 `OPL_DATABASE_URL`，验证 Postgres open/ping/schema/write/read/delete，并且 JSON 报告不能泄露连接串。
- `runtime.deploy.opl-cli-canary`: control-plane binary 提供 `canary opl-cli`，只调用 OPL readonly allowlist surfaces，不执行 install、repair、module exec 或 mutation。
- `runtime.deploy.cloud-mvp-shape`: `deploy/cloud-mvp/opl-webui.k8s.json` 固定 `opl.medopl.cn`、`4173`、`/healthz`、`/readyz`、`cloud_mvp` env 和 `OPL_DATABASE_URL` secretKeyRef；该 fixture 是声明式形状，不代表已经执行 kubectl 或公网部署。
- `runtime.opl.snapshot`: `GET /api/opl/snapshot` 通过 Go control plane 聚合真实 OPL CLI 只读 JSON surfaces。
- `runtime.opl.task-route`: `POST /api/mvp/task` 通过 Go control plane 读取 `opl domain resolve-request --json` 与 `opl contract handoff-envelope --json`，只返回 route/handoff evidence。
- `runtime.opl.cli-allowlist`: snapshot 允许 `opl system initialize --json`、`opl modules --json`、`opl contract domains --json`；task route 允许 `opl domain resolve-request --json` 和 `opl contract handoff-envelope --json`。
- `runtime.opl.fail-closed`: OPL CLI 调用必须通过 Go-side allowlist；命令失败只返回 degraded projection，不执行替代 mutation。
- `runtime.opl.no-mutation`: install、repair、module exec、family-runtime mutation 默认禁止。

## Cannot Claim

- 当前 runtime 不包含队列、计费、object storage、worker、真实公网运行证据或真实 OPL mutation。
