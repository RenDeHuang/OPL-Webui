import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const inventoryPath = 'contracts/web-surface-inventory.json';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const requiredLongLivedPaths = [
  'README.md',
  'AGENTS.md',
  'TASTE.md',
  'docs/project.md',
  'docs/status.md',
  'docs/decisions.md',
  'docs/architecture.md',
  'docs/invariants.md',
  'docs/docs_portfolio_consolidation.md',
  'docs/active/README.md',
  '.github/workflows/ci.yml',
  '.github/workflows/cloud-rollout.yml',
  '.github/workflows/release-image.yml',
  'deploy/web-cloud/RUNBOOK.md',
  'deploy/web-cloud/opl-webui.k8s.json',
];

test('surface inventory defines durable long-lived surfaces without becoming a full source mirror', () => {
  assert.equal(existsSync(inventoryPath), true, 'missing surface inventory contract');
  const inventory = readJson(inventoryPath);

  assert.equal(inventory.schemaVersion, 1);
  assert.equal(inventory.productId, 'one-person-lab-web');
  assert.equal(inventory.scope, 'long_lived_surfaces_only');
  assert.equal(inventory.excludesOrdinaryImplementationFiles, true);
  assert.ok(Array.isArray(inventory.surfaces));
  assert.ok(inventory.surfaces.length > 0);
  assert.ok(inventory.surfaces.length < 90, 'inventory should not mirror every source file');
});

test('surface inventory entries have owner, consumer, contract or machine boundary, and valid retirement', () => {
  const inventory = readJson(inventoryPath);
  const paths = new Set();

  for (const surface of inventory.surfaces) {
    paths.add(surface.path);
    assert.equal(typeof surface.path, 'string');
    assert.ok(existsSync(surface.path), `surface path must exist: ${surface.path}`);
    assert.equal(typeof surface.type, 'string', `${surface.path} must declare type`);
    assert.equal(typeof surface.ownerSurface, 'string', `${surface.path} must declare ownerSurface`);
    assert.ok(Array.isArray(surface.consumer), `${surface.path} must declare consumer array`);
    assert.ok(surface.consumer.length > 0, `${surface.path} must declare at least one consumer`);
    assert.ok(
      (Array.isArray(surface.contract) && surface.contract.length > 0)
        || typeof surface.machineBoundary === 'string',
      `${surface.path} must declare contract or machineBoundary`,
    );
    assert.ok(
      ['durable', 'integration', 'temporary', 'tombstone'].includes(surface.lifecycle),
      `${surface.path} must declare supported lifecycle`,
    );
    if (surface.lifecycle === 'temporary' || surface.lifecycle === 'tombstone') {
      assert.equal(typeof surface.retirement, 'object', `${surface.path} must declare retirement metadata`);
      assert.equal(typeof surface.retirement.deleteWhen, 'string', `${surface.path} must declare retirement.deleteWhen`);
    }
  }

  assert.equal(paths.size, inventory.surfaces.length, 'surface inventory paths must be unique');
});

test('surface inventory covers scripts, contracts, tests, recurring docs, workflows, deploy, and selected owner source', () => {
  const inventory = readJson(inventoryPath);
  const paths = new Set(inventory.surfaces.map((surface) => surface.path));

  for (const path of [
    ...collectFiles('scripts', (file) => file.endsWith('.mjs')),
    ...collectFiles('contracts', (file) => file.endsWith('.json')),
    ...collectFiles('tests', (file) => file.endsWith('.test.mjs')),
    ...collectFiles('services', (file) => file.endsWith('_test.go')),
    ...requiredLongLivedPaths,
  ]) {
    assert.ok(paths.has(path), `surface inventory missing long-lived path: ${path}`);
  }

  assert.ok(paths.has('apps/web/src/onePersonLabWeb.mjs'), 'inventory should include the Web app owner module');
  assert.ok(paths.has('services/control-plane-go/cmd/opl-webui-control-plane/main.go'), 'inventory should include the Go control-plane owner module');
  assert.equal(paths.has('services/control-plane-go/internal/webapp/postgres_chat.go'), false, 'inventory must not mirror ordinary implementation files');
});

function collectFiles(dir, predicate) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(path, predicate));
    } else if (entry.isFile() && predicate(path)) {
      files.push(path);
    }
  }
  return files.sort();
}
