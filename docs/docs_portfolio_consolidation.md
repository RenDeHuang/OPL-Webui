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

## Reading Order

1. `AGENTS.md`
2. `TASTE.md`
3. `docs/project.md`
4. `docs/architecture.md`
5. `docs/invariants.md`
6. `docs/active/README.md`
7. `contracts/*.json`

## Directory Roles

- `docs/` root keeps the core current truth and this portfolio guide.
- `docs/active/` keeps current phase truth and can/cannot-claim status.
- `contracts/` 是 One Person Lab Web 的 durable machine truth for product boundary, page state, API, runtime gate, and release readiness.
- contracts/ 是 One Person Lab Web 的 durable machine truth；Markdown prose only explains it.
- `docs/history/` keeps retired routes, dated plans, tombstones, and provenance.
- `changes/active/` keeps short-lived active workbench packages.
- `changes/archive/` keeps compact closeout history only.

## Lightweight OPL-Inspired Taxonomy

This repo copies One Person Lab's development discipline, not its directory volume. 不要复制 one-person-lab 的目录体量；only add a recurring area when it has a stable owner, purpose, state, and machine boundary.

- `docs/product/`: add only for stable product journey, pricing, onboarding, or user-surface truth that no longer fits the core docs.
- `docs/runtime/`: add only for stable OPL, MedOPL, runtime, canary, or boundary material. It must not imply this repo owns the runtime framework.
- `docs/policies/`: add only for durable AI, OPL action, security, privacy, or data-governance policy.
- `contracts/`: keep durable machine-readable API, DTO, allowlist, schema, page-state, product-boundary, runtime-gate, or release-profile surfaces.

Docs explain contracts; they do not replace them. If prose and contract disagree, update the contract or mark the prose as stale and retire it in the same change.

## Anti-Pollution Rules

- Do not keep retired positioning in active docs for path compatibility.
- Move retired routes to history or delete them.
- New recurring doc areas need an index that states what belongs there.
- When a doc moves, update active/reference links and leave tombstones only where they prevent revival.
