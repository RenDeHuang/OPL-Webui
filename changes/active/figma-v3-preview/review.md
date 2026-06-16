# Review

- owner: figma-v3-preview
- state: active

## Review Points

- Phase plan 是否保留完整最终愿景，而不是缩小成旧 shell polish。
- Gap inventory 是否覆盖 UI、data、test、visual 和 runtime。
- Dynamic Phase Gates 是否能防止“测试通过但没有做到 Figma V3”。
- 是否遵守 Go control plane、OPL readonly 和 no mutation 边界。

## Self Review

- 当前完成 Phase 0-6：目标、gap、验收路径、V3 RED tests、V3 Preview 实现、本地 visual loop 和本地 release gate 已写入 change 包。
- Phase 3 RED 证据：
  - `node --test tests/smoke/web-demo-shell.test.mjs` 失败于旧 shell 缺少 V3 首页和轻量项目工作区结构。
  - `node --test tests/contract/web-demo-data.test.mjs` 失败于 `createV3ViewModel` 尚不存在。
- Phase 3 没有新增测试文件，只更新现有 smoke/contract 测试，因此 `scripts/test-classification.mjs` 无需变更。
- Phase 4 GREEN 证据：
  - `node --test tests/contract/web-demo-data.test.mjs` 通过，V3 view model 从现有 projection 派生。
  - `node --test tests/smoke/web-demo-shell.test.mjs` 通过，HTML 暴露 V3 首页和轻量项目工作区。
  - `node --test tests/health/registry-coverage.test.mjs` 通过，新增 `apps/web/styles/v3.css` 已进入 test registry contract。
  - `node scripts/repo-bloat-audit.mjs` 通过，最大文件为 `apps/web/styles/v3.css` 241 行。
- Phase 5 visual 证据：
  - 本地服务 `http://127.0.0.1:4173` 的 `/healthz` 与 `/readyz` 通过。
  - desktop 截图保存到 `.runtime/visual/figma-v3-desktop.png`。
  - mobile 截图保存到 `.runtime/visual/figma-v3-mobile.png`。
  - 浏览器检查无 console error，关键网络请求均为 200 或缓存 304。
  - 已修正 `启动` 按钮白底白字和移动端导航裁切两个视觉 gap。
- Phase 6 release gate 证据：
  - `npm run verify` 通过。
  - `npm run gate:review` 通过。
  - Sentrux scan quality signal `7263`，`check_rules` 通过，0 violations。
- Phase 7 pre-rollout 证据：
  - `figma-v3-preview` 已快进合并到本地 `main`。
  - `main` 已推送到 `origin/main`，当前 commit 为 `c8b62af`。
  - 合并后的 `main` 再次通过 `npm run verify`、`npm run gate:review` 和 Sentrux `check_rules`。
  - short-SHA cloud image tag 应为 `uswccr.ccs.tencentyun.com/webopl/opl-webui:c8b62af`。
- 尚未执行 cloud rollout 和 online smoke，不能 claim 线上 V3 preview 完成。
