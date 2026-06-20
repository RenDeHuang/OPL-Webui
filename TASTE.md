# One Person Lab Web Engineering Taste

- owner: product-engineering owner
- purpose: durable engineering taste for AI-assisted development in this repo.
- state: active_truth
- machine boundary: human-readable guidance; tests and scripts enforce concrete rules.

## Principles

- Ideal state first: define the target product/control-plane boundary before coding.
- One gap per change: do not bundle auth, runtime, billing, UI, and deploy in one change.
- Cleanup is part of development: every change must remove, rename, or explicitly preserve replaced surfaces.
- No compatibility by default: do not keep old routes, schemas, tests, docs, aliases, or fake data unless a real consumer and retirement plan exist.
- No fake capability: runtime, billing, storage, OPL execution, and production claims require contracts and evals.
- Machine truth wins: source, API behavior, contracts, fixtures, scripts, and tests outrank prose.
- AI automation follows the development profile: `contracts/web-development-profile.json` is the machine-readable order, bloat policy, task tier policy, and completion boundary for agent work.
- Small files stay purposeful: line count is only a hard hygiene boundary at 1000 lines unless generated, fixture, or schema material. Below that boundary, split files because responsibilities are clearer, not because an arbitrary small number was crossed.
- File count is a portfolio signal, not a release blocker. Remove unowned or retired surfaces, but do not block useful product work on an arbitrary durable-file number.

## Default Development Loop

1. Read `README.md`, `AGENTS.md`, this file, `docs/status.md`, `docs/decisions.md`, `docs/active/README.md`, and relevant `contracts/*.json`.
2. Pick one gap and identify the owner surface before editing.
3. Update contracts first for user-visible, API, page-state, runtime-gate, deploy, or release-claim changes.
4. Write or update tests first and register new test files.
5. Implement the smallest behavior.
6. Retire replaced code and docs in the same change.
7. Run the targeted lane first, then `npm run verify` for the current main lane.
8. Run `npm run gate:ai` before claiming review/completion; `npm run gate:review` includes it and then checks lane evidence plus current verify.
9. Add explicit browser, deploy, regression, full, repo bloat, and Sentrux gates when the changed surface requires them.
10. Update fixed truth entries with verification evidence and cannot-claim boundaries when the current status changes.

## Test Lane Taste

- Treat lane membership as product truth: tests should explain the owner surface and contract they protect, not just where the file lives.
- Keep taxonomy machine-readable in `scripts/test-classification.mjs`: `cost` communicates execution weight, `lifecycleRole` communicates why the test exists, and `riskTriggers` drive targeted lane selection.
- Keep the main lane stable. `current` is the daily bias check for smoke, contract, health, and Go control plane.
- Keep expensive or environment-sensitive lanes explicit. Browser, deploy, regression, and full gates are selected by changed surface and release risk.
- Keep regression guards disposable. A `regression-guard` must say when it retires, and retirement deletes the test plus registry entry instead of accumulating old bug reproductions.
- Do not create direct test scripts that bypass `scripts/verify.mjs`; register tests and let the lane runner own execution.

## Automation Trigger Taste

- Any change to code, docs, contracts, tests, scripts, deploy, or API behavior is formal development and triggers the development profile.
- Any new test file triggers registry registration before it can count as evidence.
- Any user-visible, API, page-state, runtime, deploy, or release claim triggers contract-first work.
- Any completed production rollout, browser e2e, dogfood, availability, or release-image run that changes claim status triggers compressed release evidence foldback.
- Any replaced route, schema, doc entry, test, alias, mock, or compatibility layer triggers same-diff retirement unless it has a real consumer, contract, test, and retirement rule.
