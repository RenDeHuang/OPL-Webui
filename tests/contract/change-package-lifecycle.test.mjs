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
  assert.equal(existsSync('docs/active/release-automation-goal.md'), false);
});

test('active truth links active change work instead of phase package docs', () => {
  const readme = readFileSync('docs/active/README.md', 'utf8');

  assert.doesNotMatch(readme, /release-automation-goal\.md/);
  assert.doesNotMatch(readme, /changes\/active\/release-automation/);
  assert.match(readme, /changes\/active\/figma-v3-preview/);
});

test('active truth records 24ba41f session auth production evidence', () => {
  const readme = readFileSync('docs/active/README.md', 'utf8');

  assert.match(readme, /24ba41f/);
  assert.match(readme, /rollout revision `9`/);
  assert.match(readme, /\/metricsz`? 200/);
  assert.match(readme, /opl-webui-auth[\s\S]{0,80}keys=1/);
  assert.match(readme, /POST \/api\/session\/launch[\s\S]{0,80}401 AUTH_REQUIRED/);
  assert.match(readme, /GET \/api\/session\/current[\s\S]{0,80}401 AUTH_REQUIRED/);
  assert.match(readme, /还没有真实注册登录/);
});

test('active truth records fa3bcb7 tenant workspace production evidence', () => {
  const readme = readFileSync('docs/active/README.md', 'utf8');

  assert.match(readme, /fa3bcb7/);
  assert.match(readme, /opl-webui:fa3bcb7/);
  assert.match(readme, /GET \/api\/workspaces\/current[\s\S]{0,160}401 AUTH_REQUIRED/);
  assert.match(readme, /GET \/api\/tasks[\s\S]{0,160}401 AUTH_REQUIRED/);
  assert.match(readme, /POST \/api\/tasks[\s\S]{0,160}401 AUTH_REQUIRED/);
  assert.match(readme, /GET \/api\/tasks\/example_task[\s\S]{0,160}401 AUTH_REQUIRED/);
  assert.match(readme, /还没有真实注册登录/);
  assert.match(readme, /workspace invitation/);
});

test('active truth records bc0403d usage quota production rollout evidence', () => {
  const readme = readFileSync('docs/active/README.md', 'utf8');

  assert.match(readme, /usage-quota-production-rollout-verified/);
  assert.match(readme, /bc0403d/);
  assert.match(readme, /opl-webui:bc0403d/);
  assert.match(readme, /AUTH_REQUIRED/);
  assert.match(readme, /用户未提供 rollout revision/);
  assert.match(readme, /不 claim `usageQuota` \/ `QUOTA_EXCEEDED` online behavior/);
  assert.match(readme, /计费\/billing/);
  assert.match(readme, /真实 OPL execution/);
});

test('release automation is compacted after production-gated closeout', () => {
  assert.equal(existsSync('changes/active/release-automation'), false);

  const closeout = readFileSync('changes/archive/closeouts.md', 'utf8');
  for (const required of [
    'release-automation',
    'no-public-staging production-gated release loop',
    'Release Image green',
    'Cloud Rollout #5 green',
    'Production Dry Run passed',
    'Production Apply passed',
    'DB canary passed',
    'OPL CLI canary passed',
    'HTTPS smoke 200',
    'cannot claim: 真实 staging',
  ]) {
    assert.ok(closeout.includes(required), `missing archived evidence: ${required}`);
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
  assert.match(closeout, /release-automation/);
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

test('change lifecycle codifies autonomous commercial development prompts', () => {
  const lifecycle = readFileSync('changes/README.md', 'utf8');
  const requiredPhrases = [
    'Autonomous Commercial Development',
    'current truth',
    'commercial SaaS goal',
    'gap-driven phase',
    'allowed changes',
    'forbidden changes',
    'contracts',
    'tests',
    'test-classification',
    'evals',
    'cannot claim',
    'closeout conditions',
    'hard stops',
    'commit and push',
    'no compatibility layer',
    'no bloat',
  ];

  for (const phrase of requiredPhrases) {
    assert.ok(lifecycle.includes(phrase), `missing autonomous development contract phrase: ${phrase}`);
  }
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
