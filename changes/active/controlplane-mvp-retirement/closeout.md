# Control Plane MVP Retirement Closeout

- owner: product-engineering owner
- purpose: closeout record.
- state: active change closeout
- machine boundary: final verification commands must be recorded before archive.

## Completion

- Retired `services/control-plane-go/internal/mvp` from active source.
- Migrated surviving control-plane implementation to `services/control-plane-go/internal/controlplane`.
- Deleted no-consumer compatibility/legacy handler surfaces instead of carrying them forward.
- Updated imports, canary fake store, test registry, stale retirement guard, and bloat budget.
- Split Postgres schema into `postgres_schema.go` to keep file length under the 260-line gate.
- Ratcheted repo bloat durable file budget from 90 to 85.

## Verification

- RED: `node --test tests/health/stale-retirement-guard.test.mjs` failed on active `internal/mvp` usage before migration.
- Targeted: `node --test tests/health/stale-retirement-guard.test.mjs tests/health/registry-coverage.test.mjs`: passed.
- Targeted: `cd services/control-plane-go && go test ./internal/controlplane`: passed.
- Targeted: `cd services/control-plane-go && go test ./cmd/opl-webui-control-plane`: passed.
- Targeted: `cd services/control-plane-go && go test ./...`: passed.
- Lifecycle/bloat targeted: `node --test tests/contract/change-package-lifecycle.test.mjs tests/health/repo-bloat.test.mjs tests/health/stale-retirement-guard.test.mjs tests/health/registry-coverage.test.mjs`: passed.
- `npm run verify`: passed.
- `npm run gate:review`: passed.
- `npm run repo:bloat`: passed with 85 durable files, 17 tests, 17 durable markdown docs, 7 active change docs, and largest file at 260 lines.
- `sentrux check .`: passed 9 rules with quality 7355.

## Cannot Claim

- Cannot claim business behavior changed.
- Cannot claim production rollout.
- Cannot claim MedOPL runtime bridge, billing, storage, OPL worker, or real OPL execution/mutation.
