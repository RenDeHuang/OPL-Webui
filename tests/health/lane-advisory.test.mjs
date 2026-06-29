import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import {
  recommendedVerifyTargetsForFiles,
} from '../../scripts/lane-advisory.mjs';

test('lane advisory maps changed files to targeted verify lanes', () => {
  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'frontend/web/src/app/main.mjs',
  ]), ['ui', 'smoke', 'interaction', 'browser:golden']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'contracts/web-page-state-matrix.json',
  ]), ['interaction', 'contract', 'browser:golden']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'backend/control-plane-go/internal/webapp/handlers.go',
  ]), ['api', 'go']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    '.github/workflows/cloud-rollout.yml',
    'scripts/cloud-rollout.mjs',
  ]), ['release']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'backend/control-plane-go/internal/oplbridge/snapshot.go',
  ]), ['integration']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'contracts/web-development-profile.json',
    'scripts/ai-development-gate.mjs',
  ]), ['health', 'release']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'contracts/web-surface-inventory.json',
  ]), ['health']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'scripts/release-evidence-sync.mjs',
    'contracts/web-release-profile.json',
  ]), ['release']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'tests/real-medopl/real-medopl-business-flow.e2e.test.mjs',
  ]), ['real-medopl']);
});

test('lane advisory CLI reports suggestions without failing the gate', () => {
  const stdout = execFileSync(
    process.execPath,
    ['scripts/lane-advisory.mjs', 'frontend/web/index.html', 'deploy/web-cloud/RUNBOOK.md'],
    { encoding: 'utf8' },
  );

  assert.match(stdout, /\[lane-advisory\]/);
  assert.match(stdout, /npm run verify:browser:golden/);
  assert.match(stdout, /npm run verify:release/);
});
