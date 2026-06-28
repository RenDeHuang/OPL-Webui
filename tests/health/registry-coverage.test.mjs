import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import * as testClassification from '../../scripts/test-classification.mjs';

const {
  CLAIM_SCOPES,
  LIFECYCLE_ROLES,
  PROOF_LEVELS,
  TEST_COSTS,
  TEST_KINDS,
  TEST_LANE_REGISTRY,
  VERIFY_SUITES,
} = testClassification;

test('registry covers the current lane model', () => {
  for (const lane of [
    'smoke',
    'contract',
    'interaction',
    'interaction-browser',
    'health-light',
    'health',
    'go-light',
    'browser',
    'integration',
    'release',
    'regression',
    'real-medopl',
  ]) {
    assert.ok(TEST_LANE_REGISTRY[lane], `missing ${lane} lane`);
  }

  for (const lane of [
    'smoke',
    'contract',
    'interaction',
    'interaction-browser',
    'health-light',
    'health',
    'go-light',
    'browser',
    'integration',
    'release',
    'real-medopl',
  ]) {
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
      assert.ok(Array.isArray(TEST_COSTS), 'registry must publish supported test costs');
      assert.ok(Array.isArray(LIFECYCLE_ROLES), 'registry must publish supported lifecycle roles');
      assert.ok(TEST_COSTS.includes(entry.cost), `${entry.file} must declare supported cost`);
      assert.ok(LIFECYCLE_ROLES.includes(entry.lifecycleRole), `${entry.file} must declare supported lifecycle role`);
      assert.ok(Array.isArray(entry.riskTriggers), `${entry.file} must declare risk triggers`);
      assert.ok(entry.riskTriggers.length > 0, `${entry.file} must declare at least one risk trigger`);
      assert.ok(Array.isArray(entry.contracts));
      assert.ok(entry.contracts.length > 0, `${entry.file} must declare contract refs`);
      for (const contractRef of entry.contracts) {
        assert.ok(existsSync(contractRef), `${entry.file} references missing contract: ${contractRef}`);
      }
      assert.ok(Array.isArray(entry.verifySuites));
      assert.ok(entry.verifySuites.length > 0, `${entry.file} must declare verify suites`);
      assert.ok(TEST_KINDS.includes(entry.testKind), `${entry.file} must declare supported testKind`);
      assert.ok(PROOF_LEVELS.includes(entry.proofLevel), `${entry.file} must declare supported proofLevel`);
      assert.ok(CLAIM_SCOPES.includes(entry.claimScope), `${entry.file} must declare supported claimScope`);
      assert.ok(Array.isArray(entry.proves), `${entry.file} must declare proves`);
      assert.ok(entry.proves.length > 0, `${entry.file} must prove at least one claim`);
      assert.ok(Array.isArray(entry.doesNotProve), `${entry.file} must declare doesNotProve`);
      assert.ok(entry.doesNotProve.length > 0, `${entry.file} must declare at least one cannot-claim boundary`);
    }
  }

  assert.equal(new Set(registeredFiles).size, registeredFiles.length, 'registered tests must be unique');
});

test('verify suites separate daily current from explicit heavy lanes', () => {
  assert.deepEqual(VERIFY_SUITES.current, ['smoke', 'interaction', 'health-light', 'go-light']);
  assert.deepEqual(VERIFY_SUITES.contract, ['contract', 'interaction']);
  assert.deepEqual(VERIFY_SUITES.interaction, ['interaction', 'interaction-browser']);
  assert.deepEqual(VERIFY_SUITES.health, ['health-light', 'health']);
  assert.deepEqual(VERIFY_SUITES.backend, ['go-light']);
  assert.deepEqual(VERIFY_SUITES.go, ['go-light']);
  assert.deepEqual(VERIFY_SUITES.integration, ['integration']);
  assert.deepEqual(VERIFY_SUITES.release, ['release']);
  assert.deepEqual(VERIFY_SUITES.deploy, ['release']);
  assert.deepEqual(VERIFY_SUITES.full, [
    'smoke',
    'contract',
    'interaction',
    'interaction-browser',
    'health-light',
    'health',
    'go-light',
    'browser',
    'integration',
    'release',
    'regression',
  ]);
  assert.deepEqual(VERIFY_SUITES['real-medopl'], ['real-medopl']);
});

