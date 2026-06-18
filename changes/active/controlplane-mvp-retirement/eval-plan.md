# Control Plane MVP Retirement Eval Plan

- owner: product-engineering owner
- purpose: define verification gates for `internal/mvp` retirement.
- state: active change eval plan
- machine boundary: command output is verification truth.

## Targeted

- `node --test tests/health/stale-retirement-guard.test.mjs`
- `node --test tests/health/registry-coverage.test.mjs`
- `cd services/control-plane-go && go test ./internal/controlplane`
- `cd services/control-plane-go && go test ./cmd/opl-webui-control-plane`
- `cd services/control-plane-go && go test ./...`

## Full Gates

- `npm run verify`
- `npm run gate:review`
- `npm run repo:bloat`
- `sentrux check .`

## Cannot Claim

- Cannot claim business behavior changed.
- Cannot claim production rollout.
- Cannot claim MedOPL runtime bridge, billing, storage, OPL worker, or real OPL execution/mutation.
