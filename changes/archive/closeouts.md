# Archived Closeouts

- owner: product-engineering owner
- purpose: 单文件归档已关闭变更，避免每个切片继续增加 markdown 文件。
- state: active

## 2026-06-14 foundation-to-task-store-baseline

- summary: 合并归档早期 baseline：`foundation-loop-contracts`、`mvp-task-artifact-loop`、`web-demo-workspace-shell`、`cloud-mvp-service-slice`、`go-control-plane-replacement`、`post-go-cleanup`、`deploy-container-readiness`、`opl-readonly-bridge`、`opl-task-route-bridge`、`production-runtime-gate`、`task-store-boundary`。建立 repo governance、Go control plane、container health、OPL readonly snapshot、旧 `/api/mvp/task` bridge 和 task store 边界。
- verified: `npm run gate:review`, `npm run repo:bloat`, `sentrux check /home/dev/projects/ui`, local `curl /api/mvp/task` during retired MVP era。
- cannot claim: 真实登录、多租户数据库、队列、计费、object storage、OPL worker、公网生产部署或真实 OPL execution/mutation。

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

## 2026-06-17 usage-quota-production-evidence

- summary: 固化 `bc0403d` usage/quota enforcement v1 production evidence：镜像 `uswccr.ccs.tencentyun.com/webopl/opl-webui:bc0403d`，production rollout 成功；未认证 API guard 由云端验证为 `401 AUTH_REQUIRED`。本地 closeout 未执行 kubectl、未读取 kubeconfig，用户未提供 rollout revision、逐项 health/smoke/canary 数值或安全测试 token 下的 quota behavior 证据。
- verified: user-provided production rollout evidence, `git diff --check`, `npm run repo:bloat`, `npm run verify`, `npm run gate:review`, `sentrux check .`。
- cannot claim: `usageQuota` / `QUOTA_EXCEEDED` online behavior、真实支付、billing provider、复杂 plan 管理、注册登录、RBAC、worker、真实 OPL execution 或 OPL mutation。

## 2026-06-17 product-positioning-calibration

- summary: 重新校准 OPL-Webui 定位：`opl.medopl.cn` 是 ChatGPT-like OPL 前台入口；用户填写自己的 API Key，base_url 固定为 sub2api；workspace/runtime/node pool/storage 默认不在 UI 展示；tenant/workspace persistence 只作为 hidden isolation/projection；usage/quota v1 是 Webui-side precheck/projection；MedOPL/sub2api 持有充值、runtime、node pool、storage、账单、资源后台和 API gateway truth。
- verified: red `node --test tests/contract/change-package-lifecycle.test.mjs` failed on missing product positioning truth；green `node --test tests/contract/change-package-lifecycle.test.mjs tests/contract/cloud-mvp-deploy-shape.test.mjs`；final gates recorded in commit evidence。
- cannot claim: ChatGPT-like base chatbot、user API key binding、fixed sub2api bridge、@OPL capability gate、MedOPL runtime opening deep link、runtime status bridge 或 OPL run/artifact projection 已实现。

## 2026-06-18 - figma-v3-preview retired

- summary: 退役历史 Genspark V3 preview active package；旧 preview 依赖用户可见 workspace、`demoData.mjs` 和 `/api/mvp/task`，已与 one-person-lab-web 当前 truth 冲突。保留其历史价值为视觉参考，不再作为 active blocker 或 unfinished mainline。
- verified: compacted by lifecycle contract and replaced by `one-person-lab-web` tests.
- cannot claim: 不能声明该历史 preview 已 cloud rollout 或 online accepted。

## 2026-06-18 - one-person-lab-web

- summary: 将 OPL-Webui 重新校准并实现为 Genspark-like one-person-lab-web with ChatGPT-like base chatbot；新增 public account register/login/logout/current session、HttpOnly `opl_session`、hidden personal tenant/workspace、API Key encrypted binding、fixed `https://gflabtoken.cn/v1` provider、普通 chat、conversation isolation 和 @OPL runtime gate。删除旧 `demoData.mjs`、旧 `/api/mvp/*` public route 和无 consumer `mvp-task-http` schema；Web shell 不再展示 workspace/Drive/team/pricing/demo artifact。
- verified: `node --test tests/contract/go-control-plane-http.test.mjs tests/contract/one-person-lab-chat-upstream.test.mjs`; `node --test tests/contract/one-person-lab-web-data.test.mjs tests/smoke/web-demo-shell.test.mjs`; `node --test tests/health/registry-coverage.test.mjs tests/contract/change-package-lifecycle.test.mjs tests/contract/cloud-mvp-deploy-shape.test.mjs`; `cd services/control-plane-go && go test ./...`.
- cannot claim: 还没有本次 production rollout evidence；没有真实邮箱验证、找回密码、复杂 RBAC、支付 provider、MedOPL runtime status bridge、OPL worker、object storage 或真实 OPL execution/mutation。

