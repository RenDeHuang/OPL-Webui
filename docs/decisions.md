# One Person Lab Web Decisions

- owner: product-engineering owner
- purpose: current durable decisions and superseded readings.
- state: active_truth_with_history_notes
- machine boundary: human-readable decision record; contracts, source, tests, scripts, API behavior, and deploy artifacts are authoritative.

## Current Decisions

| Decision | Current reading | Machine boundary |
| --- | --- | --- |
| Web repo is a SaaS Web product peer of the App repo | `one-person-lab-web` is the browser/SaaS edition of One Person Lab App. It owns Web product truth and the Go BFF/control-plane surface, not MedOPL back office or OPL runtime truth. | `contracts/web-product-profile.json`, `docs/project.md`, `docs/architecture.md` |
| Development uses fixed truth entries | Current truth lives in README, core docs, `docs/status.md`, `docs/decisions.md`, contracts, source, tests, and scripts. Per-change `changes/active` packages are retired as the default workflow. | `AGENTS.md`, `TASTE.md`, `docs/docs_portfolio_consolidation.md`, `tests/contract/fixed-truth-lifecycle.test.mjs` |
| Product expansion pauses during governance realignment | Recent history shows product work is being pulled into governance/change lifecycle churn. Until fixed truth and tests are realigned, do not add runtime, billing, storage, deploy, projection, or OPL mutation scope. | `docs/status.md`, test registry |
| MedOPL owns commercial resource truth | Recharge, runtime, node pool, storage, billing, resource lifecycle, and commercial back office remain MedOPL-owned. Web can consume status projections and display runtime gates. | `contracts/web-product-profile.json`, `contracts/web-runtime-bridge.json` |
| OPL runtime remains external authority | Real OPL CLI integration requires Go-side contract, eval, whitelist, and human authorization boundary. Web may show refs-only projections and gates, not mutate runtime or read private state. | `contracts/web-runtime-bridge.json`, Go control plane tests |
| Verification scales with risk | Small docs/test/source maintenance can use targeted tests plus relevant suite. User-visible, API, runtime, billing, storage, deploy, OPL bridge, or release-claim changes require full gates. | `AGENTS.md`, `scripts/verify.mjs`, `scripts/workflow-gate.mjs`, `scripts/repo-bloat-audit.mjs` |

## Superseded Readings

| Superseded reading | Current reading |
| --- | --- |
| Every formal change must create `changes/active/<change-id>/` with proposal, spec delta, design, tasks, eval plan, review, and closeout. | Fixed truth entries and registered tests are the source of current state. Historical closeouts are provenance only. |
| `docs/status.md` and `docs/decisions.md` were retired prose truth. | They are now required fixed truth entries, matching the One Person Lab App product-repo pattern. |
| `changes/archive/closeouts.md` is active evidence truth. | Historical closeouts live at `docs/history/process/closeouts.md`; active claims must point to current contracts, source, tests, scripts, and deploy artifacts. |
