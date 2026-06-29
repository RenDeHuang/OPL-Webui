# One Person Lab Web 仓库协作规范

## 适用范围

本文件适用于仓库根目录及所有子目录；若更深层目录存在 `AGENTS.md`，以更近者为准。

## 工作语言

- 默认使用中文沟通、写产品文档和工程说明。
- 代码、schema、命令、路径和稳定 ID 使用英文。

## 定位

- `AGENTS.md` 只约束工作方式、稳定边界和工程纪律，不承载完整项目知识。
- 项目知识默认从 `README.md`、`TASTE.md`、`docs/project.md`、`docs/status.md`、`docs/decisions.md`、`docs/architecture.md`、`docs/invariants.md`、`docs/docs_portfolio_consolidation.md`、`docs/active/README.md` 和 `contracts/*.json` 读取。
- 每次正式开发必须先确认固定 truth，再进入一个明确的 gap-driven phase；不要从临时过程文件推导当前事实。
- 每次正式开发必须回答：claim 是什么、owner 是谁、consumer 是谁、contract 在哪里、哪个 test proof 证明它、proof level 到哪一层、不能 claim 什么、生产证据是否 foldback、新增 surface 能不能退役。

## 产品边界

- 本仓是 One Person Lab Web 产品仓：用户访问 `opl.medopl.cn` 登录后使用多租户 SaaS 版 One Person Lab 产品入口。
- 本仓拥有浏览器产品体验、多租户账号/session、tenant isolation、科研能力入口、BYOK 绑定、普通聊天 fallback、Web page state、Go control plane API 和 Web 发布验证。
- 用户填写自己的 API Key；base_url 固定为我们的 sub2api base_url，不允许用户自定义。
- Web UI 默认不展示 workspace、runtime、node pool、storage 概念；Go control plane 可保留 hidden default personal workspace 用于隔离、计费投影和未来扩展。
- 本仓不拥有桌面 App 发布体系、OPL Framework runtime truth、领域 agent 判断权威、billing source of truth、storage truth、node pool 生命周期、API gateway truth、OPL execution truth 或 artifact/body authority。
- Web UI 只调用 Go control plane HTTP API；Go control plane 消费 sub2api 和 MedOPL 状态。
- Go control plane 是当前唯一后端业务入口；真实 OPL CLI 集成必须先新增 Go-side contract、eval、白名单和人工授权边界。
- 不 import `one-person-lab` 内部模块，不读取 OPL state 文件，不直接调用 MAS/MAG/RCA 私有 runtime。
- OPL 安装、repair、module exec、family-runtime mutation、engine install/update/remove 默认禁止，除非新增 contract、eval 和人工授权边界。

## 工程闭环

