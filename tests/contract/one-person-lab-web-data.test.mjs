import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import * as web from '../../apps/web/src/onePersonLabWeb.mjs';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('one-person-lab-web contracts define product truth instead of prose specs', () => {
  const product = readJson('contracts/web-product-profile.json');
  const pageStates = readJson('contracts/web-page-state-matrix.json');
  const api = readJson('contracts/web-api.openapi.json');
  const runtime = readJson('contracts/web-runtime-bridge.json');
  const release = readJson('contracts/web-release-profile.json');
  const gui = readJson('contracts/web-gui-product-contract.json');
  const shell = readJson('contracts/web-shell-adapter.json');

  assert.equal(product.productId, 'one-person-lab-web');
  assert.equal(product.canonicalProductName, 'One Person Lab Web');
  assert.equal(product.positioning, 'Multi-tenant SaaS Web edition of One Person Lab');
  assert.equal(product.primaryUserPath, 'research_capability_first_web_workbench');
  assert.equal(product.primaryEntryModel, 'at_mention_research_capabilities');
  assert.deepEqual(product.targetUsers, [
    'research_staff',
    'masters_students',
    'phd_students',
    'principal_investigators',
    'research_teams',
  ]);
  assert.deepEqual(product.primaryEntryMarkers, ['@科研', '@论文', '@基金', '@综述', '@文件']);
  for (const owned of ['multi_tenant_saas_product', 'tenant_isolation', 'research_capability_entry', 'ordinary_chat_fallback', 'web_control_plane_api']) {
    assert.equal(product.ownedSurfaces.includes(owned), true, `missing owned surface: ${owned}`);
  }
  assert.equal(product.ownedSurfaces.includes('commercial_account_lifecycle_projection'), true);
  assert.equal(product.ownedSurfaces.includes('ordinary_chat_entry'), false);
  assert.equal(product.publicUi.primarySurface, 'research_capability_first_web_workbench');
  assert.equal(product.visionGaps.state, 'active_non_ha_gap_acceptance');
  assert.deepEqual(product.visionGaps.haPolicy, { state: 'paused', reason: 'single-node launch safety' });
  assert.deepEqual(product.visionGaps.items.map((gap) => [gap.id, gap.ownerSurface, gap.disposition]), [
    ['ui_ux_product_depth', 'apps-web', 'repo_local_contract_ready_pending_visual_baseline'],
    ['medopl_readonly_evidence', 'release-evidence', 'awaiting_secret_gated_foldback'],
    ['runtime_execution_boundary', 'runtime-gate', 'fail_closed_until_admission_contract'],
    ['commercial_saas_depth', 'product-boundary', 'readonly_personal_projection_only'],
    ['operations_maturity', 'release-evidence', 'baseline_plus_next_evidence_contracts'],
  ]);
  const visionGap = (id) => product.visionGaps.items.find((gap) => gap.id === id);
  assert.deepEqual(visionGap('ui_ux_product_depth').evidenceRequired, ['figma_mcp_source_context', 'component_state_contract', 'responsive_shell_smoke', 'browser_interaction_e2e']);
  assert.equal(visionGap('ui_ux_product_depth').acceptanceContract, 'contracts/web-gui-product-contract.json');
  assert.equal(visionGap('medopl_readonly_evidence').acceptanceContract, 'contracts/web-release-profile.json#/productionDogfoodReadiness');
  assert.equal(visionGap('runtime_execution_boundary').acceptanceContract, 'contracts/web-runtime-bridge.json');
  assert.equal(product.provider.fixedBaseUrl, 'https://gflabtoken.cn/v1');
  assert.equal(product.provider.wireApi, 'responses');
  assert.equal(product.provider.defaultModel, 'gpt-5.5');
  assert.equal(product.provider.serviceTier, 'fast');
  assert.equal(product.provider.reasoningEffort, 'xhigh');
  assert.equal(product.provider.upstreamTimeoutSeconds, 60);
  assert.equal(product.provider.upstreamTimeoutEnv, 'OPL_CHAT_UPSTREAM_TIMEOUT_SECONDS');
  assert.equal(product.provider.userEditableBaseUrl, false);
  assert.equal(product.credential.rawKeyReturnedToBrowser, false);
  for (const hidden of ['workspace', 'runtime', 'nodePool', 'storage', 'billing']) {
    assert.equal(product.publicUi.hiddenConcepts.includes(hidden), true, `${hidden} must stay hidden`);
  }
  for (const nonOwned of ['runtime_truth', 'node_pool_lifecycle', 'storage_truth', 'billing_source_of_truth', 'api_gateway_truth', 'opl_execution_truth']) {
    assert.equal(product.nonOwnedTruth.includes(nonOwned), true, `missing non-owned truth: ${nonOwned}`);
  }

  assert.deepEqual(pageStates.routes.map((route) => route.id), ['chat', 'settings', 'capabilities', 'medopl']);
  assert.equal(pageStates.routes.find((route) => route.id === 'chat').surface, 'research_capability_workbench');
  assert.deepEqual(pageStates.accountStates, ['anonymous', 'authenticated_unbound', 'authenticated_bound']);
  for (const state of ['research_entry_selected', 'paper_entry_selected', 'grant_entry_selected', 'materials_refs_pending']) {
    assert.equal(pageStates.chatStates.includes(state), true, `missing research chat state: ${state}`);
  }
  assert.equal(pageStates.chatStates.includes('runtime_required'), true);
  const reliability = pageStates.reliabilityModel;
  assert.deepEqual([reliability.owner, reliability.consumer, reliability.mode], ['one-person-lab-web', 'browser_reliability_status_surface', 'sanitized_view_model_only']);
  const reliabilityStates = ['auth_required', 'api_key_required', 'quota_exceeded', 'upstream_failed', 'service_unavailable', 'network_unreachable'];
  assert.deepEqual(reliability.statuses.map(({ state, resultErrorCode }) => [state, resultErrorCode]), [['auth_required', 'AUTH_REQUIRED'], ['api_key_required', 'API_KEY_REQUIRED'], ['quota_exceeded', 'CHAT_QUOTA_EXCEEDED'], ['upstream_failed', 'UPSTREAM_CHAT_FAILED'], ['service_unavailable', 'SERVICE_UNAVAILABLE'], ['network_unreachable', 'NETWORK_UNREACHABLE']]);
  assert.deepEqual(reliabilityStates.every((state) => pageStates.routes.find((route) => route.id === 'chat').states.includes(state)), true);
  assert.deepEqual(reliability.allowedFields, ['state', 'title', 'action', 'retryable', 'details']);
  assert.deepEqual(['raw_upstream_body', 'raw_provider_error', 'api_key', 'rawApiKey', 'encryptedApiKey', 'private_state', 'private_state_path', 'database_url', 'artifact_body'].every((field) => reliability.forbiddenPayload.includes(field)), true);
  assert.deepEqual(pageStates.localReadinessScenario.steps.map((step) => step.id), [
    'anonymous_shell',
    'register',
    'login',
    'current_session',
    'browser_session_bootstrap',
    'api_key_binding',
    'research_task_template_selected',
    'research_capability_launcher',
    'ordinary_chat_fallback',
    'quota_exceeded',
    'paper_runtime_gate',
    'grant_runtime_gate',
    'account_lifecycle_status_visible',
    'reliability_status_visible',
    'sanitized_audit',
  ]);
  assert.equal(pageStates.localReadinessScenario.requiresProductionSecrets, false);
  assert.equal(pageStates.localReadinessScenario.observableSelectors.includes('[data-chat-log]'), true);
  assert.equal(pageStates.localReadinessScenario.observableSelectors.includes('[data-runtime-gate]'), true);
  assert.equal(pageStates.localReadinessScenario.observableSelectors.includes('[data-settings-panel]'), true);
  assert.equal(pageStates.localReadinessScenario.observableSelectors.includes('[data-research-launcher]'), true);
  assert.equal(pageStates.localReadinessScenario.observableSelectors.includes('[data-capability-marker]'), true);
  assert.equal(pageStates.localReadinessScenario.observableSelectors.includes('[data-capability-mode]'), true);
  assert.equal(pageStates.localReadinessScenario.observableSelectors.includes('[data-research-task]'), true);
  assert.equal(pageStates.localReadinessScenario.observableSelectors.includes('[data-research-result]'), true);
  assert.equal(pageStates.localReadinessScenario.observableSelectors.includes('[data-research-result-section]'), true);
  assert.equal(pageStates.localReadinessScenario.observableSelectors.includes('[data-runtime-task-card]'), true);
  assert.equal(pageStates.localReadinessScenario.observableSelectors.includes('[data-account-lifecycle-status]'), true);
  assert.equal(pageStates.localReadinessScenario.observableSelectors.includes('[data-team-readiness-status]'), true);
  assert.equal(pageStates.localReadinessScenario.observableSelectors.includes('[data-quota-status]'), true);
  assert.equal(pageStates.localReadinessScenario.observableSelectors.includes('[data-account-audit-status]'), true);
  assert.equal(pageStates.localReadinessScenario.observableSelectors.includes('[data-reliability-status]'), true);
  assert.deepEqual(pageStates.researchTaskIntents.map((intent) => [intent.id, intent.marker, intent.runtimePolicy]), [
    ['research_direction', '@科研', 'ordinary_chat_fallback'],
    ['paper_question', '@论文', 'runtime_gate'],
    ['grant_plan', '@基金', 'runtime_gate'],
    ['review_map', '@综述', 'runtime_gate'],
    ['materials_refs', '@文件', 'runtime_gate'],
  ]);
  assert.deepEqual(pageStates.structuredResultShape.sections, ['research_plan', 'evidence_refs', 'next_steps']);
  assert.equal(pageStates.structuredResultShape.owner, 'one-person-lab-web');
  assert.equal(pageStates.structuredResultShape.consumer, 'research_user_chat_result');
  assert.equal(pageStates.structuredResultShape.forbiddenPayload.includes('artifact_body'), true);
  assert.equal(pageStates.structuredResultShape.forbiddenPayload.includes('private_state_path'), true);
  assert.deepEqual(pageStates.shellStates.requiredStates, [
    'public_landing',
    'auth_login_register',
    'app_default_chat',
    'left_sidebar_expanded',
    'right_inspector_files',
    'right_inspector_progress',
    'right_inspector_output',
    'api_key_required_modal',
    'skill_plaza',
    'running_turn',
    'blocked_turn',
  ]);
  assert.equal(pageStates.shellStates.defaultAppState, 'app_default_chat');
  assert.equal(pageStates.shellStates.leftRail.defaultState, 'collapsed');
  assert.equal(pageStates.shellStates.leftRail.expandedState, 'left_sidebar_expanded');
  assert.equal(pageStates.shellStates.rightInspector.defaultState, 'hidden');
  assert.deepEqual(pageStates.shellStates.rightInspector.tabs, ['files', 'progress', 'output']);
  assert.deepEqual(pageStates.shellStates.rightInspector.resize, { enabled: true, minWidth: 320, maxWidth: 520 });
  assert.equal(pageStates.shellStates.modals.apiKeyRequired.primaryAction, 'save');
  assert.equal(pageStates.shellStates.modals.apiKeyRequired.primaryActionLabel, '保存');

  for (const path of [
    '/api/session/current',
    '/api/settings/model-provider',
    '/api/chat',
    '/api/chat/conversations',
    '/api/account/audit-events',
    '/api/account/commercial-status',
  ]) {
    assert.ok(api.paths[path], `missing API path: ${path}`);
  }
  assert.equal(api.paths['/api/mvp/task'], undefined);
  assert.equal(
    api.paths['/api/account/commercial-status'].get.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/CommercialAccountStatus',
  );
  assert.equal(api.components.schemas.CommercialAccountStatus.additionalProperties, false);
  assert.equal(api.components.schemas.CommercialAccountStatus.required.includes('teamReadiness'), true);
  assert.equal(api.components.schemas.CommercialAccountStatus.required.includes('webuiRBACMutation'), true);
  assert.equal(api.components.schemas.ApiErrorCode.enum.includes('RUNTIME_REQUIRED'), true);
  assert.equal(api.components.schemas.ApiErrorCode.enum.includes('CHAT_QUOTA_EXCEEDED'), true);
  assert.equal(api.components.schemas.ChatErrorCode, undefined);

  assert.equal(runtime.owner, 'MedOPL');
  assert.equal(runtime.webuiRuntimeExecution, 'forbidden');
  assert.deepEqual(runtime.lightweightMarkers, ['@科研']);
  assert.deepEqual(runtime.runtimeRequiredMarkers, ['@论文', '@基金', '@综述', '@文件']);
  assert.deepEqual(runtime.markerSemantics.map((item) => [item.marker, item.workflow, item.runtimePolicy]), [
    ['@科研', 'research_planning', 'ordinary_chat_fallback'],
    ['@论文', 'paper_review_workflow', 'runtime_gate'],
    ['@基金', 'grant_workflow', 'runtime_gate'],
    ['@综述', 'review_workflow', 'runtime_gate'],
    ['@文件', 'materials_refs_workflow', 'runtime_gate'],
  ]);
  assert.equal(runtime.medoplDeepLink, 'https://medopl.medopl.cn');
  assert.equal(runtime.projectionPolicy.allowedPayload.includes('refs'), true);
  assert.equal(runtime.projectionPolicy.forbiddenPayload.includes('artifact_body'), true);
  for (const field of ['requiresGoSideContract', 'requiresEval', 'requiresWhitelist', 'requiresHumanAuthorization']) assert.equal(runtime.authorizationBoundary[field], true);
  assert.equal(runtime.executionAdmission.currentStatus, 'not_admitted');
  assert.deepEqual(runtime.executionAdmission.requiredBeforeAnyExecution, [
    'Go-side runtime execution contract',
    'registered eval covering command allowlist',
    'human authorization boundary',
    'tenant-scoped audit events',
    'artifact/body authority contract',
  ]);
  assert.deepEqual(runtime.executionAdmission.failClosedUntil, [
    'contract_exists',
    'eval_passes',
    'allowlist_exists',
    'authorization_boundary_exists',
  ]);

  assert.equal(release.productionHost, 'opl.medopl.cn');
  assert.deepEqual(release.requiredGates, ['npm run verify', 'npm run gate:ai', 'npm run gate:review', 'npm run repo:bloat', 'sentrux check .']);
  assert.equal(release.localNoSecretReadiness.requiresProductionSecrets, false);
  assert.equal(release.localNoSecretReadiness.browserAutomation, false);
  assert.equal(release.localNoSecretReadiness.automationLevel, 'http_contract_and_static_shell');
  assert.deepEqual(release.localNoSecretReadiness.coverage, [
    'register',
    'login',
    'current_session',
    'browser_session_bootstrap',
    'api_key_binding',
    'ordinary_chat_mock_upstream',
    'quota_exceeded',
    'runtime_gate',
    'sanitized_audit',
    'desktop_shell',
    'mobile_shell',
    'settings_hash',
  ]);
  assert.equal(release.localNoSecretReadiness.evidenceCommands.includes('node --test tests/contract/one-person-lab-chat-upstream.test.mjs'), true);
  assert.equal(release.localNoSecretReadiness.evidenceCommands.includes('node --test tests/smoke/web-shell.test.mjs'), true);
  assert.equal(release.productionDogfoodReadiness.state, 'executed_success_run_27876229568_real_chat_readonly_unconfirmed');
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.runUrl, 'https://github.com/RenDeHuang/OPL-Webui/actions/runs/27876229568');
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.commit, 'a3f7c399872a70332bd9e9465c05d11c9c2bd4ad');
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.image, 'uswccr.ccs.tencentyun.com/webopl/opl-webui:a3f7c39');
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.realChat, true);
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.medoplReadonly, 'unconfirmed');
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.coverage.includes('ordinary_chat_real_completion'), true);
  assert.deepEqual(release.productionDogfoodReadiness.readonlyFoldbackPolicy.requiredEvidence, [
    'OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1',
    'dogfood stdout confirms readonly projection checks',
    'release-evidence-sync --dogfood-readonly-confirmed',
  ]);
  assert.equal(release.productionDogfoodReadiness.readonlyFoldbackPolicy.forbidRawLogs, true);
  assert.equal(release.productionDogfoodReadiness.readonlyFoldbackPolicy.forbidSecretValues, true);
  assert.equal(release.productionDogfoodReadiness.readonlyFoldbackPolicy.claimWhenConfirmed, 'production MedOPL readonly projection dogfood');
  assert.equal(release.productionAvailabilityReadiness.state, 'executed_success_run_27876229568_after_apply');
  assert.equal(release.productionAvailabilityReadiness.latestSuccessfulRun.runUrl, 'https://github.com/RenDeHuang/OPL-Webui/actions/runs/27876229568');
  assert.equal(release.productionAvailabilityReadiness.latestSuccessfulRun.coverage.includes('HTTPS /readyz'), true);
  assert.equal(release.productionDogfoodReadiness.cannotClaim.includes('production real ordinary chat completion'), false);
  assert.equal(release.productionObservabilityBaseline.state, 'release_probe_executed_run_27876229568_scheduled_canary_success_pending_long_term_ops');
  assert.equal(release.productionObservabilityBaseline.latestSuccessfulRun.runUrl, 'https://github.com/RenDeHuang/OPL-Webui/actions/runs/27876229568');
  assert.equal(release.productionObservabilityBaseline.nextReadiness.state, 'scheduled_canary_first_success_run_27874732529_pending_ops_consumer');
  assert.equal(release.productionObservabilityBaseline.nextReadiness.scheduledCanary.workflow, '.github/workflows/production-canary.yml');
  assert.equal(release.productionObservabilityBaseline.nextReadiness.scheduledCanary.requiresProductionSecrets, false);
  assert.equal(release.productionObservabilityBaseline.nextReadiness.implementedEvidence.includes('scheduled_canary_first_success'), true);
  assert.equal(release.productionObservabilityBaseline.nextReadiness.scheduledCanary.latestSuccessfulRun.runId, 27874732529);
  assert.equal(release.productionObservabilityBaseline.nextReadiness.requiredFutureEvidence.includes('scheduled_canary_first_success'), false);
  assert.equal(release.productionObservabilityBaseline.nextReadiness.requiredFutureEvidence.includes('error_budget'), true);
  assert.deepEqual(release.productionObservabilityBaseline.nextReadiness.evidenceContracts, [
    { id: 'dashboard', owner: 'operations_owner', state: 'contract_required' },
    { id: 'alerting', owner: 'operations_owner', state: 'contract_required' },
    { id: 'error_budget', owner: 'operations_owner', state: 'contract_required' },
    { id: 'rollback_record', owner: 'release_operator', state: 'contract_required' },
  ]);
  assert.equal(release.productionObservabilityBaseline.cannotClaim.includes('dashboard'), true);
  assert.equal(release.productionObservabilityBaseline.cannotClaim.includes('alerting'), true);
  assert.equal(release.productionHAReadiness.state, 'paused_single_pod_launch_pending_second_node');
  assert.deepEqual(release.productionHAReadiness.currentApplyManifest.nodeSelector, {
    'medopl.cn/webui': 'true',
  });
  assert.deepEqual(release.productionHAReadiness.currentApplyManifest.nodeLabelPolicy.preserve, {
    'medopl.cn/workload': 'medopl',
  });
  assert.equal(release.productionHAReadiness.latestSuccessfulRun, null);
  assert.equal(release.productionHAReadiness.requiredEvidence.includes('two_ready_pods'), true);
  assert.equal(release.productionHAReadiness.requiredEvidence.includes('distinct_nodes'), true);
  assert.equal(release.productionHAReadiness.requiredEvidence.includes('ingress_backend_at_least_2'), true);
  assert.equal(release.productionHAReadiness.cannotClaim.includes('multi-node HA'), true);
  assert.equal(release.localBrowserE2EReadiness.browserAutomation, true);
  assert.equal(release.localBrowserE2EReadiness.releaseGate, true);
  assert.equal(release.localBrowserE2EReadiness.ciWorkflow, '.github/workflows/ci.yml');
  assert.equal(release.localBrowserE2EReadiness.requiredBeforeImageRelease, true);
  assert.equal(release.localBrowserE2EReadiness.latestSuccessfulRun.command, 'npm run verify:browser');
  assert.deepEqual(release.localBrowserE2EReadiness.latestSuccessfulRun.auditKinds.sort(), ['chat.completed', 'runtime_gate.required']);
  assert.equal(release.productionBrowserE2EReadiness.mode, 'secret_gated_chromium_research_main_path');
  assert.equal(release.productionBrowserE2EReadiness.state, 'executed_success_run_27876229568');
  assert.equal(release.productionBrowserE2EReadiness.defaultEnabled, false);
  assert.equal(release.productionBrowserE2EReadiness.browserAutomation, true);
  assert.equal(release.productionBrowserE2EReadiness.entrypoint, 'node tests/browser/research-main-path-runner.mjs --production');
  assert.equal(release.productionBrowserE2EReadiness.latestAttempt.runId, 27876229568);
  assert.equal(release.productionBrowserE2EReadiness.latestAttempt.status, 'success');
  assert.equal(release.productionBrowserE2EReadiness.latestAttempt.failedStage, null);
  assert.equal(release.productionBrowserE2EReadiness.latestAttempt.canClaim.includes('production browser e2e executed against https://opl.medopl.cn'), true);
  assert.equal(release.productionBrowserE2EReadiness.latestAttempt.cannotClaim.includes('production browser e2e'), false);
  assert.deepEqual(release.productionBrowserE2EReadiness.requiredSecrets, [
    'OPL_DOGFOOD_EMAIL',
    'OPL_DOGFOOD_PASSWORD',
    'OPL_DOGFOOD_API_KEY',
  ]);
  assert.deepEqual(release.productionBrowserE2EReadiness.requiredSwitches, ['OPL_PRODUCTION_BROWSER_E2E']);
  assert.equal(release.productionBrowserE2EReadiness.coverage.includes('real_browser_login'), true);
  assert.equal(release.productionBrowserE2EReadiness.coverage.includes('paper_runtime_gate'), true);
  assert.equal(release.productionBrowserE2EReadiness.cannotClaim.includes('production browser e2e'), false);
  assert.equal(release.productionBrowserE2EReadiness.cannotClaim.includes('MedOPL runtime execution'), true);
  assert.equal(release.localNoSecretReadiness.cannotClaim.includes('production authenticated dogfood e2e executed'), false);
  assert.equal(release.localNoSecretReadiness.cannotClaim.includes('production authenticated dogfood e2e requires Cloud Rollout evidence'), true);
  assert.equal(release.dogfood.rawApiKeyPrinted, false);

  assert.equal(gui.owner, 'one-person-lab-web');
  assert.equal(gui.purpose, 'web_gui_product_contract');
  assert.equal(gui.state, 'active');
  assert.equal(gui.productTruthGate.publicShell, 'public_landing_then_auth');
  assert.equal(gui.productTruthGate.appShell, 'chat_first_research_workspace');
  assert.equal(gui.productTruthGate.gensparkInfluence, 'public_landing_only');
  assert.equal(gui.productTruthGate.codexInfluence, 'app_workspace_shell');
  for (const forbidden of ['dashboard_first_app_home', 'raw_trace_console', 'runtime_truth_panel', 'billing_source_of_truth', 'node_pool_console']) {
    assert.equal(gui.productTruthGate.mustNotShow.includes(forbidden), true, `GUI contract must forbid ${forbidden}`);
  }
  assert.deepEqual(gui.objectGrammar.allowedPrimaryObjects, [
    'Project',
    'Session',
    'Message',
    'Skill',
    'InputFile',
    'OutputFile',
    'ProgressStage',
    'ApiKey',
    'Model',
    'Export',
  ]);
  assert.deepEqual(gui.objectGrammar.fileHierarchy, ['cloud_drive', 'project', 'session', 'input_output_refs']);
  assert.deepEqual(gui.taskFlow.primaryFlow, [
    'public_dashboard',
    'login_or_register',
    'app_default_chat',
    'project_or_session_select',
    'compose_prompt',
    'attach_input_files_optional',
    'run_chat_or_runtime_gate',
    'inspect_progress_files_output',
    'export_or_continue',
  ]);
  assert.deepEqual(gui.informationArchitecture.appShell, ['left_rail', 'workspace_sidebar', 'chat_canvas', 'right_inspector', 'modal_layer']);
  assert.equal(gui.visualGrammar.maxPrimaryCtaPerView, 1);
  assert.equal(gui.visualGrammar.longExplanatoryCopy, 'forbidden_in_app_shell');
  assert.equal(gui.semanticTokens.resourceActive, 'resource.active');
  assert.equal(gui.semanticTokens.billingWarning, 'billing.warning');
  assert.equal(gui.components.find((component) => component.id === 'RightInspector').defaultState, 'hidden');
  assert.deepEqual(gui.components.find((component) => component.id === 'RightInspector').tabs, ['files', 'progress', 'output']);
  assert.equal(gui.components.find((component) => component.id === 'RightInspector').resize.enabled, true);
  assert.equal(gui.components.find((component) => component.id === 'ApiKeyDialog').primaryActionLabel, '保存');
  assert.equal(gui.figmaSource.fileKey, 'E8nYfNFc2D9P01FYZ8UwBW');
  assert.equal(gui.figmaSource.nodeId, '0:1');
  assert.deepEqual(gui.figmaSource.requiredSourceFiles, ['src/app/App.tsx', 'src/styles/theme.css', 'src/styles/index.css']);
  assert.deepEqual(gui.figmaSource.adoptedPatterns, [
    'collapsed_expanded_left_rail',
    'account_popover_status',
    'missing_api_key_resource_gate',
    'prompt_command_center',
    'research_skill_launcher',
    'chat_task_view',
    'right_inspector_tabs_files_progress_output',
    'running_blocked_turn_state',
  ]);
  assert.deepEqual(gui.figmaSource.rejectedPatterns, [
    'drive_or_cloud_storage_ownership',
    'runtime_truth_ownership',
    'founder_plan_upsell',
    'unlimited_compute_claim',
    'dashboard_crm_primary_app',
    'generic_office_content_design_code_video_skills',
  ]);
  assert.equal(gui.visualQualityGate.state, 'repo_local_contract_ready_pending_visual_baseline');
  assert.deepEqual(gui.visualQualityGate.requiredBeforeProductionUiClaim, [
    'Figma MCP source context refreshed',
    'desktop screenshot reviewed',
    'mobile screenshot reviewed',
    'browser interaction e2e passed',
    'no hidden overlay intercepts input',
  ]);
  assert.deepEqual(gui.pageTemplates, [
    'PublicLanding',
    'Auth',
    'DefaultAppShell',
    'ExpandedSidebar',
    'RightInspectorOpen',
    'ModalOverlay',
    'SkillPlaza',
    'OutputPreview',
  ]);
  assert.equal(gui.accessibility.keyboardRequired, true);
  assert.equal(gui.acceptanceLayers.includes('contract'), true);
  assert.equal(gui.acceptanceLayers.includes('component_state'), true);
  assert.equal(gui.acceptanceLayers.includes('interaction'), true);
  assert.equal(gui.acceptanceLayers.includes('visual'), true);

  assert.equal(shell.owner, 'one-person-lab-web');
  assert.equal(shell.purpose, 'web_shell_adapter');
  assert.equal(shell.state, 'active');
  assert.equal(shell.activeShell.id, 'opl_web_static_esm_shell');
  assert.equal(shell.activeShell.migrationPolicy, 'stay_static_until_component_state_or_visual_regression_evidence_requires_framework');
  for (const owned of ['renderer_components', 'layout_composition', 'panel_resize_behavior', 'figma_code_mapping']) {
    assert.equal(shell.shellMayOwn.includes(owned), true, `shell may own ${owned}`);
  }
  for (const forbidden of ['product_truth', 'runtime_truth', 'domain_judgment_truth', 'artifact_body_authority', 'billing_source_of_truth']) {
    assert.equal(shell.shellMustNotOwn.includes(forbidden), true, `shell must not own ${forbidden}`);
  }
  assert.deepEqual(shell.figmaCodeMapping.variantProps.RightInspector, {
    state: ['hidden', 'files', 'progress', 'output'],
    width: ['default', 'narrow', 'wide'],
  });
  assert.equal(shell.figmaCodeMapping.requiredNodeMetadata.includes('componentId'), true);
  assert.equal(shell.figmaCodeMapping.requiredNodeMetadata.includes('variantProps'), true);
  assert.equal(shell.codeProps.RightInspector.state.includes('files'), true);
  assert.equal(shell.validationCommands.includes('npm run verify:contract'), true);
  assert.equal(shell.validationCommands.includes('npm run verify:smoke'), true);
});

