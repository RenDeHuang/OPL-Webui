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
  'contracts/web-development-profile.json',
  'contracts/web-surface-inventory.json',
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('package lifecycle exposes verification-only commands', () => {
  for (const scriptName of [
    'verify', 'verify:health', 'verify:smoke', 'verify:contract', 'test:health', 'test:smoke',
    'test:contract', 'test:regression', 'gate:ai', 'gate:review', 'repo:bloat', 'check:diff',
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
  assert.match(status, /current = smoke \+ contract \+ health \+ go/);
  assert.match(status, /scripts\/lane-advisory\.mjs/);
  assert.match(decisions, /Per-change `changes\/active` packages are retired/);
  assert.match(decisions, /File count is report-only/);
  assert.match(decisions, /fixed main lanes and dynamic targeted lanes/);
  assert.match(decisions, /lane-check\/gate evidence/);
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
  assert.match(active, /28039468173/);
  assert.match(active, /c1787da0c13aedf75b84b12c29f26b13193fce74/);
  assert.match(active, /Production Availability Probe After Apply/);
  assert.match(active, /OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1.*confirmed/);
  assert.match(active, /Production browser e2e evidence passed/);
  assert.match(active, /not MedOPL runtime execution/);
  assert.doesNotMatch(active, /27823251419/);

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
  assert.match(closeout, /production-dogfood-evidence-foldback/);
  assert.match(closeout, /27823251419/);
  assert.match(closeout, /production-real-chat-dogfood-evidence-foldback/);
  assert.match(closeout, /27833052951/);
  assert.match(closeout, /Production Authenticated Dogfood E2E/);
  assert.equal(release.currentStage, 'one-person-lab-web-contract-truth');
  assert.equal(release.historicalEvidenceRefs.includes('docs/history/process/closeouts.md'), true);
  assert.equal(release.historicalEvidenceRefs.includes('changes/archive/closeouts.md'), false);
  assert.match(status, /contracts\/web-product-profile\.json/);
  assert.match(status, /contracts\/web-api\.openapi\.json/);
  assert.match(status, /contracts\/web-release-profile\.json/);
  assert.match(status, /contracts\/web-development-profile\.json/);
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
  assert.equal(product.primaryUserPath, 'ai_native_research_homepage');
  assert.equal(product.primaryEntryModel, 'at_mention_research_capabilities');
  assert.deepEqual(product.primaryEntryMarkers, ['@科研', '@论文', '@基金', '@综述', '@文件']);
  assert.equal(product.provider.fixedBaseUrl, 'https://gflabtoken.cn/v1');
  assert.equal(product.provider.wireApi, 'responses');
  assert.equal(product.provider.defaultModel, 'gpt-5.5');
  assert.equal(product.provider.serviceTier, 'fast');
  assert.equal(product.provider.reasoningEffort, 'xhigh');
  assert.equal(product.provider.upstreamTimeoutSeconds, 60);
  assert.equal(product.provider.upstreamTimeoutEnv, 'OPL_CHAT_UPSTREAM_TIMEOUT_SECONDS');
  assert.equal(product.provider.userEditableBaseUrl, false);
  assert.equal(product.ownedSurfaces.includes('multi_tenant_saas_product'), true);
  assert.equal(product.ownedSurfaces.includes('web_product_surface'), true);
  assert.equal(product.ownedSurfaces.includes('tenant_isolation'), true);
  assert.equal(product.ownedSurfaces.includes('research_capability_entry'), true);
  assert.equal(product.ownedSurfaces.includes('ordinary_chat_fallback'), true);
  assert.equal(product.ownedSurfaces.includes('page_state'), true);
  assert.equal(product.ownedSurfaces.includes('commercial_account_lifecycle_projection'), true);
  assert.equal(product.ownedSurfaces.includes('ordinary_chat_entry'), false);
  assert.equal(product.nonOwnedTruth.includes('billing_source_of_truth'), true);
  assert.equal(product.nonOwnedTruth.includes('runtime_truth'), true);
  assert.equal(product.consumedAuthorities.includes('one-person-lab-app/contracts/app-product-profile.json'), true);
  assert.equal(product.consumedAuthorities.includes('one-person-lab/contracts/opl-framework/domains.json'), true);

  assert.equal(api.paths['/api/account/audit-events'].get.responses['200'].description, 'Sanitized user audit events.');
  assert.equal(api.paths['/api/account/commercial-status'].get.responses['200'].description, 'Readonly commercial account lifecycle projection.');
  assert.equal(
    api.paths['/api/account/commercial-status'].get.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/CommercialAccountStatus',
  );
  assert.equal(api.components.schemas.CommercialAccountStatus.additionalProperties, false);
  assert.equal(api.components.schemas.CommercialAccountStatus.required.includes('teamReadiness'), true);
  assert.equal(api.components.schemas.CommercialAccountStatus.required.includes('webuiRBACMutation'), true);
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
  assert.equal(release.dogfood.switches.includes('OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY'), true);
  assert.equal(release.rolloutPipeline.mode, 'dry_run_first_apply_canary_smoke_then_dogfood');
  assert.deepEqual(release.rolloutPipeline.imageInputPolicy.allowedInputs, [
    'full_tcr_tag',
    'full_tcr_sha256_digest',
    'release_short_commit_tag',
  ]);
  assert.equal(release.rolloutPipeline.imageInputPolicy.repository, 'uswccr.ccs.tencentyun.com/webopl/opl-webui');
  assert.equal(release.rolloutPipeline.imageInputPolicy.shortCommitTagPattern, '^[0-9a-f]{7,40}$');
  assert.match(release.rolloutPipeline.imageInputPolicy.normalization, /<tag>/);
  assert.equal(release.rolloutPipeline.imageInputPolicy.forbiddenInputs.includes('external_registry'), true);
  assert.equal(release.rolloutPipeline.imageInputPolicy.forbiddenInputs.includes('floating_latest_tag'), true);
  assert.equal(release.rolloutPipeline.imagePreflight.entrypoint, 'node scripts/cloud-rollout.mjs --image-preflight');
  assert.equal(release.rolloutPipeline.imagePreflight.requiresImage, true);
  assert.equal(release.rolloutPipeline.imagePreflight.requiresKubeconfig, false);
  assert.equal(release.rolloutPipeline.imagePreflight.mutatesCluster, false);
  assert.equal(release.rolloutPipeline.imagePreflight.registryAuth, 'private_tcr_manifest_read');
  assert.deepEqual(release.rolloutPipeline.imagePreflight.requiredSecrets, ['TCR_USERNAME', 'TCR_PASSWORD']);
  for (const forbidden of ['KUBECONFIG', 'OPL_DATABASE_URL', 'PGPASSWORD', 'OPL_DOGFOOD_API_KEY', 'OPL_DOGFOOD_PASSWORD', 'MEDOPL_TOKEN']) {
    assert.equal(release.rolloutPipeline.imagePreflight.forbiddenSecrets.includes(forbidden), true, `image preflight must not need ${forbidden}`);
  }
  assert.equal(release.rolloutPipeline.imagePreflight.afterStage, 'production_dry_run');
  assert.equal(release.rolloutPipeline.imagePreflight.beforeStage, 'production_apply');
  assert.equal(release.rolloutPipeline.imagePreflight.failureKind, 'image_missing_rollout_order_issue');
  assert.equal(release.productionReleaseFailures.latestFailedRun.runId, 27878485498);
  assert.equal(release.productionReleaseFailures.latestFailedRun.runUrl, 'https://github.com/RenDeHuang/OPL-Webui/actions/runs/27878485498');
  assert.equal(release.productionReleaseFailures.latestFailedRun.commit, '80689b1d2a139408f26fa8423df54795727e25b7');
  assert.equal(release.productionReleaseFailures.latestFailedRun.image, 'uswccr.ccs.tencentyun.com/webopl/opl-webui:80689b1');
  assert.equal(release.productionReleaseFailures.latestFailedRun.workflow, 'Cloud Rollout');
  assert.equal(release.productionReleaseFailures.latestFailedRun.targetHost, 'https://opl.medopl.cn');
  assert.equal(release.productionReleaseFailures.latestFailedRun.status, 'failure');
  assert.equal(release.productionReleaseFailures.latestFailedRun.failedStage, 'Production Apply');
  assert.equal(release.productionReleaseFailures.latestFailedRun.failureKind, 'image_missing_rollout_order_issue');
  assert.equal(release.productionReleaseFailures.latestFailedRun.imagePullOccurred, true);
  assert.equal(release.productionReleaseFailures.latestFailedRun.productFailure, false);
  assert.equal(release.productionReleaseFailures.latestFailedRun.rawLogPolicy.storesRawLogs, false);
  assert.equal(release.productionReleaseFailures.latestFailedRun.rawLogPolicy.storesSecretValues, false);
  assert.equal(release.productionReleaseFailures.cannotClaim.includes('production-ready SaaS'), true);
  assert.deepEqual(release.rolloutPipeline.orderedStages, [
    'production_dry_run',
    'production_image_preflight',
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
  assert.equal(release.productionDogfoodReadiness.state, 'executed_success_run_28039468173_real_chat_readonly_confirmed');
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.runId, 28039468173);
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.commit, 'c1787da0c13aedf75b84b12c29f26b13193fce74');
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.image, 'uswccr.ccs.tencentyun.com/webopl/opl-webui:c1787da');
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.realChat, true);
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.medoplReadonly, true);
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.publicMetadataConfirmsReadonlySwitch, true);
  assert.deepEqual(release.productionDogfoodReadiness.readonlyFoldbackPolicy.requiredEvidence, [
    'OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1',
    'dogfood stdout confirms readonly projection checks',
    'release-evidence-sync --dogfood-readonly-confirmed',
  ]);
  assert.equal(release.productionDogfoodReadiness.defaultEnabled, false);
  assert.equal(release.productionDogfoodReadiness.requiresProductionSecrets, true);
  assert.equal(release.productionDogfoodReadiness.requiresSuccessfulRolloutEvidence, true);
  assert.equal(release.productionDogfoodReadiness.afterStage, 'production_apply_canary_smoke');
  assert.equal(release.productionDogfoodReadiness.browserAutomation, false);
  assert.equal(release.productionDogfoodReadiness.optionalSwitches.includes('OPL_PRODUCTION_DOGFOOD_REAL_CHAT'), true);
  assert.equal(release.productionDogfoodReadiness.optionalSwitches.includes('OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY'), true);
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
  assert.equal(release.productionDogfoodReadiness.coverage.includes('ordinary_chat_real_completion'), true);
  assert.equal(release.productionDogfoodReadiness.coverage.includes('runtime_gate_audit'), true);
  assert.equal(release.productionDogfoodReadiness.coverage.includes('medopl_readonly_runtime_status'), true);
  assert.equal(release.productionDogfoodReadiness.coverage.includes('medopl_readonly_materials_deliverables'), true);
  assert.equal(release.productionDogfoodReadiness.coverage.includes('medopl_readonly_billing_summary'), true);
  assert.equal(release.productionDogfoodReadiness.cannotClaim.includes('browser e2e'), true);
  assert.equal(release.productionDogfoodReadiness.cannotClaim.includes('MedOPL runtime execution'), true);
  assert.equal(release.productionDogfoodReadiness.cannotClaim.includes('production real ordinary chat completion'), false);
  assert.equal(release.productionAvailabilityReadiness.mode, 'no_secret_public_http_probe');
  assert.equal(release.productionAvailabilityReadiness.state, 'executed_success_run_28039468173_after_apply');
  assert.equal(release.productionAvailabilityReadiness.latestSuccessfulRun.runId, 28039468173);
  assert.equal(release.productionAvailabilityReadiness.latestSuccessfulRun.commit, 'c1787da0c13aedf75b84b12c29f26b13193fce74');
  assert.equal(release.productionAvailabilityReadiness.latestSuccessfulRun.image, 'uswccr.ccs.tencentyun.com/webopl/opl-webui:c1787da');
  assert.deepEqual(release.productionAvailabilityReadiness.latestSuccessfulRun.statusSummary, [
    'Production Dry Run success',
    'Production Apply success',
    'Production Availability Probe After Apply success',
  ]);
  assert.equal(release.productionAvailabilityReadiness.defaultEnabled, false);
  assert.equal(release.productionAvailabilityReadiness.requiresProductionSecrets, false);
  assert.equal(release.productionAvailabilityReadiness.requiresKubeconfig, false);
  assert.equal(release.productionAvailabilityReadiness.mutatesCluster, false);
  assert.equal(release.productionAvailabilityReadiness.entrypoint, 'node scripts/cloud-rollout.mjs --availability-probe');
  assert.equal(release.productionAvailabilityReadiness.workflow, '.github/workflows/cloud-rollout.yml');
  assert.deepEqual(release.productionAvailabilityReadiness.requiredSecrets, []);
  assert.deepEqual(release.productionAvailabilityReadiness.coverage, [
    'HTTPS /healthz',
    'HTTPS /readyz',
    'HTTPS /metricsz',
    'HTTPS /',
  ]);
  assert.equal(release.productionAvailabilityReadiness.cannotClaim.includes('multi-node HA'), true);
  assert.equal(release.productionAvailabilityReadiness.cannotClaim.includes('production authenticated dogfood'), true);
  assert.equal(release.productionAvailabilityReadiness.cannotClaim.includes('production-ready SaaS'), true);
  assert.equal(release.productionObservabilityBaseline.mode, 'no_secret_public_http_observability_baseline_v1');
  assert.equal(release.productionObservabilityBaseline.state, 'v1_accepted_observability_baseline_plus_rollback_record_contract');
  assert.equal(release.productionObservabilityBaseline.owner, 'one-person-lab-web-release');
  assert.equal(release.productionObservabilityBaseline.consumer, 'cloud_rollout_closeout');
  assert.equal(release.productionObservabilityBaseline.nextReadiness.owner, 'operations_owner');
  assert.equal(release.productionObservabilityBaseline.nextReadiness.state, 'rollback_record_contract_present_dashboard_alerting_error_budget_deferred');
  assert.deepEqual(release.productionObservabilityBaseline.nextReadiness.implementedEvidence, [
    'scheduled_canary_workflow',
    'scheduled_canary_first_success',
  ]);
  assert.equal(release.productionObservabilityBaseline.nextReadiness.scheduledCanary.workflow, '.github/workflows/production-canary.yml');
  assert.equal(release.productionObservabilityBaseline.nextReadiness.scheduledCanary.state, 'executed_success_run_27874732529');
  assert.equal(release.productionObservabilityBaseline.nextReadiness.scheduledCanary.latestSuccessfulRun.runId, 27874732529);
  assert.equal(release.productionObservabilityBaseline.nextReadiness.scheduledCanary.latestSuccessfulRun.workflow, 'Production Canary');
  assert.equal(release.productionObservabilityBaseline.nextReadiness.scheduledCanary.latestSuccessfulRun.jobName, 'Scheduled Production Availability Probe');
  assert.equal(release.productionObservabilityBaseline.nextReadiness.scheduledCanary.requiresProductionSecrets, false);
  assert.equal(release.productionObservabilityBaseline.nextReadiness.scheduledCanary.requiresKubeconfig, false);
  assert.equal(release.productionObservabilityBaseline.nextReadiness.scheduledCanary.mutatesCluster, false);
  assert.deepEqual(release.productionObservabilityBaseline.productionReadinessLevels.map((level) => [level.id, level.requiredBefore]), [
    ['p0_launch_operations', 'public_single_node_launch'],
    ['p1_commercial_operations', 'commercial_scale_claim'],
    ['p2_sla_operations', 'sla_or_ha_claim'],
  ]);
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.rollbackPath.state, 'manual_harness_ready_pending_first_real_rollback_record');
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.alertingBoundary.state, 'contract_present_pending_alert_route');
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.dbBackupRestore.state, 'contract_present_pending_restore_drill');
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.observabilityDashboard.state, 'contract_present_pending_dashboard_url');
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.sloErrorBudget.state, 'contract_required_pending_owner_receipt');
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.haTopologyEvidence.state, 'paused_pending_second_node');
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.automaticRollbackAdmission.state, 'not_admitted_manual_only');
  assert.deepEqual(release.productionObservabilityBaseline.nextReadiness.evidenceContracts, [
    { id: 'dashboard', owner: 'operations_owner', state: 'contract_required' },
    { id: 'alerting', owner: 'operations_owner', state: 'contract_required' },
    { id: 'error_budget', owner: 'operations_owner', state: 'contract_required' },
    { id: 'rollback_record', owner: 'release_operator', state: 'contract_present' },
  ]);
  assert.equal(release.productionObservabilityBaseline.latestSuccessfulRun.runId, 28039468173);
  assert.equal(release.productionObservabilityBaseline.latestSuccessfulRun.coverage.includes('/metricsz summary fields'), true);
  for (const cannotClaim of ['long-term canary monitoring', 'dashboard', 'alerting', 'error budget enforcement', 'multi-node HA']) {
    assert.equal(release.productionObservabilityBaseline.cannotClaim.includes(cannotClaim), true, `observability baseline must not claim ${cannotClaim}`);
  }
  assert.equal(release.productionHAReadiness.mode, 'cloud_topology_readiness_contract');
  assert.equal(release.productionHAReadiness.state, 'paused_single_pod_launch_pending_second_node');
  assert.equal(release.productionHAReadiness.owner, 'deploy/web-cloud');
  assert.equal(release.productionHAReadiness.consumer, 'production_release_operator');
  assert.equal(release.productionHAReadiness.currentApplyManifest.replicas, 1);
  assert.deepEqual(release.productionHAReadiness.currentApplyManifest.nodeSelector, {
    'medopl.cn/webui': 'true',
  });
  assert.deepEqual(release.productionHAReadiness.currentApplyManifest.nodeLabelPolicy.preserve, {
    'medopl.cn/workload': 'medopl',
  });
  assert.deepEqual(release.productionHAReadiness.currentApplyManifest.nodeLabelPolicy.webuiScheduling, {
    'medopl.cn/webui': 'true',
  });
  assert.equal(release.productionHAReadiness.currentApplyManifest.haPaused, true);
  assert.deepEqual(release.productionHAReadiness.requiredEvidence, [
    'replicas_2',
    'two_ready_pods',
    'distinct_nodes',
    'pdb_min_available_1',
    'topology_spread_constraints',
    'rolling_update_max_unavailable_0',
    'ingress_backend_at_least_2',
    'canary_smoke',
    'production_availability_probe',
  ]);
  assert.equal(release.productionHAReadiness.latestSuccessfulRun, null);
  for (const cannotClaim of ['multi-node HA', 'CLB two-backend health', 'zero-downtime rolling update evidence']) {
    assert.equal(release.productionHAReadiness.cannotClaim.includes(cannotClaim), true, `HA readiness must not claim ${cannotClaim}`);
  }
  assert.equal(release.productionRollbackReadiness.mode, 'manual_environment_approved_rollback');
  assert.equal(release.productionRollbackReadiness.planEntrypoint, 'node scripts/cloud-rollout.mjs --rollback-plan');
  assert.equal(release.productionRollbackReadiness.entrypoint, 'node scripts/cloud-rollout.mjs --rollback');
  assert.equal(release.productionRollbackReadiness.dryRunPlanPolicy.mutatesCluster, false);
  assert.equal(release.productionRollbackReadiness.dryRunPlanPolicy.printsForwardSetImage, false);
  assert.equal(release.productionRollbackReadiness.dryRunPlanPolicy.printsRollbackUndo, true);
  assert.equal(release.productionRollbackReadiness.canaryPodSelectionPolicy.forwardApply, 'Running Ready pod matching requested OPL_IMAGE');
  assert.equal(release.productionRollbackReadiness.canaryPodSelectionPolicy.rollback, 'Running Ready pod matching post-rollback Deployment image');
  assert.equal(release.productionRollbackReadiness.cannotClaim.includes('automatic rollback'), true);
  assert.equal(release.localBrowserE2EReadiness.mode, 'local_chromium_cdp_research_main_path');
  assert.equal(release.localBrowserE2EReadiness.state, 'executed_success_local_2026_06_19');
  assert.equal(release.localBrowserE2EReadiness.releaseGate, true);
  assert.equal(release.localBrowserE2EReadiness.ciWorkflow, '.github/workflows/ci.yml');
  assert.equal(release.localBrowserE2EReadiness.requiredBeforeImageRelease, true);
  assert.equal(release.localBrowserE2EReadiness.latestSuccessfulRun.command, 'npm run verify:browser');
  assert.equal(release.localBrowserE2EReadiness.latestSuccessfulRun.tests, 2);
  assert.equal(release.localBrowserE2EReadiness.latestSuccessfulRun.failures, 0);
  assert.equal(release.localBrowserE2EReadiness.coverage.includes('paper_runtime_gate'), true);
  assert.equal(release.localBrowserE2EReadiness.coverage.includes('grant_runtime_gate'), true);
  assert.equal(release.localBrowserE2EReadiness.coverage.includes('sanitized_audit'), true);
  assert.equal(release.localBrowserE2EReadiness.cannotClaim.includes('production browser e2e'), true);
  assert.equal(release.productionBrowserE2EReadiness.state, 'executed_success_run_28039468173');
  assert.equal(release.productionBrowserE2EReadiness.latestAttempt.runId, 28039468173);
  assert.equal(release.productionBrowserE2EReadiness.latestAttempt.status, 'success');
  assert.equal(release.productionBrowserE2EReadiness.latestAttempt.cannotClaim.includes('production browser e2e'), false);
  assert.equal(release.productionBrowserE2EReadiness.cannotClaim.includes('production browser e2e'), false);
  assert.match(runbook, /OPL_SESSION_SECRET/);
  assert.match(runbook, /Production authenticated dogfood closeout/);
  assert.match(runbook, /28039468173/);
  assert.match(runbook, /c1787da/);
  assert.match(runbook, /production browser e2e passed/);
  assert.match(runbook, /real chat: true/);
  assert.match(runbook, /readonly projection: confirmed/);
  assert.match(runbook, /production authenticated dogfood e2e passed/);
  assert.match(runbook, /Production availability probe closeout/);
  assert.match(runbook, /Production availability probe/);
  assert.match(runbook, /node scripts\/cloud-rollout\.mjs --availability-probe/);
  assert.match(runbook, /OPL_AVAILABILITY_PROBE_SAMPLES=3/);
  assert.match(runbook, /Production observability baseline v1/);
  assert.match(runbook, /scheduled canary first success: 27874732529/);
  assert.match(runbook, /P0 launch operations contracts present/);
  assert.match(runbook, /P1 commercial operations contracts present/);
  assert.match(runbook, /P2 SLA\/HA operations contracts present/);
  assert.match(runbook, /pending external evidence: production_rollback_record, alert_route, db_restore_drill, dashboard_url, production_load_run, multi_node_ha_run, slo_enforcement, automatic_rollback_admission/);
  assert.match(runbook, /\.github\/workflows\/production-canary\.yml/);
  assert.match(runbook, /Production HA readiness contract/);
  assert.match(runbook, /HA is paused for the current single-node launch/);
  assert.match(runbook, /replicas=1/);
  assert.match(runbook, /replicas=2/);
  assert.match(runbook, /two Ready Pod/);
  assert.match(runbook, /distinct node/);
  assert.match(runbook, /PDB minAvailable=1/);
  assert.match(runbook, /run id/i);
  assert.match(runbook, /audit kinds/i);

  assert.doesNotMatch(status, /后续优先级按产品主链路排序：V3 UI 线上验收、真实 auth\/session/);
  assert.doesNotMatch(JSON.stringify(product), /UI 是中文 AI workspace|用户可见 workspace 系统|纯 ChatGPT 页面/);
  assert.doesNotMatch(JSON.stringify(product), /拥有完整 billing|billing source of truth 是 OPL-Webui/);
  assert.match(status, /multi-tenant SaaS Web edition of One Person Lab/);
  assert.match(JSON.stringify(product.claims.canClaim), /research Skill entry remains the primary product positioning/);
  assert.match(status, /default production budget is `60s` via `OPL_CHAT_UPSTREAM_TIMEOUT_SECONDS`/);
  assert.match(status, /Production authenticated dogfood HTTP evidence executed successfully/);
  assert.match(status, /production real ordinary chat completion/);
  assert.match(status, /run `27877811961` failed only at `Production Browser E2E`/);
  assert.match(status, /`response_header_timeout` from `gflabtoken\.cn` on model `gpt-5\.5`/);
  assert.match(status, /Real local Chromium browser e2e executed successfully/);
  assert.match(status, /Browser e2e is now a CI release gate/);
  assert.match(status, /Production availability probe executed successfully/);
  assert.match(status, /Production observability baseline v1 is now folded back to run `28039468173`/);
  assert.match(status, /A no-secret scheduled availability canary first succeeded in GitHub Actions run `27874732529`/);
  assert.match(status, /Operations maturity now has partial evidence boundaries/);
  assert.match(status, /Production HA is paused for the current single-node launch/);
  assert.match(status, /Production operations readiness is now split into P0, P1, and P2 gates/);
  assert.match(status, /P0 launch operations contracts are present/);
  assert.match(status, /P1 commercial operations contracts are present/);
  assert.match(status, /P2 SLA\/HA operations contracts are present/);
  assert.match(status, /external production evidence remains pending/);
  assert.match(status, /OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1.*confirmed/);
  assert.doesNotMatch(status, /本阶段没有执行 production authenticated dogfood e2e/);
  assert.doesNotMatch(status, /本阶段没有执行 production real ordinary chat completion dogfood/);
  assert.doesNotMatch(status, /本阶段没有执行真实 Chromium-driven browser automation/);
  assert.doesNotMatch(status, /本阶段没有执行 production availability probe/);
  assert.match(status, /Next Priorities/);
  assert.match(status, /current gap set is now machine-owned/);
  assert.match(status, /UI\/UX product depth now has source-level Figma MCP evidence pinned/);
  assert.match(status, /Runtime execution boundary is now owner-accepted as fail-closed with an empty allowlist/);
  assert.match(status, /Operations maturity now has partial evidence boundaries/);
  assert.doesNotMatch(status, /Promote browser-level e2e into CI or release-gate evidence/);
});

