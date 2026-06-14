# Eval Plan

- owner: go-control-plane-replacement
- state: active

## Required Commands

- `go test ./...`
- `npm run verify`
- `npm run gate:review`
- `sentrux check /home/dev/projects/ui`

## Cannot Claim

- 不能声明真实生产部署、真实登录、多租户数据库、队列、计费或真实 OPL execution。
