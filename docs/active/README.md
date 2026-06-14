# Active Truth

- owner: product-engineering owner
- purpose: 当前阶段、可宣称范围和下一步唯一入口。
- state: active
- machine boundary: 非机器接口；机器判断来自 source、contracts、tests、scripts 和 Sentrux rules。

## Current Stage

当前是 `deploy-container-readiness`：Go control plane 具备通用容器部署入口和健康检查。

## Can Claim

- Web UI 通过同源 `/api/mvp/task` 调用 Go control plane。
- Go API 返回带 `tenantId`、`workspaceId`、`userId`、`runId` 的 task/artifact projection。
- Go control plane 可通过 Dockerfile 构建容器，容器内默认监听 `0.0.0.0:4173`。
- `GET /healthz` 可用于云平台 HTTP health check。
- OPL projection 仍是 mock readonly，不 import OPL internals，不执行 mutation。
- `npm run gate:review` 是默认 review gate。

## Cannot Claim

- 还不是完整公网多用户生产 SaaS。
- 还没有真实登录、数据库、队列、计费、真实 OPL execution 或生产运行证据。
- 还不能执行 OPL mutation、install、repair、module exec 或 family-runtime mutation。

## Next Cursor

下一步是选择云平台并部署 Go control plane 预览环境，然后把 mock OPL projection 替换为只读真实 OPL CLI 探测边界。
