# Eval Plan

- owner: figma-v3-preview
- state: active

## Dynamic Phase Gates

- `design target accepted`: Figma target 固定为 `8peNQrKeC26oNiXZPRSdxU / 23:2 / 06 Genspark风格 V3`。
- `static structure accepted`: tests 覆盖 V3 首页、轻量项目工作区和不能 claim 的 SaaS surface。
- `local visual accepted`: 本地浏览器 desktop/mobile 截图对照 Figma V3，且无明显遮挡、错位或旧 shell 残留。
- `data contract accepted`: V3 view model 从 `/api/mvp/task` 和 `/api/opl/snapshot` 派生；不新增第二份业务 truth。
- `local gate accepted`: `npm run verify`、`npm run gate:review`、`sentrux check /home/dev/projects/ui` 通过。
- `cloud canary accepted`: 云端 rollout 后 `canary db`、`canary opl-cli`、`/healthz`、`/readyz` 通过。
- `online smoke accepted`: `https://opl.medopl.cn` 线上 desktop/mobile 截图是 V3，主 CTA 可点击且 network/console 无关键错误。

## Phase Acceptance Matrix

| Phase | Exit evidence | Cannot claim before exit |
| --- | --- | --- |
| 0 Goal & Change Package | active package exists with all seven lifecycle files | 不能 claim 已进入实现 |
| 1 Target Lock | Figma target and required UI blocks recorded | 不能 claim 目标设计已冻结 |
| 2 Gap Inventory | UI/data/test/visual/runtime gaps recorded | 不能 claim gap path 清楚 |
| 3 Tests First | V3 smoke/contract tests fail against old shell | 不能 claim 测试能防止旧 shell 回归 |
| 4 V3 Preview Implementation | targeted tests pass and UI only calls Go control plane | 不能 claim V3 preview 已实现 |
| 5 Local Visual Loop | desktop/mobile browser evidence accepted | 不能 claim 符合 Figma 视觉预期 |
| 6 Local Release Gate | verify、review gate、Sentrux pass | 不能 claim 可进入云端 rollout |
| 7 Cloud Rollout | image、rollout、pod 状态证据记录 | 不能 claim 已上线 |
| 8 Online Acceptance & Closeout | canary、health、ready、online smoke 和 compact closeout 完成 | 不能 claim 线上 V3 完成 |

## Gap Loop

每个 gap 使用同一个验收循环：

1. `gap selected`: 从 UI、data、test、visual 或 runtime gap 中选一个。
2. `expected evidence selected`: 明确用 test、screenshot、canary 或 command output 验收。
3. `failure observed`: 旧实现必须失败或被截图证明不符合目标。
4. `minimal implementation`: 只实现关闭该 gap 所需的代码。
5. `evidence passed`: 对应 evidence 通过。
6. `cannot-claim reviewed`: 更新不能 claim 边界，防止把 preview 说成完整 SaaS。

## Required Commands

- `node --test tests/smoke/web-demo-shell.test.mjs`
- `node --test tests/contract/web-demo-data.test.mjs`
- `npm run verify`
- `npm run gate:review`
- `sentrux check /home/dev/projects/ui`

## Cloud Commands

这些命令只能由云端/VPC runner 执行：

- build/push short-SHA cloud image
- `kubectl set image`
- `kubectl rollout status`
- pod 内 `canary db`
- pod 内 `canary opl-cli`
- HTTPS smoke

## Cannot Claim

- 不能声明完整 SaaS、真实登录、真实 Drive、真实团队协作、计费或 production hardening。
- 不能声明真实 OPL execution 或 mutation。
- 不能声明云端 V3 已上线，除非 cloud canary 和 online smoke gates 都有证据。