## 2026-06-18 - one-person-lab-web-production-evidence

- summary: 固化 `44dd574` one-person-lab-web production evidence：镜像 `uswccr.ccs.tencentyun.com/webopl/opl-webui:44dd574`，rollout revision `13`；Pod `opl-webui-control-plane-69c859465f-v9crb` `1/1 Running`、restarts `0`、image tag `44dd574`；`/healthz` 200、`/readyz` 200 `missing=[]`、`/metricsz` 200 `missingDependencyCount=0`、首页 200；DB canary `open,ping,schema,write,read,delete` pass；OPL CLI canary `system.initialize,connect.modules,contract.domains` pass；unauth guard `/api/auth/login` 401 `INVALID_CREDENTIALS`、`/api/chat` 401 `AUTH_REQUIRED`；public smoke `https://opl.medopl.cn/healthz` 和 `https://opl.medopl.cn/readyz` HTTP/2 200。同步云端受控修复：`opl-webui-auth` 保留 `OPL_TENANT_AUTH_SECRET` 并提供 `OPL_SESSION_SECRET`、`OPL_API_KEY_ENCRYPTION_SECRET`、`OPL_CHAT_MODEL`，Deployment manifest 声明对应 `secretKeyRef`。
- verified: user-provided production evidence；local contract/gate verification recorded in commit evidence。
- cannot claim: 真实用户注册/login write-path online e2e、真实 API Key binding online e2e、真实 chat completion online e2e、MedOPL runtime status bridge、真实 OPL runtime/mutation。

