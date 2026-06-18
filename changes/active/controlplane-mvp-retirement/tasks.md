# Control Plane MVP Retirement Tasks

- owner: product-engineering owner
- purpose: task list for `internal/mvp` retirement.
- state: active change tasks
- machine boundary: tests and gates prove task completion.

- [x] Write RED guard: active source must not use `internal/mvp`.
- [x] Move Go package to `internal/controlplane`.
- [x] Update imports, canary helpers, and package names.
- [x] Update test registry paths and Go package names.
- [x] Delete old `internal/mvp`.
- [x] Run targeted Go and Node tests.
- [x] Run full gates.
- [x] Record closeout evidence.

## Cleanup

- [x] Confirm no compatibility alias package exists.
- [x] Confirm active source has no `internal/mvp`, `package mvp`, or `mvp.` except allowed retired-route tests/history.
