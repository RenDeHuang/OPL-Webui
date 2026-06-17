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

## 2026-06-14 postgres-task-store-adapter

- summary: 增加零 ORM 的 Postgres `TaskStore` adapter 和最小 `task_projections` schema 常量。
- verified: `npm run gate:review`, `npm run repo:bloat`, `sentrux check /home/dev/projects/ui`
- cannot claim: runtime 已连接真实 Postgres、队列、计费、object storage、OPL worker 或公网生产部署。

## 2026-06-14 task-store-runtime-wiring

- summary: runtime 启动时按 `OPL_DATABASE_URL` 选择 task store；无 DB 用 memory，有 DB 走 Postgres opener，driver 未链接时 fail closed。
- verified: `npm run gate:review`, `npm run repo:bloat`, `sentrux check /home/dev/projects/ui`
- cannot claim: 真实 Postgres driver 已接入、生产数据库已运行、队列、计费、object storage、OPL worker 或公网生产部署。

## 2026-06-14 postgres-driver-runtime

- summary: 接入 pgx-backed Postgres task store runtime；配置 `OPL_DATABASE_URL` 后启动时 open、ping 并初始化 `task_projections` schema，失败关闭连接并 fail closed。
- verified: `cd services/control-plane-go && go test ./internal/mvp`, `npm run verify:contract`, `npm run gate:review`, `npm run repo:bloat --silent`, `sentrux check /home/dev/projects/ui`, local 4174 memory-store smoke。
- cannot claim: 已做真实云 Postgres 联通验证、auth、queue、billing、object storage、OPL worker 或公网生产部署。

## 2026-06-15 cloud-mvp-readiness

- summary: 增加 `cloud_mvp` runtime gate、DB/OPL readonly canary 命令、canary cleanup、Postgres projection delete 边界和 `opl.medopl.cn` K8s/Ingress shape contract。
- verified: `npm run verify`, `npm run repo:bloat --silent`, `sentrux check /home/dev/projects/ui`。
- cannot claim: 已执行 kubectl、build/push、Ingress 上线、公网 smoke、VPC/TKE DB canary、queue、billing、object storage、OPL worker 或真实 OPL execution。

## 2026-06-15 cloud-mvp-deploy-handoff

- summary: 补齐 TKE handoff 包：fixture 增加 namespace、imagePullSecret、nodeSelector、resources 和 ingress class；新增无 secret runbook 覆盖 TCR/CCR、Secret、apply、canary、smoke、rollback，并明确 OPL CLI 需由派生镜像或只读挂载提供。
- verified: `npm run verify`, `npm run gate:review`, `npm run repo:bloat --silent`, `sentrux check /home/dev/projects/ui`。
- cannot claim: 已执行 kubectl、读取 kubeconfig、build/push、打开 PostgreSQL 公网、真实云端部署、公网 smoke 或 VPC DB canary。

## 2026-06-15 cloud-stable-http-handoff

- summary: 固化已验证的 TKE qcloud HTTP 上线形态：`uswccr` 镜像 `30a3249`、NodePort `32258`、qcloud Ingress、DNS CNAME、HTTP smoke、canary 和 504 安全组排障。
- verified: `npm run verify`, `npm run gate:review`。
- cannot claim: HTTPS、完整 production ready SaaS、真实登录、队列、计费、object storage、OPL worker 或真实 OPL mutation。

## 2026-06-15 cloud-stable-https-handoff

- summary: 固化已验证的 TKE qcloud HTTPS 上线形态：`opl-webui-tls` 证书 Secret、HTTPS smoke、HTTP 80 非稳定入口、canary 结果和 W1012 单节点 HA 后续项。
- verified: `npm run verify`, `npm run gate:review`。
- cannot claim: 完整 production ready SaaS、多节点 HA、HTTP->HTTPS 强制跳转、真实登录、队列、计费、object storage、OPL worker 或真实 OPL mutation。

## 2026-06-16 cloud-update-release-loop

- summary: 固化后续网站更新发布流程：本地验证、短 commit 镜像 build/push、云端 set image、rollout、canary、HTTPS smoke 和 rollback。
- verified: `npm run verify`, `npm run gate:review`。
- cannot claim: 自动化 CI/CD、真实本轮 kubectl 执行、生产监控、多节点 HA、auth、MedOPL API integration 或产品功能开发。

## 2026-06-16 doc-lifecycle-compaction

