# Closeout

- owner: post-go-cleanup
- state: pending

## Summary

- Removed retired Node-era core/adapter packages, unused OPL contracts, and old adapter/schema tests.
- Updated AGENTS, specs, Sentrux rules, and test registry to make Go control plane the only backend business surface.

## Verification

- `npm run verify:contract`: pass
- `npm run repo:bloat`: pass, 46 files / 22 markdown / 9 tests before archive

## Cannot Claim

- 不能声明真实 OPL execution、真实登录、多租户数据库、队列、计费或生产部署。
