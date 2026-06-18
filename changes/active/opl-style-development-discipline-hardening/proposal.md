# OPL-Style Development Discipline Hardening Proposal

- owner: product-engineering owner
- purpose: align OPL-WebUI formal development discipline with the lightweight OPL-style rules.
- state: active_change
- machine boundary: `AGENTS.md`, `docs/docs_portfolio_consolidation.md`, and governance health tests.

## Why

The repo already requires lifecycle, cleanup, test registration, and gates for formal changes. It should now make the OPL-style intent explicit: ideal-state first, retired surfaces removed promptly, no compatibility pollution, and formal development triggered by source, docs, contract, tests, scripts, deploy, specs, or API behavior changes.

## Scope

- Harden `AGENTS.md` wording for ideal-state and cleanup rules.
- Add lightweight worktree/subagent discipline inspired by One Person Lab.
- Add lightweight taxonomy guidance without copying One Person Lab's directory volume.
- Add tests that keep these rules visible.

## Non-goals

- No product behavior change.
- No source structure refactor.
- No new runtime framework or OPL stage implementation.
- No compatibility layer.
