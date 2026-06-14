# Active Truth

- owner: product-engineering owner
- purpose: 当前阶段、可宣称范围和下一步唯一入口。
- state: active
- machine boundary: 非机器接口；机器判断来自 source、contracts、tests、scripts 和 Sentrux rules。

## Current Stage

当前是 `opl-readonly-bridge`：Go control plane 已通过白名单连接真实 OPL CLI 只读 JSON surfaces。

## Can Claim

- Web UI 通过同源 `/api/mvp/task` 调用 Go control plane。
- Go API 返回带 `tenantId`、`workspaceId`、`userId`、`runId` 的 task/artifact projection。
- Web UI 通过同源 `/api/opl/snapshot` 展示真实 OPL CLI 只读 snapshot。
- OPL snapshot 聚合 `opl system initialize --json`、`opl modules --json`、`opl contract domains --json`。
- Go control plane 可通过 Dockerfile 构建容器，容器内默认监听 `0.0.0.0:4173`。
- `GET /healthz` 可用于云平台 HTTP health check。
- Task/artifact projection 仍是 mock；OPL snapshot 是真实 CLI readonly，不 import OPL internals，不执行 mutation。
- `npm run gate:review` 是默认 review gate。

## Cannot Claim

- 还不是完整公网多用户生产 SaaS。
- 还没有真实登录、数据库、队列、计费、真实 OPL execution 或生产运行证据。
- 还不能执行 OPL mutation、install、repair、module exec 或 family-runtime mutation。

## Next Cursor

下一步是把 task intake 从 mock projection 升级为 OPL handoff-envelope/domain resolve 只读路由，再选择云平台部署预览环境。
