import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { TEST_LANE_REGISTRY, VERIFY_SUITES } from '../../scripts/test-classification.mjs';

test('registry covers the initial health, contract, and smoke lanes', () => {
  for (const lane of ['health', 'contract', 'smoke']) {
    assert.ok(TEST_LANE_REGISTRY[lane], `missing ${lane} lane`);
    assert.ok(TEST_LANE_REGISTRY[lane].tests.length > 0, `${lane} lane has no tests`);
  }
});

test('registry points only at existing node test files', () => {
  const registeredFiles = [];
  for (const lane of Object.values(TEST_LANE_REGISTRY)) {
    for (const entry of lane.tests) {
      registeredFiles.push(entry.file);
      assert.match(entry.file, /^tests\/.+\.test\.mjs$/);
      assert.ok(existsSync(entry.file), `missing registered test file: ${entry.file}`);
      assert.equal(typeof entry.ownerSurface, 'string');
      assert.equal(typeof entry.lifecycleRole, 'string');
      assert.ok(Array.isArray(entry.contracts));
      assert.ok(entry.contracts.length > 0, `${entry.file} must declare contract refs`);
      assert.ok(Array.isArray(entry.verifySuites));
      assert.ok(entry.verifySuites.length > 0, `${entry.file} must declare verify suites`);
    }
  }

  assert.equal(new Set(registeredFiles).size, registeredFiles.length, 'registered tests must be unique');
});

test('current verify suite includes every first-phase lane', () => {
  assert.deepEqual(VERIFY_SUITES.current, ['health', 'contract', 'smoke']);
});

test('every current-suite test points back to the current suite', () => {
  for (const laneName of VERIFY_SUITES.current) {
    for (const entry of TEST_LANE_REGISTRY[laneName].tests) {
      assert.ok(entry.verifySuites.includes('current'), `${entry.file} must be in current`);
    }
  }
});

function collectTestFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(path));
    } else if (entry.isFile() && path.endsWith('.test.mjs')) {
      files.push(path);
    }
  }
  return files.sort();
}

test('every node test file is explicitly registered', () => {
  const allTestFiles = collectTestFiles('tests');
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
