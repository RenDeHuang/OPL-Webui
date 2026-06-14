import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fixturePath = 'deploy/cloud-mvp/opl-webui.k8s.json';

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
  const service = findKind(items, 'Service');
  const ingress = findKind(items, 'Ingress');

  assert.equal(service.metadata.name, 'opl-webui-control-plane');
  assert.equal(service.spec.ports[0].port, 4173);
  assert.equal(service.spec.ports[0].targetPort, 4173);
  assert.equal(ingress.spec.rules[0].host, 'opl.medopl.cn');
  assert.equal(ingress.spec.rules[0].http.paths[0].backend.service.name, 'opl-webui-control-plane');
  assert.equal(ingress.spec.rules[0].http.paths[0].backend.service.port.number, 4173);
});

test('cloud MVP fixture requires cloud_mvp runtime and readonly OPL CLI path', () => {
  const { items } = loadManifest();
  const deployment = findKind(items, 'Deployment');
  const container = deployment.spec.template.spec.containers[0];

  assert.equal(container.ports[0].containerPort, 4173);
  assert.equal(containerEnv(container, 'OPL_WEBUI_ENV').value, 'cloud_mvp');
  assert.equal(containerEnv(container, 'OPL_CLI_PATH').value, '/opt/opl/bin/opl');
  assert.equal(containerEnv(container, 'OPL_TENANT_AUTH_MODE').value, 'medopl_launch_token');
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
