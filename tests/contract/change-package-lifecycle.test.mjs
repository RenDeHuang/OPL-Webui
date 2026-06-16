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
    'changes/README.md',
    'docs/active/README.md',
    'docs/active/release-automation-goal.md',
    'specs/product/spec.md',
    'specs/runtime/spec.md',
    'specs/source/spec.md',
    '.sentrux/rules.toml',
    'services/control-plane-go/go.mod',
  ];

  for (const file of requiredTruthFiles) {
    assert.equal(existsSync(file), true, `missing governance truth file: ${file}`);
  }

  assert.equal(existsSync('docs/README.md'), false);
});

test('active truth links the release automation goal', () => {
  const readme = readFileSync('docs/active/README.md', 'utf8');

  assert.match(readme, /release-automation-goal\.md/);
  assert.match(readme, /Release Automation/i);
});

test('release automation goal covers phased evals and boundaries', () => {
  const goal = readFileSync('docs/active/release-automation-goal.md', 'utf8');

  for (const required of [
    'Phase 1: CI 自动测试',
    'Phase 2: CI 构建并推送镜像',
    'Phase 3: 云端 CD runner rollout',
    'Phase 4: staging / production 分环境',
    'Goal',
    'Implementation Steps',
    'Evals / Acceptance Criteria',
    'Secret Boundary',
    'Failure / Rollback Handling',
    'npm run verify',
    'npm run gate:review',
    'Dockerfile.cloud',
    'short commit',
    'digest',
    'self-hosted runner',
    'scripts/cloud-rollout.mjs',
    'dry-run',
    '--apply',
    'canary db',
    'canary opl-cli',
    'manual approval',
    'staging',
    'production',
    'changes/active/release-automation',
  ]) {
    assert.ok(goal.includes(required), `missing ${required}`);
  }

  assert.doesNotMatch(goal, /AKID[A-Za-z0-9]+/);
  assert.doesNotMatch(goal, /-----BEGIN [A-Z ]+PRIVATE KEY-----/);
  assert.doesNotMatch(goal, /postgres(?:ql)?:\/\/[^`\s]+/i);
  assert.doesNotMatch(goal, /KUBECONFIG:\s*[^<\s]+/i);
  assert.doesNotMatch(goal, /TCR_PASSWORD:\s*[^<\s]+/i);
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

test('change lifecycle documents dynamic phase gates and compaction rules', () => {
  const lifecycle = readFileSync('changes/README.md', 'utf8');

  assert.match(lifecycle, /Dynamic Phase Gates/);
  assert.match(lifecycle, /design target accepted/);
  assert.match(lifecycle, /local visual accepted/);
  assert.match(lifecycle, /data contract accepted/);
  assert.match(lifecycle, /cloud canary accepted/);
  assert.match(lifecycle, /online smoke accepted/);
  assert.match(lifecycle, /active .* detailed/i);
  assert.match(lifecycle, /closed .* compact/i);
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
