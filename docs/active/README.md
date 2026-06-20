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
2. Research-task-first UX state is owned by the page-state contract, `RESEARCH_TASK_INTENTS`, and `chatStateForPrompt`; the browser runner now clicks the `research_direction` task template before ordinary chat fallback.
3. Production authenticated dogfood HTTP evidence passed in GitHub Actions run `27853332374` for commit `b312f9c7af364c1ea2e9da5d57085279435f4a18`, image `uswccr.ccs.tencentyun.com/webopl/opl-webui:b312f9c`, after dry-run, production apply, canary/smoke, and Production Availability Probe After Apply success. The dogfood job passed with production real ordinary chat and audit evidence. It remains secret-gated, not browser e2e, and not MedOPL runtime execution.
4. Production browser e2e harness is ready but not yet executed: set `production_browser_e2e=true` in `Cloud Rollout` with `apply=true` to run real Chromium against `https://opl.medopl.cn` after production apply. It uses `OPL_PRODUCTION_BROWSER_E2E=1` plus `OPL_DOGFOOD_EMAIL`, `OPL_DOGFOOD_PASSWORD`, and `OPL_DOGFOOD_API_KEY`; it must not print raw secrets or claim MedOPL runtime execution.
5. Production dogfood has an optional readonly projection lane: set `OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1` to verify runtime status, materials/deliverables, and billing summary projections after apply/canary/smoke. For run `27853332374`, `OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY` is not publicly confirmable from GitHub job metadata, so MedOPL readonly production coverage remains unclaimed until log or variable evidence is folded back.
6. Production availability probe succeeded in run `27853332374` through `Production Availability Probe After Apply`, sampling `/healthz`, `/readyz`, `/metricsz`, and `/` after the deployed image reached canary/smoke. It is not authenticated dogfood, not production browser e2e, not multi-node HA, and not complete production-ready SaaS evidence.
7. Commercial account lifecycle is now a readonly Web account projection: `GET /api/account/commercial-status` returns personal account, tenant role, active lifecycle state, and forbidden mutation flags. It must not grow into team invite, RBAC, payment, billing owner, workspace-visible UI, storage, node pool, or runtime ownership without a new owner/consumer/test gate.
8. Frontend engineering stays static HTML/CSS/ESM until browser evidence and product complexity justify React/Vite/TypeScript migration.
9. Retired Go task projection and OPL task-route surfaces must stay tombstoned; current DB canary validates the Web app schema.

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
