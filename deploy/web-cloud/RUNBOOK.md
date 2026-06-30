# OPL-Webui Web cloud Deploy Handoff

本 runbook 只给云端/VPC runner 使用，不保存真实 kubeconfig、数据库密码、云 API key、镜像凭据或证书 ID。

## 前置条件

- `KUBECONFIG=/external/path/to/tke-kubeconfig`，由云端执行者注入，不进 git。
- Production 必需 Secret：`opl-webui-postgres` 提供 `OPL_DATABASE_URL`；`opl-webui-auth` 必须包含 `OPL_TENANT_AUTH_SECRET`、`OPL_SESSION_SECRET`、`OPL_API_KEY_ENCRYPTION_SECRET`、`OPL_CHAT_MODEL`。
- OPL-Webui 是 Genspark-like one-person-lab-web with ChatGPT-like base chatbot；用户 API Key 只走固定 `https://gflabtoken.cn/v1`，不允许用户自定义 base_url。
- MedOPL 是充值、runtime、node pool、storage、账单和资源后台；OPL-Webui 不拥有 node pool 生命周期、billing source of truth 或 API gateway。
- 开源仓库 Actions 边界：`pull_request` CI test-only，PR 不拿 secrets，不使用 `pull_request_target`。
- TCR/CCR 登录由 GitHub Actions secrets `TCR_USERNAME`、`TCR_PASSWORD` 注入；OPL build context 由 `OPL_BUILD_CONTEXT` 注入；production environment secrets 注入 `KUBECONFIG`。
- build/push 必须在腾讯云 VPC self-hosted runner `[self-hosted, tencent-cloud, opl-webui]` 上运行。
- Cloud Rollout image allowlist 只允许 `uswccr.ccs.tencentyun.com/webopl/opl-webui:<tag>`、`uswccr.ccs.tencentyun.com/webopl/opl-webui@sha256:<digest>`，或 release short commit tag（如 `4a9d439`，会规范化为本仓完整镜像）。
- 当前是 `no-public-staging production-gated release`；还没有真实 `staging.opl.medopl.cn`、`opl-webui-staging` namespace、独立 staging DB/Secret/TLS/DNS。不要 fake staging；staging 不是镜像存储，TCR/CCR 才是版本存储。
- TKE IngressClass 使用 `qcloud`；qcloud Ingress 需要后端 Service 为 `NodePort`。DNS 只改 `opl.medopl.cn` CNAME。
- HTTPS 证书由 Opaque Secret `opl-webui-tls` 的 `qcloud_cert_id` 引用；不要直接在 CLB 控制台手工绑定证书。

## 镜像构建与推送

```bash
short_commit="$(git rev-parse --short HEAD)"
export OPL_IMAGE="uswccr.ccs.tencentyun.com/webopl/opl-webui:${short_commit}"
docker build \
  -f Dockerfile.cloud \
  --build-context opl=/external/path/to/one-person-lab \
  -t "$OPL_IMAGE" .
docker push "$OPL_IMAGE"
```

`Dockerfile.cloud` 会把外部 OPL context 的 `bin/opl`、`contracts/opl-framework` 和重新生成的 `/opt/opl/dist` 放进镜像；不要把 `one-person-lab` 主仓复制进本仓。当前 stable baseline 仍记录为 `uswccr.ccs.tencentyun.com/webopl/opl-webui:30a3249`，新发布用 `<short-commit>`。

## 日常更新发布流程

常规路径：

```text
CI -> Release Image -> manual production dry-run -> Environment approval -> production apply -> canary/smoke -> optional production authenticated dogfood
```

