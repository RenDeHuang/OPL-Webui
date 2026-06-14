# Runtime Spec

- owner: runtime owner
- purpose: Go control plane 和运行边界 durable spec。
- state: active
- machine boundary: 机器接口在 `services/control-plane-go`、`packages/contracts/opl/*.json` 和 tests。

## Requirements

- `runtime.go.mvp-task`: Go control plane 的 `POST /api/mvp/task` 创建 tenant-scoped task/artifact projection。
- `runtime.go.static`: Go control plane 同进程服务 `apps/web` 静态页面和 `/api/mvp/task`。
- `runtime.opl.fail-closed`: OPL projection 默认 mock readonly，真实 OPL CLI 只能通过 Go-side contract 和白名单边界进入。
- `runtime.opl.no-mutation`: install、repair、module exec、family-runtime mutation 默认禁止。

## Cannot Claim

- 当前 runtime 不包含数据库、队列、鉴权、真实云部署或真实 OPL mutation。
