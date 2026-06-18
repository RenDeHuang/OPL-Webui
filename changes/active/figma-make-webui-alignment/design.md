# Figma Make WebUI Alignment Design

- owner: product-engineering owner
- state: active

## Architecture

Implement a static shell alignment in the existing `apps/web` surface:

- `apps/web/index.html` owns durable semantic markup.
- `apps/web/styles/v3.css` owns visual layout and responsive behavior.
- `apps/web/src/onePersonLabWeb.mjs` owns state, prompts, auth/API key bindings, chat submit, runtime gate and small UI interactions.

No new framework, compatibility layer or backend route is introduced.

## UI Shape

- Fixed left sidebar with OPL mark, New Chat, navigation items and account dock.
- Main surface with centered `One Person Lab` heading, large prompt command center and grouped skill launcher.
- Top-right MedOPL Runtime card, worded as a gate/deep link rather than owned runtime.
- Settings remain the canonical account/API Key surface, visually attached to account dock and hash navigation.
- Capabilities remain Foundry-style and continue to distinguish chat-ready versus runtime-gated work.

## Data Flow

- `loadOnePersonLabWebState()` still reads current session/provider/conversations/readonly OPL snapshot.
- `saveAPIKey()` still sends only `{ apiKey }` to `/api/settings/model-provider`.
- `sendChatMessage()` still calls `/api/chat`.
- Prompt shortcuts only prefill text; runtime-required prompts show the MedOPL gate before any fake execution.

## Cleanup

- Retire old topbar-first CSS/markup from the active shell.
- Keep no hidden React-compatible adapter.
- Keep no fake cloud drive, fake billing or fake runtime execution affordance.
