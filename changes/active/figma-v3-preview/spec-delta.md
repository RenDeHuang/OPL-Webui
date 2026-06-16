# Spec Delta

- owner: figma-v3-preview
- state: active

## CURRENT TRUTH

- `docs/active/README.md` 当前阶段是 `cloud-stable-https-handoff`。
- Web UI 通过同源 `/api/mvp/task` 和 `/api/opl/snapshot` 调用 Go control plane。
- Go control plane 是唯一后端业务入口。
- 当前只能 claim OPL readonly snapshot 与 route/handoff evidence，不能 claim 真实 OPL execution。

## TARGET TRUTH

- `product.mvp.style` 从泛化 Genspark-like 参考，落到 Figma V3 preview 的具体结构。
- 首页必须呈现 Genspark式首页：大 prompt、prompt controls、工具胶囊、最近交付与推荐工作流、右侧待处理。
- 项目工作区必须呈现轻量工作区：项目信息、状态标签、下一步建议、交付流程、证据与来源、活动流、交付物预览、项目内 prompt。
- V3 preview 的数据必须从现有 Go control plane projection 派生，不能复制第二份业务 truth。

## CANNOT-CLAIM

- 不能声明完整 production ready SaaS。
- 不能声明真实登录、真实 Drive、真实团队协作或完整多租户管理。
- 不能声明真实 OPL execution 或任何 OPL mutation。
- 不能声明云端已部署 V3，除非 cloud rollout、canary 和 online smoke gates 通过。
