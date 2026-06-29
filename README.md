# One Person Lab Web

- owner: product-engineering owner
- purpose: public entry point for the One Person Lab Web product repository.
- state: active_truth
- machine boundary: human-readable navigation; contracts, source, tests, scripts, and API behavior are authoritative.

One Person Lab Web is the One Person Lab Web interaction platform and browser entry at `opl.medopl.cn`. It serves personal researchers, graduate students, PhD students, principal investigators, and research groups or organizations across research, paper, grant, review, file, PPT, and book knowledge delivery scenarios. The current product identity is browser interaction first: open Web, log in, bind an API Key or use admitted account capability, choose `@科研`, `@论文`, `@基金`, `@综述`, `@文件`, `@PPT`, or `@书`, then continue through result, progress refs, deliverable refs, blocker/next step, and MedOPL/OPL deeplink states.

This repo owns route/auth/account/BYOK, task intent, page state, refs projection, deeplink, account/session experience, hidden tenant isolation, ordinary chat fallback, same-origin Go control plane API, MedOPL runtime gate/run bridge projection, billing ledger refs projection, and Web release/deploy evidence.

UI source truth is Figma Make `UI_UX for Commercial Launch` (`1MNO5l7PQYKZVNqQgw6DGS`). OPL-Webui UI work must translate that Figma Make source into the current Web architecture; Codex does not self-design landing, sidebar, workbench, auth, search, dialog, sheet, or task UI. Figma mock data and generated app code are design input only, not task history, runtime, storage, payment, or artifact truth.

It is the Web product peer of `gaofeng21cn/one-person-lab-app`: the App repo owns the desktop product entry, while this repo owns the browser product entry.

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

- Web owns the account-based browser entry, static shell, route/auth/account/BYOK path, hidden tenant isolation, fixed provider binding, research capability launcher, ordinary chat fallback, task intent, page state, sanitized audit projection, refs projection, deeplink, MedOPL runtime gate/run bridge projection, billing ledger refs projection, and Web release/deploy evidence.
- Go control plane is the only backend business entry for this repo.
- Ordinary users do not need runtime or storage by default. Specialist execution markers enter the MedOPL-managed runtime/resource path.
- one-person-lab owns framework and execution semantics. MedOPL owns runtime, resource, billing, and storage authority. Foundry Agents own domain truth, quality, and artifact authority.
- This repo does not own desktop App packaging/updater, OPL Framework runtime truth, domain-agent judgment authority, billing source of truth, storage truth, node pool lifecycle, API gateway truth, OPL execution truth, artifact/body authority, payment mutation, or storage mutation.

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

Test truth is lane-based, not case-count-based. `scripts/test-classification.mjs` owns test taxonomy, lane membership, cost, lifecycle role, risk triggers, and verify-suite metadata. `npm run verify` runs the daily `fast` suite: `fast + ui + api + health-light + go-light`. Dynamic lane checks use changed files plus fresh verification evidence; `npm run lane:advisory -- <files...>` only explains the targeted lanes to run. Browser golden, full browser, integration, release/deploy, regression, real-MedOPL, and full verification are explicit lanes, not hidden inside health checks.

`npm run verify:real-medopl` is the explicit real local MedOPL evidence lane. It starts a real MedOPL Go backend from `/home/dev/projects/platform-v22/services/medopl-go-backend` by default, or `MEDOPL_GO_BACKEND_DIR` when provided, and proves WebUI gate/run/billing refs against that process. It is local evidence only and does not claim sandbox or production MedOPL business closure. `MEDOPL_API_BASE_URL` is Go backend operator deployment config; selected/test/canary accounts are evidence fixtures or rollout safety only, never product runtime admission policy.

Regression tests are temporary guards, not permanent inventory. The `regression` lane may be empty. Any `regression-guard` entry must carry retirement metadata, and when its condition is satisfied the same cleanup removes the test file, registry entry, and any needed no-resurrection tombstone.

Small docs/test/source maintenance can use targeted tests plus the relevant verify suite and `npm run verify`. User-visible, API, runtime, billing, storage, deploy, OPL bridge, or release-claim changes require the targeted explicit lane, `npm run gate:review`, `npm run repo:bloat`, and `sentrux check .`.

`docs/active/README.md` is the current gap baton for worktree lanes and next-agent handoff. Retired surfaces that should not return are indexed in `docs/history/tombstones/README.md`.