- 进入 code、docs、contracts、tests、scripts、deploy 或 API 行为变更时，即视为正式开发；除非用户明确要求只读分析，否则必须走本节闭环。
- 本仓不使用 `changes/active` 七件套作为默认开发系统；当前事实只写入固定 truth、contracts、source、tests 和脚本。
- 每次正式变更必须执行四个工作面：文档生命周期、代码清退、测试登记、机器 gate。
- 每次正式变更必须同步清退被替代的旧代码、旧 route、旧 schema、旧测试、旧文档入口和旧命名；不能把清退留给未来。
- 机器真相属于 source、contracts、tests、fixtures、scripts 和 API/CLI 行为；Markdown prose 只做人读入口。
- 新增测试必须登记在 `scripts/test-classification.mjs`，声明 lane、ownerSurface、lifecycleRole、contracts、cost、riskTriggers、verifySuites、testKind、proofLevel、claimScope、proves 和 doesNotProve；registry 校验这些字段的枚举和值域。
- 新增长期 surface 必须登记在 `contracts/web-surface-inventory.json`，声明 path、type、ownerSurface、consumer、contract 或 machineBoundary、lifecycle；temporary/tombstone 必须声明 retirement。
- 默认主验证入口是 `npm run verify`，即 daily `fast` 快检；日常改动面验证入口是 `npm run verify:dev`，它根据当前 diff 选择 impacted lanes；review gate 是 `npm run gate:review`。
- AI 开发纪律由 `contracts/web-development-profile.json` 机器约束：正式开发按 direct / inline / durable 分级，顺序为 claim -> owner surface -> contract/page-state/API boundary -> proof taxonomy test -> implementation -> retire replaced surface -> targeted lane -> verify/gate -> production evidence if needed -> release/status foldback -> can/cannot claim。
- `npm run gate:ai` 是正式开发的 AI workflow gate；`npm run gate:review` 必须包含它。它用于阻断 stale production claim、未登记测试、开发 workflow 变更缺少 contract/gate/registry 同步等问题。
- 测试采用 surface impacted lane 加发布前全量验证：`fast` 守普通开发快检，`dev` 组合当前 diff 的 impacted lanes，`ui` 守 UI source/view-model 边界，`api` 守 Go HTTP/API，`smoke` 守基础入口，`contract` 守 API/page-state/BYOK/tenant/OPL 边界，`health` 守治理和清退，`go` 守 Go control plane，`browser:golden` 守浏览器主路径，完整 `browser`、`integration`、`release/deploy`、`regression`、`real-medopl` 和 `full` 用于发布、高风险或显式验证。
- 测试 taxonomy 由 registry 机器约束：`cost` 支持 `cheap`、`medium`、`heavy`、`soak`、`golden`；`lifecycleRole` 支持 `current-owner`、`integration`、`regression-guard`、`tombstone-guard`；`testKind` 支持 `acceptance`、`contract`、`governance`、`regression`；`proofLevel` 支持 `static`、`unit`、`http`、`browser`、`production`；`claimScope` 支持 `repo`、`local`、`ci`、`production`。`doesNotProve` 是强制字段，用来阻断低层测试冒充生产证据。
- `regression` lane 可以为空；一旦登记 `regression-guard`，必须声明 machine-readable `retirement` metadata。退役条件到期后，同一变更必须删除测试、删除 registry entry，并按需要写入 `docs/history/tombstones/` 防止复活。
- 每次正式开发开始前必须根据改动面决定 targeted lane：普通 `frontend/web/src/features/**`、`frontend/web/styles/**` surface 修改默认跑 `verify:ui` 或 `npm run verify:dev`，不默认跑 browser/full；`frontend/web/src/app/**`、route/auth/pending/page-state 入口修改跑 `verify:ui` 与 `verify:interaction`；`contracts/web-page-state-matrix.json` 跑 `verify:interaction` 与 `verify:contract`；`backend/control-plane-go/**` 跑 `verify:api` 与 `verify:go`；`deploy/**`、`.github/workflows/**`、`scripts/cloud-rollout.mjs`、release evidence 变更跑 `verify:release`/`verify:deploy` 并覆盖 `verify:browser:golden`；OPL bridge/runtime gate 变更跑 `verify:integration`，发布风险变更再跑 `verify:full`。
- 验证强度按风险分级：小型 docs/test/source 维护至少跑 targeted tests、对应 verify suite 和 `npm run verify`；用户可见、API、contract、runtime、billing、storage、deploy、OPL bridge 或 release claim 变更还必须跑对应 explicit lane、`npm run gate:review`、`npm run repo:bloat` 和 `sentrux check .`。
- contract-first：新增或修改用户可见功能、API、runtime gate、release claim 前，必须先更新对应 `contracts/*.json`。
- page-state-first：新增或修改页面/交互前，必须先更新 `contracts/web-page-state-matrix.json`。
- browser-e2e-first：商业主路径变化必须有浏览器级或等价 smoke/e2e 计划；不能只靠文案声明。
- release-evidence-foldback：每次 GitHub release/deploy/browser/dogfood/availability run 完成并改变 can/cannot claim 时，必须把压缩证据折返到 `contracts/web-release-profile.json`、`docs/status.md` 和 `docs/active/README.md`；不能把 active docs 留在旧状态。
- release evidence 一等入口是 `npm run release:evidence -- --run-id <github-run-id>`；它只写压缩证据，不把 raw logs 放进 active docs。

## 理想态与清退

- 理想态优先：先按 One Person Lab Web 的目标产品边界和 Go control plane owner 设计，再判断现有实现如何迁移或删除。
- 旧实现只能作为迁移输入，不能反过来定义长期架构、命名、route、测试或文档入口。
- 一旦目标 topology 明确，新增投入默认服务目标形态；不继续深磨旧路线。
- 不保留兼容污染；已被当前 owner surface 替代的模块、alias、facade、schema、route、测试和文档入口默认退役。
- 如确需迁移桥，必须写明真实 consumer、合同、退役条件、对应测试和 closeout 证据。
- 不做降级处理、兜底补丁、启发式修补或“先糊住再说”式实现。