## 2026-06-18 - ui-productization-pass
- summary: 将 One Person Lab Web 从技术预览 shell 产品化为本地可 dogfood 的 Genspark-like Web 入口：顶部导航包含 Chat、Capabilities、Settings、MedOPL；首屏改为大 prompt console、固定 Model gateway、能力 capsules；`#settings` 聚焦账号/API Key 设置；消息列表、设置表单、匿名/API_KEY_REQUIRED 引导和 `@基金/@论文/@综述/@长任务` runtime gate 产品化。未新增依赖、不恢复 `demoData.mjs`、不调用 `/api/mvp/task`、不让用户自定义 base_url。
- verified: RED/GREEN `node --test tests/smoke/web-demo-shell.test.mjs tests/contract/one-person-lab-web-data.test.mjs`；browser dogfood local desktop `1280x720`、mobile `375x812`、`#settings` focus、`@基金` runtime gate，console errors none，critical network errors none；full gates recorded in commit evidence。
- cannot claim: Figma MCP 精确实现，Genspark live site 对照验收，UI productization production rollout，真实 MedOPL runtime bridge，真实 OPL execution/mutation，文件/object storage，支付/RBAC/team。
## 2026-06-18 - figma-2-21-ui-alignment
- summary: 采用 Figma node `2:21` 将首页推进为“严肃工作的 AI 工作台”：大输入框、能力 capsules、五件事、Foundry 启动中心、账号凭据区、冷灰白卡和蓝色编号；保留 fixed base_url、auth/API Key binding 和 @OPL MedOPL Runtime gate。verified: RED/GREEN web smoke+contract；browser desktop/mobile/#settings/@基金 gate。cannot claim: production rollout、真实 OPL execution/mutation、object storage、billing、node pool 生命周期。
## 2026-06-18 - figma-2-21-production-closeout: 固化 `1fc361d Figma workbench UI 已 production verified`；image `uswccr.ccs.tencentyun.com/webopl/opl-webui:1fc361d`，rollout revision `14`，Running Ready Pod `opl-webui-control-plane-54546f5bff-h8xcq`，Error/Failed Pod none；`/healthz`、`/readyz missing=[]`、`/metricsz`、`/`、`/#settings` 均 200，页面包含“严肃工作的 AI 工作台”、“OPL WebUI 应承接的五件事”和 `https://gflabtoken.cn/v1`；guards: `POST /api/chat` no cookie 401 `AUTH_REQUIRED`、`GET /api/chat` 405 `METHOD_NOT_ALLOWED`、wrong login 401 `INVALID_CREDENTIALS`。cannot claim: 真实 OPL execution/mutation、object storage、billing、node pool 生命周期或完整 production ready SaaS。
## 2026-06-18 - saas-dogfood-guardrails
- summary: A1 Gap Audit 后补齐 one-person-lab-web 主路径最小 dogfood guardrails：普通 chat 在 upstream 前执行 per-user monthly quota/abuse precheck，超额返回 `429 CHAT_QUOTA_EXCEEDED` 且不调用 gflabtoken；新增 `GET /api/account/audit-events` 只返回当前用户 sanitized audit events，覆盖 register/login/API Key/runtime gate/chat/quota/upstream failure，不记录 password、raw API Key、session secret 或 DB URL。Postgres schema 增加 `webapp_audit_events` 与 `webapp_chat_usage`；Webui-side guardrail 不等同 billing，最终计费仍归 MedOPL/sub2api。
- verified: RED `node --test tests/contract/one-person-lab-chat-upstream.test.mjs` failed on missing 429 quota guard；GREEN targeted Node contracts/smoke and `cd services/control-plane-go && go test ./...` passed；final gates recorded in commit evidence。
- cannot claim: production rollout、真实线上 quota/audit behavior、真实 MedOPL runtime bridge、object storage、billing/payment provider、真实 OPL execution/mutation 或完整 production ready SaaS。
## 2026-06-18 - capability-source-path-manifest
- summary: B/C Gap Audit 后将 Web capabilities 从纯手写数组推进为 source-path pinned manifest：view model 暴露 `syncMode=source_path_pinned_manifest`、`dynamicSync=false`、`one-person-lab-app/contracts/app-product-profile.json` 和 `one-person-lab/contracts/opl-framework/domains.json` source paths，并保留 MAS/MAG/RCA parity metadata；GitHub `ls-remote` 因 TLS/连接失败，明确 `commitPin=blocked_by_github_tls_timeout`，不伪造动态同步或上游 commit。
- verified: RED `node --test tests/contract/one-person-lab-web-data.test.mjs` failed on missing capabilitySource；GREEN targeted web data contract and bloat gate passed；final gates recorded in commit evidence。
- cannot claim: 上游 commit-SHA pinned manifest、自动 build-time sync、MedOPL runtime status bridge、真实 OPL execution/mutation。
## 2026-06-18 - dogfood-guardrails-capability-manifest-production-closeout
- summary: 固化 `9cbb4a3 dogfood guardrails + capability source-path manifest 已 production verified`；image `uswccr.ccs.tencentyun.com/webopl/opl-webui:9cbb4a3`，rollout revision `15`，Running Ready Pod `opl-webui-control-plane-6c6f59bf5f-vpmvk`，Error/Failed Pod none；`/healthz` 200、`/readyz` 200 `missing=[]`、`/metricsz` 200、`/` 200；页面包含“严肃工作的 AI 工作台”、fixed gateway `https://gflabtoken.cn/v1`、`@基金`、MedOPL Runtime，JS appends `需要 MedOPL Runtime`；public JS exposes capability `syncMode: 'source_path_pinned_manifest'` and `dynamicSync=false`；contract-backed guardrails protect `CHAT_QUOTA_EXCEEDED` and sanitized audit；No real OPL runtime was executed or created；unauth chat 401 `AUTH_REQUIRED`，wrong login 401 `INVALID_CREDENTIALS`。
- verified: user-provided production evidence；local contract/gate verification recorded in commit evidence。
- cannot claim: 真实 authenticated chat quota/audit write-path online evidence、真实 OPL execution/mutation、MedOPL runtime status bridge、object storage、billing/payment provider、node pool 生命周期或完整 production ready SaaS。
## 2026-06-18 - dogfood-e2e-readiness-parity-map-local
- summary: 本地连续开发阶段完成 Slice A/B：新增 dogfood e2e harness，用 mock upstream 覆盖注册、登录、current session、API Key binding、raw key 不回显、fixed gateway `https://gflabtoken.cn/v1`、普通 chat、`CHAT_QUOTA_EXCEEDED`、sanitized audit 和 `@基金` MedOPL runtime gate；只读审计 one-person-lab-app main `829e67b971c73e28bc5c81eaeca30617b4f0b458`，固化 one-person-lab-app parity v1：Web 承接 chat-first、purpose routing、progress/files/deliverables refs 和 runtime gate 语义，不承接 desktop packaging、local CLI mutation、artifact body、storage/billing 或 runtime 生命周期。
- verified: RED `node --test tests/contract/change-package-lifecycle.test.mjs` failed on missing `dogfood e2e harness` truth；GREEN targeted dogfood chat/web smoke contracts passed；browser desktop/mobile/#settings/register/API Key/mock chat/@基金 gate passed with console errors none and no critical network errors；final local gates recorded in commit evidence。
- cannot claim: production rollout、真实 upstream/API Key/PostgreSQL/MedOPL production e2e、真实 OPL execution/mutation、artifact body、object storage、billing/payment provider 或 MedOPL runtime status bridge。
## 2026-06-18 - production-authenticated-dogfood-e2e-readiness
- summary: 按 latest readiness audit 将优先级从 MedOPL bridge 调整为 OPL-Webui 自己的 production authenticated dogfood readiness；复用 `scripts/cloud-rollout.mjs --dogfood-e2e`、`Cloud Rollout` manual input `authenticated_dogfood_e2e` 和 runbook 固化安全 harness。默认跳过，production Environment gated；只需要 `OPL_DOGFOOD_EMAIL`、`OPL_DOGFOOD_PASSWORD`、`OPL_DOGFOOD_API_KEY`，普通 chat completion 还需 `OPL_PRODUCTION_DOGFOOD_REAL_CHAT=1`；覆盖 register/login fallback、current session、API Key binding、raw key 不回显、fixed gateway、@基金 MedOPL Runtime gate 和 audit events。
- verified: RED/GREEN `node --test tests/contract/cloud-rollout-helper.test.mjs tests/health/workflow-entrypoint.test.mjs tests/contract/cloud-mvp-deploy-shape.test.mjs`；targeted `node --test tests/contract/go-control-plane-http.test.mjs` passed；final gates recorded in commit evidence。本轮不 production rollout。
- cannot claim: production authenticated dogfood e2e 已在线执行、真实普通 chat completion online evidence、真实 authenticated quota exhaustion online evidence、MedOPL runtime status bridge、真实 OPL execution/mutation、object storage、billing/payment provider 或 node pool 生命周期。

