# Control Plane MVP Retirement Spec Delta

- owner: product-engineering owner
- purpose: describe the spec delta for removing historical MVP package naming.
- state: active change spec delta
- machine boundary: import paths, route tests, and registry entries are machine truth.

## Delta

- Active source must not import or declare `services/control-plane-go/internal/controlplane`.
- Active source must not use `package mvp` or `mvp.` references.
- The control plane task projection, launch auth, quota, membership, and Postgres store implementation moves to `services/control-plane-go/internal/controlplane`.
- Public `/api/mvp/*` remains retired; tests may keep explicit retired-route assertions.

## Compatibility

No compatibility layer is allowed. If a consumer still imports `internal/mvp`, that consumer must migrate in this change.
