# OPL-WebUI Project

- owner: product-engineering owner
- purpose: current project role and product boundary.
- state: active_truth
- machine boundary: human-readable; API behavior, specs, and tests are authoritative.

OPL-WebUI is the public OPL front WebUI at `opl.medopl.cn`. It gives users a low-friction ChatGPT-like One Person Lab entry where they log in, bind their own API Key, and use ordinary chat through the fixed `https://gflabtoken.cn/v1` gateway.

MedOPL owns recharge, runtime, node pool, storage, billing, and resource back office truth. OPL-WebUI may consume MedOPL status projections, but it must not become the billing source of truth, API gateway, storage owner, or runtime owner.

The current implementation is a static web shell served by the Go control plane. Runtime-requiring `@OPL` capabilities stop at a MedOPL Runtime gate until a Go-side contract, eval, whitelist, and authorization boundary exists.