## 文档生命周期

- `docs/docs_portfolio_consolidation.md` 是文档组合治理入口。
- 每份长期文档都必须说明 `owner`、`purpose`、`state` 和 `machine boundary`。
- 新文档先判断角色，再落到 `docs/` core、`docs/active/`、`docs/history/`、`docs/history/tombstones/` 或 `contracts/`。
- `docs/active/` 只放当前 gap baton、worktree lane、下一轮 Agent 上下文和 foldback target；不能变成过程日志或第二套 truth。
- `docs/history/tombstones/` 只放退役 surface 的 no-resurrection 记录；不能作为兼容入口。
- 退役路线、历史定位和 tombstone 只能放在 archive/history 语境；active truth 提到旧路线时必须指向当前 owner。

## 代码清退

- 不得保留无 consumer 的兼容层。
- 不做“先兼容以后再删”的默认实现；若确有迁移桥，必须写明 consumer、合同、退役条件和对应测试。
- 被当前 owner surface 替代的模块、alias、facade、mock data、route 和聚合测试默认直接退役。
- 旧过渡产品命名、demo data、fake storage、fake billing、fake runtime execution 等词只能出现在历史、归档或 fail-closed guard 中，不能成为新主线实现。

## 测试登记

- 新增或移动测试文件必须先登记在 `scripts/test-classification.mjs`。
- 测试登记必须说明 lane、ownerSurface、lifecycleRole、contracts、cost、riskTriggers、verifySuites、testKind、proofLevel、claimScope、proves 和 doesNotProve；`scripts/test-classification.mjs` 是 taxonomy、proof boundary 和 lane membership 的机器入口。
- 不能新增游离测试、散落 runner 或绕过 `npm run verify` 的单独验证入口。

## 机器 gate

- 完成声明必须有新鲜验证证据；不能用“应该通过”代替命令输出。
- 默认完成 gate 按风险分级；高风险、发布、deploy、public API、runtime、billing、storage、OPL bridge 或 release claim 变更必须覆盖 targeted lane、`npm run gate:ai`、`npm run verify`、对应 explicit lane、`npm run gate:review`、`npm run repo:bloat`、`sentrux check .`。
- 修改 AI、OPL、runtime、billing、storage、deploy 或 public API 行为时，必须有对应 contract/eval；没有 eval/test 不算完成。
- 当用户要求“彻底落地 / 全部落地 / 一步到位 / 完善后立刻吸收 / 持续推进直到完成 / 能做的都做掉”时，最终声明完成前必须执行 Plan Completion Audit：逐项列出 done / partial / not_started / blocked、证据、缺口和后续动作。

## 防膨胀规则

- 没有 consumer 的 contract 不新增。
- 没有 ownerSurface 或 consumer 的长期 surface 不新增；scripts、contracts、tests、Go tests、recurring docs、workflows/deploy 和少量关键 source owner surface 必须登记在 `contracts/web-surface-inventory.json`。
- 没有 eval/test 的 AI、OPL 或 control-plane 行为不算完成。
- `scripts/` 只放 runner、classifier、gate；不要把业务逻辑塞进脚本。
- `.runtime/`、日志、coverage、dist、截图、临时产物和 `.superpowers/` 不进 git。
- 单文件行数只作为硬 hygiene 边界：默认上限为 `1000` 行；生成文件、fixture 和 schema 可豁免。不到上限时按职责边界和可维护性判断是否拆分，不为任意小阈值拆文件。
- 仓库文件数量只作为 report-only portfolio signal；不能用固定文件数卡死产品开发。`npm run repo:bloat` 必须区分 owned growth 与 orphan growth：有 owner/consumer/contract 的增长是 report-only，无 owner 或无 consumer 的长期 surface 是 hard fail。

## worktree / subagent

- 根 checkout 默认固定在 `main`；非 `main` 长链路开发、并行开发或高风险重构应使用独立 worktree。
- 大改动或互不冲突的多 lane 工作，优先用 subagent 在独立 worktree 中并行推进。
- subagent 只能处理 source of truth 清楚、写集可隔离的任务；主会话必须核查 diff、运行验证、吸收变更并清理 worktree / branch / 临时状态。
- 共享根 checkout 只用于轻量阅读、评审、吸收验证后提交和 push，不承载长期并行实现。
