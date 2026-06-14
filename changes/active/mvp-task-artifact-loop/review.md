# Review

- owner: mvp-task-artifact-loop
- state: active

## Review Points

- 是否保持 mock-only。
- 是否没有绕过 OPL command policy。
- 是否没有引入新依赖和仓库膨胀。

## Self Review

- API demo loop 只调用 `MockOplAdapter`。
- mock adapter command 固定为 `opl contract domains`，在 readonly allowlist 内。
- 未新增 npm dependencies。
- 未实现服务器、数据库、鉴权或真实 OPL execution。
