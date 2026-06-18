# Figma Make WebUI Alignment Eval Plan

- owner: product-engineering owner
- state: active

## Targeted

```bash
node --test tests/smoke/web-demo-shell.test.mjs tests/contract/one-person-lab-web-data.test.mjs
```

Expected:

- Figma shell smoke assertions pass.
- Web data contract still confirms fixed base_url, hidden workspace and MedOPL Runtime gate.

## Full Gates

```bash
npm run verify
npm run gate:review
npm run repo:bloat
sentrux check .
```

## Cannot Claim

- No cloud rollout is performed in this change.
- No production Figma visual QA evidence until user rolls out.
- No real runtime, storage, billing or OPL execution is introduced.
