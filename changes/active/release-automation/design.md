# Design

- owner: release-automation
- state: active

## Structure

Release Automation 的阶段性计划只放在 `changes/active/release-automation/`。`docs/active/README.md` 只指向 active change package，不保存独立 phase goal 文档；closeout 后只保留 compact archive。

## Phase Model

1. Phase 1: CI 自动测试。
2. Phase 2: CI 构建并推送镜像。
3. Phase 3: 云端 CD runner rollout。
4. Phase 4: staging / production 分环境。

每个 phase 必须有 goal、implementation steps、evals、secret/no-secret boundary、failure/rollback handling。

## Phase Contract

- Goal: 分阶段建立可审计、可回滚、权限隔离的自动化发布流程。
- Implementation Steps: 每个 phase 只修改自己的最小边界，不把 CI、TCR、TKE、DNS、secret 和 production approval 混进同一个切片。
- Evals / Acceptance Criteria: 每个 phase 必须有本地合同测试和真实平台证据；没有 GitHub Actions run URL、registry digest、runner log 或 online smoke 证据时不能 claim 对应阶段完成。
- Secret Boundary: Phase 1 no-secret；Phase 2 只允许 TCR secret；Phase 3/4 的 kubeconfig 只能在腾讯云 VPC self-hosted runner 或 secret manager。
- Failure / Rollback Handling: CI/build 失败不影响线上；rollout/canary/smoke 失败必须阻断后续环境并记录 rollback evidence。

## Anti-bloat

- 不新增散落 README。
- 不新增脚本，除非某个 phase 的 eval 需要机器入口。
- workflow 只按 phase 新增最小入口；Phase 1 只允许 test-only CI。
- 不复制 release history；发布证据进入 active change review，完成后 compact 到 `changes/archive/closeouts.md`。

## Workflow Shape

- `ci.yml`: PR/main push 的 test-only gate。
- `release-image.yml`: CI 成功后只构建并推送 TCR 镜像；不自动执行 staging 或 production rollout。
- `cloud-rollout.yml`: 当前只保留手动 production dry-run/apply 入口；`apply=true` 依赖 GitHub production environment approval。
- `scripts/cloud-rollout.mjs`: dry-run first；默认 production `https://opl.medopl.cn`，只有显式设置 `OPL_BASE_URL` 时才覆盖。
- Staging: 作为后续目标保留；只有创建真实 `staging.opl.medopl.cn`、`opl-webui-staging` namespace、独立 DB/Secret/TLS/DNS 后，才恢复 automatic staging rollout。
