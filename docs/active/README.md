# Active Gap Baton

- owner: product-engineering owner
- purpose: current gap, lane handoff, and next-agent context for parallel worktree development.
- state: active_support
- machine boundary: human-readable baton only; contracts, source, tests, scripts, API behavior, deploy artifacts, and Sentrux rules are authoritative.

## Role

`docs/active/` keeps the current Web product gap and worktree lane baton. It is not a process package, not a second status file, and not a log archive. When a lane closes, fold durable facts back into `docs/status.md`, `docs/decisions.md`, `contracts/`, source, tests, deploy artifacts, or `docs/history/`.

## Current Truth

One Person Lab Web is the multi-tenant SaaS Web edition of One Person Lab. It owns the browser product entry for research staff, master's students, PhD students, principal investigators, and research teams.

Current product work should move from fixed truth into engineering evidence:

1. Browser-level e2e for register, login, API Key binding, ordinary chat fallback, `@论文`/`@基金` gate, and sanitized audit evidence.
2. Research-task-first UX for the Web entry and input flow.
3. Production authenticated dogfood behind explicit secrets and switches.
4. Frontend engineering upgrade decision only after browser evidence and product closure exist.

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
