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
