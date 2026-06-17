# Active Truth

- owner: product-engineering owner
- purpose: 当前阶段、可宣称范围和下一步唯一入口。
- state: active
- machine boundary: 非机器接口；机器判断来自 source、contracts、tests、scripts 和 Sentrux rules。

## Current Stage

当前是 `production-gated-release-loop-verified`：`https://opl.medopl.cn` 已完成 no-public-staging production-gated release loop。Release Image、Production Dry Run、GitHub production approval、Production Apply、DB canary、OPL CLI canary 和 HTTPS smoke 已在 Cloud Rollout #5 上真实通过。

## Active Change Work

- `changes/active/figma-v3-preview`: Genspark 风格 V3 preview work package；本地实现和本地 gate 已完成，cloud rollout、online acceptance 和 closeout 仍 blocked。

## Can Claim

- Web UI 通过同源 `/api/mvp/task` 调用 Go control plane。
- Go API 返回带 `tenantId`、`workspaceId`、`userId`、`runId` 和 OPL readonly route evidence 的 task/artifact projection。
- Task projection 已通过 Go-side `TaskStore` 边界保存；当前默认实现是内存 store，不是生产数据库。
- Runtime 已按 `OPL_DATABASE_URL` 选择 task store；未配置时用 memory store，配置后用 pgx-backed Postgres store，打开、ping 或 schema 初始化失败时 fail closed。
- Runtime 支持 `OPL_WEBUI_ENV=cloud_mvp` 最小上线 profile：要求 `OPL_CLI_PATH`、`OPL_DATABASE_URL` 和 `OPL_TENANT_AUTH_MODE`，不把 queue、object store、billing、worker 误算进 MVP preview。
- Control-plane binary 提供 `canary db`，授权后可在 VPC/TKE 内用环境变量里的 `OPL_DATABASE_URL` 验证 Postgres open/ping/schema/write/read/delete，报告不泄露连接串。
- Control-plane binary 提供 `canary opl-cli`，验证无 Codex/API key 依赖的 OPL snapshot readonly allowlist surfaces，不执行 install、repair、module exec、task-route passthrough 或 mutation。
- `deploy/cloud-mvp/opl-webui.k8s.json` 是 `opl.medopl.cn` 的声明式部署形状契约，固定 namespace、`uswccr` image、imagePullSecret、nodeSelector、resources、qcloud ingress class、TLS Secret `opl-webui-tls`、NodePort `32258`、4173、`/healthz`、`/readyz`、`cloud_mvp` env 和 Postgres SecretRef。
- `deploy/cloud-mvp/RUNBOOK.md` 是云端/VPC runner 的 handoff runbook，覆盖 TCR/CCR build/push、Postgres Secret、qcloud HTTPS Secret、镜像替换、apply、canary、HTTPS smoke、DNS、HA/安全组收敛设计和 rollback，不保存真实 secret。
- HA 目标态设计已固定：两个 Ready TKE node、`replicas=2`、跨 node 分布、`PDB minAvailable=1`、CLB 80/443 作为公网入口、NodePort 只允许 CLB 到节点访问。
- 当前 production-gated release loop 已固定为 CI -> Release Image -> manual production dry-run -> GitHub production approval -> production apply -> canary/smoke。
- Release loop 的 helper smoke 覆盖 `/healthz`、`/readyz`、`/metricsz` 和首页；`010c2b9` 的 `/metricsz` production rollout evidence 仍 pending，`/metricsz` 尚未线上验证。
- 当前已验证 production release commit/tag 是 `d0c4de5`；Release Image green，Cloud Rollout #5 green，Production Dry Run 通过，Production Apply 通过，production approval 已通过。
- `https://opl.medopl.cn/healthz`、`https://opl.medopl.cn/readyz` 和 `https://opl.medopl.cn/` 已返回 HTTP/2 200；VPC/TKE 内 `canary db` 和 `canary opl-cli` 已通过。
- HTTP 80 当前不是稳定入口；`EnsureIngressWarning W1012` 的单节点后端风险是 HA 后续项。
- Web UI 通过同源 `/api/opl/snapshot` 展示真实 OPL CLI 只读 snapshot。
- OPL snapshot 聚合 `opl system initialize --json`、`opl connect modules --json`、`opl contract domains --json`。
- Task intake 通过 `opl domain resolve-request --json` 和 `opl contract handoff-envelope --json` 生成只读路由证据。
- Go control plane 可通过 Dockerfile 构建容器，容器内默认监听 `0.0.0.0:4173`。
- 基础 Dockerfile 只声明 `OPL_CLI_PATH=/opt/opl/bin/opl`；`Dockerfile.cloud` 通过外部 OPL build context 把 `bin/opl`、当前 OPL framework contract root `contracts/opl-framework` 和 production `node_modules` materialize 到 `/opt/opl`，并在镜像构建期从 OPL `src` 重新生成 `/opt/opl/dist`，不把 `one-person-lab` 主仓提交进 WebUI 仓库。
- `GET /healthz` 可用于云平台 HTTP health check。
- `GET /readyz` 暴露生产依赖闸门；`OPL_WEBUI_ENV=production` 缺 auth、db、queue、object store、billing 或 worker 配置时会阻断 task intake。
- `GET /metricsz` 暴露只读 monitoring projection，复用 runtime readiness truth，不泄露 secret，不连接 DB，不调用 OPL CLI。
- Task/artifact 本体仍是 projection；OPL route/snapshot 是真实 CLI readonly，不 import OPL internals，不执行 mutation。
- `npm run gate:review` 是默认 review gate。

## Cannot Claim

- 还不是完整公网多用户 production ready SaaS。
- 多节点 HA 和安全组收敛尚未由云端执行验证；HTTP->HTTPS 强制跳转和 production hardening 仍是后续项。
- 还没有真实登录、队列、计费、object storage、OPL worker、真实 OPL execution 或生产运行证据。
- 还不能执行 OPL mutation、install、repair、module exec 或 family-runtime mutation。

## Next Cursor

下一步处理 `changes/active/figma-v3-preview` 的 cloud rollout / online acceptance，并继续推进 HA/安全组收敛、监控和 auth。真实 staging 只有在 namespace、domain、DB、Secret、TLS 和 DNS 创建后才能恢复。

## Next Priorities

后续优先级按上线风险排序：发布自动化、云端执行 HA/安全组收敛、监控、auth、MedOPL API integration。每一项都需要先补 contract、eval 和回滚边界，再进入产品功能开发。
