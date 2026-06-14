# Review

- owner: foundation-loop-contracts
- state: active

## Status

已完成本地自审，等待独立 review。

## Review Points

- 文档是否保持最小。
- contracts 是否明确为机器边界。
- OPL internals 是否被禁止直接 import。

## Self Review

- `scripts/` 只包含 verify、workflow gate、test classification、repo bloat audit。
- `packages/opl-adapter` 不执行真实 CLI，只提供 fail-closed policy evaluation 和 mock adapter。
- `packages/contracts/opl/command-policy.json` 默认 deny，allowed command 全部为 readonly。
- `.superpowers/`、`.runtime/`、dist、coverage、日志和 env 文件已忽略。