test('web data module calls session provider and chat APIs only', async () => {
  const calls = [];
  const fetchRef = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === '/api/session/current') return response({ ok: true, email: 'user@example.com' });
    if (url === '/api/settings/model-provider') return response({
      ok: true,
      provider: 'gflabtoken',
      baseUrl: 'https://gflabtoken.cn/v1',
      apiKeyConfigured: true,
      maskedKey: 'sk-***1234',
    });
    if (url === '/api/chat/conversations') return response({ ok: true, conversations: [] });
    if (url === '/api/account/commercial-status') return response({
      ok: true,
      owner: 'OnePersonLabWeb',
      productId: 'one-person-lab-web',
      accountType: 'personal',
      lifecycleState: 'active',
      tenantId: 'tenant_123',
      tenantRole: 'owner',
      teamReadiness: {
        state: 'single_user_owner',
        owner: 'OnePersonLabWeb',
        consumer: 'settings_lifecycle_summary',
        allowedNextActions: ['view_medopl_billing'],
      },
      webuiTeamMutation: 'forbidden',
      webuiInviteMutation: 'forbidden',
      webuiRBACMutation: 'forbidden',
      webuiPaymentMutation: 'forbidden',
      webuiBillingSourceOfTruth: 'forbidden',
    });
    if (url === '/api/account/billing-summary') return response({
      ok: true,
      owner: 'MedOPL',
      deepLink: 'https://medopl.medopl.cn/billing',
      quota: { limit: 100, used: 1, remaining: 99 },
      audit: { eventCount: 2, latestEventKind: 'chat.completed' },
      webuiBillingSourceOfTruth: 'forbidden',
      webuiPaymentMutation: 'forbidden',
    });
    if (url === '/api/medopl/runtime/status') return response({
      ok: true,
      owner: 'MedOPL',
      state: 'ready',
      deepLink: 'https://medopl.medopl.cn/runtime',
      counts: { activeRuns: 1 },
      webuiRuntimeExecution: 'forbidden',
    });
    if (url === '/api/medopl/materials-deliverables/projection') return response({
      ok: true,
      owner: 'MedOPL',
      deepLink: 'https://medopl.medopl.cn/materials',
      materials: [],
      deliverables: [],
      webuiStorageMutation: 'forbidden',
      webuiArtifactBody: 'forbidden',
    });
    if (url === '/api/chat') return response({ ok: true, conversationId: 'conv_1', assistantMessage: { content: '你好' } });
    if (url === '/api/opl/snapshot') return response({ ok: true, mode: 'readonly' });
    return response({ ok: false }, 404);
  };

  const state = await web.loadOnePersonLabWebState(fetchRef);
  assert.equal(state.session.email, 'user@example.com');
  assert.equal(state.provider.baseUrl, 'https://gflabtoken.cn/v1');
  assert.equal(state.provider.apiKeyConfigured, true);
  assert.equal(state.commercialStatus.accountType, 'personal');
  assert.equal(state.commercialStatus.lifecycleState, 'active');
  assert.equal(state.commercialStatus.teamReadiness.state, 'single_user_owner');
  assert.deepEqual(state.commercialStatus.teamReadiness.allowedNextActions, ['view_medopl_billing']);
  assert.equal(state.commercialStatus.webuiTeamMutation, 'forbidden');
  assert.equal(state.commercialStatus.webuiRBACMutation, 'forbidden');

  const chat = await web.sendChatMessage(fetchRef, '普通问题');
  assert.equal(chat.assistantMessage.content, '你好');
  assert.deepEqual(calls.map((call) => call.url), [
    '/api/session/current',
    '/api/settings/model-provider',
    '/api/chat/conversations',
    '/api/account/commercial-status',
    '/api/account/billing-summary',
    '/api/medopl/runtime/status',
    '/api/medopl/materials-deliverables/projection',
    '/api/opl/snapshot',
    '/api/chat',
  ]);
  assert.doesNotMatch(JSON.stringify(calls), /\/api\/mvp\/task|base_url|demo:\/\//);
});

