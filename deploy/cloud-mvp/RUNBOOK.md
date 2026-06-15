# OPL-Webui Cloud MVP Deploy Handoff

本 runbook 只写云端/VPC runner 的上线步骤，不保存真实 kubeconfig、数据库密码、云 API key 或镜像凭据。

## 前置条件

- `KUBECONFIG=/external/path/to/tke-kubeconfig`，由云端执行者注入，不进 git。
- PostgreSQL 连接信息在外部文件：`/home/dev/.secrets/opl-webui/postgresql/oplweb.env`。
- TCR/CCR 登录凭据由云端 runner 注入，仓库不保存 token。
- TKE IngressClass 使用 `qcloud`；qcloud Ingress 需要后端 Service 为 `NodePort`。
- DNS 只更新 `opl.medopl.cn` 的 CNAME，指向 TKE qcloud Ingress 创建的 CLB 域名。

## 镜像构建与推送

```bash
export OPL_IMAGE="uswccr.ccs.tencentyun.com/webopl/opl-webui:<git-sha>"
docker build \
  -f Dockerfile.cloud \
  --build-context opl=/external/path/to/one-person-lab \
  -t "$OPL_IMAGE" .
docker push "$OPL_IMAGE"
```

`Dockerfile.cloud` 会把外部 OPL context 的 `bin/opl` 和 `contracts/opl-gateway` 放到 `/opt/opl`，并在镜像构建期从 OPL `src` 重新生成 `/opt/opl/dist`，避免复制外部 stale build output。不能把 `one-person-lab` 主仓复制进本仓。

当前 cloud stable HTTP 已验证镜像：

- image: `uswccr.ccs.tencentyun.com/webopl/opl-webui:30a3249`
- digest: `sha256:3b1b903fcb02ec87527d7567604d2b2bb1102f126b00cb03e88de425f17f4fb7`

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

`deploy/cloud-mvp/opl-webui.k8s.json` 当前固定已验证镜像 `uswccr.ccs.tencentyun.com/webopl/opl-webui:30a3249`。如果发布新镜像，只替换 Deployment container image，不改 secret 或业务配置：

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

`deploy/cloud-mvp/opl-webui.k8s.json` 的 Service 必须保持 `NodePort`，当前已验证端口是 `4173:32258/TCP`；Ingress 必须保持 `ingressClassName: qcloud`。

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
curl -fsS http://opl.medopl.cn/healthz
curl -fsS http://opl.medopl.cn/readyz
curl -fsS http://opl.medopl.cn/ >/tmp/opl-webui-home.html
```

`/readyz` 必须返回 `ok: true` 后才能把本次部署视为 cloud MVP preview 可用。

当前 HTTP smoke 已通过：

- `http://opl.medopl.cn/healthz` 返回 200
- `http://opl.medopl.cn/readyz` 返回 200
- `http://opl.medopl.cn/` 返回 200
- `canary db` 通过
- `canary opl-cli` 通过

HTTPS 证书、HTTPS Ingress 和强制跳转仍是后续项；不要把当前状态表述为完整 production ready。

## DNS

TKE qcloud Ingress 创建 CLB 后，只修改 `opl.medopl.cn`：

```text
opl.medopl.cn CNAME <qcloud-clb-hostname>
```

当前已验证 CLB host 是 `lb-lhj3bgii-ms5ocrjz6hdaki2l.clb.usw-tencentclb.com`。

## 504 排障

如果 Ingress 返回 504，但 Pod、Service、canary 和集群内访问都正常，优先检查节点安全组：

- TKE qcloud Ingress 会访问 Service 的 NodePort。
- 当前已验证 NodePort 是 `32258/TCP`。
- 当前验证临时放通规则是 `0.0.0.0/0 TCP:32258`。
- 更长期做法是按集群安全策略放通 qcloud CLB 到 NodePort 或 NodePort range，不在仓库记录真实安全组 ID、账号或密钥。

## Rollback

```bash
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui rollout undo deployment/opl-webui-control-plane
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui rollout status deployment/opl-webui-control-plane
```

如果新部署首次上线且没有历史 ReplicaSet，则删除本次 Deployment/Service/Ingress，并保留 secret 供复用：

```bash
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui delete -f "$tmp_manifest"
```
