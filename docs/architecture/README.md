# Architecture

- owner: architecture owner
- purpose: 说明系统边界和依赖方向。
- state: active
- machine boundary: 非机器接口；实现边界由源码和 contracts 定义。

## Flow

Browser -> SaaS API -> OPL Adapter -> whitelisted OPL CLI/contracts

## Rules

- Web UI 只调用 SaaS API。
- SaaS API 通过 OPL Adapter 接触 OPL。
- OPL Adapter 只使用白名单 CLI 与 contracts。
- 本仓库不 import OPL internals。
