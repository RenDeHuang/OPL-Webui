import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import pkg from '../../package.json' with { type: 'json' };

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

test('foundation change package has lifecycle files and machine eval commands', () => {
  const root = 'changes/active/foundation-loop-contracts';
  const requiredFiles = [
    'proposal.md',
    'spec-delta.md',
    'design.md',
    'tasks.md',
    'eval-plan.md',
    'review.md',
    'closeout.md',
  ];

  for (const file of requiredFiles) {
    assert.equal(existsSync(`${root}/${file}`), true, `missing change lifecycle file: ${file}`);
  }

  const evalPlan = readFileSync(`${root}/eval-plan.md`, 'utf8');
  assert.match(evalPlan, /npm run verify/);
  assert.match(evalPlan, /npm run gate:review/);
  assert.match(evalPlan, /npm run repo:bloat/);
  assert.match(evalPlan, /Cannot Claim/);
});
