# Review

- owner: figma-v3-preview
- state: active

## Review Points

- Phase plan 是否保留完整最终愿景，而不是缩小成旧 shell polish。
- Gap inventory 是否覆盖 UI、data、test、visual 和 runtime。
- Dynamic Phase Gates 是否能防止“测试通过但没有做到 Figma V3”。
- 是否遵守 Go control plane、OPL readonly 和 no mutation 边界。

## Self Review

- 当前完成 Phase 0-3：目标、gap、验收路径和 V3 RED tests 已写入 change 包。
- Phase 3 RED 证据：
  - `node --test tests/smoke/web-demo-shell.test.mjs` 失败于旧 shell 缺少 V3 首页和轻量项目工作区结构。
  - `node --test tests/contract/web-demo-data.test.mjs` 失败于 `createV3ViewModel` 尚不存在。
- Phase 3 没有新增测试文件，只更新现有 smoke/contract 测试，因此 `scripts/test-classification.mjs` 无需变更。
- 尚未实现 UI，不能 claim V3 preview 完成。
