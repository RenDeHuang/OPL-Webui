# Tombstones

- owner: product-engineering owner
- purpose: retired surface index and no-resurrection guard.
- state: history_tombstone
- machine boundary: human-readable archive; tests, source, contracts, and stale-retirement guards enforce active behavior.

## Role

This directory records retired surfaces that must not return as active product, API, runtime, document, or workflow truth. Tombstones are not current product truth and must not be used as compatibility entry points.

## Retired Surfaces

| Surface | Current reading | Guard |
| --- | --- | --- |
| `changes/active` process packages | Current development uses fixed truth entries, contracts, source, registered tests, scripts, deploy artifacts, and fresh evidence. | `tests/contract/fixed-truth-lifecycle.test.mjs` |
| `changes/archive/closeouts.md` | Historical process evidence lives at `docs/history/process/closeouts.md`. | `contracts/web-release-profile.json` |
| Node API backend under `apps/api` | Go control plane is the only backend business entry. | `tests/contract/fixed-truth-lifecycle.test.mjs` |
| `packages/core` and `packages/opl-adapter` | The Web repo does not carry Node adapter compatibility packages. | `tests/contract/fixed-truth-lifecycle.test.mjs` |
| `/api/mvp/task` and MVP transition vocabulary | Public Web API uses current one-person-lab-web routes only. | `tests/health/stale-retirement-guard.test.mjs` |
| `demoData` and fake storage/billing/runtime execution | Test fixtures may mock upstreams, but active product surfaces must not present fake platform ownership. | `tests/health/stale-retirement-guard.test.mjs` |
| `apps/web/styles/v3.css` | The current Web shell uses `apps/web/styles.css`. | `tests/contract/fixed-truth-lifecycle.test.mjs` |
| `@长任务` as an active Web runtime marker | Current runtime-required markers are contract-defined as `@论文`, `@基金`, `@综述`, and `@文件`. | `contracts/web-runtime-bridge.json` |

## No-Resurrection Rules

- Delete retired surfaces by default.
- Add a tombstone only when the old name, route, document, or module is likely to be reintroduced.
- If a temporary bridge is unavoidable, it needs a real consumer, contract, retirement condition, test, and foldback target.
- Active docs may mention retired surfaces only to point readers to the current owner or this tombstone index.
