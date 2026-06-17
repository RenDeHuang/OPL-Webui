import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const fixturePath = 'deploy/cloud-mvp/opl-webui.k8s.json';
const runbookPath = 'deploy/cloud-mvp/RUNBOOK.md';

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

test('cloud MVP fixture exposes opl.medopl.cn through the Go control plane service', () => {
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

test('cloud MVP fixture requires cloud_mvp runtime and readonly OPL CLI path', () => {
  const { items } = loadManifest();
  const deployment = findKind(items, 'Deployment');
  const podSpec = deployment.spec.template.spec;
  const container = deployment.spec.template.spec.containers[0];

  assert.equal(deployment.metadata.namespace, 'opl-webui');
  assert.deepEqual(podSpec.imagePullSecrets, [{ name: 'tcr-pull-secret' }]);
  assert.deepEqual(podSpec.nodeSelector, { 'medopl.cn/workload': 'webui' });
  assert.equal(container.ports[0].containerPort, 4173);
  assert.equal(containerEnv(container, 'OPL_WEBUI_ENV').value, 'cloud_mvp');
  assert.equal(containerEnv(container, 'OPL_CLI_PATH').value, '/opt/opl/bin/opl');
  assert.equal(containerEnv(container, 'OPL_TENANT_AUTH_MODE').value, 'medopl_launch_token');
  assert.deepEqual(container.resources.requests, { cpu: '100m', memory: '128Mi' });
  assert.deepEqual(container.resources.limits, { cpu: '500m', memory: '512Mi' });
  assert.equal(container.readinessProbe.httpGet.path, '/readyz');
  assert.equal(container.livenessProbe.httpGet.path, '/healthz');
});

test('cloud MVP fixture references Postgres through a secret only', () => {
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

test('cloud MVP fixture is declarative and contains no live execution command', () => {
  const { raw } = loadManifest();

  assert.doesNotMatch(raw, /kubectl|docker\s+(?:build|push)|buildx|helm|terraform|pulumi/i);
  assert.doesNotMatch(raw, /\bapply\b/i);
});

test('cloud MVP runbook covers handoff steps without storing secrets', () => {
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
    '010c2b9',
    'production rollout evidence',
    'no-public-staging production-gated release',
    'staging.opl.medopl.cn',
    'fake staging',
    'TCR/CCR 才是版本存储',
    'Environment approval',
    'PR 不拿 secrets',
    'image allowlist',
    'uswccr.ccs.tencentyun.com/webopl/opl-webui:<tag>',
    'uswccr.ccs.tencentyun.com/webopl/opl-webui@sha256:<digest>',
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
    'medopl.cn/workload=webui',
    '80,443',
    '32258',
    '腾讯云控制台',
    'rollback',
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
  assert.match(runbook, /production.*Environment approval/is);
  assert.match(runbook, /OPL_IMAGE=.*010c2b9/i);
  assert.match(runbook, /\/metricsz.*production.*evidence/is);
  assert.match(runbook, /Release Image.*不执行 rollout/is);
  assert.match(runbook, /staging.*不是镜像存储/is);
  assert.match(runbook, /创建真实.*opl-webui-staging.*独立 staging DB\/Secret\/TLS\/DNS/is);
  assert.match(runbook, /KUBECONFIG=.*external/i);
  assert.match(runbook, /\/home\/dev\/\.secrets\/opl-webui\/postgresql\/oplweb\.env/);
  assert.doesNotMatch(runbook, /postgres(?:ql)?:\/\/[^`\s]+/i);
  assert.doesNotMatch(runbook, /password\s*[:=]\s*[^<\s]+/i);
  assert.doesNotMatch(runbook, /secret\s*[:=]\s*[^<\s]+/i);
  assert.doesNotMatch(runbook, /qcloud_cert_id\s*[:=]\s*(?!["']?\$)[^`\s]+/i);
  assert.doesNotMatch(runbook, /AKID[A-Za-z0-9]+/);
});

test('cloud MVP runbook routes daily rollout through the dry-run helper', () => {
  const runbook = readFileSync(runbookPath, 'utf8');

  assert.match(runbook, /scripts\/cloud-rollout\.mjs/);
  assert.match(runbook, /--apply/);
  assert.match(runbook, /dry-run/i);
  assert.match(runbook, /rollout revision/i);
  assert.match(runbook, /Deployment image/i);
  assert.match(runbook, /Pod imageID/i);
});
