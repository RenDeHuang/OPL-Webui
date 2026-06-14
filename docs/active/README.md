# Active Truth

- owner: product-engineering owner
- purpose: 当前阶段、可宣称范围和下一步唯一入口。
- state: active
- machine boundary: 非机器接口；机器判断来自 source、contracts、tests、scripts 和 Sentrux rules。

## Current Stage

当前是 `cloud-mvp-service-slice`：一个可本地启动、可云端部署的最小 SaaS 服务切片。

## Can Claim

- Web UI 通过同源 `/api/mvp/task` 调用 SaaS API。
- API 返回带 `tenantId`、`workspaceId`、`userId`、`runId` 的 task/artifact projection。
- OPL 调用仍通过 fail-closed mock adapter 和白名单 command policy。
- `npm run gate:review` 是默认 review gate。

## Cannot Claim

- 还不是完整公网多用户生产 SaaS。
- 还没有真实登录、数据库、队列、计费、真实 OPL execution 或生产部署证据。
- 还不能执行 OPL mutation、install、repair、module exec 或 family-runtime mutation。

## Next Cursor

下一步是部署最小服务，然后把 mock adapter 替换为只读真实 OPL CLI 探测边界。