test('active vision gaps are machine-owned and Figma-gated', () => {
  const product = readJson('contracts/web-product-profile.json');
  const gui = readJson('contracts/web-gui-product-contract.json');
  const runtime = readJson('contracts/web-runtime-bridge.json');
  const status = readFileSync('docs/status.md', 'utf8');
  const active = readFileSync('docs/active/README.md', 'utf8');
  const decisions = readFileSync('docs/decisions.md', 'utf8');

  assert.equal(product.visionGaps.state, 'active_gap_acceptance');
  assert.equal(product.visionGaps.haPolicy.state, 'paused');
  assert.deepEqual(product.visionGaps.items.map((gap) => gap.id), [
    'ui_ux_product_depth',
    'medopl_readonly_evidence',
    'runtime_execution_boundary',
    'commercial_saas_depth',
    'operations_maturity',
    'ha_and_resilience',
    'concurrency_and_load',
    'opl_auto_update_from_github',
  ]);
  assert.equal(gui.figmaSource.fileKey, 'E8nYfNFc2D9P01FYZ8UwBW');
  assert.equal(gui.figmaSource.nodeId, '0:1');
  assert.equal(gui.figmaSource.rejectedPatterns.includes('runtime_truth_ownership'), true);
  assert.equal(gui.figmaSource.rejectedPatterns.includes('unlimited_compute_claim'), true);
  assert.equal(gui.visualQualityGate.state, 'production_ui_quality_claim_accepted_current_head');
  assert.equal(gui.visualQualityGate.completedPhase, 'responsive_visual_qa');
  assert.equal(gui.visualQualityGate.currentPhase, 'production_ui_quality_claim');
  assert.equal(gui.visualQualityGate.ownerReceipt.acceptedClaim, 'ui_ux_v1_production_accepted');
  assert.equal(gui.visualQualityGate.productionUiQualityClaim.productionEvidence.status, 'done');
  assert.equal(gui.visualQualityGate.productionUiQualityClaim.lifecycle.temporaryArtifacts.includes('.runtime/browser-visual/*'), true);
  assert.equal(gui.visualQualityGate.productionUiQualityClaim.productionEvidence.rawArtifactsInGit, false);
  assert.equal(runtime.executionAdmission.currentStatus, 'not_admitted');
  assert.equal(runtime.executionAdmission.ownerReceipt.acceptedClaim, 'runtime_fail_closed_empty_allowlist_boundary_accepted');
  assert.deepEqual(runtime.executionAdmission.currentAllowlist, []);
  assert.equal(runtime.executionAdmission.requiredBeforeAnyExecution.includes('registered eval covering command allowlist'), true);
  assert.equal(runtime.executionAdmission.webRoutesMayMutateRuntime, false);
  assert.deepEqual(runtime.executionAdmission.conditions.map((condition) => [condition.id, condition.status, condition.evidence]), [
    ['go_side_execution_contract', 'missing', 'contract'],
    ['registered_allowlist_eval', 'pass', 'empty_allowlist_fail_closed_eval'],
    ['command_allowlist', 'present', 'empty_allowlist'],
    ['human_authorization_boundary', 'accepted', 'owner_receipt'],
    ['tenant_scoped_audit_events', 'missing', 'audit_contract'],
    ['artifact_body_authority_contract', 'missing', 'authority_contract'],
  ]);

  assert.match(status, /production deploy is release evidence only and must not substitute for product\/eval work/);
  assert.match(active, /production deploy is not the default next action unless the user explicitly asks for release evidence/);
  assert.match(active, /Further UI\/UX work must refresh Figma MCP source context first|UI\/UX Product Depth now requires Figma MCP/);
  assert.match(decisions, /Product gaps use acceptance contracts before deploy evidence/);
  assert.match(decisions, /UI work starts from Figma MCP source context/);
});

