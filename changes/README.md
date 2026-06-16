# Change Lifecycle

Change package 是正式开发的短期工作台。Active change keeps detailed context; closed change keeps compact history.

长期 truth 只放在 `AGENTS.md`、`specs/*.md`、`docs/active/README.md`、`deploy/cloud-mvp/RUNBOOK.md`、source、contracts、tests、fixtures 和 scripts。不要新增散落 README 或永久叙事文档。

## Lifecycle

proposal -> spec-delta -> design -> tasks -> eval-plan -> review -> closeout -> compact archive

关闭后只把精简摘要追加到 `changes/archive/closeouts.md`；删除 `changes/active/<change-id>/`。Closed change is compact; do not keep per-change archive directories.

## Fixed Template

每个 active package 固定包含：

- `proposal.md`: 为什么做、范围、非目标。
- `spec-delta.md`: 相对现有 truth 的变化。
- `design.md`: 实现方案和边界。
- `tasks.md`: 可勾选任务。
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
