import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

import pkg from '../../package.json' with { type: 'json' };

const lifecycleFiles = [
  'proposal.md',
  'spec-delta.md',
  'design.md',
  'tasks.md',
  'eval-plan.md',
  'review.md',
  'closeout.md',
];

test('package lifecycle exposes verification-only commands', () => {
  const requiredScripts = [
    'verify',
    'verify:health',
    'verify:smoke',
    'verify:contract',
    'test:health',
    'test:smoke',
    'test:contract',
    'test:regression',
    'gate:review',
    'repo:bloat',
    'check:diff',
  ];

  for (const scriptName of requiredScripts) {
    assert.ok(pkg.scripts[scriptName], `missing package script: ${scriptName}`);
  }
});

test('package does not introduce runtime or dev dependencies', () => {
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});

test('foundation change package is archived after closeout', () => {
  const root = 'changes/archive/2026-06-14-foundation-loop-contracts';

  for (const file of lifecycleFiles) {
    assert.equal(existsSync(`${root}/${file}`), true, `missing change lifecycle file: ${file}`);
  }

  const evalPlan = readFileSync(`${root}/eval-plan.md`, 'utf8');
  assert.match(evalPlan, /npm run verify/);
  assert.match(evalPlan, /npm run gate:review/);
  assert.match(evalPlan, /npm run repo:bloat/);
  assert.match(evalPlan, /Cannot Claim/);

  const history = readFileSync('docs/history/README.md', 'utf8');
  assert.match(history, /foundation-loop-contracts/);
  assert.match(history, /41515a6/);
});

test('active change packages are complete and eval-backed', () => {
  for (const changeId of readdirSync('changes/active')) {
    const root = `changes/active/${changeId}`;
    for (const file of lifecycleFiles) {
      assert.equal(existsSync(`${root}/${file}`), true, `missing ${changeId}/${file}`);
    }

    const evalPlan = readFileSync(`${root}/eval-plan.md`, 'utf8');
    assert.match(evalPlan, /npm run verify/);
    assert.match(evalPlan, /npm run gate:review/);
    assert.match(evalPlan, /Cannot Claim/);
  }
});