- summary: 固化 active detailed、closed compact 的文档生命周期规则；`changes/README.md` 增加 Dynamic Phase Gates；移除重复长期导航 `docs/README.md`。
- verified: `node --test tests/contract/change-package-lifecycle.test.mjs`, `npm run verify`, `npm run gate:review`, `sentrux check /home/dev/projects/ui`。
- cannot claim: 改变线上 runtime、删除测试职责、完成 Genspark V3 UI 或执行云端部署。

## 2026-06-17 repo-governance-sync

- summary: 同步 active truth 和 next cursor；加固 MVP task HTTP contract；修复 DB canary intent drift；补强 cloud image runtime dependency health coverage；修正 bloat gate 对 active change 七件套的 durable doc 计数语义。
- verified: `npm run verify`, `npm run gate:review`, `npm run repo:bloat`, `sentrux check .`, `cd services/control-plane-go && go test ./...`。
- cannot claim: 真实 production rollout、真实 staging、完整 SaaS、真实 OPL execution 或 OPL mutation。

## 2026-06-17 release-automation

- summary: 将发布链路收敛为 no-public-staging production-gated release loop：CI test-only、Release Image self-hosted build/push、manual Production Dry Run、GitHub production approval、Production Apply、Running Ready Pod canary selection、DB/OPL CLI canary 和 HTTPS smoke。Cloud Rollout #5 对 commit/tag `d0c4de5` 真实通过并 green；Release Image green，production approval 已通过，dry-run/apply/canary/smoke 均通过。
- verified: `npm run verify`, `npm run gate:review`, Release Image green, Cloud Rollout #5 green, Production Dry Run passed, Production Apply passed, DB canary passed, OPL CLI canary passed, HTTPS smoke 200。
- cannot claim: 真实 staging、automatic staging rollout、完整 production ready SaaS、多节点 HA/安全组收敛、监控、auth、billing、object storage、OPL worker 或真实 OPL mutation。

## 2026-06-17 autonomous-commercial-development

- summary: 在 `changes/README.md` 固化 Autonomous Commercial Development 合同，把 current truth、commercial SaaS goal、gap-driven phase、allowed/forbidden changes、contracts、tests、test-classification、evals、cannot claim、hard stops、closeout、commit and push、no compatibility layer 和 no bloat 写成后续自治开发模板，并用 lifecycle contract test 锁住。
- verified: `node --test tests/contract/change-package-lifecycle.test.mjs`, `git diff --check`, `npm run repo:bloat`, `npm run verify`, `npm run gate:review`, `sentrux check .`。
- cannot claim: 真实 production rollout、真实 staging、完整 SaaS、真实 OPL execution 或 OPL mutation。

## 2026-06-17 monitoring-surface

- summary: Go control plane 增加 `GET /metricsz` 只读 monitoring projection，复用 runtimegate readiness truth，暴露 service、environment、ready 和缺失依赖 key 统计，不读取 secret、不连接 DB、不调用 OPL CLI。
- verified: `cd services/control-plane-go && go test ./cmd/opl-webui-control-plane`, `git diff --check`, `npm run repo:bloat`, `npm run verify`, `npm run gate:review`, `sentrux check .`。
- cannot claim: 已线上部署 `/metricsz`、真实云监控/告警/SLO、完整 production ready SaaS、真实 auth、billing、queue、object storage、OPL worker、真实 OPL execution 或 OPL mutation。

## 2026-06-17 release-metrics-smoke

- summary: Cloud rollout helper dry-run 和 apply HTTPS smoke 纳入 `/metricsz`，runbook/spec/active truth 同步为 `/healthz`、`/readyz`、`/metricsz` 和首页 smoke。
- verified: `node --test tests/contract/cloud-rollout-helper.test.mjs`, `node --test tests/contract/cloud-mvp-deploy-shape.test.mjs`, `git diff --check`, `npm run repo:bloat`, `npm run verify`, `npm run gate:review`, `sentrux check .`。
- cannot claim: 已执行真实 cloud rollout、线上 `/metricsz` 已通过、真实云监控/告警/SLO、完整 production ready SaaS、真实 OPL execution 或 OPL mutation。

## 2026-06-17 production-metrics-evidence-handoff

- summary: 固化 `010c2b9` production rollout evidence handoff；active truth 和 runbook 明确 `/metricsz` 尚未线上验证，云端/VPC runner 需用 `OPL_IMAGE=uswccr.ccs.tencentyun.com/webopl/opl-webui:010c2b9` 执行 dry-run/apply/canary/smoke 后才能标记 evidence。
- verified: `node --test tests/contract/change-package-lifecycle.test.mjs tests/contract/cloud-mvp-deploy-shape.test.mjs`, `git diff --check`, `npm run repo:bloat`, `npm run verify`, `npm run gate:review`, `sentrux check .`。
- cannot claim: 已执行 `010c2b9` production rollout、线上 `/metricsz` 已通过、真实云监控/告警/SLO、完整 production ready SaaS、真实 OPL execution 或 OPL mutation。

