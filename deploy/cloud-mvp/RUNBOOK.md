# OPL-Webui Cloud MVP Deploy Handoff

本 runbook 只写云端/VPC runner 的上线步骤，不保存真实 kubeconfig、数据库密码、云 API key 或镜像凭据。

## 前置条件

- `KUBECONFIG=/external/path/to/tke-kubeconfig`，由云端执行者注入，不进 git。
- PostgreSQL 连接信息在外部文件：`/home/dev/.secrets/opl-webui/postgresql/oplweb.env`。
- TCR/CCR 登录凭据由云端 runner 注入，仓库不保存 token。
- TKE IngressClass 使用 `qcloud`；qcloud Ingress 需要后端 Service 为 `NodePort`。
- DNS 只更新 `opl.medopl.cn` 的 CNAME，指向 TKE qcloud Ingress 创建的 CLB 域名。
- HTTPS 证书由 Kubernetes Opaque Secret `opl-webui-tls` 引用，key 为 `qcloud_cert_id`；真实证书 ID 由云端执行者注入，不进 git。

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

当前 cloud stable HTTPS 已验证镜像：

- image: `uswccr.ccs.tencentyun.com/webopl/opl-webui:30a3249`
- digest: `sha256:3b1b903fcb02ec87527d7567604d2b2bb1102f126b00cb03e88de425f17f4fb7`

## 日常更新发布流程

当前 stable baseline 镜像是 `uswccr.ccs.tencentyun.com/webopl/opl-webui:30a3249`。后续每次更新都用短 commit 作为不可变 tag：

```bash
short_commit="$(git rev-parse --short HEAD)"
export OPL_IMAGE="uswccr.ccs.tencentyun.com/webopl/opl-webui:${short_commit}"
```

本地开发机只做开发、镜像构建和推送；云端/VPC runner 执行 Kubernetes rollout、canary 和 smoke。

### 1. 本地开发与验证

```bash
npm run verify
npm run gate:review
```

### 2. 构建并推送 cloud 镜像

```bash
docker build \
  -f Dockerfile.cloud \
  --build-context opl=/external/path/to/one-person-lab \
  -t "$OPL_IMAGE" .
docker push "$OPL_IMAGE"
```

### 3. 云端更新镜像并 rollout

以下命令只由云端/VPC runner 执行，本地开发机不执行。

```bash
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui set image \
  deployment/opl-webui-control-plane \
  control-plane="$OPL_IMAGE"
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui rollout status \
  deployment/opl-webui-control-plane
```

### 4. Canary

```bash
pod="$(kubectl --kubeconfig "$KUBECONFIG" -n opl-webui get pod -l app.kubernetes.io/name=opl-webui -o jsonpath='{.items[0].metadata.name}')"
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui exec "$pod" -- /app/opl-webui-control-plane canary db
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui exec "$pod" -- /app/opl-webui-control-plane canary opl-cli
```

### 5. HTTPS smoke

```bash
curl --http2 -fsS https://opl.medopl.cn/healthz
curl --http2 -fsS https://opl.medopl.cn/readyz
curl --http2 -fsS https://opl.medopl.cn/ >/tmp/opl-webui-home.html
```

### 6. Rollback

如果 rollout、canary 或 HTTPS smoke 失败，先回滚 Deployment，再重新跑 canary 和 smoke：

```bash
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui rollout undo \
  deployment/opl-webui-control-plane
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui rollout status \
  deployment/opl-webui-control-plane
```

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

## 配置 qcloud HTTPS 证书

qcloud Ingress 通过 Opaque Secret 读取腾讯云证书 ID。只创建 Secret，不要把真实 `qcloud_cert_id` 写入仓库，也不要直接在 CLB 控制台手工绑定证书；证书绑定应由 Ingress 声明驱动。

```bash
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui create secret generic opl-webui-tls \
  --type=Opaque \
  --from-literal=qcloud_cert_id="$QCLOUD_CERT_ID" \
  --dry-run=client -o yaml | kubectl --kubeconfig "$KUBECONFIG" apply -f -
```

`QCLOUD_CERT_ID` 由云端执行者从外部 secret manager 或运行环境注入。runbook 只固定 Secret 名 `opl-webui-tls` 和 key `qcloud_cert_id`。

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

