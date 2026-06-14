# Active Truth

- owner: product-engineering owner
- purpose: 当前阶段、可宣称范围和下一步唯一入口。
- state: active
- machine boundary: 非机器接口；机器判断来自 source、contracts、tests、scripts 和 Sentrux rules。

## Current Stage

当前是 `opl-task-route-bridge`：Go control plane 已通过白名单连接真实 OPL CLI 只读 snapshot、domain resolve 和 handoff envelope surfaces。

## Can Claim

- Web UI 通过同源 `/api/mvp/task` 调用 Go control plane。
- Go API 返回带 `tenantId`、`workspaceId`、`userId`、`runId` 和 OPL readonly route evidence 的 task/artifact projection。
- Task projection 已通过 Go-side `TaskStore` 边界保存；当前默认实现是内存 store，不是生产数据库。
- Runtime 已按 `OPL_DATABASE_URL` 选择 task store；未配置时用 memory store，配置后用 pgx-backed Postgres store，打开、ping 或 schema 初始化失败时 fail closed。
- Web UI 通过同源 `/api/opl/snapshot` 展示真实 OPL CLI 只读 snapshot。
- OPL snapshot 聚合 `opl system initialize --json`、`opl modules --json`、`opl contract domains --json`。
- Task intake 通过 `opl domain resolve-request --json` 和 `opl contract handoff-envelope --json` 生成只读路由证据。
- Go control plane 可通过 Dockerfile 构建容器，容器内默认监听 `0.0.0.0:4173`。
- 容器默认 `OPL_CLI_PATH=/opt/opl/bin/opl`；部署时应把 OPL CLI 作为外部只读依赖挂载或安装到该路径，不把 `one-person-lab` 主仓复制进 WebUI 镜像。
- `GET /healthz` 可用于云平台 HTTP health check。
- `GET /readyz` 暴露生产依赖闸门；`OPL_WEBUI_ENV=production` 缺 auth、db、queue、object store、billing 或 worker 配置时会阻断 task intake。
- Task/artifact 本体仍是 projection；OPL route/snapshot 是真实 CLI readonly，不 import OPL internals，不执行 mutation。
- `npm run gate:review` 是默认 review gate。

## Cannot Claim

- 还不是完整公网多用户生产 SaaS。
- 还没有真实登录、数据库、队列、计费、真实 OPL execution 或生产运行证据。
- 还不能执行 OPL mutation、install、repair、module exec 或 family-runtime mutation。

## Next Cursor

下一步是选择云平台部署预览环境，并把 OPL CLI 挂载缺失时的 route failure/degraded 状态做成更清晰的 UI 状态。