test('browser bootstrap probes current session without loading OPL snapshot', () => {
  const domSource = readFileSync('apps/web/src/onePersonLabWebDom.mjs', 'utf8');

  assert.match(domSource, /loadOnePersonLabWebState\(fetch, \{ loadSnapshot: false \}\)/);
  assert.doesNotMatch(domSource, /loadOnePersonLabWebState\(fetch, \{ probeSession: false, loadSnapshot: false \}\)/);
});

test('web data module exposes hash view and account state machine', () => {
  const pageStates = readJson('contracts/web-page-state-matrix.json');

  assert.equal(web.viewFromHash('#settings'), 'settings');
  assert.equal(web.viewFromHash('#capabilities'), 'capabilities');
  assert.equal(web.viewFromHash('#medopl'), 'medopl');
  assert.equal(web.viewFromHash(''), 'chat');
  for (const route of pageStates.routes) {
    assert.equal(web.viewFromHash(route.hash), route.id, `route hash must resolve: ${route.id}`);
  }

  assert.equal(web.accountState({ ok: false }, { apiKeyConfigured: false }), 'anonymous');
  assert.equal(web.accountState({ ok: true }, { apiKeyConfigured: false }), 'authenticated_unbound');
  assert.equal(web.accountState({ ok: true }, { apiKeyConfigured: true }), 'authenticated_bound');
});

