# Design

- owner: release-automation
- state: active

## Structure

`docs/active/release-automation-goal.md` 是人读目标入口；机器验收并入 `tests/contract/change-package-lifecycle.test.mjs` 覆盖。Active change package 记录阶段性细节，closeout 后只保留 compact archive。

## Phase Model

1. Phase 1: CI 自动测试。
2. Phase 2: CI 构建并推送镜像。
3. Phase 3: 云端 CD runner rollout。
4. Phase 4: staging / production 分环境。

每个 phase 必须有 goal、implementation steps、evals、secret/no-secret boundary、failure/rollback handling。

## Anti-bloat

- 不新增散落 README。
- 不新增脚本，除非某个 phase 的 eval 需要机器入口。
- 不新增 workflow 直到 Phase 1 implementation。
- 不复制 release history；发布证据进入 active change review，完成后 compact 到 `changes/archive/closeouts.md`。
