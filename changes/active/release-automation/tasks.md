# Tasks

- owner: release-automation
- state: active

## Checklist

- [x] Phase 0: Goal Package。
- [x] Phase 1: CI 自动测试。
- [x] Phase 2: CI build/push image。
- [ ] Phase 3: Cloud CD runner rollout。
- [ ] Phase 4: Staging / Production。
- [ ] Phase 5: Closeout compact。

## Phase Steps

### Phase 0: Goal Package

- [x] Step 0.1: 创建 `changes/active/release-automation/` 七件套。
- [x] Step 0.2: 将四阶段 release automation goal 保留在 active change package 内，不新增长期 goal doc。
- [x] Step 0.3: 更新 `docs/active/README.md` 指向 `changes/active/release-automation`。
- [x] Step 0.4: 将 release automation phase plan 合同并入 `tests/contract/change-package-lifecycle.test.mjs`，避免新增测试文件和 registry 膨胀。
- [x] Step 0.5: 跑 `npm run verify` 和 `npm run gate:review`。

### Phase 1: CI 自动测试

- [x] Step 1.1: 新增 GitHub Actions CI workflow。
- [x] Step 1.2: PR 和 main push 运行 `npm run verify`。
- [x] Step 1.3: PR 和 main push 运行 `npm run gate:review`。
- [x] Step 1.4: 明确 workflow 不 build image、不 deploy、不读取 secret。
- [x] Step 1.5: 推送后记录 GitHub Actions run URL，确认平台触发成功。

### Phase 2: CI build/push image

- [x] Step 2.1: main push 构建 `Dockerfile.cloud` 镜像。
- [x] Step 2.2: tag 使用 short commit。
- [x] Step 2.3: push 到 TCR 并输出 digest。
- [x] Step 2.4: 确认 build/push 不访问 TKE、不读取 kubeconfig。
- [x] Step 2.5: 开源仓库加固，build/push 迁移到腾讯云 self-hosted runner，避免 GitHub-hosted runner 接触 TCR 和 OPL build context secrets。

### Phase 3: Cloud CD runner rollout

- [x] Step 3.1: 定义腾讯云 VPC self-hosted runner 边界。
- [x] Step 3.2: runner 执行 `scripts/cloud-rollout.mjs` dry-run。
- [ ] Step 3.3: runner 执行 `scripts/cloud-rollout.mjs --apply`。
- [ ] Step 3.4: 记录 rollout revision、Deployment image、Pod imageID、canary 和 HTTPS smoke。

### Phase 4: Staging / Production

- [x] Step 4.1: 定义 staging namespace、domain 和 secret boundary。
- [x] Step 4.1.1: Cloud Rollout 增加 OPL image allowlist，非 `webopl/opl-webui` 镜像 fail closed。
- [ ] Step 4.2: staging 自动 rollout 并 smoke/canary。
- [x] Step 4.3: production 需要 manual approval。
- [ ] Step 4.4: production rollout 后记录 smoke/canary/rollback evidence。

### Phase 5: Closeout compact

- [ ] Step 5.1: 填写 closeout。
- [ ] Step 5.2: 追加 compact summary 到 `changes/archive/closeouts.md`。
- [ ] Step 5.3: 删除 active change package。