test('web data module implements the page-state chat matrix', () => {
  const pageStates = readJson('contracts/web-page-state-matrix.json');
  const chatStates = pageStates.chatStates;
  const reliabilityStates = pageStates.reliabilityModel.statuses.map((status) => status.state);

  for (const state of ['idle', 'sending', 'runtime_required', 'quota_exceeded', 'upstream_failed']) {
    assert.equal(chatStates.includes(state), true, `missing contract chat state: ${state}`);
  }
  for (const state of ['auth_required', 'api_key_required', 'service_unavailable', 'network_unreachable']) {
    assert.equal(chatStates.includes(state), true, `missing reliability contract state: ${state}`);
  }
  assert.deepEqual(reliabilityStates, ['auth_required', 'api_key_required', 'quota_exceeded', 'upstream_failed', 'service_unavailable', 'network_unreachable']);
  for (const state of ['research_entry_selected', 'paper_entry_selected', 'grant_entry_selected', 'materials_refs_pending']) {
    assert.equal(chatStates.includes(state), true, `missing research contract state: ${state}`);
  }

  assert.equal(web.chatStateForResult(null), 'idle');
  assert.equal(web.chatStateForResult(null, true), 'sending');
  assert.equal(web.chatStateForResult({ ok: false, errorCode: 'RUNTIME_REQUIRED' }), 'runtime_required');
  assert.equal(web.chatStateForResult({ ok: false, errorCode: 'CHAT_QUOTA_EXCEEDED' }), 'quota_exceeded');
  assert.equal(web.chatStateForResult({ ok: false, errorCode: 'UPSTREAM_CHAT_FAILED' }), 'upstream_failed');
  assert.equal(web.chatStateForResult({ ok: false, errorCode: 'AUTH_REQUIRED' }), 'auth_required');
  assert.equal(web.chatStateForResult({ ok: false, errorCode: 'API_KEY_REQUIRED' }), 'api_key_required');
  assert.equal(web.chatStateForResult({ ok: false, errorCode: 'SERVICE_UNAVAILABLE' }), 'service_unavailable');
  assert.equal(web.chatStateForResult({ ok: false, errorCode: 'NETWORK_UNREACHABLE' }), 'network_unreachable');
  assert.equal(web.chatStateForResult({ ok: true, assistantMessage: { content: 'ok' } }), 'idle');
  assert.equal(web.chatStateForPrompt('@科研 帮我拆解研究方向'), 'research_entry_selected');
  assert.equal(web.chatStateForPrompt('@论文 生成研究选题'), 'paper_entry_selected');
  assert.equal(web.chatStateForPrompt('@基金 帮我拆解标书结构'), 'grant_entry_selected');
  assert.equal(web.chatStateForPrompt('@文件 整理材料引用'), 'materials_refs_pending');
  assert.equal(web.chatStateForPrompt('普通问答'), 'idle');
  assert.deepEqual(web.RESEARCH_TASK_INTENTS.map((intent) => [intent.id, intent.marker, intent.expectedChatState]), [
    ['research_direction', '@科研', 'research_entry_selected'],
    ['paper_question', '@论文', 'paper_entry_selected'],
    ['grant_plan', '@基金', 'grant_entry_selected'],
    ['review_map', '@综述', 'materials_refs_pending'],
    ['materials_refs', '@文件', 'materials_refs_pending'],
  ]);

  for (const state of [
    web.chatStateForResult(null),
    web.chatStateForResult(null, true),
    web.chatStateForResult({ ok: false, errorCode: 'RUNTIME_REQUIRED' }),
    web.chatStateForResult({ ok: false, errorCode: 'CHAT_QUOTA_EXCEEDED' }),
    web.chatStateForResult({ ok: false, errorCode: 'UPSTREAM_CHAT_FAILED' }),
    web.chatStateForResult({ ok: false, errorCode: 'AUTH_REQUIRED' }),
    web.chatStateForResult({ ok: false, errorCode: 'API_KEY_REQUIRED' }),
    web.chatStateForResult({ ok: false, errorCode: 'SERVICE_UNAVAILABLE' }),
    web.chatStateForResult({ ok: false, errorCode: 'NETWORK_UNREACHABLE' }),
    web.chatStateForPrompt('@科研 帮我拆解研究方向'),
    web.chatStateForPrompt('@论文 生成研究选题'),
    web.chatStateForPrompt('@基金 帮我拆解标书结构'),
    web.chatStateForPrompt('@文件 整理材料引用'),
  ]) {
    assert.equal(chatStates.includes(state), true, `chat state is outside contract: ${state}`);
  }
});

