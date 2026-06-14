# Spec Delta

- owner: go-control-plane-replacement
- state: active

## MODIFIED

- `specs/runtime/spec.md`: MVP server owner 从 Node `apps/api` 改为 Go `services/control-plane-go`。
- `specs/source/spec.md`: 后端业务 source owner 改为 Go control plane。

## REMOVED

- `apps/api/src/server.mjs` 和 `apps/api/src/mvpTaskHandler.mjs` 不再是后端业务入口。

## CANNOT-CLAIM

- 不能声明真实生产部署、真实 OPL execution 或完整多租户控制面。

## EVALS

- `go test ./...`
- `npm run gate:review`
- `sentrux check /home/dev/projects/ui`
