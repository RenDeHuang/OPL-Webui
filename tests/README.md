# 测试 Lane Taxonomy

本仓库第一阶段只保留最小验证门，避免在初始化期膨胀。

- `health`: 验证测试 registry、仓库体积预算、workflow 入口。
- `contract`: 验证跨包契约和 package 生命周期约定。
- `smoke`: 验证仓库基础清单、脚本、测试说明存在。
- `regression`: 预留给明确复现过的回归用例；当前不进入 `verify`。

机器接口只来自 `scripts/test-classification.mjs` 的显式 registry。
Markdown prose 不作为机器接口，不能被其他脚本解析为权威配置。
