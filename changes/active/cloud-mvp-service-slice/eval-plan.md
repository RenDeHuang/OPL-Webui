# Eval Plan

- owner: cloud-mvp-service-slice
- state: active

## Required Commands

- `npm run verify`
- `npm run gate:review`
- `npm run repo:bloat`
- `sentrux check /home/dev/projects/ui`

## Can Claim

- 本地 MVP 服务能服务 Web shell 并处理 tenant-scoped `/api/mvp/task`。

## Cannot Claim

- 不能声明真实生产部署、真实登录、多租户数据库、队列、计费或真实 OPL execution。
