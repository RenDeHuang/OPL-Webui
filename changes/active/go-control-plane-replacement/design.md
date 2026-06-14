# Design

- owner: go-control-plane-replacement
- state: active

## Architecture

`services/control-plane-go` 提供 Go HTTP server，负责静态 Web 和 `/api/mvp/task`。

## Data Flow

Browser -> Go `/api/mvp/task` -> in-process contract projection -> JSON response。

## Boundary

Go control plane 当前使用 mock OPL projection，不 import OPL internals，不执行 mutation。
