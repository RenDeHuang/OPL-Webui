# Proposal

- owner: go-control-plane-replacement
- state: active

## Why

正式 SaaS 后端应从 MVP 阶段开始使用 Go control plane，避免 Node API 后期大换血。

## Goals

- 用 Go 直接替换 `apps/api` Node server。
- `POST /api/mvp/task` 和静态 Web 服务由 `services/control-plane-go` 承载。
- Node 只保留 repo gate/test runner，不承载后端业务。
- 不做 Node API 兼容层。

## Non-Goals

- 不实现真实登录、数据库、队列、计费、真实 OPL execution 或生产部署。
