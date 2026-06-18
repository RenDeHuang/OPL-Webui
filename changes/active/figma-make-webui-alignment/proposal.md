# Figma Make WebUI Alignment Proposal

- owner: product-engineering owner
- state: active
- source: Figma Make `E8nYfNFc2D9P01FYZ8UwBW`

## Goal

吸收 Figma Make 的 One Person Lab 前台体验，把当前公网 WebUI 从顶部导航工作台调整为更接近 App 前台的侧栏、中心 prompt、技能启动器和账号入口。

## Scope

- 保留当前 `apps/web` 静态 HTML/CSS/ESM 技术栈。
- 不迁移到 React、Vite、Tailwind 或 shadcn。
- 不新增 Go API、runtime、billing、storage 或真实 OPL execution 行为。
- Figma 中涉及 runtime、云盘、无限资源的表达必须改写为 MedOPL gate 或 refs-only 入口。

## Success

- 首屏呈现 Figma-style left sidebar、One Person Lab hero、large prompt command center、skill launcher 和 account dock。
- 用户仍只能填写 API Key；base_url 固定为 `https://gflabtoken.cn/v1`。
- @OPL 能力仍 fail-closed 到 MedOPL Runtime gate，不伪造执行。
- 旧顶部导航 UI 被清退，不保留兼容 shell。
