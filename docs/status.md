# OPL-WebUI Status

- owner: product-engineering owner
- purpose: current can-claim/cannot-claim and next development posture.
- state: active_truth
- machine boundary: human-readable; tests, deploy evidence, and API behavior are authoritative.

## Current State

- Product boundary is coherent: public OPL front WebUI, not MedOPL back office.
- Local dogfood contracts cover account, API Key binding, ordinary chat, quota/audit guardrails, and MedOPL Runtime gate.
- Production evidence exists for public health/readiness/homepage and unauthenticated guards.
- The repository is at its bloat budget edge and must prioritize cleanup before broad feature expansion.

## Next Posture

All future development is goal-driven but lifecycle-gated. Each gap must pass through document lifecycle, code retirement, test registration, and machine gates before completion can be claimed.

## Cannot Claim

- Full production-ready SaaS.
- Real MedOPL runtime status bridge.
- Real OPL execution or mutation.
- Object storage, complete billing, or payment provider.
- Complete authenticated production e2e for registration, API Key binding, chat, quota, and audit.
