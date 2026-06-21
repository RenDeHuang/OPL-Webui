# Active Gap Baton

- owner: product-engineering owner
- purpose: current gap, lane handoff, and next-agent context for parallel worktree development.
- state: active_support
- machine boundary: human-readable baton only; contracts, source, tests, scripts, API behavior, deploy artifacts, and Sentrux rules are authoritative.

## Role

`docs/active/` keeps the current Web product gap and worktree lane baton. It is not a process package, not a second status file, and not a log archive. When a lane closes, fold durable facts back into `docs/status.md`, `docs/decisions.md`, `contracts/`, source, tests, deploy artifacts, or `docs/history/`.

## Current Truth

One Person Lab Web is the multi-tenant SaaS Web edition of One Person Lab. It owns the browser product entry for research staff, master's students, PhD students, principal investigators, and research teams.

Current product work is moving from fixed truth into engineering evidence:

0. The active non-HA gap set is `contracts/web-product-profile.json#/visionGaps`: UI/UX Product Depth, MedOPL readonly evidence, runtime execution boundary, commercial SaaS depth, and operations maturity. HA is paused for single-node launch safety. These gaps advance through contracts, source, tests, and foldback evidence; production deploy is not the default next action unless the user explicitly asks for release evidence.
0a. Goal execution is now gated by `contracts/web-gap-phase-registry.json`: each gap exposes a current phase, step objective, acceptance gates, owner receipt policy, next-step openers, required evals, evidence sources, typed blockers, and cannot-claim boundaries. `npm run gap:phase` reports status plus `readyToAdvance` and may write temporary summaries to `.runtime/phase-runs`; those files are git-ignored, TTL/count/size capped, and cleaned by `node scripts/gap-phase-runner.mjs cleanup`.

