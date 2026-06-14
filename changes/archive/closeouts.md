# Archived Closeouts

- owner: product-engineering owner
- purpose: 单文件归档已关闭变更，避免每个切片继续增加 markdown 文件。
- state: active

## 2026-06-14 foundation-loop-contracts

- summary: 建立 repo governance、change lifecycle、test registry、review gate、bloat gate、OPL command policy、task/artifact contract 和 mock adapter。
- verified: `npm run gate:review`
- cannot claim: 真实 WebUI、SaaS API、数据库、多租户鉴权、真实 OPL execution。

## 2026-06-14 mvp-task-artifact-loop

- summary: 建立本地 demo vertical slice：task -> mock OPL adapter -> artifact projection。
- verified: `npm run gate:review`
- cannot claim: 真实 OPL execution、生产 API、WebUI、多租户鉴权、数据库或队列。

## 2026-06-14 web-demo-workspace-shell

- summary: 建立静态中文 AI workspace shell，展示 demo task/artifact projection。
- verified: `npm run gate:review`
- cannot claim: 完整 Genspark 复刻、真实登录、多租户数据库、真实 OPL execution 或生产部署。

## 2026-06-14 cloud-mvp-service-slice

- summary: 建立最小同源 MVP API 和 Web data bridge，返回 tenant-scoped task/artifact projection。
- verified: `npm run gate:review`, `sentrux check /home/dev/projects/ui`, local `curl /api/mvp/task`
- cannot claim: 真实生产部署、真实登录、多租户数据库、队列、计费或真实 OPL execution。

## 2026-06-14 go-control-plane-replacement

- summary: 用 Go control plane 替换 Node MVP API，删除旧 Node backend 和旧 API tests。
- verified: `npm run gate:review`, `sentrux check /home/dev/projects/ui`, local `curl /api/mvp/task`
- cannot claim: 真实生产部署、真实登录、多租户数据库、队列、计费或真实 OPL execution。

## 2026-06-14 post-go-cleanup

- summary: 清退 Go control plane 不再消费的 Node-era packages、旧 OPL contracts 和旧 tests。
- verified: `npm run gate:review`, `sentrux check /home/dev/projects/ui`
- cannot claim: 真实 OPL execution、真实登录、多租户数据库、队列、计费或生产部署。

## 2026-06-14 deploy-container-readiness

- summary: 增加 Go control plane 容器入口、`HOST`/`PORT` 配置和 `/healthz`。
- verified: `npm run gate:review`, `sentrux check /home/dev/projects/ui`
- cannot claim: 真实 OPL execution、真实登录、多租户数据库、队列、计费或生产运行证据。

## 2026-06-14 opl-readonly-bridge

- summary: Go control plane 通过白名单连接真实 OPL CLI readonly snapshot，并在 WebUI 展示 OPL 状态。
- verified: `npm run gate:review`, `sentrux check /home/dev/projects/ui`, local `curl /api/opl/snapshot`
- cannot claim: 真实 OPL mutation、真实 task execution、登录、多租户数据库、队列、计费或生产部署。

## 2026-06-14 opl-task-route-bridge

- summary: `/api/mvp/task` 调用真实 OPL CLI readonly domain resolve 与 handoff envelope，并展示 routed domain。
- verified: `npm run gate:review`, `sentrux check /home/dev/projects/ui`, local `curl /api/mvp/task`
- cannot claim: domain runtime、module exec、install、repair、登录、多租户数据库、队列、计费或生产部署。

## 2026-06-14 production-runtime-gate

- summary: 增加 `/readyz` 和 production runtime gate；生产依赖未配置时阻断 task intake。
- verified: `npm run gate:review`, `npm run repo:bloat`, `sentrux check /home/dev/projects/ui`
- cannot claim: 真实登录、多租户数据库、队列、计费、object storage、OPL worker 或公网生产部署。

## 2026-06-14 task-store-boundary

- summary: 增加 Go-side `TaskStore` 边界、内存实现和 task projection lookup endpoint，为 Postgres adapter 留接口。
- verified: `npm run gate:review`, `npm run repo:bloat`, `sentrux check /home/dev/projects/ui`
- cannot claim: 生产数据库、队列、计费、object storage、OPL worker 或公网生产部署。
