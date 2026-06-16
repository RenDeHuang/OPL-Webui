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
  - `node --test tests/contract/change-package-lifecycle.test.mjs` 先失败于 release automation phase plan 尚未进入 active package 合同。
- Phase 0 GREEN 证据：
  - 四阶段 plan 已保留在 active change package，覆盖四个 phase、steps、evals、secret boundary 和 rollback/failure handling。
  - 已删除 `docs/active/release-automation-goal.md`，避免阶段性计划变成长期 active doc。
  - 已更新 `docs/active/README.md` 的 `Active Change Work` 入口。
  - release automation 合同并入 `tests/contract/change-package-lifecycle.test.mjs`，没有新增测试文件或 registry entry。
  - `node --test tests/contract/change-package-lifecycle.test.mjs` 通过。
  - `node scripts/repo-bloat-audit.mjs` 通过，当前 counts 为 files 71、markdownDocs 24、scripts 5、tests 13、maxFileLines 252。
  - `npm run verify` 通过。
  - `npm run gate:review` 通过。
- 风险：
  - `markdownDocs` 已降到 23/24；后续 Phase 2-4 仍应避免新增 Markdown 文件，优先复用 active change package。

## Phase 1 Review

- 修正：阶段性 release automation goal 不再落成 `docs/active/release-automation-goal.md`；四阶段计划保留在 active change package，完成后走 compact closeout。
- 实现：新增 `.github/workflows/ci.yml`，只在 `pull_request` 和 `main` push 运行 `npm run verify` 与 `npm run gate:review`。
- 边界：workflow 不读取 secret，不执行 build/push，不执行 deploy，不包含 `kubectl` 或 `scripts/cloud-rollout.mjs`。
- 平台证据：GitHub Actions `CI` run `27611734207` 已在 `main` push `4f2ffe4` 上完成并成功，URL: `https://github.com/RenDeHuang/OPL-Webui/actions/runs/27611734207`。

## Phase 2-4 Review

- Phase 2 implementation: 新增 `.github/workflows/release-image.yml`，在 CI 成功后 build/push `Dockerfile.cloud` 镜像，tag 使用 short commit；build job 不持有 kubeconfig，不执行 rollout。
- Phase 2 local evidence: `docker build -f Dockerfile.cloud --build-context opl=/home/dev/projects/one-person-lab -t uswccr.ccs.tencentyun.com/webopl/opl-webui:6df9635 .` 成功；`docker push` 成功；registry index digest 是 `sha256:443f02b8b63718c971188f7ec91ec238717f568568d42aab1bc924f37811c2f5`。
- Phase 3 implementation: 新增 `.github/workflows/cloud-rollout.yml`，只在 `[self-hosted, tencent-cloud, opl-webui]` runner 上执行 `scripts/cloud-rollout.mjs`；`--apply` 由 workflow input 控制。
- Phase 4 implementation: `release-image.yml` 在镜像成功后自动触发 staging rollout；production 只通过 `cloud-rollout.yml` 手动触发并使用 GitHub environment approval。
- Blocker: 当前本机无法访问 TKE API；`kube.medopl.cn` DNS 不可解析，`https://medopl.cn` 与 `https://10.66.0.37` kube API 请求超时。`staging.opl.medopl.cn` 当前无法解析。因此不能 claim Phase 3/4 真实 rollout 已完成。
