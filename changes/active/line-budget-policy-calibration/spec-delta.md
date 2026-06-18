# Line Budget Policy Calibration Spec Delta

- owner: product-engineering owner
- purpose: describe the durable spec change for line budget enforcement.
- state: active_change
- machine boundary: bloat audit JSON and health tests.

## Previous Rule

`repo:bloat` failed when the largest tracked file exceeded `260` lines.

## New Rule

Line count is a structural signal by default:

- `260` lines: advisory review signal.
- `400` lines: explanation expected before adding more behavior.
- `600` lines: split required in strict mode unless the file is generated, fixture, or schema material.

Default `repo:bloat` remains a hard gate for repository growth budgets, but line count does not block ordinary development unless strict line checking is requested.

## Invariants

- No compatibility layer is introduced.
- File count, durable markdown count, script count, and test count remain hard budgets.
- Active change docs remain excluded from durable file and durable markdown counts.
