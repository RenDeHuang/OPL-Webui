# Control Plane MVP Retirement Design

- owner: product-engineering owner
- purpose: implementation design for the package rename and cleanup.
- state: active change design
- machine boundary: Go compiler, Node tests, bloat audit, and Sentrux rules verify the design.

## Approach

1. Add a RED health assertion that scans active source and fails on `internal/mvp`, `package mvp`, or `mvp.` outside retired-history contexts.
2. Move `services/control-plane-go/internal/controlplane` to `services/control-plane-go/internal/controlplane`.
3. Rename package declarations from `mvp` to `controlplane`.
4. Update `cmd/opl-webui-control-plane` imports and symbol qualifiers.
5. Update `scripts/test-classification.mjs` to point Go package tests at `./internal/controlplane`.
6. Delete old `internal/mvp` after all imports move.

## File Ownership

- Go control-plane implementation: `services/control-plane-go/internal/controlplane/*`
- CLI/server wiring: `services/control-plane-go/cmd/opl-webui-control-plane/*`
- Governance guard: `tests/health/stale-retirement-guard.test.mjs`
- Test registry: `scripts/test-classification.mjs`

## Risks

- Package rename can hide missing registry references if registry is not updated.
- Retired public route tests may still contain `/api/mvp` strings by design; guard must allow only those explicit retired-route tests.