## 2026-06-17 tenant-auth-boundary

- summary: Go control plane 增加 `medopl_launch_token` HMAC Bearer 边界；cloud/production task intake 由 token 注入 tenant/workspace/user，body identity 冲突返回 `TENANT_BOUNDARY_MISMATCH`，stored lookup 校验 token 边界；Web 默认 task request 不再自报 tenant/workspace/user；cloud manifest 通过 `opl-webui-auth` SecretRef 注入 signing secret。
- verified: `cd services/control-plane-go && go test ./internal/mvp`, `cd services/control-plane-go && go test ./internal/runtimegate`, `node --test tests/contract/cloud-mvp-deploy-shape.test.mjs tests/contract/web-demo-data.test.mjs tests/contract/go-control-plane-http.test.mjs`, `node --test tests/health/registry-coverage.test.mjs`, `git diff --check`, `npm run repo:bloat`, `npm run verify`, `npm run gate:review`, `sentrux check .`。
- cannot claim: 真实登录、session/RBAC、线上 rollout、完整多租户 SaaS、billing、queue、object storage、OPL worker、真实 OPL execution 或 OPL mutation。

## 2026-06-17 stable-boundary-ids

- summary: `tenantId`、`workspaceId`、`userId` 统一收敛为 stable boundary ID；body identity 和 launch-token claims 共用校验，禁止 `/`、空格、过短或过长值进入 task projection、store key 或 lookup path。
- verified: `cd services/control-plane-go && go test ./internal/mvp`, `git diff --check`, `npm run repo:bloat`, `npm run verify`, `npm run gate:review`, `sentrux check .`。
- cannot claim: 真实登录、session/RBAC、workspace membership、production rollout、billing、queue、object storage、OPL worker、真实 OPL execution 或 OPL mutation。

## 2026-06-17 task-user-persistence

- summary: Postgres `task_projections` schema 和 insert/update path 增加 `user_id`；新表 schema 要求 `user_id text not null`，已有表通过 additive drift migration 增加列，后续 task writes 显式保存 `projection.UserID`。
- verified: `cd services/control-plane-go && go test ./internal/mvp`, `git diff --check`, `npm run repo:bloat`, `npm run verify`, `npm run gate:review`, `sentrux check .`。
- cannot claim: 真实 DB migration 已执行、完整 commercial data model、usage/quota/billing、production rollout、OPL worker、真实 OPL execution 或 OPL mutation。

## 2026-06-17 task-usage-ledger

- summary: Postgres schema 增加 tenant/workspace/user scoped `usage_events`；`SaveTaskProjection` 在一个 transaction 内 upsert task projection 并写入 deterministic `task.created` event，`event_id=runId`、`quantity=1`、`source_ref=taskId`，重复 save 通过 conflict no-op 不重复计量。
- verified: targeted `cd services/control-plane-go && go test ./internal/mvp`, `node --test tests/health/registry-coverage.test.mjs`, `npm run repo:bloat`；full gates recorded in commit evidence。
- cannot claim: quota enforcement、billing/invoicing、usage dashboard、production DB migration 已执行、OPL worker、真实 OPL execution 或 OPL mutation。

## 2026-06-17 auth-session-boundary

- summary: Go control plane 增加 `POST /api/session/launch`，用有效 `medopl_launch_token` Bearer token 签发 HttpOnly `opl_session` cookie；task create / lookup 在 Bearer token 后 fallback 到 session cookie 注入 tenant/workspace/user 边界；HTTP contract helper 拆分以保持 test 文件收敛。
- verified: targeted `cd services/control-plane-go && go test ./internal/mvp`, `cd services/control-plane-go && go test ./cmd/opl-webui-control-plane`, `node --test tests/contract/go-control-plane-http.test.mjs`, `node --test tests/health/registry-coverage.test.mjs`, `npm run repo:bloat`；full gates recorded in commit evidence。
- cannot claim: 真实登录/OAuth、RBAC、session revocation、workspace membership、MedOPL API integration、production rollout、完整多租户 SaaS、真实 OPL execution 或 OPL mutation。

## 2026-06-17 session-current-boundary