`deploy/cloud-mvp/opl-webui.k8s.json` 的 Service 必须保持 `NodePort`，当前已验证端口是 `4173:32258/TCP`；Ingress 必须保持 `ingressClassName: qcloud`，并通过 `tls.secretName: opl-webui-tls` 终止 `opl.medopl.cn` 的 HTTPS。

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
curl --http2 -fsS https://opl.medopl.cn/healthz
curl --http2 -fsS https://opl.medopl.cn/readyz
curl --http2 -fsS https://opl.medopl.cn/ >/tmp/opl-webui-home.html
```

`/readyz` 必须返回 `ok: true` 后才能把本次部署视为 cloud MVP preview 可用。

当前 HTTPS smoke 已通过：

- `https://opl.medopl.cn/healthz` 返回 HTTP/2 200
- `https://opl.medopl.cn/readyz` 返回 HTTP/2 200
- `https://opl.medopl.cn/` 返回 HTTP/2 200
- `canary db` 返回 `ok=true`，覆盖 open、ping、schema、write、read、delete
- `canary opl-cli` 返回 `ok=true`，policyId 是 `opl.cli.readonly.task-route`

HTTP 80 当前不是稳定入口，当前稳定入口以 `https://opl.medopl.cn` 为准。不要把当前状态表述为完整 production ready。

## DNS

TKE qcloud Ingress 创建 CLB 后，只修改 `opl.medopl.cn`：

```text
opl.medopl.cn CNAME <qcloud-clb-hostname>
```

当前已验证 CLB host 是 `lb-lhj3bgii-ms5ocrjz6hdaki2l.clb.usw-tencentclb.com`。

## HA / 安全组收敛设计

当前风险是 `EnsureIngressWarning W1012`：只有一个后端节点，节点或 Pod 异常会影响 `https://opl.medopl.cn`。目标态是两个可调度 TKE node、两个 Ready Pod、CLB 至少两个健康 backend，且公网入口只走 CLB 80/443，不再保留 `0.0.0.0/0 TCP:32258` 这种临时 NodePort 暴露。

1. HA 目标态：`Deployment replicas=2`，两个 Pod 分布在不同 `kubernetes.io/hostname`；`/readyz`、`canary db`、`canary opl-cli` 和 HTTPS smoke 全部通过后才收口安全组。
2. TKE node：需要新增或复用第二个 Ready worker node；必须带 `medopl.cn/workload=webui` 或调整当前 nodeSelector，否则第二个 Pod 仍可能无法调度。
3. Deployment：建议 `replicas: 2`、`maxUnavailable: 0`、`maxSurge: 1`，保持滚动更新期间至少两个期望副本。
4. 调度：先用 `topologySpreadConstraints`，`maxSkew: 1`、`topologyKey: kubernetes.io/hostname`、`whenUnsatisfiable: DoNotSchedule`；同时加软 `podAntiAffinity` 作为调度偏好，避免只有一个 node 时永久阻断紧急恢复。
5. PDB：建议 `minAvailable: 1`，在两副本 MVP 阶段允许一次自愿中断但避免维护动作同时驱逐全部 Pod；后续三副本再升到 `minAvailable: 2`。
6. 安全组：优先在 qcloud Ingress/CLB 层绑定专用安全组，只允许公网到 CLB `80,443`；节点安全组仅允许来自该 CLB 安全组或 CLB 后端网段到 NodePort `32258`，验证通过后删除公网到 NodePort 的临时规则。
7. 云端执行：新增/确认第二 node -> 给第二 node 打 `medopl.cn/workload=webui` -> 更新 Deployment replicas/rolling 策略/拓扑约束/PDB -> rollout -> 确认 qcloud Ingress backend 节点数 -> 收敛安全组。
8. 验证：`kubectl get pod -o wide` 确认两个 Pod 在不同 node；`kubectl get ingress` 确认 `ADDRESS` 和 `80,443`；跑 `canary db`、`canary opl-cli`、`curl --http2 -fsS https://opl.medopl.cn/{healthz,readyz}` 和首页 smoke；确认 W1012 消失或 backend 不再是单节点。
9. 回滚：若第二 Pod 不 Ready 或 HTTPS/canary 失败，先 `kubectl rollout undo deployment/opl-webui-control-plane` 或恢复 `replicas: 1`；若安全组收敛导致 504，立即恢复上一条 NodePort 规则，再按日志定位 CLB 到 node 的来源范围。
10. 控制台事项：在腾讯云控制台新增或复用第二 CVM/TKE worker、确认节点安全组和 CLB 安全组、记录 CLB 后端来源范围、绑定专用 CLB 安全组；不要在 CLB 控制台手工改证书，证书仍由 `opl-webui-tls` Secret 驱动。

## Rollback

```bash
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui rollout undo deployment/opl-webui-control-plane
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui rollout status deployment/opl-webui-control-plane
```

如果新部署首次上线且没有历史 ReplicaSet，则删除本次 Deployment/Service/Ingress，并保留 secret 供复用：

```bash
kubectl --kubeconfig "$KUBECONFIG" -n opl-webui delete -f "$tmp_manifest"
```
