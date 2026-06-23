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
- Long-lived surface ownership is machine-readable: `contracts/web-surface-inventory.json` lists scripts, contracts, tests, Go tests, recurring docs, workflows/deploy, and selected source owner surfaces. It must not become a full mirror of ordinary implementation files.
- Small files stay purposeful: line count is only a hard hygiene boundary at 1000 lines unless generated, fixture, or schema material. Below that boundary, split files because responsibilities are clearer, not because an arbitrary small number was crossed.
- File count is a portfolio signal, not a release blocker. Owned growth is report-only; orphan growth without owner or consumer is a hard failure.

## UI Governance Taste

- UI work is subject-first: identify the One Person Lab Web research task and primary object before choosing layout patterns or components.
- Current subject: AI-native research composer with project/session/result workflow. It is not a dashboard template, CRM template, settings center, runtime console, or card grid first surface.
- Components follow surface ownership and behavior, not visual similarity. Account and compact model metadata use popovers; conversation history and mobile inspector use sheets; API Key unblock uses a dialog; destructive confirmation alone uses alert dialog.
- Surface budget comes before component polish. Home is composer-first and low-copy; More stays empty overflow until it has a named consumer; Search stays conversation history only.
- Visual identity is part of the contract: the UI should read as a quiet research composer with evidence stacks, citation trails, protocol steps, and research artifacts, not as a generic chatbot, dashboard, marketing hero, decorative glass surface, or settings center.
- Visual quality rubric is pass/fail, not ornamental prose: hierarchy clarity, copy density, spacing rhythm, mobile comfort, focus path, empty/error/loading clarity, surface ownership, and scientific artifact density must change the next correct agent action.
- Owner receipt protocol is explicit: `ui_ux_v1_production_accepted` requires current HEAD evidence, desktop/tablet/mobile/compact review, human owner acceptance, and sanitized foldback; repo-local tests alone cannot grant it.
- Do not create new UI governance files while `contracts/web-gui-product-contract.json`, `contracts/web-page-state-matrix.json`, `contracts/web-shell-adapter.json`, this file, `docs/status.md`, and `docs/active/README.md` can carry the rule.
- If a UI rule will not change the next correct agent action, leave it in code/tests or remove it instead of adding prose.

## Default Development Loop

1. Read `README.md`, `AGENTS.md`, this file, `docs/status.md`, `docs/decisions.md`, `docs/active/README.md`, and relevant `contracts/*.json`.
2. State the claim, owner surface, consumer, contract boundary, proof test, proof level, cannot-claim boundary, production foldback need, and retirement path.
3. Update contracts first for user-visible, API, page-state, runtime-gate, deploy, or release-claim changes.
4. Write or update tests first and register new test files with proof taxonomy.
5. Implement the smallest behavior.
6. Retire replaced code and docs in the same change.
7. Register any new long-lived surface in `contracts/web-surface-inventory.json`.
8. Run the targeted lane first, then `npm run verify` for the current main lane.
9. Run `npm run gate:ai` before claiming review/completion; `npm run gate:review` includes it and then checks lane evidence plus current verify.
10. Add explicit browser, deploy, regression, full, repo bloat, and Sentrux gates when the changed surface requires them.
11. Update fixed truth entries with verification evidence and cannot-claim boundaries when the current status changes.

## Test Lane Taste

- Treat lane membership as product truth: tests should explain the owner surface and contract they protect, not just where the file lives.
- Treat tests as executable evidence for a specific claim, not coverage decoration.
- Keep taxonomy machine-readable in `scripts/test-classification.mjs`: `cost` communicates execution weight, `lifecycleRole` communicates why the test exists, `testKind` communicates proof purpose, `proofLevel` communicates evidence depth, `claimScope` communicates the environment scope, `proves` states the claim, `doesNotProve` states the cannot-claim boundary, and `riskTriggers` drive targeted lane selection.
- Keep the main lane stable. `current` is the daily bias check for smoke, contract, health, and Go control plane.
- Keep expensive or environment-sensitive lanes explicit. Browser, deploy, regression, and full gates are selected by changed surface and release risk.
- Keep regression guards disposable. A `regression-guard` must say when it retires, and retirement deletes the test plus registry entry instead of accumulating old bug reproductions.
- Do not create direct test scripts that bypass `scripts/verify.mjs`; register tests and let the lane runner own execution.

## Automation Trigger Taste

- Any change to code, docs, contracts, tests, scripts, deploy, or API behavior is formal development and triggers the development profile.
- Any new test file triggers registry registration before it can count as evidence.
- Any new long-lived surface triggers `contracts/web-surface-inventory.json` registration before it can count as owned growth.
- Any user-visible, API, page-state, runtime, deploy, or release claim triggers contract-first work.
- Any completed production rollout, browser e2e, dogfood, availability, or release-image run that changes claim status triggers compressed release evidence foldback through `npm run release:evidence -- --run-id <github-run-id>` or an equivalent checked-in contract/docs update.
- Any replaced route, schema, doc entry, test, alias, mock, or compatibility layer triggers same-diff retirement unless it has a real consumer, contract, test, and retirement rule.
