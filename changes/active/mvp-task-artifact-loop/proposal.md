# Proposal

- owner: mvp-task-artifact-loop
- state: active

## Why

建立第一条可验证产品主链路：demo tenant 创建项目任务，经 mock OPL Adapter 得到 artifact projection。

## Goals

- API 暴露最小 demo loop。
- core 负责 task/artifact 状态推进。
- adapter 仍只使用 mock readonly command。

## Non-Goals

- 不实现真实登录、数据库、队列、计费或真实 OPL execution。
- 不调用 `opl module exec`、family-runtime mutation 或安装/repair 命令。
