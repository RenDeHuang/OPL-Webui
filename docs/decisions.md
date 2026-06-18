# OPL-WebUI Decisions

- owner: product-engineering owner
- purpose: current durable decisions and tradeoffs.
- state: active_truth
- machine boundary: human-readable; tests and specs are authoritative.

## Decisions

### OPL-WebUI Is Not MedOPL

OPL-WebUI remains the public OPL front entry. MedOPL remains the commercial resource and billing back office. OPL-WebUI can consume projections but must not own resource lifecycle or billing truth.

### Go Control Plane Is The Backend Entry

The WebUI calls the Go control plane over HTTP. Node API adapters and old MVP routes are retired from the public mainline.

### Runtime Work Starts With Status And Refs

Future OPL/MedOPL work must start with status bridge or refs-only projections. Execution and mutation require separate contracts, evals, whitelists, and human authorization boundaries.

### Governance Before Feature Expansion

The repository must install OPL-style lifecycle governance before broad commercial gap development. Each future goal must include cleanup, tests, registry updates, and machine gates.
