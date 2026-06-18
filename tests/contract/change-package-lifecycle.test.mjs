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
  assert.doesNotMatch(readme, /changes\/active\/figma-v3-preview/);
  assert.match(readme, /one-person-lab-web/);
});

test('archive keeps prior production evidence while active truth points to current webapp', () => {
  const readme = readFileSync('docs/active/README.md', 'utf8');
  const closeout = readFileSync('changes/archive/closeouts.md', 'utf8');

  assert.match(closeout, /24ba41f/);
  assert.match(closeout, /fa3bcb7/);
  assert.match(closeout, /bc0403d/);
  assert.match(readme, /figma-2-21-ui-alignment-local/);
  assert.match(readme, /44dd574[\s\S]{0,120}production verified/);
  assert.match(readme, /UI alignment[\s\S]{0,220}Figma `2:21`/);
  assert.match(readme, /POST \/api\/chat/);
  assert.match(readme, /最终计费归 MedOPL\/sub2api/);
});

test('product truth keeps OPL-Webui as one-person-lab-web instead of standalone SaaS backend', () => {
  const active = readFileSync('docs/active/README.md', 'utf8');
  const product = readFileSync('specs/product/spec.md', 'utf8');
  const runtime = readFileSync('specs/runtime/spec.md', 'utf8');
  const runbook = readFileSync('deploy/cloud-mvp/RUNBOOK.md', 'utf8');
  const combined = `${active}\n${product}\n${runtime}\n${runbook}`;

  for (const required of [
    'Genspark-like one-person-lab-web with ChatGPT-like base chatbot',
    'Web 版 One Person Lab App',
    '用户填写自己的 API Key',
    'base_url 固定为 `https://gflabtoken.cn/v1`',
    '不允许用户自定义 base_url',
    'hidden default personal workspace',
    'UI 不展示 workspace 产品',
    'runtime/storage/node pool',
    'medopl.medopl.cn',
    'MedOPL 是充值、runtime、node pool、storage、账单和资源后台',
    'OPL-Webui 不拥有 node pool 生命周期、billing source of truth 或 API gateway',
    'usage/quota v1 是 Webui-side precheck/projection',
    '最终计费归 MedOPL/sub2api',
    'OPL_TENANT_AUTH_SECRET',
    'OPL_SESSION_SECRET',
    'OPL_API_KEY_ENCRYPTION_SECRET',
    'OPL_CHAT_MODEL',
  ]) {
    assert.ok(combined.includes(required), `missing product positioning truth: ${required}`);
  }

  assert.doesNotMatch(active, /后续优先级按产品主链路排序：V3 UI 线上验收、真实 auth\/session/);
  assert.doesNotMatch(product, /UI 是中文 AI workspace/);
  assert.doesNotMatch(product, /用户可见 workspace 系统/);
  assert.doesNotMatch(product, /纯 ChatGPT 页面/);
  assert.doesNotMatch(product, /拥有完整 billing|billing source of truth 是 OPL-Webui/);
  assert.match(active, /44dd574[\s\S]{0,240}production verified/);
  assert.match(active, /Next Cursor[\s\S]{0,240}MedOPL runtime status bridge[\s\S]{0,240}@OPL run\/artifact projection/);
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
  assert.equal(existsSync('packages/contracts/opl/mvp-task-http.schema.json'), false);
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