1. Browser-level e2e runner executed successfully through `npm run verify:browser` with real Chromium/CDP for register, login, API Key binding, ordinary chat fallback, `@论文`/`@基金` gate, and sanitized audit evidence. It is now a CI release gate before image release; future non-CI hosts still need Chrome/Chromium via `OPL_BROWSER_BINARY` or system discovery.
2. Research-task-first UX state is owned by the page-state contract, `RESEARCH_TASK_INTENTS`, `RESEARCH_RESULT_SECTIONS`, and `chatStateForPrompt`; the browser runner now clicks the `research_direction` task template before ordinary chat fallback, verifies the structured `@科研` result sections, and verifies `@论文`/`@基金` runtime task cards. This remains a browser UI view model and must not become artifact body, storage, or runtime execution.
3. Production authenticated dogfood HTTP evidence passed in GitHub Actions run `27876229568` for commit `a3f7c399872a70332bd9e9465c05d11c9c2bd4ad`, image `uswccr.ccs.tencentyun.com/webopl/opl-webui:a3f7c39`, after dry-run, production apply, canary/smoke, and Production Availability Probe After Apply success. Production real ordinary chat and `chat.completed` audit evidence are confirmed by the production browser e2e lane in the same run. It remains secret-gated and not MedOPL runtime execution.
4. Production browser e2e evidence passed in GitHub Actions run `27876229568` through `production_browser_e2e=true` in `Cloud Rollout` with `apply=true`, `OPL_PRODUCTION_BROWSER_E2E=1`, `OPL_DOGFOOD_EMAIL`, `OPL_DOGFOOD_PASSWORD`, and `OPL_DOGFOOD_API_KEY`. The lane verified real Chromium login, API Key binding, ordinary research chat, `@论文`/`@基金` runtime gates, and sanitized audit evidence against `https://opl.medopl.cn`.
5. Production browser e2e run `27877811961` failed only at the real Chromium lane after apply, availability probe, and authenticated dogfood passed. The audit evidence shows `chat.upstream_failed` with `upstreamKind=response_header_timeout`, `upstreamHost=gflabtoken.cn`, and `upstreamModel=gpt-5.5`; this is a production slow-header budget issue, not an API key/model configuration issue. Current remediation is the configurable `OPL_CHAT_UPSTREAM_TIMEOUT_SECONDS` budget and a wider production browser wait window.
6. Production dogfood has an optional readonly projection lane: set `OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1` to verify runtime status, materials/deliverables, and billing summary projections after apply/canary/smoke. For run `27876229568`, `OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY` is not publicly confirmable from GitHub job metadata, so MedOPL readonly production coverage remains unclaimed until log or variable evidence is folded back.
7. Production availability probe succeeded in run `27876229568` through `Production Availability Probe After Apply`, sampling `/healthz`, `/readyz`, `/metricsz`, and `/` after the deployed image reached canary/smoke. It is not multi-node HA and not complete production-ready SaaS evidence.
8. Run `27878485498` was a release-order/image-missing issue, not product runtime failure: the workflow attempted image `uswccr.ccs.tencentyun.com/webopl/opl-webui:80689b1`, but the TCR manifest was absent. Current Cloud Rollout now inserts `production-image-preflight` after dry-run and before apply; `node scripts/cloud-rollout.mjs --image-preflight` fails closed as `image_missing_rollout_order_issue` with `imagePullOccurred=false` before `kubectl set image`.
9. Production observability baseline v1 is now wired into `/metricsz`, `scripts/cloud-rollout.mjs --availability-probe`, `contracts/web-release-profile.json`, and the no-secret scheduled workflow `.github/workflows/production-canary.yml`; release evidence is folded back to run `27876229568`, and scheduled canary first success is folded back to run `27874732529`. It produces no-secret endpoint sample summaries for release closeout and scheduled public canary entry evidence. Long-term operations readiness remains pending on dashboard, alerting, error budget, and rollback record. It is not HA, dashboard, alerting, error-budget, automatic rollback, or production-ready SaaS evidence.
10. Production HA is paused for the current single-node launch. The apply manifest intentionally stays at `replicas=1` so a one-worker TKE cluster can keep rolling out safely. The release contract keeps the future HA evidence boundary: `replicas=2`, two Ready Pods, distinct nodes, `PDB minAvailable=1`, topology spread constraints, rolling update `maxUnavailable=0`, at least two healthy Ingress/CLB backends, canary/smoke, and production availability probe before any multi-node HA claim.
11. Manual rollback evidence is now wired into `Cloud Rollout` through `rollback=true` and `node scripts/cloud-rollout.mjs --rollback`. It is production environment approved and reuses canary/smoke gates; it is not automatic rollback and has no production rollback run yet.
12. Commercial account lifecycle is now an authenticated readonly personal commercial status projection: `GET /api/account/commercial-status` returns personal account, tenant role, active lifecycle state, `teamReadiness=single_user_owner`, allowed next action `view_medopl_billing`, and forbidden team/invite/RBAC/payment/billing-source mutation flags. The browser settings surface renders lifecycle, team readiness, quota, and audit summaries. Current work can only claim the authenticated readonly personal commercial status projection; team invite/RBAC/pricing/subscription/payment expansion requires a real consumer, contract, and registered tests while preserving MedOPL billing authority. It must not grow this into commercial admin, billing owner, workspace-visible UI, storage, node pool, or runtime ownership.
13. User-facing reliability status is now rendered in the browser shell for login/key/quota/runtime/upstream/service/network states. It is a sanitized UX view model only and must not include raw provider errors, API keys, DB URLs, private state, or artifact bodies.
14. Frontend engineering stays static HTML/CSS/ESM until browser evidence and product complexity justify React/Vite/TypeScript migration.
15. Retired Go task projection and OPL task-route surfaces must stay tombstoned; current DB canary validates the Web app schema.
16. UI/UX Product Depth now requires Figma MCP before further UI work. Current source evidence is pinned to Figma Make file `E8nYfNFc2D9P01FYZ8UwBW`, node `0:1`, with `src/app/App.tsx`, `src/styles/theme.css`, and `src/styles/index.css` as source files. Adopted patterns are left rail, account popover, API key/resource gate, prompt command center, research skill launcher, chat/task view, right inspector tabs, and running/blocked turn state. Rejected patterns are Drive/storage ownership, runtime truth ownership, founder-plan upsell, unlimited compute, dashboard/CRM primary app, and generic office/content/code/video skills. The repo-local visual baseline is now captured by real Chromium/CDP desktop and mobile screenshots under git-ignored `.runtime/browser-visual/`, plus browser assertions for overflow, inspector visibility, and hidden-overlay input safety. Full responsive visual QA, accessibility closeout, production visual polish, and owner receipt remain pending.
17. Runtime execution remains `not_admitted`: no OPL install, repair, module exec, mutation, artifact body, private state, or domain verdict until Go-side runtime execution contract, registered eval, allowlist, human authorization boundary, tenant audit, and artifact/body authority contract exist.
18. Operations maturity currently means baseline plus future evidence contracts: dashboard, alerting, error budget, and rollback record remain `contract_required`.
19. Current non-HA gap phases are now explicit step gates rather than a broad wish list: UI/UX has advanced from repo-local visual baseline to `responsive_visual_qa` and stays partial until owner-reviewed responsive/accessibility evidence exists; MedOPL readonly foldback is blocked on secret-gated production evidence; runtime execution is blocked on human owner receipt plus Go-side contract/eval; commercial depth is blocked on buyer/operator workflow plus contract/tests; operations maturity is blocked on operations-owner selection plus a concrete contract/eval.

## Worktree Lane Model

Use one worktree per independent slide or product gap. Each lane must declare:

- objective
- source of truth
- allowed write set
- forbidden write set
- verification commands
- stop condition
- foldback target

The root checkout stays on `main` for reading, review, final absorption, verification, commit, and push. Subagents may implement inside isolated worktrees only when their write sets do not overlap.

## Next Agent Context

Start from:

1. `README.md`
2. `AGENTS.md`
3. `TASTE.md`
4. `docs/project.md`
5. `docs/status.md`
6. `docs/decisions.md`
7. `docs/architecture.md`
8. `docs/invariants.md`
9. `docs/docs_portfolio_consolidation.md`
10. `contracts/*.json`

Then pick exactly one gap. Do not create `changes/active` packages. Do not add new recurring docs directories unless the new area has a stable owner, purpose, state, machine boundary, and active consumer.

For goal-driven work, check `contracts/web-gap-phase-registry.json` before editing. If the current phase is blocked by production evidence, owner receipt, or missing contract/eval, record `blocked` instead of claiming completion.

## Foldback Rules

- Product or API truth folds back to contracts and source.
- Current claim and cannot-claim changes fold back to `docs/status.md`.
- Durable decisions fold back to `docs/decisions.md`.
- Retired surfaces fold back to `docs/history/tombstones/README.md`.
- Verification evidence folds back to tests, scripts, deploy artifacts, and compressed process history only when the evidence changes the release or lifecycle claim.
- Production rollout completion triggers `scripts/release-evidence-sync.mjs` or equivalent compressed release evidence, then foldback to `contracts/web-release-profile.json`, `docs/status.md`, and this baton; active docs must not keep stale "not yet executed" claims after a GitHub run exists.
