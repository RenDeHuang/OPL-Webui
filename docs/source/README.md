# Source

- owner: active source owner
- purpose: 标记源码目录职责，减少重复解释。
- state: active
- machine boundary: 非机器接口；源码自身和 package manifest 为准。

## Active Source Owner

- `apps/web`: Browser UI 与 workspace 体验。
- `apps/api`: SaaS API、鉴权、租户边界、任务入口。
- `packages/contracts`: 机器 contracts、schema、共享类型。
- `packages/core`: 跨端业务核心，不碰 OPL internals。
- `packages/opl-adapter`: 白名单 OPL CLI/contracts 适配层。
- `tests`: 跨包验证、契约测试、回归测试。
- `scripts`: 仓库维护脚本和本地自动化。

## Current Implemented Surface

- `apps/api/src/demoLoop.mjs`: 本地 demo API loop 函数，不启动服务。
- `apps/api/src/demoScenario.mjs`: 中文 demo scenario。
- `packages/core/src/taskArtifactLoop.mjs`: task/artifact projection builder。
