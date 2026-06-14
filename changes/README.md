# Change Packages

Change package 是从提案到 closeout 的最小生命周期记录。短写，中文，链接到源码或 docs，不复制 truth。

## Lifecycle

proposal -> spec-delta -> design -> tasks -> eval-plan -> review -> closeout

关闭后只把精简摘要追加到 `changes/archive/closeouts.md`；不要为每个已关闭切片继续保留单独归档目录。

## Fixed Template

每个 package 固定包含：

- `proposal.md`: 为什么做、范围、非目标。
- `spec-delta.md`: 相对现有 truth 的变化。
- `design.md`: 实现方案和边界。
- `tasks.md`: 可勾选任务。
- `eval-plan.md`: 验证方式。
- `review.md`: 审阅结论和阻塞项。
- `closeout.md`: 完成摘要和后续。