## 2026-06-18 - repo-governance-hardening
- summary: 将 OPL-style 开发纪律写入仓库规则：`AGENTS.md` 固定文档生命周期、代码清退、测试登记和机器 gate 四个工作面；新增 `TASTE.md` 与核心 docs portfolio，把项目叙事从 agent instructions 拆出；新增 governance hardening 和 stale retirement guard 测试；bloat audit 将 active change 七件套按短期工作台单独计数。
- verified: RED `node --test tests/health/governance-hardening.test.mjs` failed on missing governance surfaces；GREEN targeted governance/retirement/bloat/registry/workflow/lifecycle tests passed；`npm run verify` passed；`npm run gate:review` passed；`npm run repo:bloat` passed with 90 files, 17 tests, 17 durable markdown docs, 7 active change docs, largest file 260 lines；`sentrux check .` passed 9 rules with quality 7362。
- cannot claim: business gaps complete, internal MVP cleanup complete, production rollout, MedOPL runtime bridge, real OPL execution/mutation, object storage, billing/payment provider or complete production-ready SaaS。

## 2026-06-18 - opl-style-development-discipline-hardening
- summary: 将 formal development trigger、ideal-state-first、no compatibility pollution、worktree/subagent discipline 和 Plan Completion Audit 写入 `AGENTS.md` 与 docs taxonomy。
- verified: RED/GREEN governance-hardening lifecycle tests；`git diff --check`；`npm run verify`；`npm run gate:review`；`npm run repo:bloat`；`sentrux check .`。
- cannot claim: product behavior changed, frontend/Go source refactored, OPL runtime execution added, or every future cleanup automatically machine-detected。

## 2026-06-18 - line-budget-policy-calibration
- summary: 将单文件行数从长期硬标准改为 advisory policy：260 review signal、400 explicit explanation、600 strict split threshold；默认 bloat gate 不再用 `maxFileLines` 阻断，显式 strict entry 才阻断。
- verified: RED/GREEN repo-bloat and workflow-entrypoint tests；`npm run repo:bloat:strict`；`git diff --check`；`npm run verify`；`npm run gate:review`；`npm run repo:bloat`；`sentrux check .`。
- cannot claim: frontend split completed, UI behavior changed, API behavior changed, production dogfood complete, MedOPL integration complete, billing complete, or real OPL execution complete。

