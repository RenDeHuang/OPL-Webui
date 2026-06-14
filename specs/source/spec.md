# Source Spec

- owner: source owner
- purpose: 源码边界和依赖方向 durable spec。
- state: active
- machine boundary: Sentrux rules、tests 和 import graph 是机器约束。

## Source Surfaces

- `apps/web`: Browser UI，只调用 Go control plane HTTP API。
- `services/control-plane-go`: SaaS API、静态服务入口、OPL readonly bridge 和后端业务控制面。
- `packages/contracts`: 当前只保留被 Web/Go contract tests 消费的 HTTP schema。

## Dependency Direction

`apps/web -> services/control-plane-go HTTP contract -> packages/contracts`

`services/control-plane-go/internal/oplbridge -> OPL CLI JSON snapshot / route / handoff surfaces`

源码不能 import `one-person-lab` 内部模块，不能读取 OPL 私有 state；OPL 连接只能通过白名单 CLI JSON 命令。
