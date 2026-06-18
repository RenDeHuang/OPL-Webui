import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

import pkg from '../../package.json' with { type: 'json' };

const lifecycleFiles = ['proposal.md', 'spec-delta.md', 'design.md', 'tasks.md', 'eval-plan.md', 'review.md', 'closeout.md'];
const contractFiles = [
  'contracts/web-product-profile.json',
  'contracts/web-page-state-matrix.json',
  'contracts/web-api.openapi.json',
  'contracts/web-runtime-bridge.json',
  'contracts/web-release-profile.json',
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('package lifecycle exposes verification-only commands', () => {
  for (const scriptName of [
    'verify', 'verify:health', 'verify:smoke', 'verify:contract', 'test:health', 'test:smoke',
    'test:contract', 'test:regression', 'gate:review', 'repo:bloat', 'check:diff',
  ]) {
    assert.ok(pkg.scripts[scriptName], `missing package script: ${scriptName}`);
  }
});

test('repo exposes active truth, durable contracts, and structural rules', () => {
  const requiredTruthFiles = [
    'TASTE.md', 'changes/archive/closeouts.md', 'changes/README.md', 'docs/active/README.md',
    'docs/project.md', 'docs/architecture.md', 'docs/invariants.md',
    'docs/docs_portfolio_consolidation.md',
    ...contractFiles, '.sentrux/rules.toml', 'services/control-plane-go/go.mod',
  ];

  for (const file of requiredTruthFiles) {
    assert.equal(existsSync(file), true, `missing governance truth file: ${file}`);
  }

  assert.equal(existsSync('docs/README.md'), false);
  assert.equal(existsSync('docs/history/README.md'), false);
  assert.equal(existsSync('tests/README.md'), false);
  assert.equal(existsSync('apps/web/styles/v3.css'), false);
  assert.equal(existsSync('tests/smoke/web-demo-shell.test.mjs'), false);
  assert.equal(existsSync('tests/smoke/web-shell.test.mjs'), true);
  assert.equal(existsSync('docs/active/release-automation-goal.md'), false);
  for (const retired of [
    'docs/status.md',
    'docs/decisions.md',
    'specs/product/spec.md',
    'specs/runtime/spec.md',
    'specs/source/spec.md',
  ]) {
    assert.equal(existsSync(retired), false, `retired prose truth must not remain active: ${retired}`);
  }
});

test('active truth links active change work instead of phase package docs', () => {
  const readme = readFileSync('docs/active/README.md', 'utf8');

  assert.doesNotMatch(readme, /release-automation-goal\.md/);
  assert.doesNotMatch(readme, /changes\/active\/release-automation/);
  assert.doesNotMatch(readme, /changes\/active\/figma-v3-preview/);
  assert.doesNotMatch(readme, /changes\/active\/one-person-lab-web-truth-reset/);
  assert.doesNotMatch(readme, /changes\/active\/repo-slimming-and-stale-name-retirement/);
  assert.doesNotMatch(readme, /one-person-lab-web-truth-reset/);
  assert.doesNotMatch(readme, /repo-slimming-and-stale-name-retirement/);
  assert.match(readme, /No active change|没有 active change/);
  assert.match(readme, /one-person-lab-web/);
});

test('archive keeps prior production evidence while active truth points to current contracts', () => {
  const readme = readFileSync('docs/active/README.md', 'utf8');
  const closeout = readFileSync('changes/archive/closeouts.md', 'utf8');
  const release = readJson('contracts/web-release-profile.json');

  assert.match(closeout, /24ba41f/);
  assert.match(closeout, /fa3bcb7/);
  assert.match(closeout, /bc0403d/);
  assert.match(closeout, /one-person-lab-web-truth-reset/);
  assert.match(closeout, /repo-slimming-and-stale-name-retirement/);
  assert.equal(release.currentStage, 'one-person-lab-web-contract-truth');
  assert.equal(release.historicalEvidenceRefs.includes('changes/archive/closeouts.md'), true);
  assert.match(readme, /contracts\/web-product-profile\.json/);
  assert.match(readme, /contracts\/web-api\.openapi\.json/);
  assert.doesNotMatch(readme, /one-person-lab-web-truth-reset/);
  assert.doesNotMatch(readme, /repo-slimming-and-stale-name-retirement/);
});

test('product contracts keep OPL-WebUI as one-person-lab-web instead of standalone SaaS backend', () => {
  const active = readFileSync('docs/active/README.md', 'utf8');
  const product = readJson('contracts/web-product-profile.json');
  const runtime = readJson('contracts/web-runtime-bridge.json');
  const api = readJson('contracts/web-api.openapi.json');
  const release = readJson('contracts/web-release-profile.json');
  const runbook = readFileSync('deploy/web-cloud/RUNBOOK.md', 'utf8');

  assert.equal(product.productId, 'one-person-lab-web');
  assert.equal(product.positioning, 'Web edition of One Person Lab App');
  assert.equal(product.provider.fixedBaseUrl, 'https://gflabtoken.cn/v1');
  assert.equal(product.provider.userEditableBaseUrl, false);
  assert.equal(product.ownedSurfaces.includes('web_product_surface'), true);
  assert.equal(product.ownedSurfaces.includes('page_state'), true);
  assert.equal(product.nonOwnedTruth.includes('billing_source_of_truth'), true);
  assert.equal(product.nonOwnedTruth.includes('runtime_truth'), true);
  assert.equal(product.consumedAuthorities.includes('one-person-lab-app/contracts/app-product-profile.json'), true);
  assert.equal(product.consumedAuthorities.includes('one-person-lab/contracts/opl-framework/domains.json'), true);

  assert.equal(api.paths['/api/account/audit-events'].get.responses['200'].description, 'Sanitized user audit events.');
  assert.equal(api.components.schemas.ChatErrorCode.enum.includes('CHAT_QUOTA_EXCEEDED'), true);
  assert.equal(runtime.projectionPolicy.allowedPayload.includes('progress_refs'), true);
  assert.equal(runtime.projectionPolicy.forbiddenPayload.includes('artifact_body'), true);
  assert.equal(runtime.webuiRuntimeExecution, 'forbidden');
  assert.equal(release.requiredEnvKeys.includes('OPL_SESSION_SECRET'), true);
  assert.equal(release.dogfood.switches.includes('OPL_PRODUCTION_DOGFOOD_REAL_CHAT'), true);
  assert.match(runbook, /OPL_SESSION_SECRET/);

  assert.doesNotMatch(active, /后续优先级按产品主链路排序：V3 UI 线上验收、真实 auth\/session/);
  assert.doesNotMatch(JSON.stringify(product), /UI 是中文 AI workspace|用户可见 workspace 系统|纯 ChatGPT 页面/);
  assert.doesNotMatch(JSON.stringify(product), /拥有完整 billing|billing source of truth 是 OPL-Webui/);
  assert.match(active, /No active change|没有 active change/);
  assert.match(active, /Next Priorities[\s\S]{0,240}API contract implementation/);
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
  assert.equal(pkg.scripts.start, 'go run ./services/control-plane-go/cmd/opl-webui-control-plane');
});

test('post-Go cleanup removes retired Node adapter surfaces', () => {
  assert.equal(existsSync('packages/core'), false);
  assert.equal(existsSync('packages/opl-adapter'), false);
  assert.equal(existsSync('packages/contracts/opl/command-policy.json'), false);
  assert.equal(existsSync('packages/contracts/opl/task-contract.schema.json'), false);
  assert.equal(existsSync('packages/contracts/opl/artifact-contract.schema.json'), false);
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
  if (activeChanges.length === 0) {
    assert.match(readFileSync('docs/active/README.md', 'utf8'), /No active change|没有 active change/);
  }

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