1. 本地开发验证：`npm run verify`、`npm run gate:review`。
2. push/merge 到 `main` 后，`Release Image` 在 self-hosted Tencent runner build/push TCR/CCR，记录 image digest；Release Image 不执行 rollout。
3. 手动运行 `Cloud Rollout`：`image=$OPL_IMAGE` 或 `image=<short_commit>`，`target_environment=production`，`apply=false`。dry-run 不读取 kubeconfig、不改集群，只打印 rollout、evidence、canary 和 HTTPS smoke 命令。
4. dry-run 审计通过后，用同一 image 再运行 `Cloud Rollout`，`target_environment=production`，`apply=true`。同一次 workflow 会先执行 `production-dry-run`，再执行 `production-image-preflight`，用 `TCR_USERNAME` / `TCR_PASSWORD` 登录私有 TCR 并执行 `docker manifest inspect` 确认目标镜像已经存在；preflight 不读取 kubeconfig、不进入 production environment、不改集群。preflight 通过后才通过 GitHub `production` Environment approval 进入 `production-apply`，执行 `kubectl set image`、`rollout status`、`canary db`、`canary opl-cli` 和 HTTPS smoke。
5. `authenticated_dogfood_e2e=true` 只能和 `apply=true` 一起使用；dogfood job 依赖 `production-apply`，因此只能在该 image 的 apply、canary、smoke 成功后运行。`apply=false` 时请求 dogfood 会 fail-closed。
6. `availability_probe=true` 会运行 no-secret production availability probe。`apply=false` 时探测当前线上；`apply=true` 时在本次 rollout apply、canary、smoke 成功后探测新版本线上。该 probe 不读取 kubeconfig、image、DB、dogfood secret、MedOPL token 或 TCR 凭据。
7. 发布日志必须记录 rollout revision、Deployment image、Pod imageID、Pod `-o wide`、`canary db`、`canary opl-cli`、HTTPS smoke。
8. 手动回滚也走同一个 helper：`Cloud Rollout` 设置 `rollback=true`、`apply=false`、`availability_probe=true`。同一次 workflow 的 dry-run 阶段会执行 `node scripts/cloud-rollout.mjs --rollback-plan`，只打印 `rollout undo` 和 post-rollback canary/smoke 计划，不打印 forward `set image`。通过 production Environment approval 后执行 `node scripts/cloud-rollout.mjs --rollback`，再运行 `Production Availability Probe After Rollback`。这是 manual environment-approved rollback evidence，不是自动失败回滚。

如果 `rollout status` 超时或失败，helper 会在退出前打印 Deployment、ReplicaSet/Pod、Pod describe、Pod logs 和 events 摘要，并给出 `rollout likely cause`。分类只用于定位下一步排查，不改变集群状态：

- `scheduling_or_node_resources`：调度、nodeSelector、taint、CPU/内存资源不足。WebUI 当前使用 `medopl.cn/webui=true`，不能要求节点把 `medopl.cn/workload=medopl` 改成 `webui`。
- `image_pull`：镜像 tag、TCR 权限或 `imagePullSecrets` 问题。
- `missing_kubernetes_secret_or_config`：Secret/ConfigMap 或 key 缺失。
- `container_startup_or_crash`：容器启动失败或 CrashLoop。
- `readiness_or_liveness_probe`：`/readyz` 或 `/healthz` 探针失败。
- `old_pod_termination_or_node`：旧 Pod 删除或节点状态异常。

`kubectl rollout status` 同时有 kubectl 内置等待和 helper 外层硬超时；如 kubectl 客户端本身卡住，helper 会在外层超时后杀掉该进程并继续打印上述诊断。默认 kubectl 等待 150 秒，外层超时 160 秒，可用 `OPL_KUBECTL_ROLLOUT_TIMEOUT_SECONDS` 和 `OPL_ROLLOUT_STATUS_TIMEOUT_MS` 调整。每条诊断 kubectl 命令也有 5 秒默认超时，可用 `OPL_ROLLOUT_DIAGNOSTIC_TIMEOUT_MS` 调整。

手工 fallback 由云端/VPC runner 执行：

```bash
OPL_IMAGE="<short-commit-or-full-tag-or-digest>" node scripts/cloud-rollout.mjs
KUBECONFIG=/external/path/to/tke-kubeconfig \
OPL_IMAGE="<short-commit-or-full-tag-or-digest>" \
node scripts/cloud-rollout.mjs --apply
```