## 2026-06-18 - controlplane-mvp-retirement
- summary: Retired `services/control-plane-go/internal/mvp` from active source, migrated surviving implementation to `internal/controlplane`, removed no-consumer compatibility surfaces, updated imports/canary/registry/stale guard, split Postgres schema, and ratcheted durable file budget to 85.
- verified: RED stale-retirement guard; targeted Go and lifecycle/bloat tests; `npm run verify`; `npm run gate:review`; `npm run repo:bloat`; `sentrux check .`。
- cannot claim: business behavior changed, production rollout, MedOPL runtime bridge, billing, storage, OPL worker, or real OPL execution/mutation。

## 2026-06-18 - figma-make-webui-alignment
- summary: Aligned the static Web shell with the Figma Make left-sidebar workbench direction while preserving fixed provider, Go control-plane API, and runtime gate boundaries; added smoke guards against fake storage/billing/runtime claims.
- verified: RED/GREEN `tests/smoke/web-demo-shell.test.mjs` and `tests/contract/one-person-lab-web-data.test.mjs`; `npm run verify`; `npm run gate:review`; `npm run repo:bloat`; `sentrux check .`; `git diff --check`。
- cannot claim: production rollout, Figma pixel-perfect QA, valid local HTTP listener evidence, real OPL execution, runtime creation, storage, billing, node pool lifecycle, or MedOPL bridge。

## 2026-06-19 - one-person-lab-web-truth-reset
- summary: Added five durable One Person Lab Web contracts under `contracts/`; retired old active prose truth files (`specs/product/spec.md`, `specs/runtime/spec.md`, `specs/source/spec.md`, `docs/status.md`, `docs/decisions.md`); compacted already-closed active packages; updated AGENTS, TASTE, core docs, lifecycle docs, stale guard, lifecycle tests, web data tests, and test registry to make contracts the machine truth.
- verified: RED failed first on missing `contracts/web-product-profile.json` and stale AGENTS/docs references; targeted GREEN contract/governance/stale-guard tests passed; `git diff --check`; `npm run verify`; `npm run gate:review`; `npm run repo:bloat`; `sentrux check .` passed with quality `7354`.
- cannot claim: new UI behavior, production rollout, runtime execution, MedOPL runtime status bridge, or production authenticated dogfood e2e.

## 2026-06-19 - repo-slimming-and-stale-name-retirement
- summary: Conservative repo slimming: compacted closed change packages from `changes/active`, deleted placeholder `docs/history/README.md` and `tests/README.md`, merged `apps/web/styles/v3.css` into `apps/web/styles.css`, removed the extra stylesheet link, renamed the smoke test to `tests/smoke/web-shell.test.mjs`, and updated lifecycle/registry/stale-guard tests to enforce the slimmer shape.
- verified: RED targeted tests failed first on existing placeholder/stale files, old active truth, missing archive summaries, and old stylesheet link; GREEN targeted `node --test tests/contract/change-package-lifecycle.test.mjs tests/smoke/foundation.test.mjs tests/smoke/web-shell.test.mjs tests/health/registry-coverage.test.mjs tests/health/repo-bloat.test.mjs` passed 24/24; stale scan left only retirement assertions and historical closeout references; `git diff --check` passed; `npm run verify` passed with health 21/21, contract 40/40, Go package tests, and smoke 5/5; `npm run gate:review` passed; `npm run repo:bloat` passed with files 82/85, markdown docs 10/24, activeChangeDocs 0, tests 16/17; `sentrux check .` passed 9 rules with quality `7369`.
- cannot claim: product behavior change, production rollout, deploy lane removal, Go control-plane behavior change, MedOPL runtime bridge, or real OPL execution/mutation.

