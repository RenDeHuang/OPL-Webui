# OPL Readonly Bridge Closeout

## Summary

- Go control plane 新增 `/api/opl/snapshot`。
- Bridge 只允许 `opl system initialize --json`、`opl modules --json`、`opl contract domains --json`。
- WebUI 增加 OPL 连接状态，展示真实 CLI readonly snapshot。
- Task/artifact projection 仍是 mock，不宣称真实 task execution。

## Verification

- `go test ./...`
- `node --test tests/contract/opl-readonly-bridge.test.mjs tests/contract/web-demo-data.test.mjs tests/smoke/web-demo-shell.test.mjs`
- local `curl /api/opl/snapshot`
- `sentrux check /home/dev/projects/ui`

## Cannot Claim

- 未实现真实 OPL mutation、install、repair、module exec、family-runtime mutation 或真实 task execution。
- 未实现真实登录、多租户数据库、队列、计费或生产部署。
