# Source Spec

- owner: source owner
- purpose: 源码边界和依赖方向 durable spec。
- state: active
- machine boundary: Sentrux rules、tests 和 import graph 是机器约束。

## Source Surfaces

- `apps/web`: ChatGPT-like Browser UI，只调用 Go control plane HTTP API。
- `services/control-plane-go`: 前台控制面、静态服务入口、hidden isolation projection、sub2api/MedOPL 状态消费边界和 OPL readonly bridge。
- `packages/contracts`: 当前只保留被 Web/Go contract tests 消费的 HTTP schema。

## Dependency Direction

`apps/web -> services/control-plane-go HTTP contract -> packages/contracts`

`services/control-plane-go/internal/oplbridge -> OPL CLI JSON snapshot / route / handoff surfaces`

源码不能 import `one-person-lab` 内部模块，不能读取 OPL 私有 state；OPL 连接只能通过白名单 CLI JSON 命令。

OPL-Webui 不能拥有 node pool 生命周期、billing source of truth 或 API gateway；这些 source of truth 属于 MedOPL/sub2api。
