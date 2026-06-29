import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import {
  recommendedVerifyTargetsForFiles,
} from '../../scripts/lane-advisory.mjs';

test('lane advisory maps changed files to targeted verify lanes', () => {
  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'frontend/web/src/features/public-landing/publicAuthSurface.mjs',
  ]), ['ui']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'contracts/web-page-state-matrix.json',
  ]), ['interaction', 'contract']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'backend/control-plane-go/internal/webapp/handlers.go',
  ]), ['api', 'go']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    '.github/workflows/cloud-rollout.yml',
    'scripts/cloud-rollout.mjs',
  ]), ['browser:golden', 'release']);

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
  ]), ['browser:golden', 'release']);

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
  assert.match(stdout, /npm run verify:ui/);
  assert.match(stdout, /npm run verify:release/);
});

test('lane advisory keeps browser golden out of ordinary UI surface edits', () => {
  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'frontend/web/src/features/workbench/workbenchSurface.mjs',
    'frontend/web/styles/workbench.css',
  ]), ['ui']);
});

test('lane advisory escalates shared route and browser runner edits without making all UI changes release-like', () => {
  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'frontend/web/src/app/shellController.mjs',
  ]), ['ui', 'interaction']);

  assert.deepEqual(recommendedVerifyTargetsForFiles([
    'tests/browser/research-main-path-runner.mjs',
  ]), ['browser:golden', 'browser']);
});
