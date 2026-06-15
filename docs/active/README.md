# Active Truth

- owner: product-engineering owner
- purpose: 当前阶段、可宣称范围和下一步唯一入口。
- state: active
- machine boundary: 非机器接口；机器判断来自 source、contracts、tests、scripts 和 Sentrux rules。

## Current Stage

当前是 `cloud-mvp-deploy-handoff`：Go control plane 已有 cloud MVP runtime gate、Postgres/OPL readonly canary 命令、`opl.medopl.cn` TKE 部署形状契约和无 secret 云端执行 runbook，但尚未执行云端部署。

## Can Claim

- Web UI 通过同源 `/api/mvp/task` 调用 Go control plane。
- Go API 返回带 `tenantId`、`workspaceId`、`userId`、`runId` 和 OPL readonly route evidence 的 task/artifact projection。
- Task projection 已通过 Go-side `TaskStore` 边界保存；当前默认实现是内存 store，不是生产数据库。
- Runtime 已按 `OPL_DATABASE_URL` 选择 task store；未配置时用 memory store，配置后用 pgx-backed Postgres store，打开、ping 或 schema 初始化失败时 fail closed。
- Runtime 支持 `OPL_WEBUI_ENV=cloud_mvp` 最小上线 profile：要求 `OPL_CLI_PATH`、`OPL_DATABASE_URL` 和 `OPL_TENANT_AUTH_MODE`，不把 queue、object store、billing、worker 误算进 MVP preview。
- Control-plane binary 提供 `canary db`，授权后可在 VPC/TKE 内用环境变量里的 `OPL_DATABASE_URL` 验证 Postgres open/ping/schema/write/read/delete，报告不泄露连接串。
- Control-plane binary 提供 `canary opl-cli`，验证 OPL readonly allowlist surfaces，不执行 install、repair、module exec 或 mutation。
- `deploy/cloud-mvp/opl-webui.k8s.json` 是 `opl.medopl.cn` 的声明式部署形状契约，固定 namespace、imagePullSecret、nodeSelector、resources、ingress class、4173、`/healthz`、`/readyz`、`cloud_mvp` env 和 Postgres SecretRef。
- `deploy/cloud-mvp/RUNBOOK.md` 是云端/VPC runner 的 handoff runbook，覆盖 TCR/CCR build/push、K8s Secret、镜像替换、apply、canary、smoke 和 rollback，不保存真实 secret。
- Web UI 通过同源 `/api/opl/snapshot` 展示真实 OPL CLI 只读 snapshot。
- OPL snapshot 聚合 `opl system initialize --json`、`opl modules --json`、`opl contract domains --json`。
- Task intake 通过 `opl domain resolve-request --json` 和 `opl contract handoff-envelope --json` 生成只读路由证据。
- Go control plane 可通过 Dockerfile 构建容器，容器内默认监听 `0.0.0.0:4173`。
- 基础 Dockerfile 只声明 `OPL_CLI_PATH=/opt/opl/bin/opl`；`Dockerfile.cloud` 通过外部 OPL build context 把 `bin/opl` 和 `contracts/opl-gateway` materialize 到 `/opt/opl`，并在镜像构建期从 OPL `src` 重新生成 `/opt/opl/dist`，不把 `one-person-lab` 主仓提交进 WebUI 仓库。
- `GET /healthz` 可用于云平台 HTTP health check。
- `GET /readyz` 暴露生产依赖闸门；`OPL_WEBUI_ENV=production` 缺 auth、db、queue、object store、billing 或 worker 配置时会阻断 task intake。
- Task/artifact 本体仍是 projection；OPL route/snapshot 是真实 CLI readonly，不 import OPL internals，不执行 mutation。
- `npm run gate:review` 是默认 review gate。

## Cannot Claim

- 还不是完整公网多用户生产 SaaS。
- 还没有执行 kubectl、build/push、Ingress 上线、公网 smoke 或 VPC/TKE DB canary。
- 还没有真实登录、队列、计费、object storage、OPL worker、真实 OPL execution 或生产运行证据。
- 还不能执行 OPL mutation、install、repair、module exec 或 family-runtime mutation。

## Next Cursor

下一步是在可用 Docker/CCR 环境中按 `deploy/cloud-mvp/RUNBOOK.md` 注入外部 OPL build context、kubeconfig、TCR/CCR 凭据和 `/home/dev/.secrets/opl-webui/postgresql/oplweb.env` 等价 Secret，构建镜像并落地到 `opl.medopl.cn`，随后跑 `canary db`、`canary opl-cli` 和公网 smoke。
