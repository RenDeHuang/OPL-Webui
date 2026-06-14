# OPL Task Route Bridge Closeout

## Summary

- `/api/mvp/task` 增加真实 OPL CLI readonly route evidence。
- Go control plane 只允许 `opl domain resolve-request --json` 与 `opl contract handoff-envelope --json` 作为 task route/handoff 证据。
- WebUI 任务卡显示 routed domain 与 routing status。

## Verification

- `go test ./...`
- `node --test tests/contract/go-control-plane-http.test.mjs tests/contract/web-demo-data.test.mjs`
- local `curl /api/mvp/task`
- `sentrux check /home/dev/projects/ui`

## Cannot Claim

- 未实现真实 OPL execution、module exec、install、repair 或 family-runtime mutation。
- 未实现真实登录、多租户数据库、队列、计费或生产部署。
