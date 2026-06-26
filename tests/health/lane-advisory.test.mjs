import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import {
  recommendedVerifyTargetsForFiles,
} from '../../scripts/lane-advisory.mjs';

test('lane advisory maps changed files to targeted verify lanes', () => {
  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'apps/web/src/onePersonLabWeb.mjs',
  ]), ['smoke', 'browser']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'contracts/web-page-state-matrix.json',
  ]), ['contract', 'browser']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'services/control-plane-go/internal/webapp/handlers.go',
  ]), ['contract', 'go']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    '.github/workflows/cloud-rollout.yml',
    'scripts/cloud-rollout.mjs',
  ]), ['deploy', 'health']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'services/control-plane-go/internal/oplbridge/snapshot.go',
  ]), ['contract', 'go', 'full']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'contracts/web-development-profile.json',
    'scripts/ai-development-gate.mjs',
  ]), ['contract', 'health']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'contracts/web-surface-inventory.json',
  ]), ['contract', 'health']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'scripts/release-evidence-sync.mjs',
    'contracts/web-release-profile.json',
  ]), ['contract', 'deploy', 'health']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'tests/real-medopl/real-medopl-business-flow.e2e.test.mjs',
  ]), ['real-medopl']);
});

test('lane advisory CLI reports suggestions without failing the gate', () => {
  const stdout = execFileSync(
    process.execPath,
    ['scripts/lane-advisory.mjs', 'apps/web/index.html', 'deploy/web-cloud/RUNBOOK.md'],
    { encoding: 'utf8' },
  );

  assert.match(stdout, /\[lane-advisory\]/);
  assert.match(stdout, /npm run verify:browser/);
  assert.match(stdout, /npm run verify:deploy/);
});
