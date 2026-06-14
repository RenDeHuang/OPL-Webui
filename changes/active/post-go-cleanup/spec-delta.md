# Spec Delta

- owner: post-go-cleanup
- state: active

## REMOVED

- `packages/core`
- `packages/opl-adapter`
- unused task/artifact/command-policy contracts

## MODIFIED

- `specs/runtime/spec.md` 和 `specs/source/spec.md` 只描述 Go control plane 和 HTTP contract。

## EVALS

- `npm run verify`
- `npm run gate:review`
