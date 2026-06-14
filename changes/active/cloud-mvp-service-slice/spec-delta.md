# Spec Delta

- owner: cloud-mvp-service-slice
- state: active

## ADDED

- `specs/product/spec.md`: 中文 AI workspace 和多租户 MVP 主链路。
- `specs/runtime/spec.md`: `POST /api/mvp/task` 和 fail-closed OPL adapter 边界。
- `specs/source/spec.md`: Web/API/core/adapter/contracts 依赖方向。
- `packages/contracts/opl/mvp-task-http.schema.json`: MVP task HTTP request contract。

## CANNOT-CLAIM

- 不能声明完整生产 SaaS、真实 OPL execution 或生产部署。

## EVALS

- `npm run verify`
- `npm run gate:review`
- `sentrux check /home/dev/projects/ui`
