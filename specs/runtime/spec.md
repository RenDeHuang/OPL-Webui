# Runtime Spec

- owner: runtime owner
- purpose: SaaS API、OPL adapter 和运行边界 durable spec。
- state: active
- machine boundary: 机器接口在 `packages/contracts/opl/*.json`、`apps/api/src/*` 和 adapter tests。

## Requirements

- `runtime.api.mvp-task`: `POST /api/mvp/task` 创建 tenant-scoped task/artifact projection。
- `runtime.api.static`: MVP server 同进程服务 `apps/web` 静态页面和 `/api/mvp/task`。
- `runtime.opl.fail-closed`: OPL adapter 默认 fail-closed，只允许 command policy 白名单。
- `runtime.opl.no-mutation`: install、repair、module exec、family-runtime mutation 默认禁止。

## Cannot Claim

- 当前 runtime 不包含数据库、队列、鉴权、真实云部署或真实 OPL mutation。
