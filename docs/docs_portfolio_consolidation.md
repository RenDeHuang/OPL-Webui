# One Person Lab Web Documentation Portfolio

- owner: product-engineering owner
- purpose: documentation lifecycle and placement governance.
- state: active_truth
- machine boundary: human-readable; tests and source enforce concrete behavior.

## Summary

`docs/` is a portfolio, not a flat file dump. Every long-lived document must declare:

1. `owner`
2. `purpose`
3. `state`
4. `machine boundary`

Markdown prose is not a stable machine interface. Machine behavior must use source, contracts, fixtures, scripts, tests, API behavior, or semantic IDs.

Test lifecycle prose must point back to the registry. `scripts/test-classification.mjs` owns lane membership, `cost`, `lifecycleRole`, `riskTriggers`, `verifySuites`, and regression retirement metadata; docs only explain those machine rules.

## Reading Order

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

## Directory Roles

- `docs/` root keeps the core current truth and this portfolio guide.
- `docs/active/` keeps the current gap baton, worktree lane context, next-agent prompt, and foldback target. It is active support, not machine truth and not a process log.
- `contracts/` 是 One Person Lab Web 的 durable machine truth for product boundary, page state, API, runtime gate, and release readiness.
- contracts/ 是 One Person Lab Web 的 durable machine truth；Markdown prose only explains it.
- `docs/history/` keeps retired routes, dated plans, tombstones, process closeouts, and provenance.
- `docs/history/tombstones/` records retired surfaces that must not return as active owner surfaces.

## Lightweight OPL-Inspired Taxonomy

This repo copies One Person Lab's development discipline, not its directory volume. 不要复制 one-person-lab 的目录体量；only add a recurring area when it has a stable owner, purpose, state, and machine boundary.

- `docs/product/`: add only for stable product journey, pricing, onboarding, or user-surface truth that no longer fits the core docs.
- `docs/runtime/`: add only for stable OPL, MedOPL, runtime, canary, or boundary material. It must not imply this repo owns the runtime framework.
- `docs/policies/`: add only for durable AI, OPL action, security, privacy, or data-governance policy.
- `docs/active/`: keep only the current baton for gap-driven worktree lanes and next-agent context.
- `docs/history/tombstones/`: keep only no-resurrection records for retired surfaces.
- `contracts/`: keep durable machine-readable API, DTO, allowlist, schema, page-state, product-boundary, runtime-gate, or release-profile surfaces.

Docs explain contracts; they do not replace them. If prose and contract disagree, update the contract or mark the prose as stale and retire it in the same change.

## Retired Workflow

`changes/active` and `changes/archive` are retired as active development entry points. Historical closeouts live at `docs/history/process/closeouts.md` for provenance only. Future work should update fixed truth entries, contracts, source, tests, scripts, and deploy artifacts directly.

## Active Baton Lifecycle

Use `docs/active/README.md` when a goal needs worktree lane coordination or next-agent handoff. Keep it short:

1. current truth
2. objective
3. allowed write set
4. forbidden write set
5. verification
6. stop condition
7. foldback target

When the lane closes, fold durable truth back to core docs, contracts, source, tests, scripts, deploy artifacts, or history. Do not preserve daily logs or process transcripts as active docs.

## Anti-Pollution Rules

- Do not keep retired positioning in active docs for path compatibility.
- Move retired routes to history or delete them.
- New recurring doc areas need an index that states what belongs there.
- When a doc moves, update active/reference links and leave tombstones only where they prevent revival.
