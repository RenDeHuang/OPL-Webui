# One Person Lab Web Decisions

- owner: product-engineering owner
- purpose: current durable decisions and superseded readings.
- state: active_truth_with_history_notes
- machine boundary: human-readable decision record; contracts, source, tests, scripts, API behavior, and deploy artifacts are authoritative.

## Current Decisions

| Decision | Current reading | Machine boundary |
| --- | --- | --- |
| Web repo is the SaaS Web product peer of the App repo | `one-person-lab-web` is the multi-tenant SaaS Web edition of One Person Lab. It owns the browser product entry for research staff, master's students, PhD students, principal investigators, and research teams; `one-person-lab-app` owns the desktop product entry. | `contracts/web-product-profile.json`, `docs/project.md`, `docs/architecture.md` |
| Development uses fixed truth entries | Current truth lives in README, core docs, `docs/status.md`, `docs/decisions.md`, contracts, source, tests, and scripts. Per-change `changes/active` packages are retired as the default workflow. | `AGENTS.md`, `TASTE.md`, `docs/docs_portfolio_consolidation.md`, `tests/contract/fixed-truth-lifecycle.test.mjs` |
| Active docs are lightweight batons | `docs/active/README.md` is allowed for current gap, worktree lane, next-agent context, and foldback target. It is not a process package and not machine truth. | `docs/active/README.md`, `docs/docs_portfolio_consolidation.md`, `tests/contract/fixed-truth-lifecycle.test.mjs` |
| Tombstones prevent surface resurrection | Retired routes, modules, docs, names, and workflow surfaces belong under `docs/history/tombstones/` only when a no-resurrection record is useful. | `docs/history/tombstones/README.md`, `tests/health/stale-retirement-guard.test.mjs` |
| Repo bloat uses portfolio signals, not file-count blocking | Durable file count is reported as a soft portfolio signal. Hard failures stay on line-budget violations and concrete retired-surface or registry violations. | `scripts/repo-bloat-audit.mjs`, `tests/health/repo-bloat.test.mjs` |
| Primary entry is research capability first | Users enter through `@科研`, `@论文`, `@基金`, `@综述`, and `@文件`. Ordinary chat remains a fallback entry, not the primary product positioning. | `contracts/web-product-profile.json`, `contracts/web-page-state-matrix.json`, `contracts/web-runtime-bridge.json` |
| Product expansion resumes gap by gap | The heavy governance/change loop is retired. Future work should move through one product gap at a time with contract-first updates, registered tests, cleanup, and fresh evidence. | `docs/status.md`, test registry |
| External authorities stay external | Desktop App packaging/updater, OPL Framework runtime truth, domain-agent judgment, billing truth, storage truth, node pool lifecycle, API gateway truth, OPL execution truth, and artifact/body authority are not owned by this repo. | `contracts/web-product-profile.json`, `contracts/web-runtime-bridge.json` |
| OPL runtime remains external authority | Real OPL CLI integration requires Go-side contract, eval, whitelist, and human authorization boundary. Web may show refs-only projections and gates, not mutate runtime or read private state. | `contracts/web-runtime-bridge.json`, Go control plane tests |
| Verification scales with risk | Small docs/test/source maintenance can use targeted tests plus relevant suite. User-visible, API, runtime, billing, storage, deploy, OPL bridge, or release-claim changes require full gates. | `AGENTS.md`, `scripts/verify.mjs`, `scripts/workflow-gate.mjs`, `scripts/repo-bloat-audit.mjs` |

## Superseded Readings

| Superseded reading | Current reading |
| --- | --- |
| Every formal change must create `changes/active/<change-id>/` with proposal, spec delta, design, tasks, eval plan, review, and closeout. | Fixed truth entries and registered tests are the source of current state. Historical closeouts are provenance only. |
| `docs/status.md` and `docs/decisions.md` were retired prose truth. | They are now required fixed truth entries, matching the One Person Lab App product-repo pattern. |
| `changes/archive/closeouts.md` is active evidence truth. | Historical closeouts live at `docs/history/process/closeouts.md`; active claims must point to current contracts, source, tests, scripts, and deploy artifacts. |
| A fixed durable file limit determines whether development can continue. | File count is report-only; owner boundaries, retired-surface guards, test registry, line hygiene, and fresh verification decide whether the repo is healthy. |