helper 必须先校验 `OPL_IMAGE` 属于 `uswccr.ccs.tencentyun.com/webopl/opl-webui:<tag>`、`uswccr.ccs.tencentyun.com/webopl/opl-webui@sha256:<digest>`，或 `^[0-9a-f]{7,40}$` release short commit tag。短 tag 只会规范化到 `uswccr.ccs.tencentyun.com/webopl/opl-webui:<tag>`；外部 registry、未限定 repo 和 floating `latest` 继续 fail-closed。Forward apply 还必须先执行 `node scripts/cloud-rollout.mjs --image-preflight`；该 preflight 只允许使用 `TCR_USERNAME` / `TCR_PASSWORD` 做 private TCR manifest read，不能读取 `KUBECONFIG`、DB、dogfood secret 或 MedOPL token。目标 manifest 不存在时 fail-closed 为 `image_missing_rollout_order_issue`，并且 `imagePullOccurred=false`，不能进入 `kubectl set image`。Forward apply 必须只选择 Running、Ready、container image 等于本次规范化后 `OPL_IMAGE` 的 Pod 执行 canary；rollback 必须读取 undo 后 Deployment image，再选择 Running、Ready、container image 等于 post-rollback Deployment image 的 Pod 执行 canary，不能对 Failed/Succeeded/Error 历史 Pod exec。`/readyz` 必须返回 `ok=true` 且 `missing=[]`；`/metricsz` 必须返回 `ok=true` 且 `missingDependencyCount=0`。恢复 automatic staging rollout 的条件：创建真实 `staging.opl.medopl.cn`、`opl-webui-staging`、独立 staging DB/Secret/TLS/DNS，并补 workflow contract、runbook、canary/smoke eval 和 rollback。

## Production availability probe

该 probe 是 production 可用性抽样证据，不是 rollout mutation，也不是 authenticated dogfood。它只访问公开 HTTPS 入口，重复检查 `/healthz`、`/readyz`、`/metricsz` 和首页，不读取 kubeconfig、镜像、数据库、dogfood secret、MedOPL token 或 TCR 凭据。默认抽样 3 次，可用 `OPL_AVAILABILITY_PROBE_SAMPLES=3` 和 `OPL_AVAILABILITY_PROBE_INTERVAL_MS=1000` 调整；脚本会限制样本数和间隔上限。

执行边界：

```bash
OPL_BASE_URL=https://opl.medopl.cn \
OPL_AVAILABILITY_PROBE_SAMPLES=3 \
node scripts/cloud-rollout.mjs --availability-probe
```

GitHub `Cloud Rollout` 手动 input `availability_probe=true` 时：

- `apply=false`：`Production Availability Probe Current` 在 dry-run 后探测当前线上。
- `apply=true`：`Production Availability Probe After Apply` 在本次 apply、canary、smoke 成功后探测新版本线上。

Production availability probe closeout 只记录压缩摘要，不记录 response body、cookie、secret、DB URL 或 request payload：

```text
run id:
target host: https://opl.medopl.cn
image:
samples:
checks: healthz,readyz,metricsz,home
failures:
result:
cannot claim: multi-node HA, production browser e2e, production authenticated dogfood, production-ready SaaS, MedOPL runtime execution, billing/payment/storage/node pool mutation
```

## Production observability baseline v1

Observability baseline v1 使用同一 probe 的压缩摘要，不新增 dashboard 或 alerting surface。`/metricsz` 必须包含 `observabilitySchemaVersion=1`、`releaseProbeContract=production_observability_baseline_v1`、`publicProbeEndpoints=["/healthz","/readyz","/metricsz","/"]`；helper 输出每个 endpoint 的 `samples`、`successes`、`failures`、`maxDurationMs`，并继续不保存 raw response body、cookie 或 secret。