## 2026-06-19 - product-debt-retirement
- summary: Retired active MVP transition naming from the one-person-lab-web product repo surface: deploy handoff moved to `deploy/web-cloud`, runtime marker moved to `web_cloud`, default quota plan moved to `starter`, and deploy contract/test registry now use `web-cloud-deploy-shape`. Replaced the old 260/400/600/strict line policy with one `1000` line hard cap in `scripts/repo-bloat-audit.mjs`; lower line counts are no longer a gate. Historical closeout facts were preserved, and retired `/api/mvp/*` references remain only as explicit fail-closed regression guards.
- verified: RED product-debt test failed first on active transition naming and missing hard cap; GREEN targeted Node tests passed 33/33; targeted Go packages passed; `git diff --check` passed; `npm run verify` passed with health 23/23, contract 40/40, Go package tests, and smoke 5/5; `npm run gate:review` passed; `npm run repo:bloat` passed with hardCap 1000, files 83/85, tests 17/17, no line findings; `sentrux check .` passed 9 rules with quality `7369`.
- cannot claim: production rollout, new product behavior, MedOPL runtime bridge, real OPL execution/mutation, billing, storage, or production authenticated dogfood evidence.

## 2026-06-19 - web-product-app-structure
- summary: Phase 1 of the one-person-lab-web goal split the Web product shell into focused owner modules. `apps/web/src/onePersonLabWeb.mjs` is now the thin canonical product entry; `onePersonLabWebState.mjs` owns constants, API helpers, account state, and view-model creation; `onePersonLabWebDom.mjs` owns browser bootstrapping, event binding, render updates, and DOM mutation. Existing public tests still import from the product entry, and no compatibility alias or new product behavior was added.
- verified: RED web data contract failed first on missing state owner module; GREEN targeted Web tests passed 12/12; targeted governance tests passed 9/9; `git diff --check` passed; `npm run repo:bloat` passed with active docs present; `sentrux check .` passed 9 rules with quality `7351`; `npm run verify` passed with health 23/23, contract 41/41, Go package tests, and smoke 5/5; fresh `npm run gate:review` passed.
- cannot claim: React/Next migration, UI redesign, production rollout, MedOPL runtime bridge, real OPL execution/mutation, billing, storage, or materials/deliverables projection.

## 2026-06-19 - web-api-contract-implementation
- summary: Phase 2 made `contracts/web-api.openapi.json` match the current Go control-plane HTTP surface. The contract now covers implemented auth/session/provider/chat/conversation/audit/snapshot statuses and replaces the retired `ChatErrorCode` schema with one current `ApiErrorCode` enum. No compatibility schema, new endpoint, generated client, Go handler behavior, frontend behavior, or MedOPL runtime bridge was added.
- verified: RED `node --test tests/contract/go-control-plane-http.test.mjs` failed first on stale OpenAPI register status; GREEN targeted `node --test tests/contract/go-control-plane-http.test.mjs tests/contract/one-person-lab-web-data.test.mjs` passed 14/14; governance targeted tests passed 19/19; `git diff --check` passed; `npm run verify` passed with health 23/23, contract 42/42, Go package tests, and smoke 5/5; `npm run gate:review` passed; `npm run repo:bloat` passed with hardCap 1000, files 85/85, tests 17/17, activeChangeDocs 7, and no line findings; `sentrux check .` passed 9 rules with quality `7514`.
- cannot claim: new API behavior, generated client, MedOPL runtime bridge, production rollout, real OPL execution/mutation, billing, storage, materials, deliverables, or production authenticated dogfood evidence.

## 2026-06-19 - page-state-matrix-e2e
- summary: Phase 3 bound `contracts/web-page-state-matrix.json` to Web code. The product entry now exports `chatStateForResult`; the state module classifies `idle`, `sending`, `runtime_required`, `quota_exceeded`, and `upstream_failed`; the DOM owner writes `document.body.dataset.chatState`; and `#medopl` resolves to the contract route instead of falling through to `chat`. No endpoint, durable file, compatibility alias, runtime bridge, or OPL execution behavior was added.
- verified: RED targeted Web tests failed first on missing `chatStateForResult`, missing `dataset.chatState`, and `#medopl` resolving to `chat`; GREEN targeted Web tests passed 13/13; governance targeted tests passed 19/19; `git diff --check` passed; `npm run verify` passed with health 23/23, contract 43/43, Go package tests, and smoke 5/5; `npm run gate:review` passed; `npm run repo:bloat` passed with hardCap 1000, files 85/85, tests 17/17, activeChangeDocs 7, and no line findings; `sentrux check .` passed 9 rules with quality `7516`.
- cannot claim: React/Next migration, MedOPL runtime status bridge, production rollout, real OPL execution/mutation, billing, storage, materials, deliverables, or production authenticated dogfood evidence.

