# Proposal

- owner: figma-v3-preview
- state: active

## Why

当前线上 `cloud_mvp` 已可通过 HTTPS 对外访问，但 Web UI 仍是旧的简化 shell。产品目标一直是用 Genspark 风格承载 OPL formal deliverable workbench；Figma 节点 `8peNQrKeC26oNiXZPRSdxU / 23:2` 已给出 `06 Genspark风格 V3` 原型。

本变更用 gap-based development 推进 V3 preview：从当前 cloud MVP shell 出发，逐阶段关闭目标设计、结构、数据、视觉、本地 gate、云端 canary 和线上 smoke 的差距。

## Goals

- 建立 `figma-v3-preview` 的 phase/step/gap 开发路径。
- 锁定 Figma V3 target：`23:2 / 06 Genspark风格 V3`。
- 先做 V3 Preview：首页 + 轻量项目工作区。
- UI 仍只通过 Go control plane HTTP API 取数。
- 用动态验收 loop 防止“测试通过但产品没做到 Figma”。

## Non-Goals

- 不在本阶段实现真实登录、真实 Drive、真实团队协作、计费或完整 tenant admin。
- 不执行 OPL mutation、install、repair、module exec 或真实 OPL execution。
- 不新增 Go contract，除非后续 phase 证明现有 `/api/mvp/task` 和 `/api/opl/snapshot` 无法支撑 preview。
- 不做云端部署，直到本地结构、数据和视觉 gates 通过。