test('commercial lifecycle expansion stays a readonly personal projection until consumer contract and tests exist', () => {
  const product = readJson('contracts/web-product-profile.json');
  const release = readJson('contracts/web-release-profile.json');
  const status = readFileSync('docs/status.md', 'utf8');
  const active = readFileSync('docs/active/README.md', 'utf8');
  const decisions = readFileSync('docs/decisions.md', 'utf8');

  assert.equal(product.commercialLifecycle.mode, 'authenticated_readonly_personal_status_projection');
  assert.equal(product.commercialLifecycle.owner, 'one-person-lab-web');
  assert.equal(product.commercialLifecycle.consumer, 'settings_lifecycle_summary');
  assert.equal(product.commercialLifecycle.contract, 'contracts/web-api.openapi.json#/paths/~1api~1account~1commercial-status');
  assert.equal(product.commercialLifecycle.currentAccountType, 'personal');
  assert.equal(product.commercialLifecycle.currentLifecycleState, 'active');
  assert.equal(product.commercialLifecycle.projectionOnly, true);
  assert.deepEqual(product.commercialLifecycle.allowedCurrentActions, ['view_medopl_billing']);
  assert.deepEqual(product.commercialLifecycle.expansionRequires, [
    'real_consumer',
    'contract',
    'registered_tests',
    'MedOPL_billing_authority_preserved',
  ]);
  assert.equal(product.commercialLifecycle.webRoutesMayMutateBilling, false);
  assert.deepEqual(product.commercialLifecycle.expansionConditions.map((condition) => [condition.id, condition.status, condition.evidence]), [
    ['real_consumer', 'missing', 'owner_receipt'],
    ['surface_contract', 'missing', 'contract'],
    ['registered_tests', 'missing', 'eval'],
    ['medopl_billing_authority_preserved', 'missing', 'authority_contract'],
    ['payment_processor_contract', 'missing', 'contract'],
  ]);
  for (const forbiddenExpansion of [
    'team_invite',
    'team_rbac',
    'pricing',
    'subscription',
    'payment_mutation',
    'billing_source_of_truth',
    'commercial_admin_console',
  ]) {
    assert.equal(
      product.commercialLifecycle.forbiddenExpansions.includes(forbiddenExpansion),
      true,
      `commercial lifecycle must forbid ${forbiddenExpansion} expansion`,
    );
  }

  for (const cannotClaim of [
    'team invite lifecycle',
    'RBAC lifecycle',
    'pricing lifecycle',
    'subscription lifecycle',
    'payment lifecycle',
  ]) {
    assert.equal(release.cannotClaim.includes(cannotClaim), true, `release cannot claim ${cannotClaim}`);
  }

  assert.match(status, /authenticated readonly personal commercial status projection/);
  assert.match(status, /team invite\/RBAC\/pricing\/subscription\/payment expansion requires structured `expansionConditions`/);
  assert.match(active, /authenticated readonly personal commercial status projection/);
  assert.match(active, /Commercial lifecycle remains launch-blocking beyond the readonly personal projection/);
  assert.match(decisions, /Commercial lifecycle stays a readonly personal projection/);
  assert.match(decisions, /team invite\/RBAC\/pricing\/subscription\/payment/i);
});

