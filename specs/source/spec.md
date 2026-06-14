# Source Spec

- owner: source owner
- purpose: 源码边界和依赖方向 durable spec。
- state: active
- machine boundary: Sentrux rules、tests 和 import graph 是机器约束。

## Source Surfaces

- `apps/web`: Browser UI，只调用 SaaS API。
- `apps/api`: SaaS API 和静态服务入口。
- `packages/core`: task/artifact loop 纯业务投影。
- `packages/opl-adapter`: OPL CLI/contract adapter，受白名单约束。
- `packages/contracts`: schema、policy 和共享 contract。

## Dependency Direction

`apps/web -> apps/api HTTP contract -> packages/core -> packages/opl-adapter -> packages/contracts`

源码不能 import `one-person-lab` 内部模块，不能读取 OPL 私有 state。
