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
    'changes/archive/closeouts.md',
    'docs/active/README.md',
    'specs/product/spec.md',
    'specs/runtime/spec.md',
    'specs/source/spec.md',
    '.sentrux/rules.toml',
    'services/control-plane-go/go.mod',
  ];

  for (const file of requiredTruthFiles) {
    assert.equal(existsSync(file), true, `missing governance truth file: ${file}`);
  }
});

test('Go control plane replaces the Node API backend', () => {
  assert.equal(existsSync('services/control-plane-go/cmd/opl-webui-control-plane/main.go'), true);
  assert.equal(existsSync('apps/api/src/server.mjs'), false);
  assert.equal(existsSync('apps/api/src/mvpTaskHandler.mjs'), false);
  assert.match(pkg.scripts['start:mvp'], /^go run \.\/services\/control-plane-go\/cmd\/opl-webui-control-plane/);
});

test('post-Go cleanup removes retired Node adapter surfaces', () => {
  assert.equal(existsSync('packages/core'), false);
  assert.equal(existsSync('packages/opl-adapter'), false);
  assert.equal(existsSync('packages/contracts/opl/command-policy.json'), false);
  assert.equal(existsSync('packages/contracts/opl/task-contract.schema.json'), false);
  assert.equal(existsSync('packages/contracts/opl/artifact-contract.schema.json'), false);
  assert.equal(existsSync('packages/contracts/opl/mvp-task-http.schema.json'), true);
});

test('package does not introduce runtime or dev dependencies', () => {
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});

test('archived change packages keep only compact closeout summaries', () => {
  assert.deepEqual(readdirSync('changes/archive').sort(), ['closeouts.md']);

  const closeout = readFileSync('changes/archive/closeouts.md', 'utf8');
  assert.match(closeout, /foundation-loop-contracts/);
  assert.match(closeout, /production-runtime-gate/);
  assert.match(closeout, /cannot claim/);

  assert.equal(existsSync('docs/history/README.md'), false);
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
