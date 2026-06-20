import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const fixturePath = 'deploy/web-cloud/opl-webui.k8s.json';
const runbookPath = 'deploy/web-cloud/RUNBOOK.md';

function loadManifest() {
  const raw = readFileSync(fixturePath, 'utf8');
  const manifest = JSON.parse(raw);
  return { raw, items: manifest.items ?? [] };
}

function findKind(items, kind) {
  return items.find((item) => item.kind === kind);
}

function containerEnv(container, name) {
  return (container.env ?? []).find((entry) => entry.name === name);
}

test('web cloud fixture exposes opl.medopl.cn through the Go control plane service', () => {
  const { items } = loadManifest();
  const namespace = findKind(items, 'Namespace');
  const service = findKind(items, 'Service');
  const ingress = findKind(items, 'Ingress');

  assert.equal(namespace.metadata.name, 'opl-webui');
  assert.equal(service.metadata.namespace, 'opl-webui');
  assert.equal(ingress.metadata.namespace, 'opl-webui');
  assert.equal(service.metadata.name, 'opl-webui-control-plane');
  assert.equal(service.spec.type, 'NodePort');
  assert.equal(service.spec.ports[0].port, 4173);
  assert.equal(service.spec.ports[0].targetPort, 4173);
  assert.equal(service.spec.ports[0].nodePort, 32258);
  assert.equal(ingress.spec.ingressClassName, 'qcloud');
  assert.deepEqual(ingress.spec.tls, [
    { hosts: ['opl.medopl.cn'], secretName: 'opl-webui-tls' },
  ]);
  assert.equal(ingress.spec.rules[0].host, 'opl.medopl.cn');
  assert.equal(ingress.spec.rules[0].http.paths[0].backend.service.name, 'opl-webui-control-plane');
  assert.equal(ingress.spec.rules[0].http.paths[0].backend.service.port.number, 4173);
});

test('web cloud fixture requires web_cloud runtime and readonly OPL CLI path', () => {
  const { items } = loadManifest();
  const deployment = findKind(items, 'Deployment');
  const podSpec = deployment.spec.template.spec;
  const container = deployment.spec.template.spec.containers[0];

  assert.equal(deployment.metadata.namespace, 'opl-webui');
  assert.deepEqual(podSpec.imagePullSecrets, [{ name: 'tcr-pull-secret' }]);
  assert.deepEqual(podSpec.nodeSelector, { 'medopl.cn/webui': 'true' });
  assert.equal(container.ports[0].containerPort, 4173);
  assert.equal(containerEnv(container, 'OPL_WEBUI_ENV').value, 'web_cloud');
  assert.equal(containerEnv(container, 'OPL_CLI_PATH').value, '/opt/opl/bin/opl');
  assert.deepEqual(container.resources.requests, { cpu: '100m', memory: '128Mi' });
  assert.deepEqual(container.resources.limits, { cpu: '500m', memory: '512Mi' });
  assert.equal(container.readinessProbe.httpGet.path, '/readyz');
  assert.equal(container.livenessProbe.httpGet.path, '/healthz');
});

test('web cloud fixture stays single-node launch-safe while HA is paused', () => {
  const { items } = loadManifest();
  const deployment = findKind(items, 'Deployment');
  const pdb = findKind(items, 'PodDisruptionBudget');
  const podSpec = deployment.spec.template.spec;

  assert.equal(deployment.spec.replicas, 1);
  assert.equal(deployment.spec.strategy, undefined);
  assert.equal(podSpec.topologySpreadConstraints, undefined);
  assert.equal(podSpec.affinity, undefined);
  assert.equal(pdb, undefined);
});

