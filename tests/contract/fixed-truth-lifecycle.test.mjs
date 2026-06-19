import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import pkg from '../../package.json' with { type: 'json' };

const fixedTruthFiles = [
  'README.md',
  'AGENTS.md',
  'TASTE.md',
  'docs/project.md',
  'docs/status.md',
  'docs/decisions.md',
  'docs/architecture.md',
  'docs/invariants.md',
  'docs/docs_portfolio_consolidation.md',
  'docs/active/README.md',
  'docs/history/process/closeouts.md',
  'docs/history/tombstones/README.md',
];

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

test('repo exposes fixed truth, durable contracts, and structural rules', () => {
  for (const file of [...fixedTruthFiles, ...contractFiles, '.sentrux/rules.toml', 'services/control-plane-go/go.mod']) {
    assert.equal(existsSync(file), true, `missing governance truth file: ${file}`);
  }

  for (const retired of [
    'changes',
    'changes/README.md',
    'changes/active',
    'changes/archive/closeouts.md',
    'docs/README.md',
    'docs/history/README.md',
    'tests/README.md',
    'tests/health/product-debt-retirement.test.mjs',
    'tests/contract/change-package-lifecycle.test.mjs',
    'apps/web/styles/v3.css',
    'tests/smoke/web-demo-shell.test.mjs',
    'docs/active/release-automation-goal.md',
    'specs/product/spec.md',
    'specs/runtime/spec.md',
    'specs/source/spec.md',
  ]) {
    assert.equal(existsSync(retired), false, `retired surface must not remain active: ${retired}`);
  }
});

