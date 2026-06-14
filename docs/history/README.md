# History

- owner: maintainers
- purpose: 保存已关闭 change package 的摘要。
- state: active
- machine boundary: 非机器接口；不能替代 git、release 或 contracts。

这里只放 closeout 摘要，不放进行中计划、不放第二份规格。

## 2026-06-14 foundation-loop-contracts

- commit: `41515a6`
- archive: `changes/archive/2026-06-14-foundation-loop-contracts/`
- summary: 建立 OPL-WebUI 最小 repo governance、change lifecycle、test lane registry、review gate、repo bloat gate、OPL command policy、task/artifact schema 和 mock OPL adapter。
- verified: `npm run gate:review`
- can claim: 第一阶段具备 contract-driven / evals-driven foundation loop。
- cannot claim: 未实现真实 WebUI、SaaS API、数据库、多租户鉴权、真实 OPL execution、module exec 或 family-runtime mutation。

## 2026-06-14 mvp-task-artifact-loop

- commit: `8626e29`
- archive: `changes/archive/2026-06-14-mvp-task-artifact-loop/`
- summary: 建立本地 demo vertical slice：`runDemoTaskArtifactScenario()` 返回中文场景，完成 task -> mock OPL Adapter -> artifact projection。
- verified: `npm run gate:review`
- can claim: 本地 demo 纵切能完成 task/artifact projection，且只通过 mock readonly OPL command。
- cannot claim: 未实现真实 OPL execution、生产 API、WebUI、多租户鉴权、数据库或队列。

## 2026-06-14 web-demo-workspace-shell

- commit: `daad591`
- archive: `changes/archive/2026-06-14-web-demo-workspace-shell/`
- summary: 建立静态中文 AI workspace shell，展示 demo task/artifact projection。
- verified: `npm run gate:review`
- can claim: 本地静态 Web shell 方向可预览。
- cannot claim: 未实现云端服务、真实 API 调用、登录、多租户数据库或真实 OPL execution。

## 2026-06-14 cloud-mvp-service-slice

- commit: `f81f62b`
- archive: `changes/archive/2026-06-14-cloud-mvp-service-slice/`
- summary: 建立最小 Node MVP server，同源服务 Web shell 和 `POST /api/mvp/task`，并补齐 `docs/active`、`specs/*`、`.sentrux/rules.toml`。
- verified: `npm run gate:review`, `sentrux check /home/dev/projects/ui`, local `curl /api/mvp/task`
- can claim: 本地 MVP 服务能返回 tenant-scoped task/artifact projection。
- cannot claim: 未实现真实生产部署、真实登录、多租户数据库、队列、计费或真实 OPL execution。

## 2026-06-14 go-control-plane-replacement

- commit: `35c11a3`
- archive: `changes/archive/2026-06-14-go-control-plane-replacement/`
- summary: 用 Go control plane 直接替换 Node MVP API，删除 `apps/api` 后端和旧 Node API 测试。
- verified: `npm run gate:review`, `sentrux check /home/dev/projects/ui`, local `curl /api/mvp/task`
- can claim: 本地 Go control plane 能服务 Web shell 和 tenant-scoped `/api/mvp/task`。
- cannot claim: 未实现真实生产部署、真实登录、多租户数据库、队列、计费或真实 OPL execution。

## 2026-06-14 post-go-cleanup

- commit: `7bd2cb0`
- archive: `changes/archive/2026-06-14-post-go-cleanup/`
- summary: 清退 Go control plane 不再消费的 Node-era core/adapter、旧 OPL contracts 和旧 adapter/schema tests。
- verified: `npm run gate:review`, `sentrux check /home/dev/projects/ui`
- can claim: 当前后端业务 surface 收敛为 Go control plane + HTTP contract。
- cannot claim: 未实现真实 OPL execution、真实登录、多租户数据库、队列、计费或生产部署。

## 2026-06-14 deploy-container-readiness

- commit: this commit
- archive: `changes/archive/2026-06-14-deploy-container-readiness/`
- summary: 增加 Go control plane 容器部署入口、`HOST`/`PORT` 地址配置和 `/healthz` 健康检查。
- verified: `npm run gate:review`, `sentrux check /home/dev/projects/ui`
- can claim: Go control plane 具备通用容器部署底座。
- cannot claim: 未实现真实 OPL execution、真实登录、多租户数据库、队列、计费或生产运行证据。
