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
