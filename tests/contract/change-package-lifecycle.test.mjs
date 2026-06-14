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

test('repo exposes active truth, durable specs, and structural rules', () => {
  const requiredTruthFiles = [
    'docs/active/README.md',
    'specs/product/spec.md',
    'specs/runtime/spec.md',
    'specs/source/spec.md',
    '.sentrux/rules.toml',
  ];

  for (const file of requiredTruthFiles) {
    assert.equal(existsSync(file), true, `missing governance truth file: ${file}`);
  }
});

test('package does not introduce runtime or dev dependencies', () => {
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});

test('archived change packages keep only compact closeout summaries', () => {
  for (const archiveId of readdirSync('changes/archive')) {
    const root = `changes/archive/${archiveId}`;
    assert.deepEqual(readdirSync(root).sort(), ['closeout.md'], `${archiveId} archive must stay compact`);
    const closeout = readFileSync(`${root}/closeout.md`, 'utf8');
    assert.match(closeout, /Summary/);
    assert.match(closeout, /Verification/);
    assert.match(closeout, /Cannot Claim/);
  }

  const history = readFileSync('docs/history/README.md', 'utf8');
  assert.match(history, /foundation-loop-contracts/);
  assert.match(history, /41515a6/);
  assert.match(history, /mvp-task-artifact-loop/);
  assert.match(history, /8626e29/);
});

test('active change packages are complete and eval-backed', () => {
  const activeChanges = existsSync('changes/active') ? readdirSync('changes/active') : [];
  for (const changeId of activeChanges) {
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