test('current suite excludes runtime release browser and heavy sidecar gates', () => {
  const forbiddenProofLevels = new Set(['browser', 'production']);
  const forbiddenRiskTriggers = new Set([
    'browser-e2e',
    'cloud-rollout',
    'deploy',
    'medopl-real-integration',
    'runtime-gate',
    'opl-bridge',
  ]);
  const forbiddenLanes = new Set(['browser', 'interaction-browser', 'integration', 'release', 'real-medopl']);

  for (const laneName of VERIFY_SUITES.current) {
    assert.equal(forbiddenLanes.has(laneName), false, `${laneName} must not run in current`);
    for (const entry of TEST_LANE_REGISTRY[laneName].tests) {
      assert.equal(forbiddenProofLevels.has(entry.proofLevel), false, `${entry.file} must not be current proof ${entry.proofLevel}`);
      for (const risk of entry.riskTriggers) {
        assert.equal(forbiddenRiskTriggers.has(risk), false, `${entry.file} must not run ${risk} risk in current`);
      }
    }
  }
});

test('registry publishes the supported taxonomy values', () => {
  assert.ok(Array.isArray(TEST_COSTS), 'registry must publish supported test costs');
  assert.ok(Array.isArray(LIFECYCLE_ROLES), 'registry must publish supported lifecycle roles');

  for (const cost of ['cheap', 'medium', 'heavy', 'soak', 'golden']) {
    assert.ok(TEST_COSTS.includes(cost), `missing cost taxonomy: ${cost}`);
  }

  for (const role of ['current-owner', 'integration', 'regression-guard', 'tombstone-guard']) {
    assert.ok(LIFECYCLE_ROLES.includes(role), `missing lifecycle taxonomy: ${role}`);
  }

  for (const kind of ['acceptance', 'contract', 'governance', 'regression']) {
    assert.ok(TEST_KINDS.includes(kind), `missing test kind taxonomy: ${kind}`);
  }

  for (const level of ['static', 'unit', 'http', 'browser', 'production']) {
    assert.ok(PROOF_LEVELS.includes(level), `missing proof level taxonomy: ${level}`);
  }

  for (const scope of ['repo', 'local', 'ci', 'production']) {
    assert.ok(CLAIM_SCOPES.includes(scope), `missing claim scope taxonomy: ${scope}`);
  }
});

test('regression guards carry machine-readable retirement metadata', () => {
  for (const lane of Object.values(TEST_LANE_REGISTRY)) {
    for (const entry of lane.tests) {
      if (entry.lifecycleRole !== 'regression-guard') continue;

      assert.equal(entry.lane, 'regression', `${entry.file} regression guard must live in regression lane`);
      assert.equal(typeof entry.retirement, 'object', `${entry.file} must declare retirement metadata`);
      assert.equal(typeof entry.retirement.condition, 'string', `${entry.file} must declare retirement condition`);
      assert.ok(entry.retirement.condition.length > 0, `${entry.file} must declare retirement condition`);
      assert.equal(typeof entry.retirement.deleteWhen, 'string', `${entry.file} must declare deleteWhen`);
      assert.ok(entry.retirement.deleteWhen.length > 0, `${entry.file} must declare deleteWhen`);
      assert.ok(
        Array.isArray(entry.retirement.remove),
        `${entry.file} retirement must declare removal targets`,
      );
      assert.ok(
        entry.retirement.remove.includes('test') && entry.retirement.remove.includes('registry-entry'),
        `${entry.file} retirement must remove test and registry entry`,
      );
    }
  }
});

