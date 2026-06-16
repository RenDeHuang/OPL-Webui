# Proposal

- owner: release-automation
- state: active

## Why

OPL-Webui 已经具备本地测试、镜像 build/push、cloud rollout helper、canary、HTTPS smoke 和 rollback runbook。下一步要把这些手工协同步骤升级为可审计、可回滚、权限隔离的四阶段发布系统。

## Scope

- 固化 Release Automation goal 文档，覆盖 CI 自动测试、CI build/push、云端 CD runner rollout、staging/production 分环境。
- 每个 phase 必须写清 implementation steps、evals、secret boundary 和 failure/rollback handling。
- 后续按 phase 独立实现，避免 CI、TCR、TKE、DNS、secret 和 staging 一次性耦合。

## Non-goals

- 本切片不执行 `kubectl`。
- 本切片不连接 PostgreSQL。
- 本切片不写入 secret、kubeconfig、TCR 密码或云 API key。
- 本切片不做产品功能开发。
- 本切片不实现 CI/CD workflow；只建立目标、合同和生命周期入口。
