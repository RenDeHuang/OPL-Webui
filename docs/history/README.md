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
