# Control Plane MVP Retirement Proposal

- owner: product-engineering owner
- purpose: retire historical `internal/mvp` naming and package boundary.
- state: active change proposal
- machine boundary: source paths, imports, tests, registry, bloat gate, and Go package behavior are machine truth.

## Why

`internal/mvp` is historical debt. The public `/api/mvp/*` route has already been retired, but the Go control plane still imports and tests the `mvp` package. This keeps stale vocabulary in active source and makes future commercial work look like an MVP continuation instead of a current control-plane product boundary.

## Scope

- Rename the active Go package from `internal/mvp` to `internal/controlplane`.
- Preserve current runtime behavior, API behavior, data shape, and tests.
- Update imports, canary helpers, registry entries, and retirement guards.
- Delete the old `services/control-plane-go/internal/controlplane` package.

## Non-goals

- No new public API.
- No product narrative change.
- No billing, storage, runtime bridge, MedOPL integration, OPL execution, or production rollout.
- No compatibility package or alias layer.
