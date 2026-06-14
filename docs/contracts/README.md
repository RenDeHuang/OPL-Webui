# Contracts

- owner: contracts owner
- purpose: 解释机器边界的归属和使用方式。
- state: active
- machine boundary: 真正机器接口在 `packages/contracts`；本 Markdown 只解释。

Contracts 是 OPL-WebUI 与 API、Adapter、CLI 之间的机器边界。

规则：

- schema、type、event、payload 以 `packages/contracts` 为准。
- Markdown 不能作为机器接口。
- 任何 contract 变更必须走 change package，并同步测试。
