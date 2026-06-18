# one-person-lab-web-truth-reset Proposal

- owner: product-engineering owner
- purpose: reset current truth so One Person Lab Web contracts lead docs and implementation.
- state: active_change
- machine boundary: contracts, tests, source, scripts, and gates.

## Why

The repo narrative is correct, but product truth is split across Markdown specs, active docs, tests, and source. That lets prose move faster than code. This phase makes `contracts/*.json` the durable machine truth for One Person Lab Web and retires old prose truth surfaces that would keep OPL-WebUI, cloud MVP, and legacy spec wording alive as competing owners.

## Scope

- Add One Person Lab Web machine contracts for product profile, page states, HTTP API, runtime bridge, and release profile.
- Update existing tests so they read contracts instead of durable prose specs.
- Retire old active prose truth files replaced by contracts.
- Update core docs to explain contracts, not duplicate them.

## Non-Goals

- No React rewrite.
- No MedOPL runtime bridge implementation.
- No production rollout.
- No compatibility layer for old specs.
