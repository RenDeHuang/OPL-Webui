# Spec Delta

- owner: release-automation
- state: active

## Durable Truth Changes

- 删除 `docs/active/release-automation-goal.md`，避免把阶段性 release program 变成长期 active doc。
- 更新 `docs/active/README.md` 指向 active change package，并明确阶段性计划完成后 compact closeout。
- 新增 `.github/workflows/ci.yml`，作为 Phase 1 CI test-only workflow。
- 更新 `.github/workflows/release-image.yml`，当前只作为 Phase 2 build/push 入口，不自动执行 staging rollout。
- 更新 `.github/workflows/cloud-rollout.yml`，作为 production-gated 手动 dry-run/apply 入口。
- 扩展现有生命周期合同测试，验证 goal 文档覆盖四个 phase、eval、secret boundary 和 rollback/failure handling。

## Machine Truth Changes

- 更新 `tests/contract/change-package-lifecycle.test.mjs`，复用已有 registry entry，避免新增测试文件和分类登记膨胀。
- 更新 `tests/health/workflow-entrypoint.test.mjs`，验证 CI workflow test-only、Release Image build/push-only、Cloud Rollout production approval 边界。
- 更新 `tests/contract/cloud-rollout-helper.test.mjs`，验证 `OPL_BASE_URL` 默认值和显式覆盖行为。
- 更新 `scripts/test-classification.mjs`，登记新增 workflow contract surface。

## Boundary

- 本变更不改变 Web UI runtime。
- 本变更不改变 cloud manifest。
- 本变更不触发 deploy。
