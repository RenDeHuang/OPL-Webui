# OPL-WebUI Engineering Taste

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
- Small files stay small: line count is a structural signal, not a default hard blocker. Around 260 lines prompts review, 400 lines needs an explicit reason to keep growing, and 600 lines should split in strict structure work unless generated, fixture, or schema material.

## Default Development Loop

1. Read `AGENTS.md`, this file, `docs/active/README.md`, and relevant `specs/*`.
2. Create or update one `changes/active/<change-id>/` package.
3. Write or update tests first and register them.
4. Implement the smallest behavior.
5. Retire replaced code and docs in the same change.
6. Run targeted tests, then full gates.
7. Close out with verification evidence and cannot-claim boundaries.