Latest folded evidence is Cloud Rollout run `28417149616`, commit `8b0886a219b20056394470206aedc8800211e8d4`, image `uswccr.ccs.tencentyun.com/webopl/opl-webui:8b0886a`, after production apply, availability probe, authenticated dogfood, and production browser e2e. Historical run `28142197152` remains provenance only. A no-secret scheduled canary entrypoint exists at `.github/workflows/production-canary.yml`; it runs `node scripts/cloud-rollout.mjs --availability-probe` against the public host and does not read kubeconfig, dogfood secrets, database secrets, MedOPL token, or image credentials. scheduled canary first success: 27874732529.

```text
P0 launch operations contracts present: rollback_path, alerting_boundary, db_backup_restore_strategy, security_ops_baseline, incident_runbook_owner, cost_quota_guard
P1 commercial operations contracts present: staging_or_production_concurrency_evidence, upstream_backpressure_boundary, migration_schema_compatibility_policy, observability_dashboard_entry
P2 SLA/HA operations contracts present: ha_topology_evidence, slo_error_budget_contract, automatic_rollback_admission_policy
pending external evidence: production_rollback_record, alert_route, db_restore_drill, dashboard_url, production_load_run, multi_node_ha_run, slo_enforcement, automatic_rollback_admission
cannot claim: dashboard URL, alert route, DB restore drill, production load readiness, error budget enforcement, automatic rollback, multi-node HA, production-ready SaaS
```

Final release decision receipt is a separate sanitized foldback step, not an automatic deploy side effect. After the operator has real soak, load, rollback, canary, alerting, DB restore, monitoring, HA/SLO decision, and go/no-go evidence, fold only the summary:

```bash
npm run release:evidence -- \
  --run-id <github-run-id> \
  --jobs-json <jobs.json> \
  --launch-closeout-json <sanitized-closeout.json> \
  --update-release-profile contracts/web-release-profile.json
```

The closeout JSON must not contain raw logs, cookies, API keys, DB URLs, upstream bodies, or screenshots. Until this receipt is folded back, do not claim long soak, production load readiness, rollback execution, alert routing, DB restore drill, dashboard readiness, HA, SLO enforcement, automatic rollback, or production-ready SaaS.

P0/P1 single-node launch operations closeout is narrower than final HA/SLO closeout. After the operator has real rollback, alerting, DB restore, monitoring/dashboard, soak, load, DB pool, upstream backpressure, and migration-compatibility evidence, fold only the sanitized summary:

```bash
npm run release:evidence -- \
  --run-id <github-run-id> \
  --jobs-json <jobs.json> \
  --ops-closeout-json <sanitized-ops-closeout.json> \
  --update-release-profile contracts/web-release-profile.json
```

This receipt can support a controlled single-node public launch decision, but it must still not claim multi-node HA, automatic rollback, complete commercial SaaS, billing source of truth, or runtime execution.

## Production authenticated dogfood e2e

该 harness 只证明 OPL-Webui 自己的 production authenticated 用户路径，默认跳过，不属于 rollout mutation。GitHub `Cloud Rollout` 手动 input `authenticated_dogfood_e2e=false` 为默认；打开后必须同时设置 `apply=true`，并且只能在该 workflow 的 `production-apply`、canary、smoke 成功后运行。Environment secrets 只需要 `OPL_DOGFOOD_EMAIL`、`OPL_DOGFOOD_PASSWORD`、`OPL_DOGFOOD_API_KEY`，不要给该 job 注入 `KUBECONFIG`、`OPL_DATABASE_URL`、PostgreSQL 密码、MedOPL token 或 TCR 凭据。`OPL_DOGFOOD_EMAIL` 必须是邮箱格式，`OPL_DOGFOOD_PASSWORD` 必须至少 12 个字符；helper 会在发起 production 请求前本地 fail-closed。

执行边界：

```bash
OPL_PRODUCTION_DOGFOOD_E2E=1 \
OPL_DOGFOOD_EMAIL=<test-account> \
OPL_DOGFOOD_PASSWORD=<test-password> \
OPL_DOGFOOD_API_KEY=<test-api-key> \
node scripts/cloud-rollout.mjs --dogfood-e2e
```

