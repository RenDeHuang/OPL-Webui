# Proposal

- owner: cloud-mvp-service-slice
- state: active

## Why

把静态 Web shell 推进为可部署的云端 MVP 服务切片，并补齐 docs/spec/test/Sentrux 自治。

## Goals

- Web UI 通过 `/api/mvp/task` 调用 SaaS API。
- API 返回 tenant-scoped task/artifact projection。
- 引入 `docs/active`、`specs/*` 和 `.sentrux/rules.toml`。
- 不新增 npm dependencies。

## Non-Goals

- 不实现真实登录、数据库、队列、计费、真实 OPL execution 或生产云部署。
