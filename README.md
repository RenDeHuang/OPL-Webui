# One Person Lab Web

- owner: product-engineering owner
- purpose: public entry point for the One Person Lab Web product repository.
- state: active_truth
- machine boundary: human-readable navigation; contracts, source, tests, scripts, and API behavior are authoritative.

One Person Lab Web is the SaaS Web edition of One Person Lab App at `opl.medopl.cn`. It owns the browser product surface, account/session experience, BYOK API Key binding, ordinary chat entry, Web page state, same-origin Go control plane API, Web release/deploy evidence, and MedOPL Runtime gate projection.

It is the Web product peer of `gaofeng21cn/one-person-lab-app`, not a MedOPL back office and not an OPL runtime owner.

## Read First

1. `AGENTS.md`
2. `TASTE.md`
3. `docs/project.md`
4. `docs/status.md`
5. `docs/decisions.md`
6. `docs/architecture.md`
7. `docs/invariants.md`
8. `docs/docs_portfolio_consolidation.md`
9. `contracts/*.json`

## Product Boundary

- Web owns the public SaaS product entry, static shell, account/session path, fixed provider binding, ordinary chat request flow, page state, sanitized audit projection, and runtime gate display.
- Go control plane is the only backend business entry for this repo.
- MedOPL owns recharge, runtime, node pool, storage, billing, resources, and commercial back office truth.
- Upstream OPL owns framework/runtime semantics.
- MAS/MAG/RCA own domain judgment and deliverable authority.

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