test('web data module builds sanitized reliability and account lifecycle status view models', () => {
  const reliability = web.reliabilityStatusForResult({
    ok: false,
    errorCode: 'UPSTREAM_CHAT_FAILED',
    message: 'chat upstream returned an error',
    upstreamDiagnostics: {
      upstreamHost: 'gflabtoken.cn',
      upstreamModel: 'gpt-5.5',
      upstreamKind: 'network',
      rawApiKey: 'sk-secret',
    },
  });
  assert.equal(reliability.state, 'upstream_failed');
  assert.equal(reliability.title, '上游暂时不可用');
  assert.equal(reliability.action, '稍后重试');
  assert.equal(reliability.retryable, true);
  assert.equal(reliability.details.includes('gflabtoken.cn'), true);
  assert.doesNotMatch(JSON.stringify(reliability), /sk-secret|rawApiKey|encryptedApiKey|password|postgres:\/\//i);

  const account = web.accountLifecycleSummary({ ok: true, accountType: 'personal', lifecycleState: 'active', tenantRole: 'owner', tenantId: 'tenant_123' }, { ok: true, quota: { limit: 100, used: 7, remaining: 93 }, audit: { eventCount: 12, latestEventKind: 'chat.completed' } });
  assert.equal(account.lifecycleLabel, 'Personal / active');
  assert.equal(account.tenantRoleLabel, 'tenant role: owner');
  assert.equal(account.quotaLabel, 'quota 7/100 used, 93 remaining');
  assert.equal(account.auditLabel, 'audit events: 12, latest chat.completed');
  assert.doesNotMatch(JSON.stringify(account), /tenant_123|workspace|runtimeRef|nodePool|storage|paymentToken|invoiceBody/i);
});

test('web data module converts network and malformed JSON failures into sanitized reliability errors', async () => {
  const leakyPayload = { ok: false, errorCode: 'UPSTREAM_CHAT_FAILED', message: 'api_key=sk-secret-value private_state_path=/home/dev/.opl/private/state.json', rawUpstreamBody: 'sk-secret-value', upstreamDiagnostics: { upstreamHost: 'gflabtoken.cn', upstreamModel: 'gpt-5.5', rawProviderError: 'Bearer sk-secret-value', rawApiKey: 'sk-secret-value', encryptedApiKey: 'ciphertext-secret', databaseUrl: 'postgres://user:secret@example/oplweb' } };
  const upstream = await web.sendChatMessage(async () => response(leakyPayload, 502), '@科研 分析方向');
  assert.deepEqual([upstream.errorCode, upstream.status, web.chatStateForResult(upstream), web.reliabilityStatusForResult(upstream).state], ['UPSTREAM_CHAT_FAILED', 502, 'upstream_failed', 'upstream_failed']);
  assert.match(upstream.diagnostics, /gflabtoken\.cn.*gpt-5\.5/);
  assert.doesNotMatch(JSON.stringify(upstream), /rawUpstreamBody|rawProviderError|rawApiKey|encryptedApiKey|sk-secret-value|ciphertext-secret|postgres:\/\/|\/home\/dev\/\.opl\/private/i);

  for (const [status, payload, expectedCode, expectedState, retryable] of [
    [401, { ok: false, errorCode: 'AUTH_REQUIRED', message: 'cookie expired with session_secret=secret' }, 'AUTH_REQUIRED', 'auth_required', false],
    [400, { ok: false, errorCode: 'API_KEY_REQUIRED', rawApiKey: 'sk-secret-value' }, 'API_KEY_REQUIRED', 'api_key_required', false],
    [429, { ok: false, errorCode: 'CHAT_QUOTA_EXCEEDED', rawUpstreamBody: 'quota body with sk-secret-value' }, 'CHAT_QUOTA_EXCEEDED', 'quota_exceeded', false],
    [503, { ok: false, errorCode: 'API_KEY_DECRYPT_FAILED', message: 'postgres://user:secret@example/oplweb unavailable' }, 'SERVICE_UNAVAILABLE', 'service_unavailable', true],
  ]) {
    const result = await web.sendChatMessage(async () => response(payload, status), '普通问题');
    assert.deepEqual([result.errorCode, web.chatStateForResult(result), web.reliabilityStatusForResult(result).state, web.reliabilityStatusForResult(result).retryable], [expectedCode, expectedState, expectedState, retryable]);
    assert.doesNotMatch(JSON.stringify(result), /sk-secret-value|postgres:\/\/|session_secret|rawUpstreamBody|rawApiKey/i);
  }

  const chatNetwork = await web.sendChatMessage(async () => {
    throw new Error('connect ECONNRESET postgres://user:secret@example/oplweb sk-secret');
  }, '普通问题');
  assert.equal(chatNetwork.ok, false);
  assert.equal(chatNetwork.errorCode, 'NETWORK_UNREACHABLE');
  assert.equal(web.chatStateForResult(chatNetwork), 'network_unreachable');
  assert.doesNotMatch(JSON.stringify(chatNetwork), /postgres:\/\//i);
  assert.doesNotMatch(JSON.stringify(chatNetwork), /sk-secret/i);

  const saveMalformed = await web.saveAPIKey(async () => ({
    ok: false,
    status: 502,
    async json() {
      throw new Error('html upstream error with password=secret');
    },
  }), 'sk-secret', { ok: true });
  assert.equal(saveMalformed.ok, false);
  assert.equal(saveMalformed.errorCode, 'SERVICE_UNAVAILABLE');
  assert.equal(web.chatStateForResult(saveMalformed), 'service_unavailable');
  assert.doesNotMatch(JSON.stringify(saveMalformed), /password=secret|sk-secret/i);
});

test('web data module builds structured research result and runtime task card view models', () => {
  const pageStates = readJson('contracts/web-page-state-matrix.json');
  assert.deepEqual(web.RESEARCH_RESULT_SECTIONS.map((section) => section.id), pageStates.structuredResultShape.sections);

  const researchResult = web.researchResultForChat({
    prompt: '@科研 帮我拆解研究方向、问题和下一步计划',
    assistantMessage: { content: 'mock upstream response for research chat' },
  });
  assert.equal(researchResult.kind, 'structured_research_result');
  assert.equal(researchResult.marker, '@科研');
  assert.deepEqual(researchResult.sections.map((section) => section.id), ['research_plan', 'evidence_refs', 'next_steps']);
  assert.match(researchResult.sections.find((section) => section.id === 'research_plan').body, /mock upstream response/);
  assert.doesNotMatch(JSON.stringify(researchResult), /artifact_body|private_state_path|mutation_result|workspace|nodePool|storage/i);

  const ordinaryResult = web.researchResultForChat({
    prompt: '普通问答',
    assistantMessage: { content: 'ok' },
  });
  assert.equal(ordinaryResult, null);

  const runtimeCard = web.runtimeTaskCardForPrompt('@论文 生成研究选题和证据计划');
  assert.equal(runtimeCard.kind, 'runtime_task_card');
  assert.equal(runtimeCard.marker, '@论文');
  assert.equal(runtimeCard.requiredCapability, 'paper_review_workflow');
  assert.equal(runtimeCard.deepLink, 'https://medopl.medopl.cn');
  assert.equal(runtimeCard.webuiRuntimeExecution, 'forbidden');
  assert.doesNotMatch(JSON.stringify(runtimeCard), /artifact_body|private_state_path|mutation_result|workspace|nodePool|storage/i);
});

test('anonymous users cannot save API keys from the web data module', async () => {
  const calls = [];
  const result = await web.saveAPIKey(async (url, options) => {
    calls.push({ url, options });
    return response({ ok: true });
  }, 'sk-test', { ok: false });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'AUTH_REQUIRED');
  assert.deepEqual(calls, []);
});

test('model provider save never sends base_url or raw key back in view model', async () => {
  const calls = [];
  await web.saveAPIKey(async (url, options) => {
    calls.push({ url, options });
    return response({ ok: true, apiKeyConfigured: true, maskedKey: 'sk-...1234', baseUrl: web.FIXED_BASE_URL });
  }, 'sk-secret-value', { ok: true });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/settings/model-provider');
  assert.equal(calls[0].options.method, 'PUT');
  assert.doesNotMatch(calls[0].options.body, /base_url|baseUrl|https:\/\/gflabtoken\.cn\/v1/);
  assert.doesNotMatch(JSON.stringify(web.createOnePersonLabViewModel({
    session: { ok: true, email: 'user@example.com' },
    provider: { ok: true, baseUrl: web.FIXED_BASE_URL, apiKeyConfigured: true, maskedKey: 'sk-...1234' },
    conversations: { conversations: [] },
    oplSnapshot: { ok: true },
  })), /sk-secret-value/);
});

test('web data module surfaces runtime gate with MedOPL deep link', async () => {
  const gated = await web.sendChatMessage(async () => response({
    ok: false,
    errorCode: 'RUNTIME_REQUIRED',
    message: '该能力需要 MedOPL Runtime / Storage / Node Pool',
    medoplDeepLink: 'https://medopl.medopl.cn/runtime/open',
  }, 409), '@基金 写申请书');

  assert.equal(gated.errorCode, 'RUNTIME_REQUIRED');
  assert.match(gated.medoplDeepLink, /^https:\/\/medopl\.medopl\.cn/);
});

test('runtime marker policy is explicit and does not gate uncontracted at-mentions', () => {
  const runtime = readJson('contracts/web-runtime-bridge.json');
  const domSource = readFileSync('apps/web/src/onePersonLabWebDom.mjs', 'utf8');

  assert.deepEqual(web.RUNTIME_REQUIRED_MARKERS, runtime.runtimeRequiredMarkers);
  assert.deepEqual(web.LIGHTWEIGHT_MARKERS, runtime.lightweightMarkers);
  assert.deepEqual(web.CAPABILITY_MARKER_SEMANTICS, runtime.markerSemantics);
  assert.equal(web.requiresRuntimeGate('@科研 帮我拆解研究方向'), false);
  for (const marker of runtime.runtimeRequiredMarkers) {
    assert.equal(web.requiresRuntimeGate(`${marker} 做一个任务`), true, `contract marker must gate: ${marker}`);
  }
  assert.equal(web.requiresRuntimeGate('@RCA 规划可视化交付方案'), false);
  assert.equal(web.requiresRuntimeGate('请 @同事 看一下这个普通问题'), false);
  assert.match(domSource, /requiresRuntimeGate/);
  assert.doesNotMatch(domSource, /\.includes\('@'\)/);
});

test('web data module loads sanitized MedOPL runtime status projection', async () => {
  const view = await web.loadOnePersonLabWebState(async (url) => {
    if (url === '/api/session/current') return response({ ok: true, email: 'runtime@example.com' });
    if (url === '/api/settings/model-provider') return response({ ok: true, baseUrl: web.FIXED_BASE_URL, apiKeyConfigured: true });
    if (url === '/api/chat/conversations') return response({ ok: true, conversations: [] });
    if (url === '/api/account/commercial-status') return response({
      ok: true,
      owner: 'OnePersonLabWeb',
      productId: 'one-person-lab-web',
      accountType: 'personal',
      lifecycleState: 'active',
      tenantId: 'tenant_runtime',
      tenantRole: 'owner',
      webuiTeamMutation: 'forbidden',
      webuiInviteMutation: 'forbidden',
      webuiPaymentMutation: 'forbidden',
      webuiBillingSourceOfTruth: 'forbidden',
    });
    if (url === '/api/medopl/runtime/status') return response({
      ok: true,
      owner: 'MedOPL',
      state: 'required',
      deepLink: 'https://medopl.medopl.cn/runtime',
      refs: { runtimeRef: 'runtime_public_ref_123' },
      counts: { activeRuns: 0 },
      webuiRuntimeExecution: 'forbidden',
    });
    if (url === '/api/opl/snapshot') return response({ ok: true, mode: 'readonly' });
    return response({ ok: false }, 404);
  });

  assert.equal(view.runtimeStatus.owner, 'MedOPL');
  assert.equal(view.runtimeStatus.state, 'required');
  assert.equal(view.runtimeStatus.deepLink, 'https://medopl.medopl.cn/runtime');
  assert.equal(view.runtimeStatus.webuiRuntimeExecution, 'forbidden');
  assert.equal(view.runtimeStatus.refs.runtimeRef, 'runtime_public_ref_123');
  assert.doesNotMatch(JSON.stringify(view.runtimeStatus), /secret|raw_provider_secret|artifact_body|private_state_path|mutation_result/i);
});

test('web data module loads sanitized materials and deliverables projection', async () => {
  const view = await web.loadOnePersonLabWebState(async (url) => {
    if (url === '/api/session/current') return response({ ok: true, email: 'materials@example.com' });
    if (url === '/api/settings/model-provider') return response({ ok: true, baseUrl: web.FIXED_BASE_URL, apiKeyConfigured: true });
    if (url === '/api/chat/conversations') return response({ ok: true, conversations: [] });
    if (url === '/api/account/commercial-status') return response({
      ok: true,
      owner: 'OnePersonLabWeb',
      productId: 'one-person-lab-web',
      accountType: 'personal',
      lifecycleState: 'active',
      tenantId: 'tenant_materials',
      tenantRole: 'owner',
      webuiTeamMutation: 'forbidden',
      webuiInviteMutation: 'forbidden',
      webuiPaymentMutation: 'forbidden',
      webuiBillingSourceOfTruth: 'forbidden',
    });
    if (url === '/api/medopl/runtime/status') return response({ ok: true, owner: 'MedOPL', state: 'ready', webuiRuntimeExecution: 'forbidden' });
    if (url === '/api/medopl/materials-deliverables/projection') return response({
      ok: true,
      owner: 'MedOPL',
      deepLink: 'https://medopl.medopl.cn/materials',
      materials: [{ materialId: 'material_public_ref_123', title: 'Linked material', kind: 'reference', status: 'ready' }],
      deliverables: [{ deliverableId: 'deliverable_public_ref_456', title: 'Linked deliverable', kind: 'artifact_ref', status: 'draft', ref: 'deliverable_public_ref_456' }],
      webuiStorageMutation: 'forbidden',
      webuiArtifactBody: 'forbidden',
    });
    if (url === '/api/opl/snapshot') return response({ ok: true, mode: 'readonly' });
    return response({ ok: false }, 404);
  });

  assert.equal(view.materialsDeliverables.owner, 'MedOPL');
  assert.equal(view.materialsDeliverables.deepLink, 'https://medopl.medopl.cn/materials');
  assert.equal(view.materialsDeliverables.materials[0].materialId, 'material_public_ref_123');
  assert.equal(view.materialsDeliverables.deliverables[0].deliverableId, 'deliverable_public_ref_456');
  assert.equal(view.materialsDeliverables.webuiStorageMutation, 'forbidden');
  assert.equal(view.materialsDeliverables.webuiArtifactBody, 'forbidden');
  assert.doesNotMatch(JSON.stringify(view.materialsDeliverables), /secret|raw_provider_secret|artifact_body|blob|private_state_path|mutation_result/i);
});

test('web data module loads sanitized billing summary projection', async () => {
  const view = await web.loadOnePersonLabWebState(async (url) => {
    if (url === '/api/session/current') return response({ ok: true, email: 'billing@example.com' });
    if (url === '/api/settings/model-provider') return response({ ok: true, baseUrl: web.FIXED_BASE_URL, apiKeyConfigured: true });
    if (url === '/api/chat/conversations') return response({ ok: true, conversations: [] });
    if (url === '/api/account/commercial-status') return response({
      ok: true,
      owner: 'OnePersonLabWeb',
      productId: 'one-person-lab-web',
      accountType: 'personal',
      lifecycleState: 'active',
      tenantId: 'tenant_billing',
      tenantRole: 'owner',
      webuiTeamMutation: 'forbidden',
      webuiInviteMutation: 'forbidden',
      webuiPaymentMutation: 'forbidden',
      webuiBillingSourceOfTruth: 'forbidden',
    });
    if (url === '/api/account/billing-summary') return response({
      ok: true,
      owner: 'MedOPL',
      deepLink: 'https://medopl.medopl.cn/billing',
      quota: { limit: 3, used: 1, remaining: 2 },
      audit: { eventCount: 4, latestEventKind: 'api_key.saved' },
      webuiBillingSourceOfTruth: 'forbidden',
      webuiPaymentMutation: 'forbidden',
    });
    if (url === '/api/medopl/runtime/status') return response({ ok: true, owner: 'MedOPL', state: 'ready', webuiRuntimeExecution: 'forbidden' });
    if (url === '/api/medopl/materials-deliverables/projection') return response({ ok: true, owner: 'MedOPL', materials: [], deliverables: [] });
    if (url === '/api/opl/snapshot') return response({ ok: true, mode: 'readonly' });
    return response({ ok: false }, 404);
  });

  assert.equal(view.billingSummary.owner, 'MedOPL');
  assert.equal(view.billingSummary.deepLink, 'https://medopl.medopl.cn/billing');
  assert.equal(view.billingSummary.quota.remaining, 2);
  assert.equal(view.billingSummary.audit.latestEventKind, 'api_key.saved');
  assert.equal(view.billingSummary.webuiBillingSourceOfTruth, 'forbidden');
  assert.equal(view.billingSummary.webuiPaymentMutation, 'forbidden');
  assert.doesNotMatch(JSON.stringify(view.billingSummary), /secret|raw_provider_secret|paymentToken|ledger|invoiceBody|rawMetadata|private_state_path/i);
});

test('web data module loads commercial account lifecycle without team or billing mutation', async () => {
  const view = await web.loadOnePersonLabWebState(async (url) => {
    if (url === '/api/session/current') return response({ ok: true, email: 'commercial@example.com' });
    if (url === '/api/settings/model-provider') return response({ ok: true, baseUrl: web.FIXED_BASE_URL, apiKeyConfigured: true });
    if (url === '/api/chat/conversations') return response({ ok: true, conversations: [] });
    if (url === '/api/account/commercial-status') return response({
      ok: true,
      owner: 'OnePersonLabWeb',
      productId: 'one-person-lab-web',
      accountType: 'personal',
      lifecycleState: 'active',
      tenantId: 'tenant_commercial',
      tenantRole: 'owner',
      teamReadiness: {
        state: 'single_user_owner',
        owner: 'OnePersonLabWeb',
        consumer: 'settings_lifecycle_summary',
        allowedNextActions: ['view_medopl_billing'],
      },
      webuiTeamMutation: 'forbidden',
      webuiInviteMutation: 'forbidden',
      webuiRBACMutation: 'forbidden',
      webuiPaymentMutation: 'forbidden',
      webuiBillingSourceOfTruth: 'forbidden',
    });
    if (url === '/api/account/billing-summary') return response({ ok: true, owner: 'MedOPL', quota: { limit: 3, used: 1, remaining: 2 } });
    if (url === '/api/medopl/runtime/status') return response({ ok: true, owner: 'MedOPL', state: 'ready', webuiRuntimeExecution: 'forbidden' });
    if (url === '/api/medopl/materials-deliverables/projection') return response({ ok: true, owner: 'MedOPL', materials: [], deliverables: [] });
    if (url === '/api/opl/snapshot') return response({ ok: true, mode: 'readonly' });
    return response({ ok: false }, 404);
  });

  assert.equal(view.commercialStatus.owner, 'OnePersonLabWeb');
  assert.equal(view.commercialStatus.accountType, 'personal');
  assert.equal(view.commercialStatus.lifecycleState, 'active');
  assert.equal(view.commercialStatus.tenantRole, 'owner');
  assert.equal(view.commercialStatus.teamReadiness.state, 'single_user_owner');
  assert.equal(view.commercialStatus.teamReadiness.consumer, 'settings_lifecycle_summary');
  assert.deepEqual(view.commercialStatus.teamReadiness.allowedNextActions, ['view_medopl_billing']);
  assert.equal(view.commercialStatus.webuiTeamMutation, 'forbidden');
  assert.equal(view.commercialStatus.webuiInviteMutation, 'forbidden');
  assert.equal(view.commercialStatus.webuiRBACMutation, 'forbidden');
  assert.equal(view.commercialStatus.webuiPaymentMutation, 'forbidden');
  assert.equal(view.commercialStatus.webuiBillingSourceOfTruth, 'forbidden');
  assert.equal(view.accountLifecycle.lifecycleLabel, 'Personal / active');
  assert.equal(view.accountLifecycle.tenantRoleLabel, 'tenant role: owner');
  assert.equal(view.accountLifecycle.teamReadinessLabel, 'team readiness: single_user_owner');
  assert.equal(view.accountLifecycle.quotaLabel, 'quota 1/3 used, 2 remaining');
  assert.doesNotMatch(JSON.stringify(view.commercialStatus), /workspace|teamInvite|paymentToken|invoiceBody|storage|nodePool|runtimeRef|rawApiKey|encryptedApiKey|subscription|price/i);
});

test('web view model keeps workspace hidden and exposes fixed provider surface', () => {
  const view = web.createOnePersonLabViewModel({
    session: { ok: true, email: 'user@example.com' },
    provider: {
      ok: true,
      baseUrl: 'https://gflabtoken.cn/v1',
      apiKeyConfigured: false,
      maskedKey: '',
    },
    conversations: { conversations: [] },
    oplSnapshot: { ok: true, mode: 'readonly' },
  });

  assert.equal(view.title, '科研人员的 One Person Lab Web');
  assert.match(view.subtitle, /@科研、@论文、@基金/);
  assert.equal(view.figmaMakeSource, 'E8nYfNFc2D9P01FYZ8UwBW');
  assert.equal(view.shell.leftSidebar, true);
  assert.equal(view.shell.accountDock, true);
  assert.equal(view.shell.promptCommandCenter, true);
  assert.deepEqual(view.navItems.map((item) => item.label), ['首页', '科研能力', '论文', '基金', '账号']);
  assert.equal(view.provider.baseUrl, 'https://gflabtoken.cn/v1');
  assert.equal(view.provider.baseUrlEditable, false);
  assert.equal(view.accountState, 'authenticated_unbound');
  assert.equal(view.capabilitySource.syncMode, 'source_path_pinned_manifest');
  assert.equal(view.capabilitySource.dynamicSync, false);
  assert.match(view.capabilitySource.appContract, /one-person-lab-app\/contracts\/app-product-profile\.json/);
  assert.match(view.capabilitySource.frameworkContract, /one-person-lab\/contracts\/opl-framework\/domains\.json/);
  assert.deepEqual(view.capabilities.map((item) => item.label), ['科研规划', '论文/综述', '基金', '材料/文件', '普通问答']);
  assert.deepEqual(view.researchTaskIntents.map((intent) => intent.id), [
    'research_direction',
    'paper_question',
    'grant_plan',
    'review_map',
    'materials_refs',
  ]);
  assert.deepEqual(view.researchTaskIntents.map((intent) => intent.consumer), [
    'research_user_prompt',
    'research_user_prompt',
    'research_user_prompt',
    'research_user_prompt',
    'research_user_prompt',
  ]);
  assert.equal(view.skillGroups, undefined);
  assert.deepEqual(view.capabilities.filter((item) => item.runtimeRequired).map((item) => item.sourceAssistant), ['mas', 'mag', 'medopl']);
  assert.equal(view.runtimeGate.deepLink, 'https://medopl.medopl.cn');
  assert.equal(view.runtimeGate.title, '需要 MedOPL 授权');
  assert.equal(view.runtimeGate.message, '该能力需要在 MedOPL 开通后继续');
  assert.doesNotMatch(JSON.stringify(view.runtimeGate), /MedOPL Runtime|node pool|托管运行环境|存储|无限计算资源|创始人计划|WebUI owns/i);
  assert.deepEqual(view.researchResultSections.map((section) => section.id), ['research_plan', 'evidence_refs', 'next_steps']);
  assert.deepEqual(view.workbenchSteps.map((item) => item.title), [
    '选择专业工作',
    '绑定真实材料',
    '进入科研工作流',
    '沉淀交付物',
    '保留普通聊天',
  ]);
  assert.doesNotMatch(JSON.stringify(view), /workspace|demoData|demo:\/\/|轻量项目工作区|真实执行|已完成执行|fake storage|fake billing|fake runtime execution/i);
});

test('web product entry delegates state and DOM ownership to focused modules', () => {
  const entryPath = 'apps/web/src/onePersonLabWeb.mjs';
  const statePath = 'apps/web/src/onePersonLabWebState.mjs';
  const domPath = 'apps/web/src/onePersonLabWebDom.mjs';
  const entry = readFileSync(entryPath, 'utf8');

  assert.equal(existsSync(statePath), true, `missing state owner module: ${statePath}`);
  assert.equal(existsSync(domPath), true, `missing DOM owner module: ${domPath}`);
  assert.match(entry, /onePersonLabWebState\.mjs/);
  assert.match(entry, /onePersonLabWebDom\.mjs/);
  assert.doesNotMatch(entry, /querySelector|addEventListener|appendMessage|writeJSON|readJSON|providerFallback/);
  assert.ok(entry.split('\n').length <= 80, 'product entry should stay thin');
});

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}