test('operations maturity and gap phase advancement require structured eval evidence', () => {
  const release = readJson('contracts/web-release-profile.json');
  const gapRegistry = readJson('contracts/web-gap-phase-registry.json');
  const status = readFileSync('docs/status.md', 'utf8');
  const active = readFileSync('docs/active/README.md', 'utf8');

  assert.deepEqual(gapRegistry.evalDimensionPolicy.dimensions, ['contract', 'repo_local', 'browser', 'production', 'owner', 'cleanup']);
  assert.equal(gapRegistry.evalDimensionPolicy.advanceRule, 'currentStatus=done and all evalResults pass');
  assert.equal(gapRegistry.evalDimensionPolicy.externalEvidenceCannotBeInferredFromRepoLocal, true);
  assert.deepEqual(gapRegistry.evalDimensionPolicy.externalEvidenceDimensions, ['production', 'owner']);
  assert.deepEqual(release.productionObservabilityBaseline.nextReadiness.evidenceConditions.map((condition) => [condition.id, condition.status, condition.evidence]), [
    ['dashboard_contract', 'missing', 'contract'],
    ['alerting_contract', 'missing', 'contract'],
    ['error_budget_contract', 'missing', 'contract'],
    ['rollback_record_contract', 'present', 'contract'],
    ['production_rollback_record', 'contract_only_pending_first_run', 'production_evidence'],
  ]);
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.costQuotaGuard.state, 'contract_present');
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.migrationSchemaCompatibility.state, 'contract_present_pending_migration_drill');
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.upstreamBackpressure.state, 'repo_local_timeout_fail_closed_pending_production_sla');
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.concurrencyEvidence.state, 'staging_safe_baseline_present_production_claim_pending');
  assert.equal(release.productionLaunchCloseout.mode, 'explicit_final_release_decision_receipt');
  assert.equal(release.productionLaunchCloseout.entrypoint, 'npm run release:evidence -- --launch-closeout-json <sanitized-json>');
  assert.deepEqual(release.productionLaunchCloseout.requiredReceiptFields, ['decision', 'owner', 'acceptedAt', 'acceptedClaim', 'evidence', 'rawLogPolicy']);
  assert.equal(release.productionLaunchCloseout.cannotClaim.includes('production-ready SaaS'), true);
  assert.equal(release.productionObservabilityBaseline.nextReadiness.rollbackRecordV1.state, 'contract_present_pending_first_production_run');
  assert.equal(release.productionRollbackReadiness.recordContract.state, 'present');
  assert.deepEqual(release.productionObservabilityBaseline.nextReadiness.maturityAdmittedWhen, [
    'dashboard_contract=present',
    'alerting_contract=present',
    'error_budget_contract=present',
    'rollback_record_contract=present',
    'production_rollback_record=present',
  ]);
  assert.match(status, /a phase may advance only when `currentStatus=done` and all eval results pass/);
  assert.match(active, /Repo-local tests cannot infer production evidence or owner receipt/);
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
