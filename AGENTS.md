# OPL-WebUI 仓库协作规范

## 适用范围

本文件适用于仓库根目录及所有子目录；若更深层目录存在 `AGENTS.md`，以更近者为准。

## 工作语言

- 默认使用中文沟通、写产品文档和工程说明。
- 代码、schema、命令、路径和稳定 ID 使用英文。

## 产品边界

- 本仓是公网多租户 SaaS WebUI，用 Genspark 风格承载 OPL formal deliverable workbench。
- Web UI 只调用 Go control plane HTTP API。
- Go control plane 是当前唯一后端业务入口；真实 OPL CLI 集成必须先新增 Go-side contract、eval 和白名单边界。
- 不 import `one-person-lab` 内部模块，不读取 OPL state 文件，不直接调用 MAS/MAG/RCA 私有 runtime。
- OPL 安装、repair、module exec、family-runtime mutation、engine install/update/remove 默认禁止，除非新增 contract、eval 和人工授权边界。

## 工程闭环

- 正式变更必须先有 `changes/active/<change-id>/`，并包含 proposal、spec-delta、design、tasks、eval-plan、review、closeout。
- 机器真相属于 source、contracts、tests、fixtures、scripts 和 API/CLI 行为；Markdown prose 只做人读入口。
- 新增测试必须登记在 `scripts/test-classification.mjs`，声明 lane、ownerSurface、lifecycleRole、contracts 和 verifySuites。
- 默认验证入口是 `npm run verify`；review gate 是 `npm run gate:review`。

## 防膨胀规则

- 没有 consumer 的 contract 不新增。
- 没有 eval/test 的 AI、OPL 或 control-plane 行为不算完成。
- `scripts/` 只放 runner、classifier、gate；不要把业务逻辑塞进脚本。
- `.runtime/`、日志、coverage、dist、截图、临时产物和 `.superpowers/` 不进 git。
- 单文件超过约 `260` 行会触发当前 repo bloat gate；需要先拆分或调整明确预算。
