# Figma Make WebUI Alignment Review

- owner: product-engineering owner
- state: active

## Review Notes

- Kept the repo tech stack unchanged: static `apps/web/index.html`, `apps/web/styles/v3.css`, and `apps/web/src/onePersonLabWeb.mjs`.
- Did not import or scaffold Figma Make's React/Vite/Tailwind/shadcn stack.
- Replaced the old topbar-first shell with a left-sidebar app shell, central prompt command center, skill launcher, account dock, account popover, and MedOPL Runtime card.
- Preserved existing API contracts: `/api/session/current`, `/api/settings/model-provider`, `/api/chat/conversations`, `/api/opl/snapshot`, and `/api/chat`.
- Preserved product boundaries: no user-custom base_url, no WebUI-owned runtime/storage/billing/node-pool lifecycle, no fake OPL execution.
- `apps/web/src/onePersonLabWeb.mjs` is now 294 lines. This crosses the 260-line review signal but stays below 400. It is kept as one file for this UI-only gap because splitting would add durable files while the repo is at the file budget; next behavior-bearing JS change should extract shell metadata/DOM binding if the file keeps growing.

## Risks To Check

- Figma runtime/drive wording must not violate OPL-WebUI product boundary. Checked by smoke and contract tests.
- Existing auth/API Key/chat contracts must remain unchanged. Checked by targeted and full verify.
- UI should not introduce hidden compatibility layers or new framework dependencies. Checked by diff and package dependency tests.
