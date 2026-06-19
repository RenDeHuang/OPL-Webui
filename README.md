# One Person Lab Web

- owner: product-engineering owner
- purpose: public entry point for the One Person Lab Web product repository.
- state: active_truth
- machine boundary: human-readable navigation; contracts, source, tests, scripts, and API behavior are authoritative.

One Person Lab Web is the multi-tenant SaaS Web edition of One Person Lab at `opl.medopl.cn`. It serves research staff, master's students, PhD students, principal investigators, and research teams through `@科研`, `@论文`, `@基金`, `@综述`, and `@文件` research capability entries.

This repo owns the browser product surface, multi-tenant account/session experience, tenant isolation, BYOK API Key binding, research capability entry, ordinary chat fallback, Web page state, same-origin Go control plane API, and Web release/deploy evidence.

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

- Web owns the multi-tenant SaaS product entry, static shell, account/session path, tenant isolation, fixed provider binding, research capability launcher, ordinary chat fallback, page state, sanitized audit projection, and Web release/deploy evidence.
- Go control plane is the only backend business entry for this repo.
- This repo does not own desktop App packaging/updater, OPL Framework runtime truth, domain-agent judgment authority, billing source of truth, storage truth, node pool lifecycle, API gateway truth, OPL execution truth, or artifact/body authority.

## Development Loop

Use fixed truth, not per-change process packages:

1. Read the fixed truth entry points above.
2. Identify one gap and its owner surface.
3. Update contracts first for user-visible, API, page-state, runtime-gate, deploy, or release-claim changes.
4. Update or add registered tests.
5. Implement the smallest source/docs change.
6. Retire replaced routes, schemas, tests, docs, names, and compatibility surfaces in the same diff.
7. Run verification scaled to risk.

Small docs/test/source maintenance can use targeted tests plus the relevant verify suite. User-visible, API, runtime, billing, storage, deploy, OPL bridge, or release-claim changes require `npm run verify`, `npm run gate:review`, `npm run repo:bloat`, and `sentrux check .`.

`docs/active/README.md` is the current gap baton for worktree lanes and next-agent handoff. Retired surfaces that should not return are indexed in `docs/history/tombstones/README.md`.
