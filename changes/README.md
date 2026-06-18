# Change Lifecycle

Change package 是正式开发的短期工作台。Active change keeps detailed context; closed change keeps compact history.

长期 truth 只放在 `AGENTS.md`、`docs/active/README.md`、`contracts/*.json`、`deploy/cloud-mvp/RUNBOOK.md`、source、tests、fixtures 和 scripts。不要新增散落 README 或永久叙事文档。

## Lifecycle

proposal -> spec-delta -> design -> tasks -> eval-plan -> review -> closeout -> compact archive

关闭后只把精简摘要追加到 `changes/archive/closeouts.md`；删除 `changes/active/<change-id>/`。Closed change is compact; do not keep per-change archive directories.

每个 active change 必须执行四个工作面：

- 文档生命周期：确认长期 truth 的 owner、purpose、state 和 machine boundary。
- 代码清退：同步删除或迁移被替代的 route、schema、mock、测试、文档入口和命名。
- 测试登记：新增或移动测试必须登记在 `scripts/test-classification.mjs`。
- 机器 gate：targeted eval 后跑 `npm run verify`、`npm run gate:review`、`npm run repo:bloat` 和 `sentrux check .`。

## Fixed Template

每个 active package 固定包含：

- `proposal.md`: 为什么做、范围、非目标。
- `spec-delta.md`: 相对现有 truth 的变化。
- `design.md`: 实现方案和边界。
- `tasks.md`: 可勾选任务。
- `tasks.md` 必须包含 cleanup / retirement 项。
- `eval-plan.md`: 阶段验收、命令和 cannot claim。
- `review.md`: 审阅结论和阻塞项。
- `closeout.md`: 完成摘要、验证证据和后续。

## Dynamic Phase Gates

`eval-plan.md` 必须按阶段写验收，不只写最终命令。按适用范围选择 gates：

- `design target accepted`: 设计目标、Figma 节点或产品边界已锁定。
- `static structure accepted`: 页面、contract 或 manifest 的骨架已由测试覆盖。
- `local visual accepted`: 本地浏览器截图已核对桌面和移动端。
- `data contract accepted`: UI 或 runtime 数据来自 Go control plane contract，不复制业务 truth。
- `local gate accepted`: `npm run verify`、`npm run gate:review` 和结构检查通过。
- `cloud canary accepted`: rollout 后 `canary db`、`canary opl-cli` 和 `/readyz` 通过。
- `online smoke accepted`: 线上入口、主流程和必要截图已确认。

不能适用的 gate 要写明原因。AI、OPL、runtime 或上线行为没有对应 eval/test 不能 claim 完成。

## Autonomous Commercial Development

长期自治开发使用固定 prompt contract，不靠外部复制临时 prompt。每个商业化推进 change 必须先写清：

- `current truth`: 当前已由 source、contracts、tests、fixtures、scripts、docs/active 和 closeouts 证明的事实。
- `commercial SaaS goal`: 面向公网多租户 SaaS 的目标状态，不把愿景写成已完成事实。
- `gap-driven phase`: 本 phase 只推进一个清晰 gap，并列出阶段 evals。
- `allowed changes`: 本次允许修改的文件、contract、UI 或 Go control plane 行为。
- `forbidden changes`: 禁止 OPL mutation、无授权 production action、无 consumer contract 和业务逻辑脚本化。
- `contracts`: 行为变化必须有真实 consumer，且 Web UI 只通过 Go control plane HTTP API。
- `contracts`: 用户可见行为、API、page state、runtime gate 或 release claim 必须先更新对应 contract；docs cannot claim beyond contracts/tests/source/evidence。
- `tests`: 新增或修改行为先写 test，再改实现。
- `test-classification`: 新增测试文件必须登记；修改既有测试需确认现有 registry 覆盖。
- `evals`: targeted eval 先过，再跑 `npm run verify`、`npm run gate:review` 和结构检查。
- `cannot claim`: 没有 production、staging、OPL execution 或 mutation evidence 时必须明说不能 claim。
- `closeout conditions`: closeout 必须写完成内容、验证命令、cannot claim 和后续 gap。
- `hard stops`: secrets、生产凭证、破坏性操作、付费外部动作和含糊产品取舍必须停下问人。
- `commit and push`: 验证通过后只 add intentional files，commit，再 push 到 `origin/main`。

默认工程约束：no compatibility layer unless a real consumer needs it；no bloat。文件、CSS 或文档接近结构预算时先拆分或收敛范围；行数默认作为 advisory 结构信号，显式 strict 入口才阻断。
