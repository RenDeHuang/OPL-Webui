# Release Automation Goal

- owner: release-engineering owner
- state: active
- change package: `changes/active/release-automation`
- machine boundary: 本文是人读目标入口；机器判断来自 contracts、tests、scripts、workflow logs、registry manifest、runner logs 和线上 smoke/canary。

## Goal

把 OPL-Webui 从 Codex 手动协同发布升级为四阶段可验证发布系统：CI 自动测试、CI 构建并推送镜像、云端 CD runner rollout、staging / production 分环境发布。每个阶段独立交付，必须有 eval、secret boundary、failure / rollback handling，不能把 GitHub public runner、TCR、TKE、DNS、kubeconfig 和 production approval 混成一次性大改。

## Phase 1: CI 自动测试

### Goal

PR 和 main push 自动运行本仓默认质量门，让测试结果进入 GitHub Actions，而不是只依赖本地 Codex 输出。

### Implementation Steps

- 新增 GitHub Actions CI workflow。
- `pull_request` 和 `push` 到 `main` 触发。
- 运行 `npm run verify`。
- 运行 `npm run gate:review`。
- 明确不构建镜像、不部署、不访问 TKE、不读取 secret。

### Evals / Acceptance Criteria

- workflow 文件存在并被合同测试覆盖。
- GitHub Actions run URL 可证明 PR / push 自动触发。
- `npm run verify` 和 `npm run gate:review` 在 workflow 中通过。
- workflow 中没有 `kubectl`、`docker push`、kubeconfig 或 secret 引用。

### Secret Boundary

Phase 1 no-secret。不能新增 GitHub Secrets，不能读取 kubeconfig，不能连接 PostgreSQL。

### Failure / Rollback Handling

CI 失败只阻断合并或发布，不回滚线上环境。修复方式是提交新 commit 让 CI 重新运行。

## Phase 2: CI 构建并推送镜像

### Goal

main 分支测试通过后，由 CI 构建 `Dockerfile.cloud` 镜像，使用 short commit tag 推送到 TCR，并输出 immutable digest。

### Implementation Steps

- main push 触发 build job。
- 使用 `Dockerfile.cloud` 和外部 OPL build context。
- image tag 使用 short commit。
- 登录 `uswccr.ccs.tencentyun.com/webopl`。
- push `uswccr.ccs.tencentyun.com/webopl/opl-webui:<short-commit>`。
- 输出 registry manifest digest。
- 不访问 TKE，不执行 rollout。

### Evals / Acceptance Criteria

- GitHub Actions build log 显示 short commit tag。
- `docker buildx imagetools inspect` 或 registry manifest 查询返回 digest。
- tag 与 commit 对应。
- workflow 不包含 `kubectl`、KUBECONFIG 或 TKE endpoint。

### Secret Boundary

只允许使用镜像仓库凭据，例如 `TCR_USERNAME`、`TCR_PASSWORD`、`TCR_REGISTRY`、`TCR_NAMESPACE`。不能在仓库、日志或文档中写真实 secret 值。

### Failure / Rollback Handling

build/push 失败不影响线上。已存在 production image 不变。重新运行 workflow 或提交新 commit 修复。

## Phase 3: 云端 CD runner rollout

### Goal

部署动作只在腾讯云 VPC 内的 self-hosted runner 执行，公共 GitHub runner 不持有 kubeconfig，也不能直连 TKE。

### Implementation Steps

- 准备腾讯云 VPC self-hosted runner。
- runner 持有外部注入的 kubeconfig 并能访问 TKE API。
- 先执行 `scripts/cloud-rollout.mjs` dry-run。
- approval 后执行 `scripts/cloud-rollout.mjs --apply`。
- helper 执行 `kubectl set image`、`rollout status`、`canary db`、`canary opl-cli`、`/healthz`、`/readyz` 和首页 smoke。
- 记录 rollout revision、Deployment image、Pod imageID、canary 输出和 HTTPS smoke 输出。

### Evals / Acceptance Criteria

- self-hosted runner 日志证明 `kubectl get nodes` 或等价只读 API 可达。
- dry-run 输出目标 image、Deployment、canary 和 smoke 命令。
- `--apply` 更新 Deployment image 到目标 digest 或 tag。
- `canary db` 和 `canary opl-cli` 通过。
- `https://opl.medopl.cn/healthz` 和 `/readyz` 返回 200 / ok。
- 首页返回新版本标记。

### Secret Boundary

kubeconfig 只存在腾讯云 VPC runner 或云端 secret manager。GitHub public runner、本地仓库和 Markdown 不保存 kubeconfig、数据库密码或云 API key。

### Failure / Rollback Handling

rollout、canary 或 HTTPS smoke 失败时不能静默成功。使用 `kubectl rollout undo deployment/opl-webui-control-plane` 或 runbook rollback，记录失败日志和恢复后的 smoke 结果。

## Phase 4: staging / production 分环境

### Goal

新版本先发 staging，通过 smoke/canary 后再由 manual approval 发布 production，避免直接打 `https://opl.medopl.cn`。

### Implementation Steps

- 定义 staging namespace。
- 定义 staging domain，例如 `staging.opl.medopl.cn` 或 `staging-opl.medopl.cn`。
- staging 使用与 production 相同 image tag。
- staging 自动 rollout 并运行 smoke/canary。
- production rollout 需要 manual approval。
- production 继续使用 `https://opl.medopl.cn`。
- 两套环境有明确 secret、DB、Ingress 和 rollback 边界。

### Evals / Acceptance Criteria

- staging namespace 和 Ingress 存在。
- staging HTTPS 可访问。
- staging `canary db` 和 `canary opl-cli` 通过。
- production 不自动更新。
- manual approval 后 production 更新。
- production HTTPS smoke/canary 通过。
- staging 与 production 配置 diff 可审计且不混淆。

### Secret Boundary

staging 和 production 使用独立 secret scope。不能把 production secret 复用到 staging，不能在 public runner 暴露任一环境 kubeconfig。

### Failure / Rollback Handling

staging 失败阻断 production。production 失败执行 rollback，记录 approval、rollout revision、Pod imageID、canary、smoke 和 rollback evidence。

## Cannot Claim

- Phase 1 未实现前，不能 claim CI 自动测试已上线。
- Phase 2 未实现前，不能 claim image 自动 build/push。
- Phase 3 未实现前，不能 claim cloud rollout 自动化。
- Phase 4 未实现前，不能 claim staging / production 分环境发布。
- 没有 GitHub Actions run URL、registry digest、runner log 或 online smoke 证据时，不能用本地通过替代线上完成。