- 默认不执行真实普通 chat；只有显式设置 `OPL_PRODUCTION_DOGFOOD_REAL_CHAT=1` 才会发起一次 `POST /api/chat`，使用测试账号绑定的测试 API Key 经固定 gateway `https://gflabtoken.cn/v1` 完成普通 chat completion。
- 默认不执行 readonly projection dogfood；只有显式设置 `OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1` 才会读取 `/api/medopl/runtime/status`、`/api/medopl/materials-deliverables/projection` 和 `/api/account/billing-summary`，并校验 owner 与 forbidden mutation flags。
- 覆盖 register 或 login fallback、current session、API Key binding、raw API Key 不回显、fixed gateway、`@基金` MedOPL Runtime gate、audit events；`CHAT_QUOTA_EXCEEDED` 仍由本地 mock upstream contract 覆盖，不在 production 故意耗尽 quota。
- GitHub step 必须先 `::add-mask::` dogfood API Key 和密码；脚本不打印 raw API Key、request body、password、完整 response body 或 `opl_session`，只打印步骤名、HTTP status、errorCode 和 audit kind 汇总。
- 当前没有 delete user API，因此生产 dogfood 数据采用专用 test account / hidden personal tenant/workspace 隔离，不 claim 自动清理；该账号只是一条 production evidence fixture，不是产品 runtime admission policy。
- 该 harness 不执行 kubectl，不读取 kubeconfig，不直接连接真实 PostgreSQL，不连接 MedOPL production private API，不执行真实 OPL，不创建 runtime、storage、billing 或 node pool 生命周期。readonly projection dogfood 只通过 OPL-Webui Go control plane 的公开只读端点校验 sanitized projection。

Production authenticated dogfood closeout 只记录压缩证据，不记录 raw body、cookie、API Key、password 或 request payload：

```text
run id:
target host: https://opl.medopl.cn
image:
real chat: false|true
medopl readonly: false|true
steps: register_or_login,current_session,api_key_binding,runtime_gate,audit_events[,runtime_status,materials_deliverables,billing_summary]
HTTP status summary:
audit kinds:
cannot claim: browser e2e, MedOPL runtime execution, billing/payment/storage/node pool mutation, production MedOPL private API integration, quota exhaustion production evidence
```

Latest compressed evidence:

```text
run id: 28417149616
run URL: https://github.com/RenDeHuang/OPL-Webui/actions/runs/28417149616
commit: 8b0886a219b20056394470206aedc8800211e8d4
target host: https://opl.medopl.cn
image: uswccr.ccs.tencentyun.com/webopl/opl-webui:8b0886a
real chat: true (confirmed by production browser e2e in the same run)
readonly projection: true (sanitized foldback confirms OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1)
stages: Production Dry Run success, Production Image Preflight success, Production Apply success, Production Availability Probe After Apply success, Production Authenticated Dogfood E2E success, Production Browser E2E success
steps: register_or_login,current_session,api_key_binding,ordinary_chat,runtime_gate,audit_events,runtime_status,materials_deliverables,billing_summary
HTTP status summary: GitHub job success; raw response bodies are not stored in git
audit kinds: chat.completed,runtime_gate.required validated by production browser e2e; raw audit payload is not stored in git
result: production authenticated dogfood e2e passed
cannot claim: MedOPL runtime execution, billing/storage/node pool mutation, quota exhaustion production evidence
```

Production availability probe closeout:

```text
run id: 28417149616
run URL: https://github.com/RenDeHuang/OPL-Webui/actions/runs/28417149616
image: uswccr.ccs.tencentyun.com/webopl/opl-webui:8b0886a
stage: Production Availability Probe After Apply success
coverage: HTTPS /healthz, HTTPS /readyz, HTTPS /metricsz, HTTPS /
cannot claim: multi-node HA, production browser e2e, production-ready SaaS, MedOPL runtime execution
```

Production browser e2e harness:

- 在 `Cloud Rollout` 中设置 `apply=true` 且 `production_browser_e2e=true`，job 会在 `Production Apply` 后运行。
- 该 lane 使用真实 Chromium/CDP 打开 `https://opl.medopl.cn`，通过生产 dogfood 账号执行登录、API Key 绑定、普通科研 chat、`@论文`/`@基金` runtime gate 和 audit evidence 检查。
- 该 lane 需要 `OPL_DOGFOOD_EMAIL`、`OPL_DOGFOOD_PASSWORD`、`OPL_DOGFOOD_API_KEY`，并在 job 中 mask password/API key。
- 该 lane 不执行 kubectl，不读取 kubeconfig，不读取数据库 secret，不连接 MedOPL private API，不执行 OPL runtime mutation。
- 本 harness 已在 GitHub Actions run `28417149616` 成功执行；后续只有新的成功 run 才能替换 latest compressed evidence。

Production browser e2e closeout 只记录压缩证据，不记录 raw body、cookie、API Key、password、email 或 request payload：

```text
run id: 28417149616
run URL: https://github.com/RenDeHuang/OPL-Webui/actions/runs/28417149616
job URL: https://github.com/RenDeHuang/OPL-Webui/actions/runs/28417149616/job/84202607112
target host: https://opl.medopl.cn
image: uswccr.ccs.tencentyun.com/webopl/opl-webui:8b0886a
browser: chromium
steps: real_browser_login,api_key_binding,research_task_template_selected,ordinary_chat,paper_runtime_gate,grant_runtime_gate,audit_events
audit kinds: chat.completed,runtime_gate.required
result: production browser e2e passed
cannot claim: MedOPL runtime execution, billing/payment/storage/node pool mutation, team invite/RBAC/payment lifecycle, production-ready SaaS
```

## 创建 Kubernetes Secret

```bash
set -a
. /home/dev/.secrets/opl-webui/postgresql/oplweb.env
. /external/path/to/opl-webui-auth.env
set +a

kubectl --kubeconfig "$KUBECONFIG" -n opl-webui create secret generic opl-webui-postgres \
  --from-literal=OPL_DATABASE_URL="$OPL_DATABASE_URL" \
  --dry-run=client -o yaml | kubectl --kubeconfig "$KUBECONFIG" apply -f -
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui create secret generic opl-webui-auth \
  --from-literal=OPL_TENANT_AUTH_SECRET="$OPL_TENANT_AUTH_SECRET" \
  --from-literal=OPL_SESSION_SECRET="$OPL_SESSION_SECRET" \
  --from-literal=OPL_API_KEY_ENCRYPTION_SECRET="$OPL_API_KEY_ENCRYPTION_SECRET" \
  --from-literal=OPL_CHAT_MODEL="$OPL_CHAT_MODEL" \
  --dry-run=client -o yaml | kubectl --kubeconfig "$KUBECONFIG" apply -f -
```

`OPL_TENANT_AUTH_SECRET` 继续保留给既有 launch-token/canary 边界；`OPL_SESSION_SECRET` 签 HttpOnly `opl_session`；API Key 使用 `OPL_API_KEY_ENCRYPTION_SECRET` 加密保存，后端不返回 raw API Key；`OPL_CHAT_MODEL` 是 server-side 默认模型配置。

## 44dd574 生产验证记录

- image: `uswccr.ccs.tencentyun.com/webopl/opl-webui:44dd574`
- rollout revision: `13`
- Pod: `opl-webui-control-plane-69c859465f-v9crb`，`1/1 Running`，restarts `0`，image tag `44dd574`
- `/healthz` HTTP 200，`/readyz` HTTP 200 且 `missing=[]`，`/metricsz` HTTP 200 且 `missingDependencyCount=0`
- `/` HTTP 200 返回 One Person Lab Web 首页 HTML
- canary db pass: `open,ping,schema,write,read,delete`
- canary opl-cli pass: `system.initialize,connect.modules,contract.domains`
- unauth guard: `/api/auth/login` HTTP 401 `INVALID_CREDENTIALS`；`/api/chat` HTTP 401 `AUTH_REQUIRED`
- public smoke: `https://opl.medopl.cn/healthz` HTTP/2 200；`https://opl.medopl.cn/readyz` HTTP/2 200 且 `missing=[]`
- controlled fix: `opl-webui-auth` 保留 `OPL_TENANT_AUTH_SECRET`，并新增 `OPL_SESSION_SECRET`、`OPL_API_KEY_ENCRYPTION_SECRET`、`OPL_CHAT_MODEL`；Deployment 已声明这四个 `secretKeyRef`。本记录不包含 secret value。