## 2026-06-19 - medopl-runtime-status-bridge
- summary: Phase 4 added `GET /api/medopl/runtime/status` as a readonly sanitized MedOPL runtime projection. OpenAPI, HTTP contract tests, and Web state now cover owner/state/deepLink/refs/counts plus fixed `webuiRuntimeExecution=forbidden`. The projection is sourced from explicit Web control-plane configuration only; no compatibility route, MedOPL production API call, runtime creation, storage, billing, node lifecycle, or OPL mutation was added.
- verified: RED targeted HTTP/Web tests failed first on missing OpenAPI path, missing Go JSON endpoint, and missing Web runtime status projection; GREEN targeted HTTP/Web tests passed 17/17; targeted post-closeout tests passed 31/31; targeted Go packages passed; governance targeted tests passed 19/19; `git diff --check` passed; `npm run verify` passed with health 23/23, contract 45/45, Go package tests, and smoke 5/5; `npm run gate:review` passed; `npm run repo:bloat` passed with hardCap 1000, files 85/85, tests 17/17, activeChangeDocs 0, and no line findings; `sentrux check .` passed 9 rules with quality `7515`.
- cannot claim: MedOPL production API integration, runtime creation or release, real OPL execution/mutation, billing, storage, node pool lifecycle, materials, deliverables, or production authenticated dogfood evidence.

## 2026-06-19 - materials-deliverables-projection
- summary: Phase 5 added `GET /api/medopl/materials-deliverables/projection` as a readonly sanitized MedOPL-owned projection. Go control plane returns summary refs only; OpenAPI documents `200/405`; Web state loads the projection as `materialsDeliverables`. No compatibility alias, durable test file, upload/download/delete route, object storage write, artifact body, OPL execution, MedOPL production API call, billing, or node lifecycle behavior was added.
- verified: RED targeted HTTP/Web tests failed first on missing OpenAPI path, missing Go JSON route, and missing Web state projection; GREEN targeted HTTP/Web tests passed 19/19; targeted Go packages passed; lifecycle/bloat/registry targeted tests passed 19/19; `git diff --check` passed; `npm run verify` passed with health 23/23, contract 47/47, Go package tests, and smoke 5/5; `npm run gate:review` passed; `npm run repo:bloat` passed with hardCap 1000, files 85/85, tests 17/17, activeChangeDocs 7, and no line findings; `sentrux check .` passed 9 rules with quality `7516`.
- cannot claim: real storage integration, artifact body delivery, upload/download/delete, OPL execution or mutation, MedOPL production API integration, or production authenticated dogfood evidence.

## 2026-06-19 - billing-quota-audit-projection
- summary: Phase 6 added `GET /api/account/billing-summary` as an authenticated readonly projection. It returns MedOPL billing handoff, configured chat quota summary, sanitized audit count/latest event kind, and explicit forbidden flags for WebUI billing truth and payment mutation. No compatibility alias, durable test file, payment provider, recharge, invoice, refund, ledger source of truth, production billing API call, or destructive account action was added.
- verified: RED targeted HTTP/Web tests failed first on missing OpenAPI path, missing Go endpoint, and missing Web state projection; GREEN targeted HTTP/Web tests passed 21/21; targeted Go packages passed; lifecycle/bloat/registry targeted tests passed 19/19; `git diff --check` passed; `npm run verify` passed with health 23/23, contract 49/49, Go package tests, and smoke 5/5; `npm run gate:review` passed; `npm run repo:bloat` passed with hardCap 1000, files 85/85, tests 17/17, activeChangeDocs 7, and no line findings; `sentrux check .` passed 9 rules with quality `7514`.
- cannot claim: real payment or recharge, billing source of truth, invoice/refund/reconciliation, MedOPL production billing integration, or production authenticated dogfood evidence.