test('fixed truth documents the retired changes workflow and current gap', () => {
  const readme = readFileSync('README.md', 'utf8');
  const agents = readFileSync('AGENTS.md', 'utf8');
  const taste = readFileSync('TASTE.md', 'utf8');
  const status = readFileSync('docs/status.md', 'utf8');
  const decisions = readFileSync('docs/decisions.md', 'utf8');
  const portfolio = readFileSync('docs/docs_portfolio_consolidation.md', 'utf8');

  for (const text of [readme, agents, taste, status, decisions, portfolio]) {
    assert.match(text, /one-person-lab-web|One Person Lab Web/);
  }

  assert.match(readme, /multi-tenant SaaS Web edition of One Person Lab/);
  assert.match(readme, /@科研`, `@论文`, `@基金`, `@综述`, and `@文件`/);
  assert.match(agents, /不使用 `changes\/active` 七件套作为默认开发系统/);
  assert.match(taste, /Read `README\.md`/);
  assert.match(status, /research SaaS product engineering/);
  assert.match(status, /docs\/active\/README\.md/);
  assert.match(status, /Product work now moves one gap at a time/);
  assert.match(decisions, /Per-change `changes\/active` packages are retired/);
  assert.match(decisions, /File count is report-only/);
  assert.match(portfolio, /Retired Workflow/);
  assert.match(portfolio, /Active Baton Lifecycle/);
});

test('active baton and tombstone preserve next-agent context without becoming machine truth', () => {
  const active = readFileSync('docs/active/README.md', 'utf8');
  const tombstones = readFileSync('docs/history/tombstones/README.md', 'utf8');

  for (const required of ['owner:', 'purpose:', 'state:', 'machine boundary:']) {
    assert.match(active, new RegExp(required));
    assert.match(tombstones, new RegExp(required));
  }

  for (const required of [
    'Current Truth',
    'Worktree Lane Model',
    'Next Agent Context',
    'Foldback Rules',
  ]) {
    assert.match(active, new RegExp(required));
  }

  for (const required of [
    'changes/active',
    'apps/api',
    '/api/mvp/task',
    'demoData',
    '@长任务',
    'No-Resurrection Rules',
  ]) {
    assert.match(tombstones, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('archive keeps prior production evidence while active truth points to current contracts', () => {
  const status = readFileSync('docs/status.md', 'utf8');
  const closeout = readFileSync('docs/history/process/closeouts.md', 'utf8');
  const release = readJson('contracts/web-release-profile.json');

  assert.match(closeout, /24ba41f/);
  assert.match(closeout, /fa3bcb7/);
  assert.match(closeout, /bc0403d/);
  assert.match(closeout, /one-person-lab-web-truth-reset/);
  assert.match(closeout, /repo-slimming-and-stale-name-retirement/);
  assert.equal(release.currentStage, 'one-person-lab-web-contract-truth');
  assert.equal(release.historicalEvidenceRefs.includes('docs/history/process/closeouts.md'), true);
  assert.equal(release.historicalEvidenceRefs.includes('changes/archive/closeouts.md'), false);
  assert.match(status, /contracts\/web-product-profile\.json/);
  assert.match(status, /contracts\/web-api\.openapi\.json/);
  assert.match(status, /contracts\/web-release-profile\.json/);
  assert.doesNotMatch(status, /one-person-lab-web-truth-reset/);
  assert.doesNotMatch(status, /repo-slimming-and-stale-name-retirement/);
});

test('product contracts keep OPL-WebUI as one-person-lab-web instead of standalone SaaS backend', () => {
  const status = readFileSync('docs/status.md', 'utf8');
  const product = readJson('contracts/web-product-profile.json');
  const runtime = readJson('contracts/web-runtime-bridge.json');
  const api = readJson('contracts/web-api.openapi.json');
  const release = readJson('contracts/web-release-profile.json');
  const runbook = readFileSync('deploy/web-cloud/RUNBOOK.md', 'utf8');

  assert.equal(product.productId, 'one-person-lab-web');
  assert.equal(product.positioning, 'Multi-tenant SaaS Web edition of One Person Lab');
  assert.equal(product.primaryUserPath, 'research_capability_first_web_workbench');
  assert.equal(product.primaryEntryModel, 'at_mention_research_capabilities');
  assert.deepEqual(product.primaryEntryMarkers, ['@科研', '@论文', '@基金', '@综述', '@文件']);
  assert.equal(product.provider.fixedBaseUrl, 'https://gflabtoken.cn/v1');
  assert.equal(product.provider.userEditableBaseUrl, false);
  assert.equal(product.ownedSurfaces.includes('multi_tenant_saas_product'), true);
  assert.equal(product.ownedSurfaces.includes('web_product_surface'), true);
  assert.equal(product.ownedSurfaces.includes('tenant_isolation'), true);
  assert.equal(product.ownedSurfaces.includes('research_capability_entry'), true);
  assert.equal(product.ownedSurfaces.includes('ordinary_chat_fallback'), true);
  assert.equal(product.ownedSurfaces.includes('page_state'), true);
  assert.equal(product.ownedSurfaces.includes('ordinary_chat_entry'), false);
  assert.equal(product.nonOwnedTruth.includes('billing_source_of_truth'), true);
  assert.equal(product.nonOwnedTruth.includes('runtime_truth'), true);
  assert.equal(product.consumedAuthorities.includes('one-person-lab-app/contracts/app-product-profile.json'), true);
  assert.equal(product.consumedAuthorities.includes('one-person-lab/contracts/opl-framework/domains.json'), true);

  assert.equal(api.paths['/api/account/audit-events'].get.responses['200'].description, 'Sanitized user audit events.');
  assert.equal(api.components.schemas.ApiErrorCode.enum.includes('CHAT_QUOTA_EXCEEDED'), true);
  assert.equal(api.components.schemas.ChatErrorCode, undefined);
  assert.deepEqual(runtime.lightweightMarkers, ['@科研']);
  assert.deepEqual(runtime.runtimeRequiredMarkers, ['@论文', '@基金', '@综述', '@文件']);
  assert.equal(runtime.runtimeRequiredMarkers.includes('@长任务'), false);
  assert.equal(runtime.projectionPolicy.allowedPayload.includes('progress_refs'), true);
  assert.equal(runtime.projectionPolicy.forbiddenPayload.includes('artifact_body'), true);
  assert.equal(runtime.webuiRuntimeExecution, 'forbidden');
  assert.equal(release.requiredEnvKeys.includes('OPL_SESSION_SECRET'), true);
  assert.equal(release.dogfood.switches.includes('OPL_PRODUCTION_DOGFOOD_REAL_CHAT'), true);
  assert.equal(release.rolloutPipeline.mode, 'dry_run_first_apply_canary_smoke_then_dogfood');
  assert.deepEqual(release.rolloutPipeline.orderedStages, [
    'production_dry_run',
    'production_apply',
    'canary_smoke',
    'production_authenticated_dogfood',
  ]);
  assert.equal(release.rolloutPipeline.dryRun.requiresImage, true);
  assert.equal(release.rolloutPipeline.dryRun.requiresKubeconfig, false);
  assert.equal(release.rolloutPipeline.apply.requiresImage, true);
  assert.equal(release.rolloutPipeline.apply.requiresKubeconfig, true);
  assert.equal(release.rolloutPipeline.canarySmoke.semanticJsonChecks.includes('/readyz ok=true missing=[]'), true);
  assert.equal(release.rolloutPipeline.canarySmoke.semanticJsonChecks.includes('/metricsz ok=true missingDependencyCount=0'), true);
  assert.equal(release.productionDogfoodReadiness.mode, 'secret_gated_http_authenticated_e2e');
  assert.equal(release.productionDogfoodReadiness.defaultEnabled, false);
  assert.equal(release.productionDogfoodReadiness.requiresProductionSecrets, true);
  assert.equal(release.productionDogfoodReadiness.requiresSuccessfulRolloutEvidence, true);
  assert.equal(release.productionDogfoodReadiness.afterStage, 'production_apply_canary_smoke');
  assert.equal(release.productionDogfoodReadiness.browserAutomation, false);
  assert.deepEqual(release.productionDogfoodReadiness.requiredSecrets, [
    'OPL_DOGFOOD_EMAIL',
    'OPL_DOGFOOD_PASSWORD',
    'OPL_DOGFOOD_API_KEY',
  ]);
  assert.equal(release.productionDogfoodReadiness.secretValidation.OPL_DOGFOOD_EMAIL, 'must contain @');
  assert.equal(release.productionDogfoodReadiness.secretValidation.OPL_DOGFOOD_PASSWORD, 'min_length_12');
  for (const forbidden of ['KUBECONFIG', 'OPL_DATABASE_URL', 'PGPASSWORD', 'MEDOPL_TOKEN', 'TCR_PASSWORD']) {
    assert.equal(release.productionDogfoodReadiness.forbiddenSecrets.includes(forbidden), true, `dogfood must not need ${forbidden}`);
  }
  assert.equal(release.productionDogfoodReadiness.coverage.includes('register_or_login'), true);
  assert.equal(release.productionDogfoodReadiness.coverage.includes('runtime_gate_audit'), true);
  assert.equal(release.productionDogfoodReadiness.cannotClaim.includes('browser e2e'), true);
  assert.match(runbook, /OPL_SESSION_SECRET/);
  assert.match(runbook, /Production authenticated dogfood closeout/);
  assert.match(runbook, /run id/i);
  assert.match(runbook, /audit kinds/i);

  assert.doesNotMatch(status, /后续优先级按产品主链路排序：V3 UI 线上验收、真实 auth\/session/);
  assert.doesNotMatch(JSON.stringify(product), /UI 是中文 AI workspace|用户可见 workspace 系统|纯 ChatGPT 页面/);
  assert.doesNotMatch(JSON.stringify(product), /拥有完整 billing|billing source of truth 是 OPL-Webui/);
  assert.match(status, /multi-tenant SaaS Web edition of One Person Lab/);
  assert.match(status, /Ordinary chat is a fallback entry/);
  assert.match(status, /Next Priorities/);
});

test('release automation evidence is historical after production-gated closeout', () => {
  const closeout = readFileSync('docs/history/process/closeouts.md', 'utf8');
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

test('historical closeouts are provenance only', () => {
  const closeout = readFileSync('docs/history/process/closeouts.md', 'utf8');
  assert.match(closeout, /foundation-loop-contracts/);
  assert.match(closeout, /production-runtime-gate/);
  assert.match(closeout, /release-automation/);
  assert.match(closeout, /cannot claim/);
  assert.doesNotMatch(readFileSync('docs/status.md', 'utf8'), /changes\/archive\/closeouts\.md/);
});