## 配置 qcloud HTTPS 证书

```bash
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui create secret generic opl-webui-tls \
  --type=Opaque \
  --from-literal=qcloud_cert_id="$QCLOUD_CERT_ID" \
  --dry-run=client -o yaml | kubectl --kubeconfig "$KUBECONFIG" apply -f -
```

`QCLOUD_CERT_ID` 由外部 secret manager 或执行环境注入。runbook 只固定 Secret 名 `opl-webui-tls` 和 key `qcloud_cert_id`。

## 替换真实镜像地址

```bash
tmp_manifest="$(mktemp)"
node -e '
const fs = require("fs");
const image = process.env.OPL_IMAGE;
const manifest = JSON.parse(fs.readFileSync("deploy/web-cloud/opl-webui.k8s.json", "utf8"));
for (const item of manifest.items) {
  if (item.kind === "Deployment") item.spec.template.spec.containers[0].image = image;
}
process.stdout.write(JSON.stringify(manifest, null, 2));
' > "$tmp_manifest"
```

## 部署

以下步骤只由云端/VPC runner 执行 `kubectl apply`，本地开发机不执行。Service 保持 `NodePort`，当前端口 `4173:32258/TCP`；Ingress 保持 `ingressClassName: qcloud`，TLS Secret `opl-webui-tls` 终止 `opl.medopl.cn`。

```bash
kubectl --kubeconfig "$KUBECONFIG" create namespace opl-webui --dry-run=client -o yaml \
  | kubectl --kubeconfig "$KUBECONFIG" apply -f -
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui apply -f "$tmp_manifest"
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui rollout status deployment/opl-webui-control-plane
```

## Canary

```bash
pod="$(kubectl --kubeconfig "$KUBECONFIG" -n opl-webui get pod -l app.kubernetes.io/name=opl-webui -o jsonpath='{.items[0].metadata.name}')"
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui exec "$pod" -- /app/opl-webui-control-plane canary db
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui exec "$pod" -- /app/opl-webui-control-plane canary opl-cli
```

## Smoke

```bash
curl --http2 -fsS https://opl.medopl.cn/healthz
curl --http2 -fsS https://opl.medopl.cn/readyz
curl --http2 -fsS https://opl.medopl.cn/metricsz
curl --http2 -fsS https://opl.medopl.cn/ >/tmp/opl-webui-home.html
curl --http2 -fsS -X POST https://opl.medopl.cn/api/chat
curl --http2 -fsS https://opl.medopl.cn/api/session/current
```

未认证 `POST /api/chat` 与 `GET /api/session/current` 应返回 `401 AUTH_REQUIRED`。`/readyz` 必须 `ok: true`。当前 HTTPS smoke 已通过 `/healthz`、`/readyz`、首页 HTTP/2 200，`canary db` open/ping/schema/write/read/delete ok，`canary opl-cli` ok。HTTP 80 当前不是稳定入口。

## DNS

```text
opl.medopl.cn CNAME <qcloud-clb-hostname>
```

当前已验证 CLB host：`lb-lhj3bgii-ms5ocrjz6hdaki2l.clb.usw-tencentclb.com`。

## HA / 安全组收敛设计

当前风险是 `EnsureIngressWarning W1012`：只有一个后端节点。目标态是两个可调度 TKE node、两个 Ready Pod、CLB 至少两个健康 backend，公网入口只走 CLB `80,443`，NodePort `32258` 只接受 CLB 到节点访问。

