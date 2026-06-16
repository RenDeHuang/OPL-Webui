# Review

- owner: release-automation
- state: active

## Review Points

- 四个 phase 是否解耦，避免把 CI、TCR、TKE、staging 和 production 一次做完。
- secret boundary 是否清晰，避免 GitHub public runner 持有 kubeconfig。
- eval 是否覆盖每个 phase 的可证明证据。
- 是否遵守 repo bloat gate 和文档生命周期。

## Self Review

- Phase 0 RED 证据：
  - `node --test tests/contract/change-package-lifecycle.test.mjs` 先失败于缺少 `docs/active/release-automation-goal.md` 和 README 链接。
- Phase 0 GREEN 证据：
  - 已新增 `docs/active/release-automation-goal.md`，覆盖四个 phase、steps、evals、secret boundary 和 rollback/failure handling。
  - 已更新 `docs/active/README.md` 的 `Active Goal Docs` 入口。
  - release automation 合同并入 `tests/contract/change-package-lifecycle.test.mjs`，没有新增测试文件或 registry entry。
  - `node --test tests/contract/change-package-lifecycle.test.mjs` 通过。
  - `node scripts/repo-bloat-audit.mjs` 通过，当前 counts 为 files 71、markdownDocs 24、scripts 5、tests 13、maxFileLines 252。
  - `npm run verify` 通过。
  - `npm run gate:review` 通过。
- 风险：
  - `markdownDocs` 已达到 24/24；后续 Phase 1-4 不能新增 Markdown 文件，必须先 closeout/compact 已完成 active change 或复用现有文档。
