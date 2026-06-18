# OPL-WebUI 仓库协作规范

## 适用范围

本文件适用于仓库根目录及所有子目录；若更深层目录存在 `AGENTS.md`，以更近者为准。

## 工作语言

- 默认使用中文沟通、写产品文档和工程说明。
- 代码、schema、命令、路径和稳定 ID 使用英文。

## 定位

- `AGENTS.md` 只约束工作方式、稳定边界和工程纪律，不承载完整项目知识。
- 项目知识默认从 `TASTE.md`、`docs/project.md`、`docs/status.md`、`docs/architecture.md`、`docs/invariants.md`、`docs/decisions.md`、`docs/active/README.md` 和 `specs/*` 读取。
- 每次正式开发必须先确认当前 truth，再进入一个明确的 gap-driven phase。

## 产品边界

- 本仓是公网 OPL 前台 WebUI：用户访问 `opl.medopl.cn` 登录后使用 ChatGPT-like OPL 前台入口。
- 用户填写自己的 API Key；base_url 固定为我们的 sub2api base_url，不允许用户自定义。
- Web UI 默认不展示 workspace、runtime、node pool、storage 概念；Go control plane 可保留 hidden default personal workspace 用于隔离、计费投影和未来扩展。
- MedOPL 是充值、runtime、node pool、storage、账单和资源后台；OPL-Webui 不拥有 node pool 生命周期、billing source of truth 或 API gateway。
- Web UI 只调用 Go control plane HTTP API；Go control plane 消费 sub2api 和 MedOPL 状态。
- Go control plane 是当前唯一后端业务入口；真实 OPL CLI 集成必须先新增 Go-side contract、eval、白名单和人工授权边界。
- 不 import `one-person-lab` 内部模块，不读取 OPL state 文件，不直接调用 MAS/MAG/RCA 私有 runtime。
- OPL 安装、repair、module exec、family-runtime mutation、engine install/update/remove 默认禁止，除非新增 contract、eval 和人工授权边界。

## 工程闭环

- 正式变更必须先有 `changes/active/<change-id>/`，并包含 proposal、spec-delta、design、tasks、eval-plan、review、closeout。
- 每次正式变更必须执行四个工作面：文档生命周期、代码清退、测试登记、机器 gate。
- 每次正式变更必须同步清退被替代的旧代码、旧 route、旧 schema、旧测试、旧文档入口和旧命名；不能把清退留给未来。
- 机器真相属于 source、contracts、tests、fixtures、scripts 和 API/CLI 行为；Markdown prose 只做人读入口。
- 新增测试必须登记在 `scripts/test-classification.mjs`，声明 lane、ownerSurface、lifecycleRole、contracts 和 verifySuites。
- 默认验证入口是 `npm run verify`；review gate 是 `npm run gate:review`；正式完成前还必须跑 `npm run repo:bloat` 和 `sentrux check .`。

## 文档生命周期

- `docs/docs_portfolio_consolidation.md` 是文档组合治理入口。
- 每份长期文档都必须说明 `owner`、`purpose`、`state` 和 `machine boundary`。
- 新文档先判断角色，再落到 `docs/` core、`docs/active/`、`docs/history/`、`specs/` 或 `changes/active/`。
- 退役路线、历史定位和 tombstone 只能放在 archive/history 语境；active truth 提到旧路线时必须指向当前 owner。

## 代码清退

- 不得保留无 consumer 的兼容层。
- 不做“先兼容以后再删”的默认实现；若确有迁移桥，必须写明 consumer、合同、退役条件和对应测试。
- 被当前 owner surface 替代的模块、alias、facade、mock data、route 和聚合测试默认直接退役。
- 旧 `mvp`、`demo://`、`demoData`、fake storage、fake billing、fake runtime execution 等词只能出现在历史、归档或 fail-closed guard 中，不能成为新主线实现。

## 测试登记

- 新增或移动测试文件必须先登记在 `scripts/test-classification.mjs`。
- 测试登记必须说明 lane、ownerSurface、lifecycleRole、contracts 和 verifySuites。
- 不能新增游离测试、散落 runner 或绕过 `npm run verify` 的单独验证入口。

## 机器 gate

- 完成声明必须有新鲜验证证据；不能用“应该通过”代替命令输出。
- 默认完成 gate：targeted tests、`npm run verify`、`npm run gate:review`、`npm run repo:bloat`、`sentrux check .`。
- 修改 AI、OPL、runtime、billing、storage、deploy 或 public API 行为时，必须有对应 contract/eval；没有 eval/test 不算完成。

## 防膨胀规则

- 没有 consumer 的 contract 不新增。
- 没有 eval/test 的 AI、OPL 或 control-plane 行为不算完成。
- `scripts/` 只放 runner、classifier、gate；不要把业务逻辑塞进脚本。
- `.runtime/`、日志、coverage、dist、截图、临时产物和 `.superpowers/` 不进 git。
- 单文件超过约 `260` 行会触发当前 repo bloat gate；需要先拆分或调整明确预算。
- 仓库接近或达到 bloat 预算时，新增业务能力前必须先清退、拆分或收敛现有 surface。