HA is paused for the current single-node launch. The apply manifest intentionally stays at `replicas=1` so a one-worker TKE cluster can keep rolling out safely; do not apply `replicas=2` with `DoNotSchedule` topology rules until a second Ready worker node is available and labeled. This cannot be used as multi-node HA evidence until the cloud operator folds back the actual run, pod topology, and CLB backend result.

1. 当前 launch-safe 形态：`replicas=1`，不启用 `topologySpreadConstraints`、`podAntiAffinity` 或 `PDB`，避免单节点集群调度卡住。
2. 未来 HA 形态：`replicas=2`、跨 `kubernetes.io/hostname` 分布、`topologySpreadConstraints maxSkew: 1`、`DoNotSchedule`、软 `podAntiAffinity`、`PDB minAvailable: 1`、滚动更新 `maxUnavailable: 0`。
3. TKE node：新增或复用第二个 Ready worker node，保留 `medopl.cn/workload=medopl` 作为 MedOPL 节点身份，并额外带 `medopl.cn/webui=true` 供 WebUI 调度。
4. 安全组：qcloud Ingress/CLB 只允许公网 `80,443`；节点安全组只允许 CLB 安全组或 CLB 后端网段到 NodePort `32258`，验证后删除公网到 NodePort 的临时规则。
5. HA 恢复执行：确认第二 node -> 打 label -> 改为 HA manifest -> rollout -> 确认 Ingress backend 节点数 -> 收敛安全组。
6. 验证：`kubectl get pod -o wide` 两 Pod 在不同 node；`kubectl get ingress` 有 `80,443`；跑 canary、`https://opl.medopl.cn/{healthz,readyz}` 和首页 smoke；确认 W1012 消失或 backend 不再是单节点。
7. 回滚：Pod 不 Ready 或 HTTPS/canary 失败时 `rollout undo` 或恢复 `replicas: 1`；安全组导致 504 时先恢复上一条 NodePort 规则。
8. 腾讯云控制台事项：新增/复用第二 CVM/TKE worker、确认节点/CLB 安全组、记录 CLB 后端来源范围、绑定专用 CLB 安全组；证书仍由 `opl-webui-tls` Secret 驱动。

Production HA readiness contract closeout must include:

```text
replicas=2
two Ready Pod: true|false
distinct node: true|false
PDB minAvailable=1: true|false
topologySpreadConstraints: true|false
rolling update maxUnavailable=0: true|false
Ingress/CLB backend count:
canary/smoke:
production availability probe:
cannot claim until all true: multi-node HA, CLB two-backend health, zero-downtime rolling update evidence
```

## Rollback

首选 GitHub `Cloud Rollout` 手动回滚：

```text
image: uswccr.ccs.tencentyun.com/webopl/opl-webui:<previous-known-good-tag-or-digest>
target_environment: production
apply: false
rollback: true
availability_probe: true
authenticated_dogfood_e2e: false
production_browser_e2e: false
```

该路径会执行：

```bash
KUBECONFIG=/external/path/to/tke-kubeconfig \
OPL_IMAGE="uswccr.ccs.tencentyun.com/webopl/opl-webui:<previous-known-good-tag-or-digest>" \
node scripts/cloud-rollout.mjs --rollback
```

Rollback closeout 只记录压缩证据：

```text
run id:
target host: https://opl.medopl.cn
image:
stages: Production Dry Run, Production Rollback, Production Availability Probe After Rollback
checks: rollout_undo,rollout_status,canary_db,canary_opl_cli,healthz,readyz,metricsz,home
result:
cannot claim: automatic rollback, production-ready SaaS, data migration rollback
```

手工 kubectl fallback 仅在 GitHub workflow 不可用时由云端/VPC runner 执行：

```bash
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui rollout undo deployment/opl-webui-control-plane
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui rollout status deployment/opl-webui-control-plane
```

如果新部署首次上线且没有历史 ReplicaSet，则删除本次 Deployment/Service/Ingress，并保留 secret 供复用：

```bash
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui delete -f "$tmp_manifest"
```
