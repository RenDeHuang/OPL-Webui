# Figma Make WebUI Alignment Spec Delta

- owner: product-engineering owner
- state: active
- machine boundary: `apps/web/*`、`tests/smoke/web-demo-shell.test.mjs`、`tests/contract/one-person-lab-web-data.test.mjs`

## Product Delta

Current truth remains OPL-WebUI public front:

- WebUI is the public One Person Lab web entry.
- Go control plane remains the only backend business entry.
- MedOPL owns runtime、node pool、storage、billing 和 resource lifecycle。
- WebUI may show MedOPL Runtime gate and deep link, but must not claim it owns those resources.

This change only updates the front-end presentation:

- Replace topbar-first IA with left-sidebar app shell.
- Add Figma-style skill groups:
  - OPL
  - 办公套件
  - 设计与代码
  - 内容创作
  - 工具
- Add account dock/status surface linked to existing Settings/auth/API Key controls.
- Add runtime CTA card that explicitly opens MedOPL instead of claiming WebUI-owned runtime.

## Cannot Claim

- Figma pixel-perfect implementation.
- React/Figma Make codebase adoption.
- Real OPL execution.
- WebUI-owned storage, billing, node pool or runtime lifecycle.
- Production rollout evidence for this UI until the user rolls out and verifies cloud.
