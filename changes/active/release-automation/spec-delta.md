# Spec Delta

- owner: release-automation
- state: active

## Durable Truth Changes

- 新增 `docs/active/release-automation-goal.md` 作为发布自动化四阶段目标入口。
- 更新 `docs/active/README.md` 指向该 goal，并明确当前阶段仍是 goal/planning，不能 claim CI/CD 已上线。
- 扩展现有生命周期合同测试，验证 goal 文档覆盖四个 phase、eval、secret boundary 和 rollback/failure handling。

## Machine Truth Changes

- 更新 `tests/contract/change-package-lifecycle.test.mjs`，复用已有 registry entry，避免新增测试文件和分类登记膨胀。

## Boundary

- 本变更不改变 Web UI runtime。
- 本变更不改变 cloud manifest。
- 本变更不触发 deploy。