## 2026-06-19 - local-no-secret-readiness
- summary: Phase 7 promoted local no-secret HTTP dogfood and static shell readiness into machine truth without claiming real browser automation. `contracts/web-release-profile.json` now declares `localNoSecretReadiness` coverage, evidence commands, `browserAutomation=false`, and `automationLevel=http_contract_and_static_shell`; `contracts/web-page-state-matrix.json` maps observable readiness scenario steps/selectors for register, login, current session, API Key binding, ordinary chat with mock upstream, quota exceeded, runtime gate, sanitized audit, desktop shell, mobile shell, and settings hash. `.sentrux/baseline.json` is ignored as a local verification artifact.
- verified: RED `node --test tests/contract/one-person-lab-web-data.test.mjs` failed first on missing readiness contract; GREEN targeted `node --test tests/contract/one-person-lab-web-data.test.mjs`, `node --test tests/contract/one-person-lab-chat-upstream.test.mjs`, `node --test tests/smoke/web-shell.test.mjs`, `node --test tests/contract/change-package-lifecycle.test.mjs`, and `node --test tests/contract/go-control-plane-http.test.mjs` passed; post-closeout `git diff --check` passed; post-closeout `npm run verify` passed with health 23/23, contract 49/49, Go package tests, and smoke 5/5; post-closeout `npm run gate:review` passed; post-closeout `npm run repo:bloat` passed with hardCap 1000, files 85/85, tests 17/17, activeChangeDocs 0, and no line findings; `sentrux check .` passed 9 rules with quality `7514`; `sentrux gate .` reported quality `7514 -> 7514` and no structural degradation.
- cannot claim: Playwright/Puppeteer/Chromium-driven browser automation, production authenticated dogfood e2e executed, real upstream/API Key online dogfood, production quota exhaustion online evidence, MedOPL production runtime bridge, real OPL execution/mutation, billing/payment/storage source of truth, or production-ready SaaS.

## 2026-06-19 - browser-session-bootstrap
- summary: Browser initial bootstrap now probes `/api/session/current` by calling `loadOnePersonLabWebState(fetch, { loadSnapshot: false })`, so returning users with a valid session cookie can render as authenticated after refresh. OPL snapshot loading remains disabled on initial browser load. `browser_session_bootstrap` is now part of local no-secret readiness in the page-state and release contracts.
- verified: RED `node --test tests/contract/one-person-lab-web-data.test.mjs` failed first on the stale `probeSession: false` bootstrap override; GREEN targeted Web contract, Web smoke, and lifecycle tests passed; post-closeout `git diff --check`, `npm run verify`, `npm run gate:review`, `npm run repo:bloat`, `sentrux check .`, and `sentrux gate .` passed.
- cannot claim: production authenticated dogfood e2e, real browser automation, production rollout, MedOPL production runtime bridge, real OPL execution/mutation, billing, storage, or production-ready SaaS.

## 2026-06-19 - billing-quota-usage-projection
- summary: `GET /api/account/billing-summary` now reads current-period local chat quota usage from the same store used by the chat quota guard. Memory and Postgres stores expose readonly `ChatQuotaStatus`; ordinary chat increments usage and runtime-gated messages do not. The response still declares MedOPL ownership and forbids WebUI billing source-of-truth and payment mutation.
- verified: RED `node --test tests/contract/go-control-plane-http.test.mjs` failed first because billing summary returned `used: 0` after ordinary chat; GREEN targeted HTTP/Web contracts and Go package tests passed; post-closeout `git diff --check`, `npm run verify`, `npm run gate:review`, `npm run repo:bloat`, `sentrux check .`, and `sentrux gate .` passed.
- cannot claim: real payment, recharge, invoice, refund, reconciliation, billing source of truth, MedOPL production billing integration, production authenticated dogfood e2e, or OPL execution/mutation.

## 2026-06-19 - runtime-marker-policy-alignment
- summary: Runtime-required marker policy is now an explicit Web allowlist matching `contracts/web-runtime-bridge.json`. Browser prompt preflight uses `requiresRuntimeGate()` instead of treating every `@` mention as runtime work; static `@RCA` prompts were retired without adding a compatibility marker; visible shell text now includes `@文件`; docs now describe contract-defined runtime markers instead of broad `@OPL` syntax.
- verified: RED `node --test tests/contract/one-person-lab-web-data.test.mjs` failed first on missing exported marker policy, and `node --test tests/smoke/web-shell.test.mjs` failed first on missing `@文件` plus stale `@RCA`; GREEN targeted Web/smoke/HTTP/lifecycle/Go tests passed; pre-closeout `git diff --check`, `npm run verify`, `npm run gate:review`, `npm run repo:bloat`, `sentrux check .`, and `sentrux gate .` passed.
- cannot claim: new runtime marker, real OPL execution/mutation, MedOPL production runtime bridge, production authenticated dogfood e2e, or runtime ownership by WebUI.
