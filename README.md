# One Person Lab Web

- owner: product-engineering owner
- purpose: public entry point for the One Person Lab Web product repository.
- state: active_truth
- machine boundary: human-readable navigation; contracts, source, tests, scripts, and API behavior are authoritative.

One Person Lab Web is the account-based Web edition of One Person Lab App at `opl.medopl.cn`. It serves research staff, master's students, PhD students, principal investigators, and research teams through a simple path: open Web, log in, bind an API Key or use account capability, choose `@科研`, `@论文`, `@基金`, `@综述`, `@文件`, `@PPT`, and `@书`, then continue through result, progress refs, deliverable refs, blocker/next step, and MedOPL/OPL deeplink states.

This repo owns the browser product surface, account/session experience, hidden multi-tenant isolation, BYOK API Key binding, research capability entry, ordinary chat fallback, Web page state, same-origin Go control plane API, and Web release/deploy evidence.

It is the Web product peer of `gaofeng21cn/one-person-lab-app`: the App repo owns the desktop product entry, while this repo owns the SaaS browser product entry.

## Read First

1. `AGENTS.md`
2. `TASTE.md`
3. `docs/project.md`
4. `docs/status.md`
5. `docs/decisions.md`
6. `docs/architecture.md`
7. `docs/invariants.md`
8. `docs/docs_portfolio_consolidation.md`
9. `docs/active/README.md`
10. `contracts/*.json`

## Product Boundary

- Web owns the account-based product entry, static shell, account/session path, hidden tenant isolation, fixed provider binding, research capability launcher, ordinary chat fallback, page state, sanitized audit projection, and Web release/deploy evidence.
- Go control plane is the only backend business entry for this repo.
- This repo does not own desktop App packaging/updater, OPL Framework runtime truth, domain-agent judgment authority, billing source of truth, storage truth, node pool lifecycle, API gateway truth, OPL execution truth, or artifact/body authority.

## Development Loop

Use fixed truth, not per-change process packages:

1. Read the fixed truth entry points above.
2. Identify one gap and its owner surface.
3. Update contracts first for user-visible, API, page-state, runtime-gate, deploy, or release-claim changes.
4. Choose the targeted test lane before implementation.
5. Update or add registered tests.
6. Implement the smallest source/docs change.
7. Retire replaced routes, schemas, tests, docs, names, and compatibility surfaces in the same diff.
8. Run targeted lane, then `current`, then risk-specific explicit lanes.

Test truth is lane-based, not case-count-based. `scripts/test-classification.mjs` owns test taxonomy, lane membership, cost, lifecycle role, risk triggers, and verify-suite metadata. `npm run verify` runs `current = smoke + contract + health + go`. Dynamic lane checks use changed files plus fresh verification evidence; `npm run lane:advisory -- <files...>` only explains the targeted lanes to run. Browser, deploy, regression, and full verification are explicit lanes, not hidden inside health checks.

Regression tests are temporary guards, not permanent inventory. The `regression` lane may be empty. Any `regression-guard` entry must carry retirement metadata, and when its condition is satisfied the same cleanup removes the test file, registry entry, and any needed no-resurrection tombstone.

Small docs/test/source maintenance can use targeted tests plus the relevant verify suite and `npm run verify`. User-visible, API, runtime, billing, storage, deploy, OPL bridge, or release-claim changes require the targeted explicit lane, `npm run gate:review`, `npm run repo:bloat`, and `sentrux check .`.

`docs/active/README.md` is the current gap baton for worktree lanes and next-agent handoff. Retired surfaces that should not return are indexed in `docs/history/tombstones/README.md`.
