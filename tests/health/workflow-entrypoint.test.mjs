import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import test from 'node:test';

import pkg from '../../package.json' with { type: 'json' };

test('workflow entrypoints are wired through package scripts', () => {
  assert.equal(pkg.scripts['gate:review'], 'node scripts/workflow-gate.mjs');
  assert.equal(pkg.scripts['repo:bloat'], 'node scripts/repo-bloat-audit.mjs');
  assert.equal(pkg.scripts['check:diff'], 'git diff --check');
  assert.equal(pkg.scripts['start:mvp'], 'node apps/api/src/server.mjs');
  assert.equal(pkg.scripts.verify, 'node scripts/verify.mjs current');
  assert.equal(pkg.scripts['test:health'], 'node scripts/verify.mjs suite health');
  assert.equal(pkg.scripts['test:contract'], 'node scripts/verify.mjs suite contract');
  assert.equal(pkg.scripts['test:smoke'], 'node scripts/verify.mjs suite smoke');
});

test('workflow gate script exists', () => {
  assert.equal(existsSync('scripts/workflow-gate.mjs'), true);
});

test('review gate includes diff hygiene, bloat, and current verify', async () => {
  const { REVIEW_GATE_STEPS } = await import('../../scripts/workflow-gate.mjs');
  assert.deepEqual(REVIEW_GATE_STEPS.map((step) => step.label), [
    'diff hygiene',
    'repo bloat audit',
    'current verify',
  ]);
});

test('workflow gate can be imported without executing gate steps', () => {
  const stdout = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', "import './scripts/workflow-gate.mjs'; console.log('imported')"],
    { encoding: 'utf8' },
  );

  assert.equal(stdout.trim(), 'imported');
});
