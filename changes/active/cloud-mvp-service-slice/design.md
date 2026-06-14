# Design

- owner: cloud-mvp-service-slice
- state: active

## Architecture

`apps/api/src/server.mjs` 是最小 Node HTTP 服务，同时服务 `apps/web` 静态文件和 `/api/mvp/task`。

## Data Flow

Browser -> `/api/mvp/task` -> `createMvpTaskResponse()` -> demo task/artifact loop -> mock OPL adapter -> JSON projection。

## Failure Modes

- 缺少 tenant、workspace、user 或 prompt 时返回 `INVALID_MVP_TASK_REQUEST`。
- OPL adapter 继续只允许 command policy 白名单。

## Surface Impact

- source: `apps/api`, `apps/web`, `packages/contracts`
- docs/specs: `docs/active`, `specs/*`
- tests: health、contract、smoke
