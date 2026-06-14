# Design

- owner: foundation-loop-contracts
- state: active

## Shape

文档分为长期 docs 与短生命周期 changes：

- `docs/`: 稳定入口和边界说明。
- `changes/active/foundation-loop-contracts/`: 本次初始化记录。

## Boundary

Browser -> SaaS API -> OPL Adapter -> whitelisted OPL CLI/contracts

不 import OPL internals。
