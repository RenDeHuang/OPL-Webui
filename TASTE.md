# One Person Lab Web Engineering Taste

- owner: product-engineering owner
- purpose: durable engineering taste for AI-assisted development in this repo.
- state: active_truth
- machine boundary: human-readable guidance; tests and scripts enforce concrete rules.

## Principles

- Ideal state first: define the target product/control-plane boundary before coding.
- One gap per change: do not bundle auth, runtime, billing, UI, and deploy in one change.
- Cleanup is part of development: every change must remove, rename, or explicitly preserve replaced surfaces.
- No compatibility by default: do not keep old routes, schemas, tests, docs, aliases, or fake data unless a real consumer and retirement plan exist.
- No fake capability: runtime, billing, storage, OPL execution, and production claims require contracts and evals.
- Machine truth wins: source, API behavior, contracts, fixtures, scripts, and tests outrank prose.
- Small files stay purposeful: line count is only a hard hygiene boundary at 1000 lines unless generated, fixture, or schema material. Below that boundary, split files because responsibilities are clearer, not because an arbitrary small number was crossed.

## Default Development Loop

1. Read `AGENTS.md`, this file, `docs/active/README.md`, and relevant `contracts/*.json`.
2. Create or update one `changes/active/<change-id>/` package.
3. Write or update tests first and register them.
4. Implement the smallest behavior.
5. Retire replaced code and docs in the same change.
6. Run targeted tests, then full gates.
7. Close out with verification evidence and cannot-claim boundaries.
