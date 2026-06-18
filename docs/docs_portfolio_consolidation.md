# OPL-WebUI Documentation Portfolio

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
4. `docs/status.md`
5. `docs/architecture.md`
6. `docs/invariants.md`
7. `docs/decisions.md`
8. `docs/active/README.md`
9. `specs/*`

## Directory Roles

- `docs/` root keeps the core current truth and this portfolio guide.
- `docs/active/` keeps current phase truth and can/cannot-claim status.
- `specs/` keeps durable product, runtime, and source requirements.
- `docs/history/` keeps retired routes, dated plans, tombstones, and provenance.
- `changes/active/` keeps short-lived active workbench packages.
- `changes/archive/` keeps compact closeout history only.

## Anti-Pollution Rules

- Do not keep retired positioning in active docs for path compatibility.
- Move retired routes to history or delete them.
- New recurring doc areas need an index that states what belongs there.
- When a doc moves, update active/reference links and leave tombstones only where they prevent revival.
