# Tasks

- owner: release-automation
- state: active

## Checklist

- [x] Phase 0: Goal Package。
- [ ] Phase 1: CI 自动测试。
- [ ] Phase 2: CI build/push image。
- [ ] Phase 3: Cloud CD runner rollout。
- [ ] Phase 4: Staging / Production。
- [ ] Phase 5: Closeout compact。

## Phase Steps

### Phase 0: Goal Package

- [x] Step 0.1: 创建 `changes/active/release-automation/` 七件套。
- [x] Step 0.2: 新增 `docs/active/release-automation-goal.md`。
- [x] Step 0.3: 更新 `docs/active/README.md` 指向 release automation goal。
- [x] Step 0.4: 将 release automation goal 合同并入 `tests/contract/change-package-lifecycle.test.mjs`，避免新增测试文件和 registry 膨胀。
- [x] Step 0.5: 跑 `npm run verify` 和 `npm run gate:review`。

### Phase 1: CI 自动测试

- [ ] Step 1.1: 新增 GitHub Actions CI workflow。
- [ ] Step 1.2: PR 和 main push 运行 `npm run verify`。
- [ ] Step 1.3: PR 和 main push 运行 `npm run gate:review`。
- [ ] Step 1.4: 明确 workflow 不 build image、不 deploy、不读取 secret。

### Phase 2: CI build/push image

- [ ] Step 2.1: main push 构建 `Dockerfile.cloud` 镜像。
- [ ] Step 2.2: tag 使用 short commit。
- [ ] Step 2.3: push 到 TCR 并输出 digest。
- [ ] Step 2.4: 确认不访问 TKE、不读取 kubeconfig。

### Phase 3: Cloud CD runner rollout

- [ ] Step 3.1: 定义腾讯云 VPC self-hosted runner 边界。
- [ ] Step 3.2: runner 执行 `scripts/cloud-rollout.mjs` dry-run。
- [ ] Step 3.3: approval 后 runner 执行 `scripts/cloud-rollout.mjs --apply`。
- [ ] Step 3.4: 记录 rollout revision、Deployment image、Pod imageID、canary 和 HTTPS smoke。

### Phase 4: Staging / Production

- [ ] Step 4.1: 定义 staging namespace、domain 和 secret boundary。
- [ ] Step 4.2: staging 自动 rollout 并 smoke/canary。
- [ ] Step 4.3: production 需要 manual approval。
- [ ] Step 4.4: production rollout 后记录 smoke/canary/rollback evidence。

### Phase 5: Closeout compact

- [ ] Step 5.1: 填写 closeout。
- [ ] Step 5.2: 追加 compact summary 到 `changes/archive/closeouts.md`。
- [ ] Step 5.3: 删除 active change package。
