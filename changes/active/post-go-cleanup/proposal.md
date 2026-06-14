# Proposal

- owner: post-go-cleanup
- state: active

## Why

Go control plane 已经替换 Node API，旧 `packages/core` 和 `packages/opl-adapter` 不再被运行态消费，应清退以防 AI 后续误判边界。

## Goals

- 删除旧 Node core/adapter 和未消费 schema。
- 保留当前 `mvp-task-http` contract。
- 更新 docs/spec/Sentrux/test registry。

## Non-Goals

- 不改 Web UI，不引入真实 OPL execution。
