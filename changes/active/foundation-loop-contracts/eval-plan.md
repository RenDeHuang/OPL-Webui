# Eval Plan

- owner: foundation-loop-contracts
- state: active

## Required Commands

- `npm run verify`
- `npm run gate:review`
- `npm run repo:bloat`
- `npm run check:diff`

## Evidence Level

- local contract proof
- local smoke proof
- repo hygiene and bloat gate proof

## Can Claim

- 第一阶段仓库具备最小 contract-driven / evals-driven 工程闭环。
- OPL Adapter MVP 只允许 `packages/contracts/opl/command-policy.json` 内的只读命令。
- 测试必须通过显式 registry 进入 verify suite。

## Cannot Claim

- 不能声明真实 OPL task execution、module exec、family-runtime mutation、安装或 repair 已接通。
- 不能声明公网 SaaS、鉴权、多租户数据库、计费或生产部署已实现。
- 不能把 Markdown prose 当作机器接口。
