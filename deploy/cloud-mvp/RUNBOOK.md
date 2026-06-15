# OPL-Webui Cloud MVP Deploy Handoff

本 runbook 只写云端/VPC runner 的上线步骤，不保存真实 kubeconfig、数据库密码、云 API key 或镜像凭据。

## 前置条件

- `KUBECONFIG=/external/path/to/tke-kubeconfig`，由云端执行者注入，不进 git。
- PostgreSQL 连接信息在外部文件：`/home/dev/.secrets/opl-webui/postgresql/oplweb.env`。
- Dockerfile 当前只声明 `OPL_CLI_PATH=/opt/opl/bin/opl`，没有把 OPL CLI 放进镜像；上线镜像必须通过派生镜像或只读挂载提供该 binary。
- TCR/CCR 登录凭据由云端 runner 注入，仓库不保存 token。

## 镜像构建与推送

```bash
export OPL_IMAGE="<tcr-or-ccr-registry>/<namespace>/opl-webui:<git-sha>"
docker build \
  -f Dockerfile.cloud \
  --build-context opl=/external/path/to/one-person-lab \
  -t "$OPL_IMAGE" .
docker push "$OPL_IMAGE"
```

`Dockerfile.cloud` 会把外部 OPL context 的 `bin/opl`、`dist` 和 `contracts/opl-gateway` 放到 `/opt/opl`。不能把 `one-person-lab` 主仓复制进本仓。

## 创建 Kubernetes Secret

```bash
set -a
. /home/dev/.secrets/opl-webui/postgresql/oplweb.env
set +a

kubectl --kubeconfig "$KUBECONFIG" -n opl-webui create secret generic opl-webui-postgres \
  --from-literal=OPL_DATABASE_URL="$OPL_DATABASE_URL" \
  --dry-run=client -o yaml | kubectl --kubeconfig "$KUBECONFIG" apply -f -
```

`opl-webui-postgres` 只包含 `OPL_DATABASE_URL`，不要把明文值写回仓库。

## 替换真实镜像地址

```bash
tmp_manifest="$(mktemp)"
node -e '
const fs = require("fs");
const image = process.env.OPL_IMAGE;
const manifest = JSON.parse(fs.readFileSync("deploy/cloud-mvp/opl-webui.k8s.json", "utf8"));
for (const item of manifest.items) {
  if (item.kind === "Deployment") item.spec.template.spec.containers[0].image = image;
}
process.stdout.write(JSON.stringify(manifest, null, 2));
' > "$tmp_manifest"
```

## 部署

以下步骤由云端/VPC runner 执行 `kubectl apply`，本地开发机不执行。

```bash
kubectl --kubeconfig "$KUBECONFIG" create namespace opl-webui --dry-run=client -o yaml \
  | kubectl --kubeconfig "$KUBECONFIG" apply -f -
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui apply -f "$tmp_manifest"
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui rollout status deployment/opl-webui-control-plane
```

## Canary

```bash
pod="$(kubectl --kubeconfig "$KUBECONFIG" -n opl-webui get pod -l app.kubernetes.io/name=opl-webui -o jsonpath='{.items[0].metadata.name}')"
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui exec "$pod" -- /app/opl-webui-control-plane canary db
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui exec "$pod" -- /app/opl-webui-control-plane canary opl-cli
```

## Smoke

```bash
curl -fsS https://opl.medopl.cn/healthz
curl -fsS https://opl.medopl.cn/readyz
curl -fsS https://opl.medopl.cn/ >/tmp/opl-webui-home.html
```

`/readyz` 必须返回 `ok: true` 后才能把本次部署视为 cloud MVP preview 可用。

## Rollback

```bash
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui rollout undo deployment/opl-webui-control-plane
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui rollout status deployment/opl-webui-control-plane
```

如果新部署首次上线且没有历史 ReplicaSet，则删除本次 Deployment/Service/Ingress，并保留 secret 供复用：

```bash
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui delete -f "$tmp_manifest"
```
