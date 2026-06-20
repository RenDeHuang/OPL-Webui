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

1. Browser-level e2e runner executed successfully through `npm run verify:browser` with real Chromium/CDP for register, login, API Key binding, ordinary chat fallback, `@论文`/`@基金` gate, and sanitized audit evidence. It is now a CI release gate before image release; future non-CI hosts still need Chrome/Chromium via `OPL_BROWSER_BINARY` or system discovery.
2. Research-task-first UX state is owned by the page-state contract, `RESEARCH_TASK_INTENTS`, `RESEARCH_RESULT_SECTIONS`, and `chatStateForPrompt`; the browser runner now clicks the `research_direction` task template before ordinary chat fallback, verifies the structured `@科研` result sections, and verifies `@论文`/`@基金` runtime task cards. This remains a browser UI view model and must not become artifact body, storage, or runtime execution.
3. Production authenticated dogfood HTTP evidence passed in GitHub Actions run `27866718228` for commit `3e69e3d38ed60b9aea96bd7d9c76ad65fe481135`, image `uswccr.ccs.tencentyun.com/webopl/opl-webui:3e69e3d`, after dry-run, production apply, canary/smoke, and Production Availability Probe After Apply success. The dogfood job passed with production real ordinary chat and audit evidence. It remains secret-gated and not MedOPL runtime execution.
4. Production browser e2e evidence passed in GitHub Actions run `27866718228` through `production_browser_e2e=true` in `Cloud Rollout` with `apply=true`, `OPL_PRODUCTION_BROWSER_E2E=1`, `OPL_DOGFOOD_EMAIL`, `OPL_DOGFOOD_PASSWORD`, and `OPL_DOGFOOD_API_KEY`. The lane verified real Chromium login, API Key binding, ordinary research chat, `@论文`/`@基金` runtime gates, and sanitized audit evidence against `https://opl.medopl.cn`.
5. Production dogfood has an optional readonly projection lane: set `OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1` to verify runtime status, materials/deliverables, and billing summary projections after apply/canary/smoke. For run `27866718228`, `OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY` is not publicly confirmable from GitHub job metadata, so MedOPL readonly production coverage remains unclaimed until log or variable evidence is folded back.
6. Production availability probe succeeded in run `27866718228` through `Production Availability Probe After Apply`, sampling `/healthz`, `/readyz`, `/metricsz`, and `/` after the deployed image reached canary/smoke. It is not multi-node HA and not complete production-ready SaaS evidence.
7. Production observability baseline v1 is now wired into `/metricsz`, `scripts/cloud-rollout.mjs --availability-probe`, and `contracts/web-release-profile.json`, and folded back to run `27866718228`. It produces no-secret endpoint sample summaries for release closeout; long-term operations readiness remains pending on scheduled canary, dashboard, alerting, error budget, and rollback record. It is not HA, long-term canary, dashboard, alerting, or error-budget evidence.
8. Production HA readiness manifest is ready but not cloud-executed. The deploy manifest declares `replicas=2`, `PDB minAvailable=1`, topology spread constraints, soft pod anti-affinity, and rolling update `maxUnavailable=0`. The release contract still requires two Ready Pods, distinct nodes, at least two healthy Ingress/CLB backends, canary/smoke, and production availability probe before any multi-node HA claim.
9. Manual rollback evidence is now wired into `Cloud Rollout` through `rollback=true` and `node scripts/cloud-rollout.mjs --rollback`. It is production environment approved and reuses canary/smoke gates; it is not automatic rollback and has no production rollback run yet.
10. Commercial account lifecycle is now a readonly Web account projection: `GET /api/account/commercial-status` returns personal account, tenant role, active lifecycle state, `teamReadiness=single_user_owner`, allowed next action `view_medopl_billing`, and forbidden team/invite/RBAC/payment/billing-source mutation flags. The browser settings surface renders lifecycle, team readiness, quota, and audit summaries. It must not grow into team invite, RBAC, payment, billing owner, workspace-visible UI, storage, node pool, or runtime ownership without a new owner/consumer/test gate.
11. User-facing reliability status is now rendered in the browser shell for login/key/quota/runtime/upstream/service/network states. It is a sanitized UX view model only and must not include raw provider errors, API keys, DB URLs, private state, or artifact bodies.
12. Frontend engineering stays static HTML/CSS/ESM until browser evidence and product complexity justify React/Vite/TypeScript migration.
13. Retired Go task projection and OPL task-route surfaces must stay tombstoned; current DB canary validates the Web app schema.

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

## Foldback Rules

- Product or API truth folds back to contracts and source.
- Current claim and cannot-claim changes fold back to `docs/status.md`.
- Durable decisions fold back to `docs/decisions.md`.
- Retired surfaces fold back to `docs/history/tombstones/README.md`.
- Verification evidence folds back to tests, scripts, deploy artifacts, and compressed process history only when the evidence changes the release or lifecycle claim.
- Production rollout completion triggers `scripts/release-evidence-sync.mjs` or equivalent compressed release evidence, then foldback to `contracts/web-release-profile.json`, `docs/status.md`, and this baton; active docs must not keep stale "not yet executed" claims after a GitHub run exists.
