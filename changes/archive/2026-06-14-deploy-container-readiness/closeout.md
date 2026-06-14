# Deploy Container Readiness Closeout

## Summary

- Go control plane 支持 `HOST`/`PORT` 地址配置，本机默认仍是 `127.0.0.1:4173`。
- 新增 `GET /healthz` 健康检查，供云平台探活。
- 新增 Dockerfile 和 `.dockerignore`，容器只构建 Go control plane 并复制 `apps/web`。
- 部署 readiness 测试已登记到 test registry。

## Verification

- `go test ./...`
- `node --test tests/contract/go-control-plane-http.test.mjs tests/health/deploy-container-readiness.test.mjs tests/health/registry-coverage.test.mjs`
- `npm run gate:review`
- `sentrux check /home/dev/projects/ui`

## Cannot Claim

- 未实现真实 OPL execution、真实登录、多租户数据库、队列、计费或生产运行证据。
- 未绑定具体云平台，Dockerfile 只是通用容器部署入口。
