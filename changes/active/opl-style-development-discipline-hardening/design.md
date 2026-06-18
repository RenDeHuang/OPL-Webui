# OPL-Style Development Discipline Hardening Design

- owner: product-engineering owner
- purpose: implementation design for governance hardening.
- state: active_change
- machine boundary: docs and health tests.

## Design

`tests/health/governance-hardening.test.mjs` is extended first. It expects:

- `AGENTS.md` to name ideal-state-first development.
- `AGENTS.md` to forbid compatibility pollution.
- `AGENTS.md` to define formal development triggers.
- `AGENTS.md` to include worktree/subagent discipline.
- `AGENTS.md` to require Plan Completion Audit for complete-landed requests.
- `docs/docs_portfolio_consolidation.md` to define a lightweight OPL-inspired taxonomy.

Then the docs are updated to satisfy those tests. This keeps the change narrow and machine-visible without adding product code.

## Comparison Boundary

One Person Lab is a framework/runtime repo. OPL-WebUI is a public WebUI plus Go control plane. The repo should copy the discipline, not the full taxonomy size.
