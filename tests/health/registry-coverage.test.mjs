import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { TEST_LANE_REGISTRY, VERIFY_SUITES } from '../../scripts/test-classification.mjs';

test('registry covers the current lane model', () => {
  for (const lane of ['smoke', 'contract', 'health', 'go', 'browser', 'deploy', 'regression']) {
    assert.ok(TEST_LANE_REGISTRY[lane], `missing ${lane} lane`);
  }

  for (const lane of ['smoke', 'contract', 'health', 'go', 'browser', 'deploy']) {
    assert.ok(TEST_LANE_REGISTRY[lane].tests.length > 0, `${lane} lane has no tests`);
  }
});

test('registry points only at existing test files', () => {
  const registeredFiles = [];
  for (const lane of Object.values(TEST_LANE_REGISTRY)) {
    for (const entry of lane.tests) {
      registeredFiles.push(entry.file);
      assert.ok(existsSync(entry.file), `missing registered test file: ${entry.file}`);
      assert.ok(['node', 'go'].includes(entry.runner), `${entry.file} must declare a supported runner`);
      if (entry.runner === 'node') {
        assert.match(entry.file, /^tests\/.+\.test\.mjs$/);
      }
      if (entry.runner === 'go') {
        assert.match(entry.file, /^services\/.+_test\.go$/);
        assert.equal(typeof entry.cwd, 'string');
        assert.ok(existsSync(entry.cwd), `${entry.file} references missing cwd: ${entry.cwd}`);
        assert.equal(typeof entry.goPackage, 'string');
      }
      assert.equal(typeof entry.ownerSurface, 'string');
      assert.equal(typeof entry.lifecycleRole, 'string');
      assert.ok(['cheap', 'medium', 'heavy'].includes(entry.cost), `${entry.file} must declare cost`);
      assert.ok(Array.isArray(entry.riskTriggers), `${entry.file} must declare risk triggers`);
      assert.ok(entry.riskTriggers.length > 0, `${entry.file} must declare at least one risk trigger`);
      assert.ok(Array.isArray(entry.contracts));
      assert.ok(entry.contracts.length > 0, `${entry.file} must declare contract refs`);
      for (const contractRef of entry.contracts) {
        assert.ok(existsSync(contractRef), `${entry.file} references missing contract: ${contractRef}`);
      }
      assert.ok(Array.isArray(entry.verifySuites));
      assert.ok(entry.verifySuites.length > 0, `${entry.file} must declare verify suites`);
    }
  }

  assert.equal(new Set(registeredFiles).size, registeredFiles.length, 'registered tests must be unique');
});

test('verify suites separate daily current from explicit heavy lanes', () => {
  assert.deepEqual(VERIFY_SUITES.current, ['smoke', 'contract', 'health', 'go']);
  assert.deepEqual(VERIFY_SUITES.full, ['smoke', 'contract', 'health', 'go', 'browser', 'deploy', 'regression']);
});

test('every current-suite test points back to the current suite', () => {
  for (const laneName of VERIFY_SUITES.current) {
    for (const entry of TEST_LANE_REGISTRY[laneName].tests) {
      assert.ok(entry.verifySuites.includes('current'), `${entry.file} must be in current`);
    }
  }
});

test('browser and deploy tests are first-class lanes, not health spillover', () => {
  const laneFiles = Object.fromEntries(
    Object.entries(TEST_LANE_REGISTRY).map(([laneName, lane]) => [
      laneName,
      lane.tests.map((entry) => entry.file),
    ]),
  );

  assert.ok(laneFiles.browser.includes('tests/browser/research-main-path.browser.test.mjs'));
  assert.ok(laneFiles.deploy.includes('tests/deploy/container-readiness.test.mjs'));
  assert.ok(laneFiles.deploy.includes('tests/contract/web-cloud-deploy-shape.test.mjs'));
  assert.ok(laneFiles.deploy.includes('tests/contract/cloud-rollout-helper.test.mjs'));
  assert.ok(laneFiles.go.includes('services/control-plane-go/cmd/opl-webui-control-plane/main_test.go'));

  assert.equal(laneFiles.health.some((file) => file.startsWith('tests/browser/')), false);
  assert.equal(laneFiles.health.includes('tests/deploy/container-readiness.test.mjs'), false);
});

function collectTestFiles(dir, predicate) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(path, predicate));
    } else if (entry.isFile() && predicate(path)) {
      files.push(path);
    }
  }
  return files.sort();
}

test('every current test file is explicitly registered', () => {
  const allTestFiles = [
    ...collectTestFiles('tests', (path) => path.endsWith('.test.mjs')),
    ...collectTestFiles('services', (path) => path.endsWith('_test.go')),
  ].sort();
  const registered = new Set(
    Object.values(TEST_LANE_REGISTRY).flatMap((lane) => lane.tests.map((entry) => entry.file)),
  );

  for (const file of allTestFiles) {
    assert.ok(registered.has(file), `unregistered test file: ${file}`);
  }

  for (const file of registered) {
    assert.ok(statSync(file).isFile(), `registered test is not a file: ${file}`);
  }
});
