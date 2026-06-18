# Line Budget Policy Calibration Design

- owner: product-engineering owner
- purpose: implementation design for the OPL-like line budget policy.
- state: active_change
- machine boundary: `scripts/repo-bloat-audit.mjs` output schema and tests.

## Design

`scripts/repo-bloat-audit.mjs` keeps hard `budgets` for durable file count, markdown docs, scripts, and tests. It removes `maxFileLines` from hard default budgets.

The script emits a new `lineBudgetPolicy` object:

- `warning: 260`
- `reviewRequired: 400`
- `splitRequired: 600`
- `defaultMode: advisory`
- `strictMode: boolean`
- `exemptions: ["generated", "fixture", "schema"]`

The script also emits `lineBudgetFindings`, including file path, line count, severity, and whether the file is exempt. In default mode, findings are visible but do not fail the process. In strict mode, non-exempt `splitRequired` findings fail.

Strict mode is enabled by `--strict-lines` or `OPL_WEBUI_LINE_BUDGET_STRICT=1`.

## Boundaries

This phase changes policy plumbing only. It does not split `apps/web/src/onePersonLabWeb.mjs`; that belongs to a later structure phase if the file begins blocking clear feature work.
