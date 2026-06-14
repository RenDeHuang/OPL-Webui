# Product

- owner: product owner
- purpose: 定位 OPL-WebUI 的产品边界。
- state: active
- machine boundary: 非机器接口；不能替代 contracts 或运行时配置。

OPL-WebUI 是公网多租户 SaaS，提供 Genspark 风格 AI Workspace，并作为 OPL formal deliverable workbench。

## MVP Loops

- Intake: 收集目标、输入、约束。
- Project: 管理项目状态与上下文。
- Task Runtime: 运行 AI/OPL 任务并追踪事件。
- Review: 人审、差异、批准。
- Artifact: 产出、版本、下载。
- Tenant: 租户、成员、配额、隔离。

## Cannot-Claim

- 不能声称已实现未落地的 OPL 内部能力。
- 不能声称绕过白名单直接执行任意 CLI。
- 不能把 Markdown 当作机器可执行 contract。

## Current MVP Slice

- `mvp-task-artifact-loop`: 本地 demo tenant 可完成 task -> mock OPL Adapter -> artifact projection。
- 该 slice 只证明产品主链路形状，不证明真实 OPL execution、登录、多租户数据库或生产 SaaS。