test('web cloud fixture references Postgres through a secret only', () => {
  const { raw, items } = loadManifest();
  const container = findKind(items, 'Deployment').spec.template.spec.containers[0];
  const databaseEnv = containerEnv(container, 'OPL_DATABASE_URL');

  assert.deepEqual(databaseEnv.valueFrom.secretKeyRef, {
    name: 'opl-webui-postgres',
    key: 'OPL_DATABASE_URL',
  });
  assert.doesNotMatch(raw, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(raw, /password\s*[:=]/i);
  assert.doesNotMatch(raw, /PGPASSWORD/i);
});

test('web cloud fixture injects public account and API key secrets through secrets only', () => {
  const { raw, items } = loadManifest();
  const container = findKind(items, 'Deployment').spec.template.spec.containers[0];

  assert.deepEqual(containerEnv(container, 'OPL_TENANT_AUTH_SECRET').valueFrom.secretKeyRef, {
    name: 'opl-webui-auth',
    key: 'OPL_TENANT_AUTH_SECRET',
  });
  assert.deepEqual(containerEnv(container, 'OPL_SESSION_SECRET').valueFrom.secretKeyRef, {
    name: 'opl-webui-auth',
    key: 'OPL_SESSION_SECRET',
  });
  assert.deepEqual(containerEnv(container, 'OPL_API_KEY_ENCRYPTION_SECRET').valueFrom.secretKeyRef, {
    name: 'opl-webui-auth',
    key: 'OPL_API_KEY_ENCRYPTION_SECRET',
  });
  assert.deepEqual(containerEnv(container, 'OPL_CHAT_MODEL').valueFrom.secretKeyRef, {
    name: 'opl-webui-auth',
    key: 'OPL_CHAT_MODEL',
  });
  assert.doesNotMatch(raw, /OPL_(?:TENANT_AUTH_SECRET|SESSION_SECRET|API_KEY_ENCRYPTION_SECRET|CHAT_MODEL)"\s*,\s*"value"/);
  assert.doesNotMatch(raw, /OPL_TENANT_AUTH_MODE/);
});

test('web cloud fixture is declarative and contains no live execution command', () => {
  const { raw } = loadManifest();

  assert.doesNotMatch(raw, /kubectl|docker\s+(?:build|push)|buildx|helm|terraform|pulumi/i);
  assert.doesNotMatch(raw, /\bapply\b/i);
});

test('web cloud runbook covers handoff steps without storing secrets', () => {
  assert.equal(existsSync(runbookPath), true);
  const runbook = readFileSync(runbookPath, 'utf8');

  for (const required of [
    'TCR/CCR',
    'GitHub Actions',
    'TCR_USERNAME',
    'TCR_PASSWORD',
    'OPL_BUILD_CONTEXT',
    'self-hosted',
    'tencent-cloud',
    'OPL_IMAGE',
    'uswccr.ccs.tencentyun.com/webopl/opl-webui:30a3249',
    'short_commit',
    'Release Image',
    'Cloud Rollout',
    'optional production authenticated dogfood',
    'one-person-lab-web',
    'OPL_TENANT_AUTH_SECRET',
    'OPL_SESSION_SECRET',
    'OPL_API_KEY_ENCRYPTION_SECRET',
    'OPL_CHAT_MODEL',
    'https://gflabtoken.cn/v1',
    'no-public-staging production-gated release',
    'staging.opl.medopl.cn',
    'fake staging',
    'TCR/CCR 才是版本存储',
    'Environment approval',
    'PR 不拿 secrets',
    'image allowlist',
    'uswccr.ccs.tencentyun.com/webopl/opl-webui:<tag>',
    'uswccr.ccs.tencentyun.com/webopl/opl-webui@sha256:<digest>',
    'release short commit tag',
    'opl-webui-postgres',
    'OPL_DATABASE_URL',
    'kubectl apply',
    'set image',
    'rollout status',
    'rollout undo',
    'canary db',
    'canary opl-cli',
    '/healthz',
    '/readyz',
    '/metricsz',
    'missingDependencyCount=0',
    'https://opl.medopl.cn',
    'qcloud',
    'qcloud_cert_id',
    'opl-webui-tls',
    'Opaque',
    'NodePort',
    'DNS',
    '504',
    'W1012',
    'replicas=2',
    'topologySpreadConstraints',
    'podAntiAffinity',
    'PDB',
    'minAvailable: 1',
    'DoNotSchedule',
    'medopl.cn/workload=medopl',
    'medopl.cn/webui=true',
    '80,443',
    '32258',
    '腾讯云控制台',
    'rollback',
    'Production authenticated dogfood e2e',
    'OPL_PRODUCTION_DOGFOOD_E2E',
    'OPL_PRODUCTION_DOGFOOD_REAL_CHAT',
    'OPL_DOGFOOD_API_KEY',
    'OPL_DOGFOOD_PASSWORD',
    '默认跳过',
    '至少 12 个字符',
    '不打印 raw API Key',
  ]) {
    assert.match(runbook, new RegExp(required.replace(/[/-]/g, '\\$&'), 'i'));
  }
  assert.match(runbook, /opl-webui:\$\{short_commit\}/);
  assert.match(runbook, /CI.*main.*push/is);
  assert.match(runbook, /pull_request.*secrets/is);
  assert.match(runbook, /self-hosted.*tencent-cloud.*opl-webui/is);
  assert.match(runbook, /target_environment.*production/is);
  assert.match(runbook, /apply.*false/is);
  assert.match(runbook, /apply.*true/is);
  assert.match(runbook, /production-dry-run.*production-apply/is);
  assert.match(runbook, /dogfood job 依赖.*production-apply/is);
  assert.match(runbook, /apply=false.*dogfood.*fail-closed/is);
  assert.match(runbook, /image=<short_commit>/);
  assert.match(runbook, /短 tag 只会规范化到 `uswccr\.ccs\.tencentyun\.com\/webopl\/opl-webui:<tag>`/);
  assert.match(runbook, /floating `latest` 继续 fail-closed/);
  assert.match(runbook, /production.*Environment approval/is);
  assert.match(runbook, /Production 必需 Secret.*opl-webui-auth.*OPL_TENANT_AUTH_SECRET.*OPL_SESSION_SECRET/is);
  assert.match(runbook, /API Key[\s\S]{0,120}OPL_API_KEY_ENCRYPTION_SECRET/is);
  assert.match(runbook, /POST \/api\/chat[\s\S]{0,80}401 AUTH_REQUIRED/is);
  assert.match(runbook, /GET \/api\/session\/current[\s\S]{0,80}401 AUTH_REQUIRED/is);
  assert.match(runbook, /OPL_IMAGE="<short-commit-or-full-tag-or-digest>" node scripts\/cloud-rollout\.mjs/);
  assert.match(runbook, /OPL_IMAGE="<short-commit-or-full-tag-or-digest>"[\s\S]{0,100}node scripts\/cloud-rollout\.mjs --apply/);
  assert.match(runbook, /node scripts\/cloud-rollout\.mjs --dogfood-e2e/is);
  assert.match(runbook, /不连接 MedOPL production/is);
  assert.match(runbook, /不执行真实 OPL/is);
  assert.match(runbook, /Release Image.*不执行 rollout/is);
  assert.match(runbook, /staging.*不是镜像存储/is);
  assert.match(runbook, /创建真实.*opl-webui-staging.*独立 staging DB\/Secret\/TLS\/DNS/is);
  assert.match(runbook, /KUBECONFIG=.*external/i);
  assert.match(runbook, /\/home\/dev\/\.secrets\/opl-webui\/postgresql\/oplweb\.env/);
  assert.doesNotMatch(runbook, /postgres(?:ql)?:\/\/[^`\s]+/i);
  assert.doesNotMatch(runbook, /password\s*[:=]\s*[^<\s]+/i);
  assert.doesNotMatch(runbook, /secret\s*[:=]\s*(?!["']?\$|["']?<)[^`\s]+/i);
  assert.doesNotMatch(runbook, /qcloud_cert_id\s*[:=]\s*(?!["']?\$)[^`\s]+/i);
  assert.doesNotMatch(runbook, /AKID[A-Za-z0-9]+/);
});

test('web cloud runbook routes daily rollout through the dry-run helper', () => {
  const runbook = readFileSync(runbookPath, 'utf8');

  assert.match(runbook, /scripts\/cloud-rollout\.mjs/);
  assert.match(runbook, /--apply/);
  assert.match(runbook, /dry-run/i);
  assert.match(runbook, /rollout revision/i);
  assert.match(runbook, /Deployment image/i);
  assert.match(runbook, /Pod imageID/i);
});
