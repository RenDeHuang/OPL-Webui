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

function assertIncludesAll(actual, expected, label) {
  for (const item of expected) assert.equal(actual.includes(item), true, `missing ${label}: ${item}`);
}

test('package lifecycle exposes verification-only commands', () => {
  for (const scriptName of [
    'verify', 'verify:health', 'verify:smoke', 'verify:contract', 'test:health', 'test:smoke',
    'test:contract', 'test:regression', 'gate:ai', 'gate:review', 'repo:bloat', 'line:budget', 'check:diff',
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

  assert.match(readme, /One Person Lab knowledge delivery Web platform/);
  assert.match(readme, /personal account-based Web edition/);
  assert.match(readme, /@科研`, `@论文`, `@基金`, `@综述`, `@文件`, `@PPT`, and `@书`/);
  assert.match(agents, /不使用 `changes\/active` 七件套作为默认开发系统/);
  assert.match(taste, /Read `README\.md`/);
  assert.match(status, /three-layer product modules plus explicit gap slices/);
  assert.match(status, /docs\/active\/README\.md/);
  assert.match(status, /Product work moves one slice at a time/);
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
  assert.match(active, /28282021822/);
  assert.match(active, /d9f50522e1f116a6f8d9827c33bc0b08a4e1f721/);
  assert.match(active, /28142197152.*historical-only/);
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
  assert.equal(release.latestMainEvidence.state, 'folded_success_run_28282021822');
  assert.equal(release.latestMainEvidence.runId, 28282021822);
  assert.equal(release.latestMainEvidence.commit, 'd9f50522e1f116a6f8d9827c33bc0b08a4e1f721');
  assert.equal(release.latestMainEvidence.image, 'uswccr.ccs.tencentyun.com/webopl/opl-webui:d9f5052');
  assert.equal(release.latestMainEvidence.canClaim.includes('OPL-Webui controlled launch ready'), true);
  assert.match(status, /contracts\/web-product-profile\.json/);
  assert.match(status, /contracts\/web-api\.openapi\.json/);
  assert.match(status, /contracts\/web-release-profile\.json/);
  assert.match(status, /contracts\/web-development-profile\.json/);
  assert.match(status, /Latest main production evidence is folded back from GitHub Actions run `28282021822`/);
  assert.doesNotMatch(status, /one-person-lab-web-truth-reset/);
  assert.doesNotMatch(status, /repo-slimming-and-stale-name-retirement/);
  assert.doesNotMatch(status, /Latest `main` production evidence is folded back to GitHub Actions run `28142197152`/);
});

test('product contracts keep OPL-WebUI as one-person-lab-web instead of standalone SaaS backend', () => {
  const status = readFileSync('docs/status.md', 'utf8');
  const product = readJson('contracts/web-product-profile.json');
  const runtime = readJson('contracts/web-runtime-bridge.json');
  const api = readJson('contracts/web-api.openapi.json');
  const release = readJson('contracts/web-release-profile.json');
  const runbook = readFileSync('deploy/web-cloud/RUNBOOK.md', 'utf8');

  assert.equal(product.productId, 'one-person-lab-web');
  assert.equal(product.positioning, 'One Person Lab knowledge delivery Web platform');
  assert.equal(product.topLevelProductCategory, 'knowledge_delivery_web_platform');
  assert.equal(product.primaryUserPath, 'account_based_web_app_main_path');
  assert.equal(product.primaryEntryModel, 'login_bind_key_then_task_entry');
  assert.equal(product.accountBasedWebAppMainPath.mode, 'account_based_web_edition_main_path_v1');
  assert.deepEqual(product.accountBasedWebAppMainPath.orderedSteps.map((step) => step.id), [
    'open_web',
    'login_account',
    'bind_api_key_or_use_account_capability',
    'choose_research_task',
    'view_result_or_medopl_gate',
    'view_progress_refs',
    'view_deliverable_refs',
    'view_blocker_next_step',
    'continue_via_medopl_deeplink',
  ]);
  assert.equal(product.accountBasedWebAppMainPath.technicalCapability.multiTenant, 'hidden_enabler_not_product_positioning');
  assert.equal(product.webBusinessCapabilityV1.claim, 'account_based_one_person_lab_web_app_business_capability_v1');
  assert.equal(product.webBusinessCapabilityV1.mainPathContract, 'contracts/web-product-profile.json#/accountBasedWebAppMainPath');
  assert.deepEqual(product.primaryEntryMarkers, ['@科研', '@论文', '@基金', '@综述', '@文件', '@PPT', '@书']);
  assert.equal(product.provider.fixedBaseUrl, 'https://gflabtoken.cn/v1');
  assert.equal(product.provider.wireApi, 'responses');
  assert.equal(product.provider.defaultModel, 'gpt-5.5');
  assert.equal(product.provider.serviceTier, 'fast');
  assert.equal(product.provider.reasoningEffort, 'xhigh');
  assert.equal(product.provider.upstreamTimeoutSeconds, 60);
  assert.equal(product.provider.upstreamTimeoutEnv, 'OPL_CHAT_UPSTREAM_TIMEOUT_SECONDS');
  assert.equal(product.provider.userEditableBaseUrl, false);
  assert.equal(product.ownedSurfaces.includes('account_based_web_app_entry'), true);
  assert.equal(product.ownedSurfaces.includes('multi_tenant_saas_product'), false);
  assert.equal(product.ownedSurfaces.includes('web_product_surface'), true);
  assert.equal(product.ownedSurfaces.includes('tenant_isolation'), true);
  assert.equal(product.ownedSurfaces.includes('research_capability_entry'), true);
  assert.equal(product.ownedSurfaces.includes('ordinary_chat_fallback'), true);
  assert.equal(product.ownedSurfaces.includes('page_state'), true);
  assert.equal(product.ownedSurfaces.includes('commercial_account_lifecycle_projection'), true);
  assert.equal(product.ownedSurfaces.includes('medopl_runtime_gate_bridge'), true);
  assert.equal(product.ownedSurfaces.includes('medopl_runtime_run_refs_projection'), true);
  assert.equal(product.ownedSurfaces.includes('medopl_billing_ledger_refs_projection'), true);
  assert.equal(product.ownedSurfaces.includes('medopl_capability_entry'), true);
  assert.equal(product.ownedSurfaces.includes('medopl_authorization_status_projection'), true);
  assert.equal(product.ownedSurfaces.includes('medopl_progress_refs_projection'), true);
  assert.equal(product.ownedSurfaces.includes('ordinary_chat_entry'), false);
  assert.equal(product.nonOwnedTruth.includes('billing_source_of_truth'), true);
  assert.equal(product.nonOwnedTruth.includes('runtime_truth'), true);
  assert.equal(product.nonOwnedTruth.includes('artifact_body_authority'), true);
  assert.equal(product.consumedAuthorities.includes('one-person-lab-app/contracts/app-product-profile.json'), true);
  assert.equal(product.consumedAuthorities.includes('one-person-lab/contracts/opl-framework/domains.json'), true);
  assert.equal(product.capabilityGoal.mode, 'medopl_authorized_runtime_storage_capabilities_without_web_authority');
  assert.deepEqual(product.capabilityGoal.targetCapabilities, ['runtime', 'storage', 'progress_refs', 'deliverable_refs', 'materials_refs', 'presentation_refs', 'book_refs']);
  assert.deepEqual(product.capabilityGoal.webOwnedExperience, ['entry', 'authorization_status', 'runtime_gate_bridge', 'run_intent_submission', 'readonly_projection', 'progress_refs_projection', 'deliverable_refs_projection', 'billing_ledger_refs_projection', 'deeplink', 'fail_closed_gate']);
  assert.deepEqual(product.capabilityGoal.authorityOwners, { runtime: 'MedOPL / OPL Framework', storage: 'MedOPL / OPL Framework', artifactBody: 'MedOPL / OPL Framework' });
  assert.equal(product.capabilityGoal.webMayExecuteRuntime, false);
  assert.equal(product.capabilityGoal.webMayOwnStorageTruth, false);

  assert.deepEqual(product.capabilityGoal.upstreamPurposeEntries, [
    'research',
    'grant',
    'presentation_foundry',
    'book_foundry',
  ]);
  assert.equal(product.capabilityGoal.webMayOwnArtifactBody, false);

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
  assert.deepEqual(runtime.runtimeRequiredMarkers, ['@论文', '@基金', '@综述', '@文件', '@PPT', '@书']);
  assert.equal(runtime.runtimeRequiredMarkers.includes('@长任务'), false);
  assert.equal(runtime.capabilityGoal.mode, 'medopl_authorized_capability_entry_and_refs_projection');
  assert.deepEqual(runtime.capabilityGoal.userCapabilities, ['runtime', 'storage', 'progress_refs', 'deliverable_refs', 'materials_refs', 'presentation_refs', 'book_refs']);
  assert.deepEqual(runtime.capabilityGoal.webRole, ['gate', 'authorization_status', 'readonly_projection', 'progress_refs_projection', 'deliverable_refs_projection', 'deeplink']);
  assert.deepEqual(runtime.capabilityGoal.authorityOwners, ['MedOPL', 'OPL Framework']);
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
  assert.equal(release.productionDogfoodReadiness.state, 'executed_success_run_28282021822_real_chat_readonly_confirmed');
  assert.equal(release.productionDogfoodReadiness.evidenceScope, 'historical');
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.runId, 28282021822);
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.commit, 'd9f50522e1f116a6f8d9827c33bc0b08a4e1f721');
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.image, 'uswccr.ccs.tencentyun.com/webopl/opl-webui:d9f5052');
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
  assert.equal(release.productionAvailabilityReadiness.state, 'executed_success_run_28282021822_after_apply');
  assert.equal(release.productionAvailabilityReadiness.evidenceScope, 'historical');
  assert.equal(release.productionAvailabilityReadiness.latestSuccessfulRun.runId, 28282021822);
  assert.equal(release.productionAvailabilityReadiness.latestSuccessfulRun.commit, 'd9f50522e1f116a6f8d9827c33bc0b08a4e1f721');
  assert.equal(release.productionAvailabilityReadiness.latestSuccessfulRun.image, 'uswccr.ccs.tencentyun.com/webopl/opl-webui:d9f5052');
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
  assert.equal(release.productionObservabilityBaseline.state, 'release_probe_executed_run_28282021822_scheduled_canary_success_pending_long_term_ops');
  assert.equal(release.productionObservabilityBaseline.evidenceScope, 'historical');
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
  assert.equal(release.productionObservabilityBaseline.latestSuccessfulRun.runId, 28282021822);
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
  assert.equal(release.productionBrowserE2EReadiness.state, 'executed_success_run_28282021822');
  assert.equal(release.productionBrowserE2EReadiness.evidenceScope, 'historical');
  assert.equal(release.productionBrowserE2EReadiness.latestAttempt.runId, 28282021822);
  assert.equal(release.productionBrowserE2EReadiness.latestAttempt.status, 'success');
  assert.equal(release.productionBrowserE2EReadiness.latestAttempt.cannotClaim.includes('production browser e2e'), false);
  assert.equal(release.productionBrowserE2EReadiness.cannotClaim.includes('production browser e2e'), false);
  assert.match(runbook, /OPL_SESSION_SECRET/);
  assert.match(runbook, /Production authenticated dogfood closeout/);
  assert.match(runbook, /28282021822/);
  assert.match(runbook, /d9f5052/);
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
  assert.match(status, /One Person Lab knowledge delivery Web platform/);
  assert.match(status, /Account-based User Product Layer is done v1 at repo\/browser evidence level/);
  assert.match(JSON.stringify(product.claims.canClaim), /account-based task path remains the primary product positioning/);
  assert.match(status, /default production budget is `60s` via `OPL_CHAT_UPSTREAM_TIMEOUT_SECONDS`/);
  assert.match(status, /Latest-main production authenticated dogfood HTTP evidence executed successfully/);
  assert.match(status, /production real ordinary chat completion/);
  assert.match(status, /run `27877811961` failed only at `Production Browser E2E`/);
  assert.match(status, /`response_header_timeout` from `gflabtoken\.cn` on model `gpt-5\.5`/);
  assert.match(status, /Real local Chromium browser e2e executed successfully/);
  assert.match(status, /Browser e2e is now a CI release gate/);
  assert.match(status, /Latest-main production availability probe executed successfully/);
  assert.match(status, /Production observability baseline v1 is folded back to latest-main run `28282021822`/);
  assert.match(status, /A no-secret scheduled availability canary first succeeded in GitHub Actions run `27874732529`/);
  assert.match(status, /Operations maturity now has partial evidence boundaries/);
  assert.match(status, /Production HA is paused for the current single-node launch/);
  assert.match(status, /Production operations readiness is now split into P0, P1, and P2 gates/);
  assert.match(status, /P0 launch operations contracts are present/);
  assert.match(status, /P1 commercial operations contracts are present/);
  assert.match(status, /P2 SLA\/HA operations contracts are present/);
  assert.match(status, /external production evidence still pending after this RC closeout/);
  assert.match(status, /OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1.*confirmed/);
  assert.match(status, /Latest main production evidence is folded back from GitHub Actions run `28282021822`/);
  assert.doesNotMatch(status, /本阶段没有执行 production authenticated dogfood e2e/);
  assert.doesNotMatch(status, /本阶段没有执行 production real ordinary chat completion dogfood/);
  assert.doesNotMatch(status, /本阶段没有执行真实 Chromium-driven browser automation/);
  assert.doesNotMatch(status, /本阶段没有执行 production availability probe/);
  assert.match(status, /Next Priorities/);
  assert.match(status, /current gap set is machine-owned/);
  assert.match(status, /UI\/UX product depth now has source-level Figma MCP evidence pinned/);
  assert.match(status, /Runtime bridge boundary now has a local Go-side MedOPL API bridge/);
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
  assert.equal(runtime.medoplApiBridge.requiredEndpointEnv, 'MEDOPL_API_BASE_URL');
  assert.equal(runtime.medoplApiBridge.endpointConfigScope, 'operator_deployment_config');
  assert.equal(runtime.medoplApiBridge.endpointNotConfiguredPolicy, 'operator_deployment_blocker_fail_closed');
  assert.equal(runtime.medoplApiBridge.routes.runtimeGate.webRoute, 'POST /api/opl/runtime-gate');
  assert.equal(runtime.medoplApiBridge.routes.runs.webRoute, 'POST /api/opl/runs');
  assert.equal(runtime.medoplApiBridge.routes.billingSummary.projectionPolicy, 'readonly_summary_and_ledger_refs_only');
  assert.equal(runtime.medoplApiBridge.typedBlockers.includes('package_required'), true);
  assert.equal(runtime.medoplApiBridge.typedBlockers.includes('storage_required'), true);
  assert.equal(runtime.medoplApiBridge.cannotClaim.includes('MedOPL production runtime execution'), true);
  assert.equal(runtime.runtimeAdmission.mode, 'medopl_account_resource_state_driven');
  assert.deepEqual(runtime.runtimeAdmission.readyWhen, [
    'package_or_plan_active',
    'credit_or_billing_ok',
    'compute_resource_open',
    'storage_space_open',
    'workspace_runtime_storage_binding_bound',
  ]);
  assert.deepEqual(runtime.runtimeAdmission.operatorDeploymentConfig, ['MEDOPL_API_BASE_URL']);
  assert.deepEqual(runtime.runtimeAdmission.notProductPolicy, [
    'selected_user',
    'test_account',
    'canary_account',
    'hardcoded_account_allowlist',
    'MEDOPL_API_BASE_URL',
  ]);
  assert.equal(runtime.executionAdmission.ownerReceipt.acceptedClaim, 'medopl_runtime_gate_run_bridge_local_refs_only_accepted');
  assert.deepEqual(runtime.executionAdmission.webRuntimeCommandPolicy.allowedCommands, []);
  assert.equal(runtime.executionAdmission.webRuntimeCommandPolicy.productAccessPolicy, false);
  assert.equal(runtime.executionAdmission.requiredBeforeAnyExecution.includes('production MedOPL runtime execution evidence'), true);
  assert.equal(runtime.executionAdmission.webRoutesMayMutateRuntime, false);
  assert.deepEqual(runtime.executionAdmission.conditions.map((condition) => [condition.id, condition.status, condition.evidence]), [
    ['go_side_medopl_bridge_contract', 'present', 'contracts/web-runtime-bridge.json#/medoplApiBridge'],
    ['registered_bridge_eval', 'pass', 'tests/contract/medopl-runtime-bridge-contract.test.mjs'],
    ['web_runtime_command_policy', 'present', 'empty_command_set_not_product_access_policy'],
    ['human_authorization_boundary', 'accepted', 'owner_receipt'],
    ['tenant_scoped_audit_events', 'partial', 'runtime_gate_audit_only'],
    ['real_local_medopl_process_evidence', 'present', 'contracts/web-runtime-bridge.json#/realLocalMedOPLEvidence'],
    ['production_medopl_runtime_execution_evidence', 'missing', 'release_evidence'],
    ['artifact_body_authority_contract', 'missing', 'authority_contract'],
  ]);

  assert.match(status, /Production deploy is release evidence only and must not substitute for product\/eval work/);
  assert.match(active, /Production rollout latest-main evidence is folded back for commit `d9f5052` through Cloud Rollout run `28282021822`/);
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
  assert.match(active, /Commercial owner decision is accepted only for readonly personal projection/);
  assert.match(decisions, /Commercial lifecycle stays a readonly personal projection/);
  assert.match(decisions, /team invite\/RBAC\/pricing\/subscription\/payment/i);
});

test('MedOPL runtime and storage capabilities are product goals without Web authority', () => {
  const pageState = readJson('contracts/web-page-state-matrix.json');
  const product = readJson('contracts/web-product-profile.json');
  const runtime = readJson('contracts/web-runtime-bridge.json');
  const status = readFileSync('docs/status.md', 'utf8');
  const active = readFileSync('docs/active/README.md', 'utf8');

  assert.equal(pageState.medoplCapabilityStates.mode, 'authorized_capability_projection_without_web_authority');
  assert.deepEqual(pageState.medoplCapabilityStates.states, [
    'medopl_not_authorized',
    'medopl_authorized',
    'runtime_status_readonly',
    'storage_status_readonly',
    'progress_refs_readonly',
    'deliverable_refs_readonly',
  ]);
  assert.deepEqual(pageState.medoplCapabilityStates.forbiddenClaims, [
    'web_runtime_execution',
    'web_storage_truth',
    'artifact_body_authority',
    'node_pool_lifecycle',
  ]);
  assert.equal(pageState.medoplCapabilityStates.authorityOwner, 'MedOPL / OPL Framework');
  assert.equal(product.capabilityGoal.pageStateContract, 'contracts/web-page-state-matrix.json#/medoplCapabilityStates');
  assert.equal(runtime.projectionPolicy.allowedPayload.includes('status'), true);
  assert.equal(runtime.projectionPolicy.allowedPayload.includes('deliverable_refs'), true);
  assert.equal(runtime.projectionPolicy.forbiddenPayload.includes('private_state_path'), true);
  assert.match(status, /runtime\/storage\/package\/billing\/resource release (are owned by MedOPL|remain MedOPL-owned capabilities)/);
  assert.match(active, /runtime\/storage\/package\/billing\/resource release are MedOPL-owned capabilities/);
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
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.alertingBoundary.ownerReceipt.owner, 'huangrende');
  assert.deepEqual(release.productionObservabilityBaseline.productionReadinessGates.alertingBoundary.ownerReceipt.severityPolicy, {
    p0: '5m_response',
    p1: '30m_response',
    p2: 'business_hours_response',
  });
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.alertingBoundary.ownerReceipt.channelStatus, 'pending');
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.observabilityDashboard.ownerReceipt.status, 'pending_dashboard_url');
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.concurrencyEvidence.ownerReceipt.stagingUsers, 10);
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.concurrencyEvidence.ownerReceipt.productionPolicy, 'smoke_only');
  assert.equal(release.productionObservabilityBaseline.productionReadinessGates.concurrencyEvidence.ownerReceipt.upstreamQuotaPolicy, 'no_real_gflabtoken_quota_without_explicit_authorization');
  assert.equal(release.productionLaunchCloseout.mode, 'explicit_final_release_decision_receipt');
  assert.equal(release.productionLaunchCloseout.entrypoint, 'npm run release:evidence -- --launch-closeout-json <sanitized-json>');
  assert.deepEqual(release.productionLaunchCloseout.requiredReceiptFields, ['decision', 'owner', 'acceptedAt', 'acceptedClaim', 'evidence', 'rawLogPolicy']);
  assert.equal(release.productionLaunchCloseout.cannotClaim.includes('production-ready SaaS'), true);
  assert.equal(release.productionOperationsCloseout.mode, 'p0_p1_single_node_operations_closeout');
  assert.equal(release.productionOperationsCloseout.entrypoint, 'npm run release:evidence -- --ops-closeout-json <sanitized-json>');
  assert.deepEqual(release.productionOperationsCloseout.rawLogPolicy, { storesRawLogs: false, storesSecretValues: false });
  assert.equal(release.productionOperationsCloseout.cannotClaim.includes('multi-node HA'), true);
  assert.equal(release.productionObservabilityBaseline.nextReadiness.rollbackRecordV1.state, 'contract_present_pending_first_production_run');
  assert.equal(release.productionRollbackReadiness.recordContract.state, 'present');
  assert.equal(Object.hasOwn(release.productionRollbackReadiness, 'latestDrill'), false);
  assert.deepEqual(release.productionObservabilityBaseline.nextReadiness.maturityAdmittedWhen, [
    'dashboard_contract=present',
    'alerting_contract=present',
    'error_budget_contract=present',
    'rollback_record_contract=present',
    'production_rollback_record=present',
  ]);
  assert.match(status, /a phase may advance only when `currentStatus=done` and all eval results pass/);
  assert.match(active, /run `28142197152` remains historical only/);
  assert.match(status, /Alert route owner receipt is accepted for owner `huangrende` with P0 5 minutes, P1 30 minutes, and P2 business-hours response, but channel evidence remains pending/);
  assert.match(active, /rollback drill run id, DB restore drill, dashboard URL, and concrete alert channel remain pending external evidence/);
});

test('controlled launch readiness separates hard launch gates from upstream quality evidence', () => {
  const release = readJson('contracts/web-release-profile.json');
  const product = readJson('contracts/web-product-profile.json');
  const pageState = readJson('contracts/web-page-state-matrix.json');
  const status = readFileSync('docs/status.md', 'utf8');
  const active = readFileSync('docs/active/README.md', 'utf8');

  assert.equal(release.controlledLaunchReadiness.mode, 'single_node_controlled_launch_v1');
  assert.equal(release.controlledLaunchReadiness.claim, 'controlled_launch_readiness');
  assert.equal(release.controlledLaunchReadiness.owner, 'one-person-lab-web-release');
  assert.equal(release.controlledLaunchReadiness.consumer, 'release_operator');
  assert.equal(release.controlledLaunchReadiness.state, 'latest_main_d9f5052_supported_by_folded_production_evidence_run_28282021822');
  assert.equal(release.controlledLaunchReadiness.businessCapabilityV1.contract, 'contracts/web-product-profile.json#/webBusinessCapabilityV1');
  assert.equal(release.controlledLaunchReadiness.businessCapabilityV1.hardGateForControlledLaunch, true);
  assert.deepEqual(release.controlledLaunchReadiness.hardGates, [
    'release_image_exists',
    'production_dry_run',
    'production_apply',
    'canary_smoke',
    'availability_probe',
    'account_session_byok_audit_quota_postgres_contracts',
    'service_unavailable_fail_closed_contract',
  ]);
  assert.deepEqual(release.controlledLaunchReadiness.supportingEvidence, [
    'production_authenticated_dogfood_real_upstream_structured_research_success',
    'production_browser_e2e_real_upstream_structured_research_success',
    'medopl_readonly_projection_dogfood',
    'scheduled_canary_first_success',
  ]);
  assert.equal(release.controlledLaunchReadiness.realUpstreamStructuredResearch.hardGateForControlledLaunch, false);
  assert.equal(release.controlledLaunchReadiness.serviceUnavailableFailClosed.hardGateForControlledLaunch, true);
  assert.deepEqual(release.controlledLaunchReadiness.longTaskContinuity.requiredProjection, ['refs', 'progress_refs', 'deliverable_refs', 'deeplink', 'blocker_next_step']);
  assert.deepEqual(release.controlledLaunchReadiness.saasControlPlane.requiredContracts, ['account_session', 'tenant_isolation', 'BYOK', 'sanitized_audit', 'quota_guard', 'postgres_store_path', 'release_canary']);
  assert.equal(release.controlledLaunchReadiness.cannotClaim.includes('production-ready SaaS'), true);
  assert.equal(release.controlledLaunchReadiness.cannotClaim.includes('upstream provider availability'), true);
  assert.equal(release.controlledLaunchReadiness.cannotClaim.includes('production concurrent SaaS readiness'), true);
  assert.equal(product.claims.canClaim.includes('single-node controlled launch readiness'), true);
  assert.equal(product.claims.cannotClaim.includes('production-ready SaaS'), true);
  assert.equal(pageState.structuredResultShape.serviceUnavailableFallback, 'sanitized_fail_closed_no_structured_result_fabrication');
  assert.match(status, /Controlled launch readiness is a separate release claim/);
  assert.match(active, /controlled launch readiness is separate from real upstream structured research success/);
  assert.match(active, /Latest main production evidence is folded back from run `28282021822`/);
  assert.doesNotMatch(active, /Latest `main` production evidence is folded back to run `28142197152`/);
});

test('owner decisions keep commercial and HA boundaries explicit without false completion claims', () => {
  const product = readJson('contracts/web-product-profile.json');
  const release = readJson('contracts/web-release-profile.json');
  const gapRegistry = readJson('contracts/web-gap-phase-registry.json');
  const status = readFileSync('docs/status.md', 'utf8');
  const active = readFileSync('docs/active/README.md', 'utf8');

  assert.equal(product.commercialLifecycle.ownerReceipt.status, 'accepted');
  assert.equal(product.commercialLifecycle.ownerReceipt.acceptedClaim, 'commercial_readonly_personal_projection_boundary_accepted');
  assert.equal(product.commercialLifecycle.blockedBy, 'missing_real_buyer_or_operator_workflow');
  assert.equal(product.commercialLifecycle.billingPaymentSourceOfTruth, 'MedOPL');
  assert.equal(product.commercialLifecycle.webRoutesMayMutateBilling, false);

  const commercialGap = gapRegistry.gaps.find((gap) => gap.id === 'commercial_saas_depth');
  assert.equal(commercialGap.currentStatus, 'blocked');
  assert.equal(commercialGap.phases[0].ownerReceipt.status, 'accepted');
  assert.equal(commercialGap.phases[0].ownerReceipt.acceptedClaim, 'commercial_readonly_personal_projection_boundary_accepted');
  assert.equal(commercialGap.phases[0].ownerReceipt.doesNotAdmit.includes('team_rbac'), true);
  assert.equal(commercialGap.phases[0].ownerReceipt.doesNotAdmit.includes('payment_mutation'), true);

  assert.equal(release.productionHAReadiness.ownerReceipt.status, 'accepted');
  assert.equal(release.productionHAReadiness.ownerReceipt.acceptedClaim, 'ha_paused_for_single_node_controlled_launch');
  assert.equal(release.productionHAReadiness.ownerReceipt.secondNodeApproved, false);
  assert.equal(release.productionHAReadiness.currentApplyManifest.replicas, 1);

  const haGap = gapRegistry.gaps.find((gap) => gap.id === 'ha_and_resilience');
  assert.equal(haGap.state, 'paused');
  assert.equal(haGap.currentStatus, 'blocked');
  assert.equal(haGap.phases[0].ownerReceipt.status, 'accepted');
  assert.equal(haGap.phases[0].ownerReceipt.acceptedClaim, 'ha_paused_for_single_node_controlled_launch');
  assert.match(status, /HA owner decision is accepted as paused/);
  assert.match(active, /Commercial owner decision is accepted only for readonly personal projection/);
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

test('product truth is fixed to growth user and minimal ops layers without full SaaS expansion', () => {
  const product = readJson('contracts/web-product-profile.json');
  const pageState = readJson('contracts/web-page-state-matrix.json');
  const release = readJson('contracts/web-release-profile.json');
  const api = readJson('contracts/web-api.openapi.json');
  const registry = readFileSync('scripts/test-classification.mjs', 'utf8');
  const status = readFileSync('docs/status.md', 'utf8');
  const active = readFileSync('docs/active/README.md', 'utf8');

  assert.deepEqual(product.productLayers.map((layer) => [layer.id, layer.status]), [
    ['public_growth_layer', 'done_v1'],
    ['account_based_user_product_layer', 'done_v1_repo_browser'],
    ['minimal_admin_ops_layer', 'partial'],
  ]);
  const byLayer = Object.fromEntries(product.productLayers.map((layer) => [layer.id, layer]));
  assert.deepEqual(byLayer.public_growth_layer.audience, ['anonymous_user']);
  assert.deepEqual(byLayer.public_growth_layer.surfaces, ['public_homepage', 'use_cases', 'task_skill_catalog', 'example_outputs', 'updates', 'login_cta']);
  assert.deepEqual(byLayer.public_growth_layer.taskFamilies, ['research', 'paper', 'grant', 'review', 'files', 'ppt', 'book']);
  assert.equal(byLayer.public_growth_layer.referenceShape, 'YouMind-style public product education surface');
  assert.equal(byLayer.public_growth_layer.ownsRuntimeExecution, false);
  assert.equal(byLayer.public_growth_layer.ownsArtifactBody, false);
  assert.equal(byLayer.public_growth_layer.ownsBillingTruth, false);
  assert.equal(byLayer.account_based_user_product_layer.contract, 'contracts/web-product-profile.json#/accountBasedWebAppMainPath');
  assert.equal(byLayer.account_based_user_product_layer.primary, true);
  assert.equal(byLayer.account_based_user_product_layer.claimStatus, 'done_v1_repo_browser');
  assertIncludesAll(byLayer.account_based_user_product_layer.owned, ['account_session', 'task_entry', 'page_state', 'sanitized_projection', 'refs', 'deeplink'], 'user layer owned surface');
  assertIncludesAll(byLayer.account_based_user_product_layer.forbiddenClaims, ['full_saas', 'payment', 'team_rbac', 'runtime_execution'], 'user layer forbidden claim');
  assert.deepEqual(byLayer.minimal_admin_ops_layer.registrationModeAllowed, ['open', 'invite_only', 'allowlist', 'disabled']);
  assert.deepEqual(byLayer.minimal_admin_ops_layer.userStatusAllowed, ['active', 'disabled']);
  assert.equal(byLayer.minimal_admin_ops_layer.activeSlice, undefined);
  assert.equal(byLayer.minimal_admin_ops_layer.completedSlices.includes('registration_policy_user_status_v0'), true);
  assert.equal(byLayer.minimal_admin_ops_layer.nextGaps.dogfoodReleaseEvidenceSummary, 'not_started');
  assert.equal(byLayer.minimal_admin_ops_layer.nextGaps.hiddenOpsUi, 'optional_reserved');
  assert.deepEqual(byLayer.minimal_admin_ops_layer.firstPhaseSurfaces, ['operator_only_api', 'same_domain_hidden_ops_route']);
  assertIncludesAll(byLayer.minimal_admin_ops_layer.operatorOnlyCapabilities, ['view_sanitized_user_status', 'view_quota', 'view_audit', 'disable_user', 'enable_user'], 'ops capability');
  assert.equal(byLayer.minimal_admin_ops_layer.authBoundary, 'operator_token_required');
  assert.equal(byLayer.minimal_admin_ops_layer.allAdminOperationsAudited, true);
  assertIncludesAll(byLayer.minimal_admin_ops_layer.forbiddenCapabilities, ['payment', 'pricing', 'subscription', 'invoice', 'refund', 'team_rbac', 'support_impersonation'], 'ops forbidden capability');

  assert.deepEqual(product.gapMap.layers.map((layer) => [layer.id, layer.status]), [
    ['growth_layer', 'done_v1'],
    ['user_product_layer', 'done_v1_repo_browser'],
    ['admin_ops_layer', 'partial'],
    ['production_rollout', 'folded_success_run_28282021822'],
  ]);
  assert.deepEqual(pageState.productLayers.map((layer) => [layer.id, layer.status]), [
    ['public_growth_layer', 'done_v1'],
    ['account_based_user_product_layer', 'done_v1_repo_browser'],
    ['minimal_admin_ops_layer', 'partial'],
  ]);
  assert.equal(pageState.minimalAdminOpsLayer.registrationMode.default, 'open');
  assert.deepEqual(pageState.minimalAdminOpsLayer.registrationMode.allowed, ['open', 'invite_only', 'allowlist', 'disabled']);
  assert.deepEqual(pageState.minimalAdminOpsLayer.userStatus.allowed, ['active', 'disabled']);
  assert.equal(pageState.minimalAdminOpsLayer.completedSlices.includes('registration_policy_user_status_v0'), true);
  assert.equal(pageState.minimalAdminOpsLayer.nextGaps.dogfoodReleaseEvidenceSummary, 'not_started');
  assert.equal(pageState.minimalAdminOpsLayer.firstPhaseRouteOptions.includes('/_ops'), true);
  assert.equal(pageState.minimalAdminOpsLayer.operatorAuth, 'operator_token_required');
  assert.equal(pageState.minimalAdminOpsLayer.requiresAuditForAdminMutation, true);

  assert.equal(api['x-product-layers'].primary, 'account_based_user_product_layer');
  assert.equal(api['x-product-layers'].publicGrowthLayer.status, 'done_v1');
  assert.equal(api['x-product-layers'].minimalAdminOpsLayer.status, 'partial');
  assert.equal(api['x-product-layers'].minimalAdminOpsLayer.registrationModeAllowed.includes('allowlist'), true);
  assert.equal(api['x-product-layers'].minimalAdminOpsLayer.forbiddenCapabilities.includes('payment'), true);
  assert.equal(api['x-product-layers'].minimalAdminOpsLayer.allAdminOperationsAudited, true);
  assert.equal(release.productLayerReadiness.accountBasedUserProductLayer, 'done_v1_repo_browser');
  assert.equal(release.productLayerReadiness.publicGrowthLayer, 'done_v1');
  assert.equal(release.productLayerReadiness.taskHistoryContinuationCenter, 'done_v0');
  assert.equal(release.productLayerReadiness.minimalAdminOpsLayer, 'partial');
  assert.equal(release.productLayerReadiness.minimalAdminOpsLayerNextGap, 'dogfood_release_evidence_summary_not_started');
  assert.equal(release.productLayerReadiness.productionRollout, 'folded_success_run_28282021822');
  assertIncludesAll(release.productLayerReadiness.cannotClaimFromAdminOpsV0, ['full SaaS', 'payment lifecycle', 'team/RBAC lifecycle', 'HA', 'runtime sync'], 'admin ops cannot claim');
  assert.doesNotMatch(JSON.stringify(product), /sub2api/i);
  assert.doesNotMatch(status, /sub2api/i);
  assert.doesNotMatch(active, /sub2api/i);
  assert.match(status, /Public Growth Layer/);
  assert.match(status, /Account-based User Product Layer/);
  assert.match(status, /Minimal Admin\/Ops Layer/);
  assert.match(active, /Minimal Admin\/Ops Layer is partial/i);
  assert.match(active, /registration policy and user status v0 is done/i);
  assert.match(registry, /Admin\/Ops v0 does not prove full SaaS/);
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
