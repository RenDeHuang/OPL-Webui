# Control Plane MVP Retirement Review

- owner: product-engineering owner
- purpose: review notes for this active change.
- state: active change review
- machine boundary: reviewer notes are human-readable; tests and gates are machine truth.

## Review Notes

- RED guard was verified first: `node --test tests/health/stale-retirement-guard.test.mjs` failed on active `internal/mvp` imports, package declarations, and old `/api/mvp` handler/test strings.
- The active Go package moved to `services/control-plane-go/internal/controlplane`.
- No compatibility alias package was added.
- Old unregistered public handler surfaces were deleted instead of renamed: `HandleTask`, `HandleStoredTask`, `HandleSessionLaunch`, `HandleSessionCurrent`, `HandleWorkspaceCurrent`, `HandleSaaSTasks`, and `HandleSaaSTask`.
- Still-used control-plane surfaces were retained: task projection DTOs, deterministic projection builder, memory/Postgres projection store, quota projection, usage ledger, DB canary support, OPL readonly route projection.
- `DownloadRef` no longer emits a fake `demo://` storage URL; it now emits an explicit `artifact-ref:` projection reference.
- Test registry points to `./internal/controlplane`, and removed handler/session tests are no longer registered.
- Bloat budget was ratcheted from 90 durable files to 85 durable files after cleanup.
