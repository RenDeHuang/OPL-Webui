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
    'OPL_IMAGE',
    'opl-webui-postgres',
    'OPL_DATABASE_URL',
    'kubectl apply',
    'canary db',
    'canary opl-cli',
    '/healthz',
    '/readyz',
    'qcloud',
    'NodePort',
    'DNS',
    '504',
    'rollback',
  ]) {
    assert.match(runbook, new RegExp(required.replace(/[/-]/g, '\\$&'), 'i'));
  }
  assert.match(runbook, /KUBECONFIG=.*external/i);
  assert.match(runbook, /\/home\/dev\/\.secrets\/opl-webui\/postgresql\/oplweb\.env/);
  assert.doesNotMatch(runbook, /postgres(?:ql)?:\/\/[^`\s]+/i);
  assert.doesNotMatch(runbook, /password\s*[:=]\s*[^<\s]+/i);
  assert.doesNotMatch(runbook, /secret\s*[:=]\s*[^<\s]+/i);
  assert.doesNotMatch(runbook, /AKID[A-Za-z0-9]+/);
});
