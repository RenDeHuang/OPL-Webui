# One Person Lab Web Invariants

- owner: product-engineering owner
- purpose: hard constraints that future changes must not break.
- state: active_truth
- machine boundary: human-readable; contracts, tests, and source are authoritative.

## Product Invariants

- Users cannot customize `base_url`; it remains `https://gflabtoken.cn/v1`.
- Raw API Keys must not be returned to the browser, logged, or stored unencrypted.
- Ordinary chat can call the fixed OpenAI-compatible upstream only after auth, API Key binding, and quota precheck.
- Contract-defined runtime markers must not fake execution.
- Workspace/runtime/node pool/storage/billing concepts stay hidden from the public WebUI unless a future contract admits a user-facing projection.

## Engineering Invariants

- No current truth in per-change process packages; fixed truth lives in README, core docs, contracts, source, tests, scripts, and API/CLI behavior.
- No user-visible behavior change before the relevant contract is updated.
- No page behavior change before `contracts/web-page-state-matrix.json` is updated.
- No new behavior without test coverage and registry entry.
- No test taxonomy outside the registry: lifecycle role, cost, risk triggers, verify suites, and regression retirement metadata belong in `scripts/test-classification.mjs`.
- No compatibility layer without a real consumer, explicit contract, and retirement plan.
- No active retired vocabulary unless it is a fail-closed guard or a history/archive reference.
- No completion claim without fresh verification evidence.
- Docs cannot claim beyond contracts, tests, source, scripts, API behavior, deploy artifacts, and verified historical evidence.
