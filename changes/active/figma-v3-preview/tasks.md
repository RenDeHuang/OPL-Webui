# Tasks

- owner: figma-v3-preview
- state: active

## Checklist

- [x] Phase 0: Goal & Change Package。
- [x] Phase 1: Target Lock。
- [x] Phase 2: Gap Inventory。
- [x] Phase 3: Tests First。
- [x] Phase 4: V3 Preview Implementation。
- [x] Phase 5: Local Visual Loop。
- [x] Phase 6: Local Release Gate。
- [ ] Phase 7: Cloud Rollout。
- [ ] Phase 8: Online Acceptance & Closeout。

## Phase Steps

### Phase 0: Goal & Change Package

- [x] Step 0.1: 创建 `changes/active/figma-v3-preview/`。
- [x] Step 0.2: 补齐 proposal、spec-delta、design、tasks、eval-plan、review、closeout。
- [x] Step 0.3: 明确本变更只做 V3 Preview，不 claim 完整 SaaS。

### Phase 1: Target Lock

- [x] Step 1.1: 用 Figma MCP 确认文件 `8peNQrKeC26oNiXZPRSdxU`。
- [x] Step 1.2: 锁定节点 `23:2 / 06 Genspark风格 V3`。
- [x] Step 1.3: 提取首页和轻量项目工作区的必备 UI 区块。

### Phase 2: Gap Inventory

- [x] Step 2.1: 写出 UI gap。
- [x] Step 2.2: 写出 data gap。
- [x] Step 2.3: 写出 test gap。
- [x] Step 2.4: 写出 visual gap。
- [x] Step 2.5: 写出 runtime gap。
- [x] Step 2.6: 评估最终愿景可达性和当前不能 claim 的边界。

### Phase 3: Tests First

- [x] Step 3.1: 更新 `tests/smoke/web-demo-shell.test.mjs`，断言 V3 首页结构。
- [x] Step 3.2: 更新 `tests/smoke/web-demo-shell.test.mjs`，断言轻量项目工作区结构。
- [x] Step 3.3: 更新 `tests/contract/web-demo-data.test.mjs`，断言 V3 view model 从现有 projection 派生。
- [x] Step 3.4: 如新增测试文件，登记 `scripts/test-classification.mjs`。
- [x] Step 3.5: 跑 targeted tests，确认旧实现失败。

### Phase 4: V3 Preview Implementation

- [x] Step 4.1: 阅读 `apps/web` 当前 HTML、CSS 和 data modules。
- [x] Step 4.2: 设计 focused file split，避免单文件超过 repo bloat gate。
- [x] Step 4.3: 实现 V3 view model，不复制第二份业务 truth。
- [x] Step 4.4: 实现 Genspark式首页。
- [x] Step 4.5: 实现轻量项目工作区。
- [x] Step 4.6: 保持按钮为 preview 行为，不伪造真实 auth、Drive、team 或 billing。
- [x] Step 4.7: 跑 Phase 3 targeted tests，确认通过。

### Phase 5: Local Visual Loop

- [x] Step 5.1: 启动本地 Web UI。
- [x] Step 5.2: 用浏览器检查 desktop viewport。
- [x] Step 5.3: 用浏览器检查 mobile viewport。
- [x] Step 5.4: 检查 console/network 错误。
- [x] Step 5.5: 对照 Figma V3，记录需要修正的视觉 gap。
- [x] Step 5.6: 修正视觉 gap 并重复 Step 5.2 到 Step 5.5，直到本地视觉可接受。

### Phase 6: Local Release Gate

- [x] Step 6.1: 跑 `npm run verify`。
- [x] Step 6.2: 跑 `npm run gate:review`。
- [x] Step 6.3: 跑 `sentrux check /home/dev/projects/ui`。
- [x] Step 6.4: 更新 `review.md` 的本地审阅结论。

### Phase 7: Cloud Rollout

- [x] Step 7.1: 确认本地 gates 全部通过。
- [x] Step 7.2: 由云端/VPC runner 构建 short-SHA image。
- [x] Step 7.3: 由云端/VPC runner 推送 image。
- [x] Step 7.3.1: 固化 dry-run first 的 `scripts/cloud-rollout.mjs`，把 rollout、pod canary 和 HTTPS smoke 变成可重复云端执行入口。
- [ ] Step 7.4: 由云端/VPC runner 执行 Kubernetes rollout。
- [ ] Step 7.5: 记录 rollout revision、image digest 和 pod 状态。

### Phase 8: Online Acceptance & Closeout

- [ ] Step 8.1: 跑云端 `canary db`。
- [ ] Step 8.2: 跑云端 `canary opl-cli`。
- [ ] Step 8.3: 检查 `/healthz` 和 `/readyz`。
- [ ] Step 8.4: 打开 `https://opl.medopl.cn` 做 desktop/mobile online smoke。
- [ ] Step 8.5: 确认主 CTA 可点击且没有关键 console/network 错误。
- [ ] Step 8.6: 填写 `closeout.md`。
- [ ] Step 8.7: 将 closeout 摘要追加到 `changes/archive/closeouts.md`。
- [ ] Step 8.8: 删除 `changes/active/figma-v3-preview/`，完成 compact archive。

## First Implementation Slice

第一实现切片只做 Phase 3：

- 更新 `tests/smoke/web-demo-shell.test.mjs`，断言 V3 首页和工作区关键结构。
- 更新 `tests/contract/web-demo-data.test.mjs`，断言 V3 view model 由现有 API projection 派生。
- 如新增测试文件，登记 `scripts/test-classification.mjs`。
- 跑测试并确认旧实现失败。