- summary: Go control plane 增加 `GET /api/session/current`，复用 Bearer/session cookie HMAC 校验后返回当前 `tenantId`、`workspaceId`、`userId` 和 `authMode` projection；HTTP contract 断言 session cookie 可查询 current boundary 且响应不含 token material。
- verified: targeted `cd services/control-plane-go && go test ./internal/mvp`, `cd services/control-plane-go && go test ./cmd/opl-webui-control-plane`, `node --test tests/contract/go-control-plane-http.test.mjs`, `node --test tests/health/registry-coverage.test.mjs`, `npm run repo:bloat`；full gates recorded in commit evidence。
- cannot claim: 真实登录/OAuth、RBAC、session revocation、workspace membership、MedOPL API integration、production rollout、完整多租户 SaaS、真实 OPL execution 或 OPL mutation。

## 2026-06-17 session-auth-production-evidence

- summary: 固化 `24ba41f` session/auth boundary production evidence：镜像 `uswccr.ccs.tencentyun.com/webopl/opl-webui:24ba41f`，rollout revision `9`；`/healthz`、`/readyz`、`/metricsz` 和首页均返回 200；DB canary 与 OPL CLI canary 通过；`opl-webui-auth` Opaque Secret 存在且 keys=1；未带 Authorization 的 `POST /api/session/launch` 与无 cookie 的 `GET /api/session/current` 均返回 `401 AUTH_REQUIRED`。
- verified: user-provided production evidence, `git diff --check`, `npm run repo:bloat`, `npm run verify`, `npm run gate:review`, `sentrux check .`。
- cannot claim: 完整商业 SaaS、真实注册登录、workspace membership、RBAC、billing、worker、真实 OPL execution 或 OPL mutation。

## 2026-06-17 tenant-workspace-persistence

- summary: 建立商业 SaaS 数据骨架 v1：`users`、`tenants`、`tenant_memberships`、`workspaces`、`workspace_memberships` schema；新增 `GET /api/workspaces/current`、`GET /api/tasks`、`POST /api/tasks`、`GET /api/tasks/{taskId}`；API 只从 bearer/session auth boundary 推导 tenant/workspace/user，缺 membership fail closed，tenant A 不能读取 tenant B task，前端最小接入 workspace/task list。
- verified: targeted `cd services/control-plane-go && go test ./...`, `node --test tests/contract/saas-workspace-task-api.test.mjs tests/contract/web-demo-data.test.mjs tests/health/registry-coverage.test.mjs`, plus final full gates recorded in commit evidence。
- cannot claim: production rollout、真实注册登录、workspace invitation、复杂 RBAC、billing、worker、真实 OPL execution 或 OPL mutation。

## 2026-06-17 tenant-workspace-production-evidence

- summary: 固化 `fa3bcb7` tenant/workspace persistence v1 production evidence：镜像 `uswccr.ccs.tencentyun.com/webopl/opl-webui:fa3bcb7`，production rollout 成功；`/healthz`、`/readyz`、`/metricsz` 和首页 smoke 通过；DB canary 与 OPL CLI canary 通过；未认证 `GET /api/workspaces/current`、`GET /api/tasks`、`POST /api/tasks`、`GET /api/tasks/example_task` 均返回 `401 AUTH_REQUIRED`。本地 closeout 未执行 kubectl、未读取 kubeconfig，rollout revision 数字未在本地证据中确认。
- verified: user-provided production evidence, `git diff --check`, `npm run repo:bloat`, `npm run verify`, `npm run gate:review`, `sentrux check .`。
- cannot claim: 完整商业 SaaS、真实注册登录、workspace invitation、复杂 RBAC、billing、worker、真实 OPL execution 或 OPL mutation。

## 2026-06-17 usage-quota-enforcement

- summary: 建立 usage/quota enforcement v1：默认 `mvp` plan、task quota `2`、usage period `monthly`；`POST /api/tasks` 创建前按 auth-derived tenant/workspace 检查 quota，未超额时 task projection 与 usage event 继续同边界写入，超额时返回 `QUOTA_EXCEEDED` 且不写 task projection 或 usage event；`GET /api/workspaces/current` 返回 plan、task quota、usage period、used count 和 remaining count；前端只显示最小 usage/quota 状态。
- verified: red `cd services/control-plane-go && go test ./internal/mvp` failed on missing quota API, red `node --test tests/contract/saas-workspace-task-api.test.mjs tests/contract/web-demo-data.test.mjs` failed on missing `usageQuota`; targeted green `cd services/control-plane-go && go test ./internal/mvp`, `node --test tests/contract/saas-workspace-task-api.test.mjs tests/contract/web-demo-data.test.mjs tests/smoke/web-demo-shell.test.mjs`; final gates recorded in commit evidence。
- cannot claim: production rollout、真实支付、billing provider、复杂 plan 管理、workspace invitation、复杂 RBAC、worker、真实 OPL execution 或 OPL mutation。
