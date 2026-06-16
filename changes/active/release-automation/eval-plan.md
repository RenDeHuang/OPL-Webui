# Eval Plan

- owner: release-automation
- state: active

## Phase Gates

### Phase 0: Goal Package

- `static structure accepted`: `tests/contract/change-package-lifecycle.test.mjs` 通过。
- `local gate accepted`: `npm run verify` 和 `npm run gate:review` 通过。

### Phase 1: CI 自动测试

- GitHub Actions workflow 存在。
- PR 和 main push 触发测试。
- workflow 只运行 `npm run verify` 和 `npm run gate:review`。
- workflow 不引用 secret、不 build image、不 deploy、不包含 `kubectl`。

### Phase 2: CI build/push image

- main push 构建 `Dockerfile.cloud`。
- image tag 等于 short commit。
- TCR manifest 可查询并输出 digest。
- workflow 不引用 kubeconfig、不执行 rollout。

### Phase 3: Cloud CD runner rollout

- self-hosted runner 在腾讯云 VPC 内。
- runner 能访问 TKE API。
- dry-run 和 `--apply` 分离。
- `canary db`、`canary opl-cli`、`/healthz`、`/readyz` 和首页 smoke 通过。
- 记录 rollout revision、Deployment image、Pod imageID。

### Phase 4: Staging / Production

- staging 与 production namespace/domain/secret boundary 不混淆。
- staging 先自动 rollout，production manual approval 后 rollout。
- 两个环境都有 smoke/canary/rollback evidence。

## Required Commands

- `node --test tests/contract/change-package-lifecycle.test.mjs`
- `npm run verify`
- `npm run gate:review`

## Cannot Claim

- 未实现的 phase 不能 claim 自动化完成。
- 没有 GitHub Actions run URL 不能 claim CI 已上线。
- 没有 registry digest 不能 claim image push 完成。
- 没有 VPC runner 日志不能 claim rollout 自动化完成。
- 没有 staging 和 production 线上证据不能 claim 分环境发布完成。