test('integration and expensive tests enter current only by explicit reason', () => {
  for (const lane of Object.values(TEST_LANE_REGISTRY)) {
    for (const entry of lane.tests) {
      const requiresExplicitCurrentReason =
        entry.lifecycleRole === 'integration' || ['heavy', 'soak', 'golden'].includes(entry.cost);

      if (!requiresExplicitCurrentReason || !entry.verifySuites.includes('current')) continue;

      assert.equal(
        typeof entry.currentSuiteReason,
        'string',
        `${entry.file} must explain why integration/heavy/golden/soak runs in current`,
      );
      assert.ok(entry.currentSuiteReason.length > 0, `${entry.file} must explain current suite inclusion`);
    }
  }
});

test('every current-suite test points back to the current suite', () => {
  const currentLanes = new Set(VERIFY_SUITES.current);
  for (const laneName of VERIFY_SUITES.current) {
    for (const entry of TEST_LANE_REGISTRY[laneName].tests) {
      assert.ok(entry.verifySuites.includes('current'), `${entry.file} must be in current`);
    }
  }

  for (const [laneName, lane] of Object.entries(TEST_LANE_REGISTRY)) {
    for (const entry of lane.tests) {
      if (!entry.verifySuites.includes('current')) continue;
      assert.equal(currentLanes.has(laneName), true, `${entry.file} declares current but lane ${laneName} is not in current`);
    }
  }
});

test('interaction integration release and browser sidecars are first-class lanes, not current spillover', () => {
  const laneFiles = Object.fromEntries(
    Object.entries(TEST_LANE_REGISTRY).map(([laneName, lane]) => [
      laneName,
      lane.tests.map((entry) => entry.file),
    ]),
  );

  assert.ok(laneFiles.interaction.includes('tests/contract/interaction-truth-contract.test.mjs'));
  assert.ok(laneFiles.interaction.includes('tests/contract/public-growth-layer-contract.test.mjs'));
  assert.ok(laneFiles['interaction-browser'].includes('tests/browser/public-growth-login-return.browser.test.mjs'));
  assert.ok(laneFiles['interaction-browser'].includes('tests/browser/interaction-truth.browser.test.mjs'));
  assert.ok(laneFiles.browser.includes('tests/browser/research-main-path.browser.test.mjs'));
  assert.ok(laneFiles.integration.includes('tests/contract/medopl-runtime-bridge-contract.test.mjs'));
  assert.ok(laneFiles.integration.includes('tests/contract/opl-readonly-bridge.test.mjs'));
  assert.ok(laneFiles.integration.includes('tests/contract/web-runtime-state.test.mjs'));
  assert.ok(laneFiles.integration.includes('services/control-plane-go/internal/oplbridge/snapshot_test.go'));
  assert.ok(laneFiles.integration.includes('services/control-plane-go/internal/runtimegate/gate_test.go'));
  assert.ok(laneFiles.release.includes('tests/deploy/container-readiness.test.mjs'));
  assert.ok(laneFiles.release.includes('tests/contract/web-cloud-deploy-shape.test.mjs'));
  assert.ok(laneFiles.release.includes('tests/contract/cloud-rollout-helper.test.mjs'));
  assert.ok(laneFiles.release.includes('tests/health/workflow-entrypoint.test.mjs'));
  assert.ok(laneFiles.release.includes('tests/health/ai-development-gate.test.mjs'));
  assert.ok(laneFiles['real-medopl'].includes('tests/real-medopl/real-medopl-business-flow.e2e.test.mjs'));
  assert.ok(laneFiles['go-light'].includes('services/control-plane-go/cmd/opl-webui-control-plane/main_test.go'));

  const currentFiles = VERIFY_SUITES.current.flatMap((laneName) => laneFiles[laneName]);
  assert.equal(currentFiles.includes('tests/health/workflow-entrypoint.test.mjs'), false);
  assert.equal(currentFiles.includes('tests/health/ai-development-gate.test.mjs'), false);
  assert.equal(currentFiles.includes('tests/contract/medopl-runtime-bridge-contract.test.mjs'), false);
  assert.equal(currentFiles.includes('services/control-plane-go/internal/runtimegate/gate_test.go'), false);
  assert.equal(laneFiles.health.some((file) => file.startsWith('tests/browser/')), false);
  assert.equal(laneFiles.health.some((file) => file.startsWith('tests/real-medopl/')), false);
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
