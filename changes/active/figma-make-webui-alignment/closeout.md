# Figma Make WebUI Alignment Closeout

- owner: product-engineering owner
- state: active

## Evidence

- RED verified:
  - `node --test tests/smoke/web-demo-shell.test.mjs tests/contract/one-person-lab-web-data.test.mjs`
  - Expected failures before implementation:
    - missing `figmaMakeSource` / shell metadata in `createOnePersonLabViewModel`
    - missing `figma-make-webui-alignment` / `sidebar-shell` / `skill-launcher` shell markers in `apps/web/index.html`
- Targeted GREEN:
  - `node --test tests/smoke/web-demo-shell.test.mjs tests/contract/one-person-lab-web-data.test.mjs`
  - Result: 10 tests, 10 pass.
- Full verification:
  - `npm run verify`
  - Result: health 21/21 pass, contract 40/40 pass, Go packages pass, smoke 6/6 pass.
- Review gate:
  - `npm run gate:review`
  - Result: diff hygiene, repo bloat, Go tests, current verify all pass.
- Bloat:
  - `npm run repo:bloat`
  - Result: ok, durable files `85/85`, tests `17/17`, scripts `5/8`, markdown docs `17/24`, active change docs `28`, largest file `apps/web/src/onePersonLabWeb.mjs` at 294 lines.
- Structural gate:
  - `sentrux check .`
  - Result: 9 rules checked, Quality `7365`, all rules pass.
- Diff hygiene:
  - `git diff --check`
  - Result: pass.

## Cleanup

- Retired active topbar-first shell markup and CSS from `apps/web/index.html` and `apps/web/styles/v3.css`.
- Kept no React compatibility layer, no Figma runtime adapter, no new dependency, no new test file.
- Kept fixed `https://gflabtoken.cn/v1` provider surface and existing Go control-plane APIs.
- Added smoke guards against `Drive`、`云盘`、`无限计算资源`、`创始人计划` and fake storage/billing/runtime execution wording in active UI.

## Cannot Claim

- No cloud rollout was performed in this change.
- No production evidence exists for this UI until GitHub/cloud rollout is executed separately.
- No Figma pixel-perfect visual QA was performed.
- Local HTTP smoke was attempted on `19191`, but no valid listener evidence was obtained; `18080` was occupied by an unrelated uvicorn app and was not used as evidence.
- No real OPL execution, runtime creation, storage, billing, node pool lifecycle or MedOPL bridge was added.
