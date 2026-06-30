import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function assertIncludesAll(actual, expected, label) { for (const item of expected) assert.equal(actual.includes(item), true, `missing ${label}: ${item}`); }
function latestEvidence(release) {
  const latest = release.latestMainEvidence;
  return { latest, dogfoodState: `executed_success_run_${latest.runId}_real_chat_${release.productionDogfoodReadiness.latestSuccessfulRun.medoplReadonly === true ? 'readonly_confirmed' : 'readonly_unconfirmed'}`, availabilityState: `executed_success_run_${latest.runId}_after_apply`, observabilityState: `release_probe_executed_run_${latest.runId}_scheduled_canary_success_pending_long_term_ops`, browserState: `executed_success_run_${latest.runId}` };
}
function assertLatestRun(run, latest) {
  for (const key of ['runId', 'commit', 'image']) assert.equal(run[key], latest[key]);
  if (run.runUrl) assert.equal(run.runUrl, latest.runUrl);
}

test('one-person-lab-web contracts define product truth instead of prose specs', () => {
  const product = readJson('contracts/web-product-profile.json');
  const pageStates = readJson('contracts/web-page-state-matrix.json');
  const api = readJson('contracts/web-api.openapi.json');
  const runtime = readJson('contracts/web-runtime-bridge.json');
  const release = readJson('contracts/web-release-profile.json');
  const gui = readJson('contracts/web-gui-product-contract.json');
  const shell = readJson('contracts/web-shell-adapter.json');
  const { latest, dogfoodState, availabilityState, observabilityState, browserState } = latestEvidence(release);

  assert.equal(product.productId, 'one-person-lab-web');
  assert.equal(product.canonicalProductName, 'One Person Lab Web');
  assert.equal(product.positioning, 'One Person Lab Web interaction platform / browser entry for knowledge delivery');
  assert.deepEqual([product.topLevelProductCategory, product.productIdentity.category, product.productIdentity.primaryRole], ['web_interaction_platform', 'web_interaction_platform', 'browser_entry']);
  assert.deepEqual([product.productIdentity.ordinaryUserDefaultRequires, product.productIdentity.authoritySplit], [[], { onePersonLab: 'framework_execution_semantics', MedOPL: 'runtime_resource_billing_storage', FoundryAgents: 'domain_truth_quality_artifact_authority' }]);
  assert.deepEqual(product.productIdentity.specialistExecutionPath.requiredForMarkers, product.primaryEntryMarkers.filter((marker) => marker !== '@科研'));
  assert.equal(product.productIdentity.releaseEvidenceBoundary.includes('cannot define, change, or rewrite OPL-Webui product identity'), true);
  assert.equal(product.primaryUserPath, 'account_based_web_app_main_path');
  assert.equal(product.primaryEntryModel, 'login_bind_key_then_task_entry');
  assert.deepEqual(product.accountBasedWebAppMainPath.orderedSteps.map((step) => step.id), ['open_web', 'login_account', 'bind_api_key_or_use_account_capability', 'choose_research_task', 'view_result_or_medopl_gate', 'view_progress_refs', 'view_deliverable_refs', 'view_blocker_next_step', 'continue_via_medopl_deeplink']);
  assert.equal(product.webBusinessCapabilityV1.claim, 'account_based_one_person_lab_web_app_business_capability_v1');
  assert.equal(product.webBusinessCapabilityV1.webSideRuntimeExecution, false);
  assert.deepEqual(product.targetUsers, ['research_staff', 'masters_students', 'phd_students', 'principal_investigators', 'research_teams']);
  assert.deepEqual(product.primaryEntryMarkers, ['@科研', '@论文', '@基金', '@综述', '@文件', '@PPT', '@书']);
  assertIncludesAll(product.ownedSurfaces, ['account_based_web_app_entry', 'tenant_isolation', 'research_capability_entry', 'ordinary_chat_fallback', 'web_control_plane_api'], 'owned surface');
  assert.equal(product.ownedSurfaces.includes('multi_tenant_saas_product'), false);
  assert.equal(product.ownedSurfaces.includes('commercial_account_lifecycle_projection'), true);
  assert.equal(product.ownedSurfaces.includes('ordinary_chat_entry'), false);
  assert.deepEqual([product.publicUi.primarySurface, product.publicUi.visibleRoutes], ['ai_native_research_homepage', ['home', 'skills', 'workflows', 'projects', 'more']]);
  assert.equal(product.visionGaps.state, 'active_gap_acceptance');
  assert.deepEqual(product.visionGaps.haPolicy, { state: 'paused', reason: 'single-node launch safety' });
  assert.deepEqual(product.visionGaps.items.map((gap) => gap.id), ['ui_ux_product_depth', 'commercial_launch_ui_implementation', 'commercial_launch_readiness_closeout', 'commercial_runtime_admission_alignment_v1', 'commercial_product_user_journey_depth_v1', 'medopl_readonly_evidence', 'runtime_execution_boundary', 'commercial_saas_depth', 'operations_maturity', 'ha_and_resilience', 'concurrency_and_load', 'opl_auto_update_from_github']);
  const visionGap = (id) => product.visionGaps.items.find((gap) => gap.id === id);
  assert.deepEqual(visionGap('ui_ux_product_depth').evidenceRequired, ['figma_mcp_source_context', 'component_state_contract', 'responsive_shell_smoke', 'browser_interaction_e2e', 'desktop_tablet_mobile_compact_visual_qa_browser_evidence', 'human_owner_receipt_before_production_ui_claim', 'production_browser_e2e_or_screenshot_evidence', 'accessibility_closeout_boundary', 'sanitized_foldback']);
  assert.deepEqual([visionGap('commercial_launch_readiness_closeout').disposition, product.commercialLaunchReadiness.remoteSync.policy.pushRequiresOwnerAuthorization], ['local_acceptance_and_remote_sync_prep_done_blocked_on_owner_authorized_push_ci_rollout_foldback', true]);
  assert.deepEqual([visionGap('commercial_runtime_admission_alignment_v1').disposition, visionGap('commercial_runtime_admission_alignment_v1').launchBlocking, visionGap('commercial_product_user_journey_depth_v1').disposition, product.commercialProductUserJourneyDepth.currentProductValueStatus], ['ordinary_blocked_ready_onboarding_paths_aligned_before_production_e2e_rerun', true, 'repo_browser_product_acceptance_done_owner_visual_copy_pending', 'repo_browser_product_acceptance_done_owner_pending_v1']);
  assert.equal(visionGap('medopl_readonly_evidence').disposition, 'production_readonly_projection_dogfood_confirmed_run_28142197152');
  assert.equal(visionGap('runtime_execution_boundary').disposition, 'medopl_account_resource_state_driven_local_gate_run_bridge_refs_only_production_execution_unclaimed');
  assert.deepEqual([visionGap('ha_and_resilience').acceptanceContract, visionGap('concurrency_and_load').acceptanceContract, visionGap('opl_auto_update_from_github').acceptanceContract], ['contracts/web-release-profile.json#/productionHAReadiness', 'contracts/web-product-profile.json#/concurrencyAndLoad', 'contracts/web-release-profile.json#/oplAutoUpdateReadiness']);
  assert.equal(visionGap('runtime_execution_boundary').launchBlocking, true);
  assert.equal(visionGap('commercial_saas_depth').launchBlocking, false);
  assert.deepEqual([product.provider.fixedBaseUrl, product.provider.wireApi, product.provider.defaultModel, product.provider.serviceTier, product.provider.reasoningEffort, product.provider.upstreamTimeoutSeconds, product.provider.upstreamTimeoutEnv, product.provider.userEditableBaseUrl], ['https://gflabtoken.cn/v1', 'responses', 'gpt-5.5', 'fast', 'xhigh', 60, 'OPL_CHAT_UPSTREAM_TIMEOUT_SECONDS', false]);
  assert.equal(product.credential.rawKeyReturnedToBrowser, false);
  assert.deepEqual([product.commercialLifecycle.mode, product.commercialLifecycle.currentPhase, product.commercialLifecycle.nextPhase, product.commercialLifecycle.blockedBy], ['authenticated_readonly_personal_status_projection', 'commercial_contract', 'commercial_consumer_contract', 'missing_real_buyer_or_operator_workflow']);
  assert.equal(product.commercialLifecycle.ownerReceipt.acceptedClaim, 'commercial_readonly_personal_projection_boundary_accepted');
  assert.equal(product.commercialLifecycle.billingPaymentSourceOfTruth, 'MedOPL');
  assert.deepEqual(product.commercialLifecycle.nextStepOpeners, ['real buyer or operator workflow is named', 'contract exists for invite, RBAC, pricing, subscription, or payment surface', 'registered tests preserve MedOPL billing authority']);
  assertIncludesAll(product.publicUi.hiddenConcepts, ['workspace', 'runtime', 'nodePool', 'storage', 'billing'], 'hidden concept');
  assertIncludesAll(product.nonOwnedTruth, ['runtime_truth', 'node_pool_lifecycle', 'storage_truth', 'billing_source_of_truth', 'api_gateway_truth', 'opl_execution_truth'], 'non-owned truth');
  assert.deepEqual(product.concurrencyAndLoad.mode, 'staging_safe_10_user_baseline_no_production_load_claim');
  assertIncludesAll(product.concurrencyAndLoad.localEvidence.proves, ['tenant scoped account/session/API key/chat isolation contracts', 'Postgres-backed store path exists when OPL_DATABASE_URL is set', 'staging-safe 10-user concurrent account/API key/chat/quota baseline', 'bounded Postgres pool sizing defaults and environment overrides', 'slow upstream timeout fails closed with sanitized diagnostics'], 'concurrency proof');
  assertIncludesAll(product.concurrencyAndLoad.requiredBeforeProductionClaim, ['production_or_staging_concurrent_register_login_chat_api_key_quota_test', 'database_pool_sizing_evidence', 'slow_upstream_backpressure_or_rate_limit_evidence'], 'concurrency required evidence');
  assert.equal(product.concurrencyAndLoad.productionEvidence.status, 'not_claimed');
  assert.deepEqual([product.concurrencyAndLoad.stagingBaseline.users, product.concurrencyAndLoad.databasePoolSizing.defaults.maxOpenConns, product.concurrencyAndLoad.slowUpstreamBackpressure.state], [10, 10, 'repo_local_timeout_fail_closed']);
  assert.deepEqual(pageStates.routes.map((route) => route.id), ['home', 'skills', 'workflows', 'projects', 'more']);
  assert.equal(pageStates.routes.find((route) => route.id === 'home').surface, 'ai_native_research_homepage');
  assert.deepEqual(pageStates.accountStates, ['anonymous', 'authenticated_unbound', 'authenticated_bound']);
  for (const state of ['research_entry_selected', 'paper_entry_selected', 'grant_entry_selected', 'materials_refs_pending', 'presentation_entry_selected', 'book_entry_selected']) {
    assert.equal(pageStates.chatStates.includes(state), true, `missing research chat state: ${state}`);
  }
  assert.equal(pageStates.chatStates.includes('runtime_required'), true);
  const reliability = pageStates.reliabilityModel;
  assert.deepEqual([reliability.owner, reliability.consumer, reliability.mode], ['one-person-lab-web', 'browser_reliability_status_surface', 'sanitized_view_model_only']);
  const reliabilityStates = ['auth_required', 'api_key_required', 'quota_exceeded', 'runtime_required', 'upstream_failed', 'service_unavailable', 'network_unreachable'];
  assert.deepEqual(reliability.statuses.map(({ state, resultErrorCode }) => [state, resultErrorCode]), [['auth_required', 'AUTH_REQUIRED'], ['api_key_required', 'API_KEY_REQUIRED'], ['quota_exceeded', 'CHAT_QUOTA_EXCEEDED'], ['runtime_required', 'RUNTIME_REQUIRED'], ['runtime_required', 'RUNTIME_GATE_BLOCKED'], ['runtime_required', 'MEDOPL_ENDPOINT_REQUIRED'], ['upstream_failed', 'UPSTREAM_CHAT_FAILED'], ['service_unavailable', 'SERVICE_UNAVAILABLE'], ['network_unreachable', 'NETWORK_UNREACHABLE']]);
  assert.deepEqual(reliabilityStates.every((state) => pageStates.routes.find((route) => route.id === 'home').states.includes(state)), true);
  assert.deepEqual(reliability.allowedFields, ['state', 'title', 'action', 'retryable', 'details']);
  assert.deepEqual(['raw_upstream_body', 'raw_provider_error', 'api_key', 'rawApiKey', 'encryptedApiKey', 'private_state', 'private_state_path', 'database_url', 'artifact_body'].every((field) => reliability.forbiddenPayload.includes(field)), true);
  const expectedRouteScope = { home: ['side_navigation', 'first_view', 'turn_state', 'chat_canvas', 'runtime_gate'], skills: ['skill_library'], workflows: ['workflow_library'], projects: ['project_window_continuation_center'], more: ['empty_overflow_menu'] };
  assert.deepEqual(pageStates.shellStates.routeScopedSurfaces, expectedRouteScope);
  assert.deepEqual(Object.values(pageStates.shellStates.layeredGovernance), ['ai_native_research_composer_with_project_session_result_workflow', ['product_subject', 'information_architecture', 'first_view_contract', 'surface_budget', 'interaction_contract', 'component_behavior_law', 'semantic_tokens'], 'components_follow_surface_ownership_not_visual_similarity', true]);
  assert.deepEqual(pageStates.shellStates.surfaceOwnershipForbidden, { search: ['skill_search', 'workflow_search', 'prompt_directory', 'backend_search_api'], more: ['settings_status_dump', 'account_lifecycle', 'quota_audit', 'provider_base_url', 'api_key_form'], account: ['primary_navigation_item', 'more_route_panel'], model_selector: ['visible_gateway_url', 'base_url_editor'] });
  const surfaceAcceptance = pageStates.shellStates.surfaceInteractionAcceptance;
  assert.deepEqual(Object.keys(surfaceAcceptance), ['search', 'more', 'account', 'model_selector', 'inspector']);
  assert.deepEqual([surfaceAcceptance.search.openTrigger, surfaceAcceptance.search.closeTrigger, surfaceAcceptance.search.focusReturn, surfaceAcceptance.search.emptyState, surfaceAcceptance.search.forbiddenContent], ['side_nav_search', ['explicit_close', 'escape', 'outside_click', 'route_change'], 'side_nav_search', 'project_conversation_file_search_empty', ['skills', 'workflows', 'prompts', 'provider_settings']]);
  assert.deepEqual([surfaceAcceptance.more.openTrigger, surfaceAcceptance.more.closeTrigger, surfaceAcceptance.more.emptyState, surfaceAcceptance.more.forbiddenContent], ['side_nav_more', ['route_change'], 'empty_overflow', ['settings', 'account_lifecycle', 'quota', 'provider_base_url', 'api_key_form']]);
  assert.deepEqual([surfaceAcceptance.account.openTrigger, surfaceAcceptance.account.closeTrigger, surfaceAcceptance.account.focusReturn, surfaceAcceptance.account.placement], ['bottom_avatar', ['explicit_close', 'escape', 'outside_click', 'route_change'], 'bottom_avatar', 'bottom_avatar_popover']);
  assert.deepEqual([surfaceAcceptance.model_selector.openTrigger, surfaceAcceptance.model_selector.closeTrigger, surfaceAcceptance.model_selector.forbiddenContent], ['composer_model_choice', ['selection', 'escape', 'outside_click'], ['gateway_url', 'base_url_editor']]);
  assert.deepEqual(surfaceAcceptance.inspector, { desktop: 'stable_right_work_panel', mobile: 'light_bottom_sheet', focusReturn: 'right_utility_rail' });
  assert.deepEqual(pageStates.shellStates.sideNavigation.actions.map(({ id, label, kind, targetView, localOnly, consumer, forbiddenApis }) => [id, label, kind, targetView, localOnly, consumer, forbiddenApis.join('|')]), [['home', '新聊天', 'route', 'home', true, 'composer_focus', ''], ['search', '搜索聊天', 'sheet', 'home', true, 'project_conversation_file_search', '/api/search'], ['files', '文件库', 'local_handoff', 'home', true, 'file_material_handoff_to_medopl', ''], ['workflows', '已安排/任务', 'route', 'workflows', true, 'scheduled_tasks_and_workflow_library', ''], ['skills', '应用 / Skills', 'route', 'skills', true, 'skill_library', ''], ['more', '更多', 'route', 'more', true, 'empty_overflow_menu', '']]);
  assert.deepEqual(pageStates.shellStates.librarySurfaces, { skills: { scopes: ['my_skills', 'opl_skills'], actions: ['import_skill'] }, workflows: { scopes: ['my_workflows', 'opl_workflows'], actions: ['create_workflow', 'import_workflow'] }, projects: { scopes: ['my_projects', 'my_conversations', 'task_projection'], actions: ['new_project', 'continue_conversation'], requiredApis: ['/api/chat/conversations', '/api/tasks', '/api/tasks/{taskId}'], projection: 'conversation_draft_list_plus_project_window_refs_status_metadata_only', doesNotProve: ['dedicated project persistence API'] } });
  assertIncludesAll(pageStates.localReadinessScenario.steps.map((step) => step.id), ['anonymous_shell', 'register', 'login', 'api_key_binding', 'research_task_template_selected', 'choose_task', 'view_result_or_gate', 'view_progress_refs', 'view_deliverable_refs', 'view_blocker_next_step', 'continue_via_deeplink', 'paper_runtime_gate', 'grant_runtime_gate', 'sanitized_audit'], 'local readiness step');
  assert.equal(pageStates.localReadinessScenario.requiresProductionSecrets, false);
  assertIncludesAll(pageStates.localReadinessScenario.observableSelectors, ['[data-side-navigation]', '[data-first-view]', '[data-starter-chips]', '[data-chat-log]', '[data-runtime-gate]', '[data-more-overflow]', '[data-project-window-center]', '[data-project-window-list]', '[data-project-window-empty]', '[data-search-sheet]', '[data-window-search]', '[data-project-window-search-results]', '[data-project-window-search-empty]', '[data-model-selector]', '[data-overlay-close]', '[data-research-launcher]', '[data-capability-marker]', '[data-capability-mode]', '[data-research-task]', '[data-research-result]', '[data-research-result-section]', '[data-runtime-task-card]', '[data-reliability-status]'], 'observable selector');
  assert.deepEqual(pageStates.researchTaskIntents.map((intent) => [intent.id, intent.marker, intent.runtimePolicy]), [['research_direction', '@科研', 'ordinary_chat_fallback'], ['paper_question', '@论文', 'runtime_gate'], ['grant_plan', '@基金', 'runtime_gate'], ['review_map', '@综述', 'runtime_gate'], ['materials_refs', '@文件', 'runtime_gate'], ['presentation_foundry', '@PPT', 'runtime_gate'], ['book_foundry', '@书', 'runtime_gate']]);
  assert.deepEqual(pageStates.structuredResultShape.sections, ['research_plan', 'evidence_refs', 'next_steps']);
  assert.deepEqual([pageStates.structuredResultShape.primarySurface, pageStates.structuredResultShape.rawAssistantTranscriptForStructuredResult, pageStates.structuredResultShape.maxRawAssistantMessagesPerStructuredResult], ['structured_research_artifact_card', 'forbidden', 0]);
  assert.equal(pageStates.structuredResultShape.owner, 'one-person-lab-web');
  assert.equal(pageStates.structuredResultShape.consumer, 'research_user_chat_result');
  assert.equal(pageStates.structuredResultShape.forbiddenPayload.includes('artifact_body'), true);
  assert.equal(pageStates.structuredResultShape.forbiddenPayload.includes('private_state_path'), true);
  assert.deepEqual(pageStates.shellStates.requiredStates, ['public_landing', 'auth_login_register', 'home_default', 'project_window_continuation_center', 'search_sheet_open', 'inspector_autonomy', 'inspector_inputs', 'inspector_outputs', 'inspector_why_next', 'api_key_required_modal', 'skill_plaza', 'workflow_plaza', 'running_turn', 'blocked_turn']);
  assert.equal(pageStates.shellStates.defaultAppState, 'home_default');
  assert.equal(pageStates.shellStates.sideNavigation.defaultState, 'visible');
  assert.deepEqual(pageStates.shellStates.inspector, { defaultState: 'hidden', tabs: ['autonomy', 'inputs', 'outputs', 'why_next'], resize: { enabled: true, minWidth: 320, maxWidth: 520 }, placement: 'right_resizable_panel', desktopBehavior: 'stable_right_work_panel_without_main_overlap', mobileBehavior: 'light_bottom_sheet_with_rail_yield', mobileMaxHeightVh: 64, responsivePlacement: { desktop: 'right_resizable_panel', tablet: 'right_sheet', mobile: 'bottom_sheet' }, mustNotBePrimaryNavigation: true });
  assert.equal(pageStates.shellStates.modals.apiKeyRequired.primaryAction, 'save');
  assert.equal(pageStates.shellStates.modals.apiKeyRequired.primaryActionLabel, '保存');
  assert.deepEqual(pageStates.shellStates.modals.apiKeyRequired.closeTrigger, ['explicit_close', 'escape']);
  assert.deepEqual(Object.values(gui.layeredGovernance.subjectBeforePattern), ['ai_native_research_composer_with_project_session_result_workflow', 'research_turn', 'compose_research_question_or_continue_session', ['dashboard_template', 'crm_template', 'settings_center', 'runtime_console', 'card_grid_first', 'component_inventory']]);
  assert.deepEqual([gui.layeredGovernance.layerOrder, gui.layeredGovernance.noNewTruthFile], [['product_subject', 'information_architecture', 'first_view_contract', 'surface_budget', 'interaction_contract', 'component_behavior_law', 'semantic_tokens'], true]);
  assert.deepEqual(gui.visualGrammar.surfaceBudget.routeBudgets.home, { maxSections: 1, maxCards: 0, maxBodyParagraphs: 1, maxCta: 1 });
  assert.deepEqual(gui.visualGrammar.surfaceBudget.routeBudgets.more, { maxSections: 1, maxCards: 0, maxBodyParagraphs: 1, maxCta: 0 });
  assert.deepEqual([gui.componentBehaviorLaw.Popover.allowedFor, gui.componentBehaviorLaw.Dialog.allowedFor, gui.componentBehaviorLaw.Sheet.allowedFor], [['account_status', 'compact_model_metadata'], ['api_key_required_blocking_task'], ['mobile_inspector', 'project_window_search']]);
  assert.equal(gui.componentBehaviorLaw.Card.forbiddenFor.includes('routine_page_section_wrapper'), true);

  assertIncludesAll(Object.keys(api.paths), [
    '/api/session/current',
    '/api/settings/model-provider',
    '/api/chat',
    '/api/chat/conversations',
    '/api/account/audit-events',
    '/api/account/commercial-status',
  ], 'API path');
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
  assert.deepEqual(runtime.runtimeRequiredMarkers, ['@论文', '@基金', '@综述', '@文件', '@PPT', '@书']);
  assert.deepEqual(runtime.markerSemantics.map((item) => [item.marker, item.workflow, item.runtimePolicy]), [
    ['@科研', 'research_planning', 'ordinary_chat_fallback'],
    ['@论文', 'paper_review_workflow', 'runtime_gate'],
    ['@基金', 'grant_workflow', 'runtime_gate'],
    ['@综述', 'review_workflow', 'runtime_gate'],
    ['@文件', 'materials_refs_workflow', 'runtime_gate'],
    ['@PPT', 'presentation_foundry_workflow', 'runtime_gate'],
    ['@书', 'book_foundry_workflow', 'runtime_gate'],
  ]);
  assert.equal(runtime.medoplDeepLink, 'https://medopl.medopl.cn');
  assert.equal(runtime.runtimeAdmission.mode, 'medopl_account_resource_state_driven');
  assert.deepEqual(runtime.runtimeAdmission.readyWhen, ['package_or_plan_active', 'credit_or_billing_ok', 'compute_resource_open', 'storage_space_open', 'workspace_runtime_storage_binding_bound']);
  assert.deepEqual(runtime.runtimeAdmission.operatorDeploymentConfig, ['MEDOPL_API_BASE_URL']);
  assertIncludesAll(runtime.runtimeAdmission.notProductPolicy, ['selected_user', 'test_account', 'canary_account', 'hardcoded_account_allowlist', 'MEDOPL_API_BASE_URL'], 'not product runtime admission policy');
  assertIncludesAll(runtime.runtimeAdmission.webConsumes, ['runtime_gate', 'action_contract', 'workspace_runtime_storage_binding_refs', 'progress_refs', 'deliverable_refs', 'billing_ledger_release_readonly_projection', 'deeplink_next_action'], 'runtime admission consumed projection');
  assert.equal(runtime.runtimeAdmission.localRealMedOPLProofRole, 'evidence_lane_not_product_truth');
  assert.equal(runtime.medoplApiBridge.endpointConfigScope, 'operator_deployment_config');
  assert.equal(runtime.medoplApiBridge.endpointNotConfiguredPolicy, 'operator_deployment_blocker_fail_closed');
  assert.deepEqual(runtime.medoplApiBridge.operatorDeploymentBlockers, ['medopl_endpoint_required']);
  assert.equal(pageStates.medoplCapabilityStates.runtimeRequiredFlow.readyPolicy, 'medopl_account_resource_state_ready_required_before_run');
  assert.equal(pageStates.medoplCapabilityStates.runtimeRequiredFlow.runtimeAdmission.mode, 'medopl_account_resource_state_driven');
  assert.deepEqual(pageStates.medoplCapabilityStates.runtimeRequiredFlow.operatorDeploymentBlockerStates, ['medopl_endpoint_required']);
  assert.match(api.paths['/api/opl/runtime-gate'].post.responses['424'].description, /account\/resource runtime gate|operator MedOPL endpoint config/);
  assert.equal(runtime.projectionPolicy.allowedPayload.includes('refs'), true);
  assert.equal(runtime.projectionPolicy.forbiddenPayload.includes('artifact_body'), true);
  for (const field of ['requiresGoSideContract', 'requiresEval', 'requiresOperatorSafetyPolicy', 'requiresHumanAuthorization']) assert.equal(runtime.authorizationBoundary[field], true);
  assert.equal(runtime.executionAdmission.currentStatus, 'not_admitted');
  assert.equal(runtime.executionAdmission.currentPhase, 'execution_admission');
  assert.equal(runtime.executionAdmission.nextPhase, 'production_medopl_runtime_evidence_closeout');
  assert.equal(runtime.executionAdmission.blockedBy, null);
  assert.deepEqual(runtime.executionAdmission.ownerReceipt, { required: true, source: 'human_owner_receipt', status: 'accepted', acceptedAt: '2026-06-26', acceptedClaim: 'medopl_runtime_gate_run_bridge_local_refs_only_accepted', acceptedScope: 'Web may bridge MedOPL runtime gate and run refs/progress/deliverables locally; MedOPL and OPL Framework remain execution and artifact authority.' });
  assert.deepEqual(runtime.executionAdmission.webRuntimeCommandPolicy.allowedCommands, []);
  assert.equal(runtime.executionAdmission.webRuntimeCommandPolicy.productAccessPolicy, false);
  assert.deepEqual(runtime.executionAdmission.forbiddenCommands, ['install', 'repair', 'module_exec', 'artifact_body', 'runtime_mutation']);
  assert.deepEqual(runtime.executionAdmission.nextStepOpeners, ['operator MEDOPL_API_BASE_URL is configured for production evidence collection', 'production runtime gate/run evidence is folded back', 'artifact/body authority contract stays external']);
  assert.deepEqual(runtime.executionAdmission.requiredBeforeAnyExecution, ['production MedOPL runtime execution evidence', 'registered bridge eval', 'human authorization boundary', 'tenant-scoped audit events', 'artifact/body authority contract']);
  assert.deepEqual(runtime.executionAdmission.failClosedUntil, ['operator_medopl_endpoint_configured', 'medopl_account_resource_gate_ready', 'bridge_eval_passes', 'authorization_boundary_exists']);
  const productRuntimeTruth = JSON.stringify({ product, runtime, pageStates });
  assert.doesNotMatch(productRuntimeTruth, /selected real user|selected user|test account|canary account|canaryAdmission|hardcoded account allowlist/i);

  assert.equal(release.productionHost, 'opl.medopl.cn');
  assert.deepEqual(release.requiredGates, ['npm run verify', 'npm run gate:ai', 'npm run gate:review', 'npm run repo:bloat', 'sentrux check .']);
  assert.equal(release.localNoSecretReadiness.requiresProductionSecrets, false);
  assert.equal(release.localNoSecretReadiness.browserAutomation, false);
  assert.equal(release.localNoSecretReadiness.automationLevel, 'http_contract_and_static_shell');
  assertIncludesAll(release.localNoSecretReadiness.coverage, ['open_web', 'login', 'api_key_binding', 'choose_task', 'view_result_or_gate', 'view_progress_refs', 'view_deliverable_refs', 'view_blocker_next_step', 'continue_via_deeplink'], 'local readiness business path coverage');
  assert.equal(release.localNoSecretReadiness.evidenceCommands.includes('node --test tests/contract/one-person-lab-chat-upstream.test.mjs'), true);
  assert.equal(release.localNoSecretReadiness.evidenceCommands.includes('node --test tests/smoke/web-shell.test.mjs'), true);
  assert.equal(latest.state, `folded_success_run_${latest.runId}`);
  assert.equal(latest.image.endsWith(`:${latest.commit.slice(0, 7)}`), true);
  assert.equal(release.latestMainEvidence.canClaim.includes('OPL-Webui controlled launch ready'), true);
  assert.equal(release.latestMainEvidence.cannotClaim.includes('production-ready SaaS'), true);
  assert.equal(release.productionDogfoodReadiness.state, dogfoodState);
  assert.equal(release.productionDogfoodReadiness.evidenceScope, 'historical');
  assertLatestRun(release.productionDogfoodReadiness.latestSuccessfulRun, latest);
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.realChat, true);
  assert.equal(['unconfirmed', true].includes(release.productionDogfoodReadiness.latestSuccessfulRun.medoplReadonly), true);
  assert.equal(release.productionDogfoodReadiness.latestSuccessfulRun.publicMetadataConfirmsReadonlySwitch, release.productionDogfoodReadiness.latestSuccessfulRun.medoplReadonly === true);
  assertIncludesAll(release.productionDogfoodReadiness.latestSuccessfulRun.coverage, ['ordinary_chat_real_completion', 'chat_completed_audit', 'runtime_gate_audit'], 'dogfood coverage');
  assert.equal(release.productionDogfoodReadiness.readonlyFoldbackPolicy.currentPhase, 'production_readonly_foldback');
  assert.equal(release.productionDogfoodReadiness.readonlyFoldbackPolicy.nextPhase, 'readonly_foldback_closeout');
  assert.equal(release.productionDogfoodReadiness.readonlyFoldbackPolicy.blockedBy, null);
  assert.deepEqual(release.productionDogfoodReadiness.readonlyFoldbackPolicy.ownerReceipt, { required: false, source: 'production_secret_gated' });
  assert.deepEqual(release.productionDogfoodReadiness.readonlyFoldbackPolicy.nextStepOpeners, [
    'approved production dogfood run with OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1',
    'sanitized dogfood stdout confirms readonly projection checks',
    'release:evidence folds readonly confirmation without raw logs or secrets',
  ]);
  assert.deepEqual(release.productionDogfoodReadiness.readonlyFoldbackPolicy.requiredEvidence, [
    'OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1',
    'dogfood stdout confirms readonly projection checks',
    'release-evidence-sync --dogfood-readonly-confirmed',
  ]);
  assert.equal(release.productionDogfoodReadiness.readonlyFoldbackPolicy.forbidRawLogs, true);
  assert.equal(release.productionDogfoodReadiness.readonlyFoldbackPolicy.forbidSecretValues, true);
  assert.equal(release.productionDogfoodReadiness.readonlyFoldbackPolicy.confirmedBy.runId, 28142197152);
  assert.equal(release.productionDogfoodReadiness.readonlyFoldbackPolicy.confirmedBy.rawLogPolicy.storesRawLogs, false);
  assert.equal(release.productionDogfoodReadiness.readonlyFoldbackPolicy.claimWhenConfirmed, 'production MedOPL readonly projection dogfood');
  assert.equal(release.productionAvailabilityReadiness.state, availabilityState);
  assert.equal(release.productionAvailabilityReadiness.evidenceScope, 'historical');
  assertLatestRun(release.productionAvailabilityReadiness.latestSuccessfulRun, latest);
  assertIncludesAll(release.productionAvailabilityReadiness.latestSuccessfulRun.coverage, ['HTTPS /readyz'], 'availability coverage');
  assert.equal(release.productionDogfoodReadiness.cannotClaim.includes('production real ordinary chat completion'), false);
  assert.equal(release.productionObservabilityBaseline.state, observabilityState);
  assert.equal(release.productionObservabilityBaseline.evidenceScope, 'historical');
  assert.equal(release.productionObservabilityBaseline.currentPhase, 'ops_evidence_contracts');
  assert.equal(release.productionObservabilityBaseline.nextPhase, 'ops_contract_detail');
  assert.equal(release.productionObservabilityBaseline.blockedBy, null);
  assert.equal(release.productionObservabilityBaseline.ownerReceipt.acceptedClaim, 'operations_maturity_v1_baseline_and_rollback_record_contract_accepted');
  assert.deepEqual(release.productionObservabilityBaseline.nextStepOpeners, ['fold back real production rollback record after manual environment-approved rollback executes', 'open dashboard, alerting, or error budget only with a separate operations owner contract', 'keep automatic rollback out of scope until separately admitted']);
  assertLatestRun(release.productionObservabilityBaseline.latestSuccessfulRun, latest);
  assert.equal(release.productionObservabilityBaseline.nextReadiness.state, 'rollback_record_contract_present_dashboard_alerting_error_budget_deferred');
  assert.equal(release.productionObservabilityBaseline.nextReadiness.scheduledCanary.workflow, '.github/workflows/production-canary.yml');
  assert.equal(release.productionObservabilityBaseline.nextReadiness.scheduledCanary.requiresProductionSecrets, false);
  assertIncludesAll(release.productionObservabilityBaseline.nextReadiness.implementedEvidence, ['scheduled_canary_first_success'], 'implemented ops evidence');
  assert.equal(release.productionObservabilityBaseline.nextReadiness.scheduledCanary.latestSuccessfulRun.runId, 27874732529);
  assert.equal(release.productionObservabilityBaseline.nextReadiness.requiredFutureEvidence.includes('scheduled_canary_first_success'), false);
  assertIncludesAll(release.productionObservabilityBaseline.nextReadiness.requiredFutureEvidence, ['error_budget'], 'future ops evidence');
  assert.deepEqual(release.productionObservabilityBaseline.productionReadinessLevels.map((level) => [level.id, level.requiredBefore]), [['p0_launch_operations', 'public_single_node_launch'], ['p1_commercial_operations', 'commercial_scale_claim'], ['p2_sla_operations', 'sla_or_ha_claim']]);
  const opsLevel = (id) => release.productionObservabilityBaseline.productionReadinessLevels.find((level) => level.id === id);
  assertIncludesAll(opsLevel('p0_launch_operations').gates, ['rollback_path', 'alerting_boundary', 'db_backup_restore_strategy', 'security_ops_baseline', 'incident_runbook_owner', 'cost_quota_guard'], 'P0 ops gate');
  assertIncludesAll(opsLevel('p1_commercial_operations').gates, ['staging_or_production_concurrency_evidence', 'upstream_backpressure_boundary', 'migration_schema_compatibility_policy', 'observability_dashboard_entry'], 'P1 ops gate');
  assertIncludesAll(opsLevel('p2_sla_operations').gates, ['ha_topology_evidence', 'slo_error_budget_contract', 'automatic_rollback_admission_policy'], 'P2 ops gate');
  assert.deepEqual(Object.fromEntries(['alertingBoundary', 'dbBackupRestore', 'securityOpsBaseline', 'costQuotaGuard', 'migrationSchemaCompatibility', 'observabilityDashboard', 'automaticRollbackAdmission'].map((id) => [id, release.productionObservabilityBaseline.productionReadinessGates[id].state])), { alertingBoundary: 'contract_present_pending_alert_route', dbBackupRestore: 'contract_present_pending_restore_drill', securityOpsBaseline: 'contract_present', costQuotaGuard: 'contract_present', migrationSchemaCompatibility: 'contract_present_pending_migration_drill', observabilityDashboard: 'contract_present_pending_dashboard_url', automaticRollbackAdmission: 'not_admitted_manual_only' });
  assert.deepEqual(release.productionObservabilityBaseline.nextReadiness.evidenceContracts, [{ id: 'dashboard', owner: 'operations_owner', state: 'contract_required' }, { id: 'alerting', owner: 'operations_owner', state: 'contract_required' }, { id: 'error_budget', owner: 'operations_owner', state: 'contract_required' }, { id: 'rollback_record', owner: 'release_operator', state: 'contract_present' }]);
  assertIncludesAll(release.productionObservabilityBaseline.cannotClaim, ['dashboard', 'alerting', 'automatic rollback'], 'ops cannot-claim');
  assert.equal(release.productionLaunchCloseout.state, 'contract_present_pending_final_release_decision');
  assertIncludesAll(release.productionLaunchCloseout.requiredEvidence, ['soak', 'load', 'rollback', 'canary', 'alerting', 'dbRestore', 'monitoring', 'ha', 'slo'], 'launch closeout evidence');
  assert.deepEqual(release.productionLaunchCloseout.rawLogPolicy, { storesRawLogs: false, storesSecretValues: false });
  assert.equal(release.productionLaunchCloseout.latestDecision, null);
  assertIncludesAll(release.productionLaunchCloseout.cannotClaim, ['production-ready SaaS', 'long-term production stability', 'automatic rollback'], 'launch closeout cannot-claim');
  assert.equal(release.productionHAReadiness.state, 'paused_single_pod_launch_pending_second_node');
  assert.deepEqual(release.productionHAReadiness.currentApplyManifest.nodeSelector, { 'medopl.cn/webui': 'true' });
  assert.deepEqual(release.productionHAReadiness.currentApplyManifest.nodeLabelPolicy.preserve, { 'medopl.cn/workload': 'medopl' });
  assert.equal(release.productionHAReadiness.latestSuccessfulRun, null);
  assertIncludesAll(release.productionHAReadiness.requiredEvidence, ['two_ready_pods', 'distinct_nodes', 'ingress_backend_at_least_2'], 'HA evidence');
  assertIncludesAll(release.productionHAReadiness.cannotClaim, ['multi-node HA'], 'HA cannot-claim');
  assert.deepEqual(release.oplAutoUpdateReadiness.mode, 'build_time_pinned_opl_context');
  assert.deepEqual([release.oplAutoUpdateReadiness.runtimeGithubSync, release.oplAutoUpdateReadiness.ownerReceipt.acceptedClaim], ['forbidden_by_current_policy', 'opl_update_build_time_pinned_policy_accepted']);
  assertIncludesAll(release.oplAutoUpdateReadiness.cannotClaim, ['runtime continuous GitHub sync', 'background updater parity with one-person-lab-app'], 'OPL auto-update cannot-claim');
  assert.equal(release.localBrowserE2EReadiness.browserAutomation, true);
  assert.equal(release.localBrowserE2EReadiness.releaseGate, true);
  assert.equal(release.localBrowserE2EReadiness.ciWorkflow, '.github/workflows/ci.yml');
  assert.equal(release.localBrowserE2EReadiness.requiredBeforeImageRelease, true);
  assert.equal(release.localBrowserE2EReadiness.latestSuccessfulRun.command, 'npm run verify:browser');
  assertIncludesAll(release.localBrowserE2EReadiness.latestSuccessfulRun.auditKinds, ['chat.completed', 'runtime_gate.blocked'], 'local browser audit kind');
  assert.equal(release.productionBrowserE2EReadiness.mode, 'secret_gated_chromium_research_main_path');
  assert.equal(release.productionBrowserE2EReadiness.state, browserState);
  assert.equal(release.productionBrowserE2EReadiness.evidenceScope, 'historical');
  assert.equal(release.productionBrowserE2EReadiness.defaultEnabled, false);
  assert.equal(release.productionBrowserE2EReadiness.browserAutomation, true);
  assert.equal(release.productionBrowserE2EReadiness.entrypoint, 'node tests/browser/research-main-path-runner.mjs --production');
  assert.equal(release.productionBrowserE2EReadiness.businessPathProof, 'account_based_web_app_main_path_v1');
  assertLatestRun(release.productionBrowserE2EReadiness.latestAttempt, latest);
  assert.equal(release.productionBrowserE2EReadiness.latestAttempt.status, 'success');
  assert.equal(release.productionBrowserE2EReadiness.latestAttempt.failedStage, null);
  assertIncludesAll(release.productionBrowserE2EReadiness.latestAttempt.canClaim, ['production browser e2e executed against https://opl.medopl.cn'], 'browser can-claim');
  assert.equal(release.productionBrowserE2EReadiness.latestAttempt.cannotClaim.includes('production browser e2e'), false);
  assert.deepEqual(release.productionBrowserE2EReadiness.requiredSecrets, ['OPL_DOGFOOD_EMAIL', 'OPL_DOGFOOD_PASSWORD', 'OPL_DOGFOOD_API_KEY']);
  assert.equal(release.productionDogfoodReadiness.secretValidation.OPL_DOGFOOD_EMAIL, 'valid_email_shape');
  assert.equal(release.productionDogfoodReadiness.secretValidation.OPL_DOGFOOD_PASSWORD, 'non_empty');
  assert.deepEqual(release.productionBrowserE2EReadiness.requiredSwitches, ['OPL_PRODUCTION_BROWSER_E2E']);
  assertIncludesAll(release.productionBrowserE2EReadiness.coverage, ['real_browser_login', 'api_key_binding', 'research_task_template_selected', 'structured_research_result_sections', 'paper_runtime_gate', 'grant_runtime_gate', 'progress_refs_projection', 'deliverable_refs_projection', 'blocker_next_step', 'medopl_deeplink'], 'browser coverage');
  assert.equal(release.productionBrowserE2EReadiness.cannotClaim.includes('production browser e2e'), false);
  assertIncludesAll(release.productionBrowserE2EReadiness.cannotClaim, ['MedOPL runtime execution'], 'browser cannot-claim');
  assert.equal(release.localNoSecretReadiness.cannotClaim.includes('production authenticated dogfood e2e executed'), false);
  assert.equal(release.localNoSecretReadiness.cannotClaim.includes('production authenticated dogfood e2e requires Cloud Rollout evidence'), true);
  assert.equal(release.dogfood.rawApiKeyPrinted, false);
  assert.equal(gui.owner, 'one-person-lab-web');
  assert.equal(gui.purpose, 'web_gui_product_contract');
  assert.equal(gui.state, 'active');
  assert.deepEqual([gui.productTruthGate.publicShell, gui.productTruthGate.appShell, gui.productTruthGate.gensparkInfluence, gui.productTruthGate.codexInfluence], ['ai_native_homepage', 'side_nav_command_home', 'homepage_structure_reference', 'contract_first_surface_builder']);
  assertIncludesAll(gui.productTruthGate.mustShow, ['side_navigation_new_chat_projects_skill_workflow_search_more', 'centered_brand_title', 'primary_research_composer', 'starter_chips', 'project_window_continuation_center_as_secondary_surface', 'project_window_search_sheet', 'structured_research_artifact_result_stream', 'desktop_inspector_stable_work_panel', 'lightweight_mobile_inspector_sheet'], 'required GUI surface');
  assertIncludesAll(gui.productTruthGate.mustNotShow, ['dashboard_first_app_home', 'left_rail_primary_navigation', 'workspace_sidebar_primary_shell', 'raw_trace_console', 'runtime_truth_panel', 'billing_source_of_truth', 'node_pool_console', 'raw_upstream_transcript_for_structured_research_result', 'floating_desktop_inspector_overlay', 'heavy_mobile_inspector_sheet'], 'forbidden GUI surface');
  assert.deepEqual(gui.objectGrammar.allowedPrimaryObjects, ['Task', 'Session', 'Message', 'Skill', 'InputFile', 'OutputFile', 'ProgressStage', 'ApiKey', 'Model', 'Export']);
  assert.deepEqual(gui.objectGrammar.fileHierarchy, ['task', 'session', 'input_output_refs']);
  assert.deepEqual(gui.taskFlow.primaryFlow, ['home', 'compose_prompt_or_pick_starter_chip', 'login_or_register_if_needed', 'api_key_modal_if_needed', 'attach_input_files_optional', 'run_chat_or_runtime_gate', 'inspect_autonomy_inputs_outputs_why_next', 'export_or_continue']);
  assert.deepEqual(gui.informationArchitecture.appShell, ['side_navigation', 'home_command_canvas', 'secondary_surfaces', 'right_inspector_layer', 'modal_layer']);
  assert.deepEqual(gui.informationArchitecture.sideNavigation, ['home', 'search', 'files', 'workflows', 'skills', 'more']);
  assert.deepEqual(gui.informationArchitecture.sideNavigationLabels, ['新聊天', '搜索聊天', '文件库', '已安排/任务', '应用 / Skills', '更多']);
  assert.deepEqual(gui.informationArchitecture.sideNavigationTaskOwnership, { home: 'compose_or_start_research_task', search: 'open_project_conversation_file_search', files: 'file_material_handoff_to_medopl', workflows: 'browse_scheduled_tasks_and_workflows', skills: 'browse_or_import_skill_entries', more: 'route_empty_overflow_surface' });
  assert.deepEqual(gui.informationArchitecture.sideNavigationActionMap, { home: { action: 'route_home_and_focus_composer', targetView: 'home', ownerSurface: 'browser_shell', consumer: 'composer_focus' }, search: { action: 'open_search_sheet', targetView: 'home', ownerSurface: 'browser_shell', consumer: 'project_conversation_file_search' }, files: { action: 'open_file_attach_handoff', targetView: 'home', ownerSurface: 'browser_shell', consumer: 'file_material_handoff_to_medopl' }, workflows: { action: 'route_workflows_page', targetView: 'workflows', ownerSurface: 'browser_shell', consumer: 'scheduled_tasks_and_workflow_library' }, skills: { action: 'route_skills_page', targetView: 'skills', ownerSurface: 'browser_shell', consumer: 'skill_library' }, more: { action: 'route_more_overflow_surface', targetView: 'more', ownerSurface: 'browser_shell', consumer: 'empty_overflow_menu' } });
  assert.deepEqual(gui.informationArchitecture.routeScope, expectedRouteScope);
  assert.deepEqual(gui.informationArchitecture.librarySurfaces, pageStates.shellStates.librarySurfaces);
  assert.deepEqual(gui.informationArchitecture.rightInspector, { launcher: 'right_utility_rail', tabs: ['autonomy', 'inputs', 'outputs', 'why_next'], resize: { enabled: true, minWidth: 320, maxWidth: 520 }, desktopBehavior: 'stable_right_work_panel_without_main_overlap', mobileBehavior: 'light_bottom_sheet_with_rail_yield', mobileMaxHeightVh: 64, responsivePlacement: { desktop: 'right_resizable_panel', tablet: 'right_sheet', mobile: 'bottom_sheet' }, mustNotBePrimaryNavigation: true });
  assert.equal(gui.informationArchitecture.accountEntry, 'bottom_avatar_popover');
  assert.deepEqual(gui.informationArchitecture.forbiddenPrimaryNavigationItems, ['account_text_link', 'research_capability', 'paper', 'grant', 'settings', 'api_key']);
  assert.deepEqual(gui.informationArchitecture.retiredPrimaryShell, ['left_rail', 'workspace_sidebar', 'multi_column_sidebar_sprawl', 'clean_workbench_v1']);
  assert.deepEqual([gui.visualGrammar.maxPrimaryCtaPerView, gui.visualGrammar.longExplanatoryCopy, gui.visualGrammar.density, gui.visualGrammar.aesthetic, gui.visualGrammar.mainstreamReference], [1, 'forbidden_in_app_shell', 'low_stimulus_command_home', 'clean_low_stimulus_research_workspace', 'genspark_like_side_nav_center_composer_agentic_cards']);
  assert.deepEqual(gui.visualGrammar.firstViewContract.allowedElements, ['side_navigation', 'brand_title', 'primary_composer', 'starter_chips', 'right_inspector_utility_rail']);
  assert.deepEqual(gui.visualGrammar.firstViewContract.forbiddenElements, ['left_rail', 'workspace_sidebar', 'summary_strip', 'settings_form', 'chat_history', 'right_inspector_content_by_default', 'runtime_gate', 'long_explanatory_copy']);
  assert.deepEqual(gui.visualGrammar.firstViewContract.starterChipCount, { min: 3, max: 5 });
  assert.deepEqual(Object.fromEntries(Object.entries(gui.visualGrammar.surfaceBudget).filter(([key]) => key !== 'routeBudgets')), { maxSectionsPerScreen: 3, maxCardsPerScreen: 6, maxBodyParagraphsPerScreen: 3, maxCtaPerScreen: 2, homeFirstViewMaxSections: 1, homeFirstViewMaxCards: 0, secondarySurfaceMaxCards: 6 });
  assert.deepEqual(gui.visualGrammar.resultStreamContract, { primaryResearchResultSurface: 'structured_research_artifact_card', rawAssistantTranscriptForStructuredResult: 'forbidden', maxRawAssistantMessagesPerStructuredResult: 0, researchArtifactSectionCount: 3, density: 'artifact_first_not_test_log' });
  assert.deepEqual(gui.visualGrammar.inspectorSurfaceContract, { desktop: { behavior: 'stable_right_work_panel', overlapWithMainContent: 'forbidden', reservedMainLayout: 'required' }, mobile: { behavior: 'light_bottom_sheet', maxHeightVh: 64, railYieldWhileOpen: 'required' } });
  assert.deepEqual(Object.values(gui.visualIdentity), ['ai_native_research_composer', ['evidence_stack', 'citation_trail', 'protocol_steps', 'research_artifact'], 'quiet_research_notebook', 'concise_research_operator', 'state_change_orientation_only', ['generic_chatbot', 'dashboard_template', 'marketing_hero', 'decorative_glass', 'neumorphism', 'settings_center']]);
  assert.deepEqual(gui.visualQualityRubric.criteria.map(({ id, measurement, required }) => [id, measurement, required]), [['hierarchy_clarity', 'browser_or_owner_review_boolean', true], ['copy_density', 'browser_static_copy_budget', true], ['spacing_rhythm', 'browser_layout_review_boolean', true], ['mobile_comfort', 'browser_mobile_sheet_and_touch_boolean', true], ['focus_path', 'browser_keyboard_path_boolean', true], ['empty_error_loading_clarity', 'contract_state_presence_boolean', true], ['surface_ownership', 'contract_forbidden_content_boolean', true], ['scientific_artifact_density', 'browser_artifact_shape_boolean', true]]);
  assert.deepEqual(gui.visualQualityRubric.doesNotMeasure, ['pixel_perfect_figma_match', 'complete_design_system', 'assistive_technology_conformance', 'production_owner_acceptance']);
  assert.deepEqual(Object.values(gui.ownerReceiptProtocol), ['ui_ux_v1_production_accepted', ['current_head', 'desktop_tablet_mobile_compact_production_or_owner_review_evidence', 'owner_explicit_acceptance', 'sanitized_foldback'], ['home', 'skills', 'workflows', 'projects', 'more', 'search_sheet', 'account_popover', 'model_selector', 'inspector', 'api_key_modal'], false, ['human_owner_receipt', 'current_head_production_evidence']]);
  assert.deepEqual(gui.visualGrammar.styleTokens.colorRoles, ['canvas', 'surface', 'elevatedSurface', 'border', 'text', 'mutedText', 'accent', 'success', 'warning', 'danger', 'focusRing']);
  assert.deepEqual([gui.visualGrammar.styleTokens.typeScale, gui.visualGrammar.styleTokens.spaceScale, gui.visualGrammar.styleTokens.radiusScale], [['caption', 'label', 'body', 'bodyStrong', 'title', 'display'], ['4', '8', '12', '16', '24', '32'], ['6', '8', '12', 'pill']]);
  assert.deepEqual(gui.visualGrammar.colorPolicy, { primaryAccent: 'opl_green', primaryAccentHex: '#2f6b4f', focusRing: 'opl_green_focus_ring', forbiddenPrimaryPalettes: ['default_tech_blue', 'default_purple', 'purple_blue_gradient'], forbiddenPrimaryHex: ['#2563eb', '#6366f1', '#8b5cf6'], allowedDepth: 'flat_with_soft_depth_only' });
  assert.deepEqual(gui.visualGrammar.motionPolicy, { durationMs: { fast: 120, base: 160, sheet: 180 }, easing: 'ease-out', allowedProperties: ['opacity', 'transform', 'background-color', 'border-color', 'box-shadow', 'color'], forbidden: ['layout_animation', 'long_blocking_transition', 'motion_without_prefers_reduced_motion'], prefersReducedMotion: 'required' });
  assert.deepEqual(gui.visualGrammar.interactionStatePolicy.requiredStates, ['hover', 'active', 'focus-visible', 'disabled', 'loading']);
  assert.deepEqual(gui.visualGrammar.responsiveTopology, { desktop: ['side_nav_visible', 'center_composer_primary', 'secondary_surfaces_below_fold', 'stable_right_inspector_on_request'], tablet: ['side_nav_compact', 'center_composer_primary', 'secondary_surfaces_single_column', 'inspector_sheet'], mobile: ['side_nav_icon_strip', 'composer_first', 'starter_chips_before_history', 'lightweight_inspector_bottom_sheet', 'account_popover_for_auth_and_api_key'], compact: ['brand_composer_first', 'single_column', 'nonessential_status_collapsed'] });
  assertIncludesAll(Object.keys(gui.designQualityGates), ['accessibility', 'touch', 'performance', 'style', 'layout', 'typography', 'motion', 'forms', 'navigation'], 'design quality gate');
  assertIncludesAll(gui.designQualityGates.navigation.required, ['search_is_project_conversation_file_search', 'more_is_empty_overflow', 'bottom_avatar_account_entry', 'optional_model_selector'], 'navigation design quality gate');
  assertIncludesAll(gui.designQualityGates.style.required, ['opl_green_primary_accent', 'low_stimulus_ui', 'no_test_like_ui_copy'], 'style design quality gate');
  assert.deepEqual(Object.keys(gui.interactionContract), ['account_popover', 'search_sheet', 'api_key_required_modal', 'inspector_sheet']);
  for (const overlay of Object.values(gui.interactionContract)) {
    assert.equal(Array.isArray(overlay.closeTrigger), true);
    assert.equal(overlay.closeTrigger.includes('explicit_close'), true);
    assert.equal(overlay.closeTrigger.includes('escape'), true);
    assert.equal(typeof overlay.focusReturn, 'string');
    assert.equal(typeof overlay.emptyState, 'string');
    assert.equal(typeof overlay.errorState, 'string');
    assert.equal(typeof overlay.loadingState, 'string');
  }
  assert.equal(gui.semanticTokens.resourceActive, 'resource.active');
  assert.equal(gui.semanticTokens.billingWarning, 'billing.warning');
  assert.equal(gui.components.find((component) => component.id === 'SideNavigation').defaultState, 'visible');
  assert.equal(gui.components.find((component) => component.id === 'SearchPanel').role, 'project_conversation_file_search');
  assert.equal(gui.components.find((component) => component.id === 'MoreOverflow').defaultState, 'empty');
  assert.equal(gui.components.find((component) => component.id === 'InspectorSheet').defaultState, 'hidden');
  assert.deepEqual(gui.components.find((component) => component.id === 'InspectorSheet').tabs, ['autonomy', 'inputs', 'outputs', 'why_next']);
  assert.equal(gui.components.find((component) => component.id === 'InspectorSheet').resize.enabled, true);
  assert.deepEqual(gui.components.find((component) => component.id === 'SkillPlaza').actions, ['import_skill']);
  assert.deepEqual(gui.components.find((component) => component.id === 'WorkflowCards').actions, ['create_workflow', 'import_workflow']);
  assert.deepEqual(gui.components.find((component) => component.id === 'ProjectWindowCenter').actions, ['new_project', 'continue_conversation']);
  assert.equal(gui.components.find((component) => component.id === 'ApiKeyDialog').primaryActionLabel, '保存');
  assert.deepEqual(Object.keys(gui.componentTokens), ['Button', 'Input', 'Card', 'Popover', 'Modal', 'Nav', 'Chip', 'Tabs', 'Sheet']);
  assert.equal(gui.figmaSource.fileKey, '1MNO5l7PQYKZVNqQgw6DGS');
  assert.equal(gui.figmaSource.nodeId, '0:1');
  assert.deepEqual(gui.figmaSource.requiredSourceFiles, ['src/app/App.tsx', 'src/styles/theme.css']);
  assert.deepEqual(gui.figmaSource.adoptedPatterns, ['account_popover_status', 'missing_api_key_resource_gate', 'side_navigation_new_chat_projects_skill_workflow_search_more', 'ai_native_center_composer', 'starter_chips', 'prompt_command_center', 'research_skill_launcher', 'agentic_workflow_cards', 'inspector_sheet_tabs_autonomy_inputs_outputs_why_next', 'running_blocked_turn_state']);
  assert.deepEqual(gui.figmaSource.rejectedPatterns, ['drive_or_cloud_storage_ownership', 'runtime_truth_ownership', 'founder_plan_upsell', 'unlimited_compute_claim', 'dashboard_crm_primary_app', 'generic_office_content_design_video_skills', 'default_tech_blue_primary_palette', 'dominant_purple_primary_palette', 'purple_blue_gradient_primary_style', 'heavy_glassmorphism_primary_style', 'neumorphism_primary_style']);
  assert.equal(gui.visualGrammar.currentUiVariant, 'ai_native_research_home_v1');
  assert.deepEqual([gui.visualQualityGate.state, gui.visualQualityGate.completedPhase, gui.visualQualityGate.currentPhase, gui.visualQualityGate.nextPhase], ['production_ui_quality_claim_accepted_current_head', 'responsive_visual_qa', 'production_ui_quality_claim', null]);
  assert.deepEqual(gui.visualQualityGate.ownerReceipt, { required: true, status: 'accepted', source: 'human_owner_receipt', acceptedClaim: 'ui_ux_v1_production_accepted', acceptedAt: '2026-06-23', acceptedScope: 'current production UI/UX v1 product surface only', cannotBeInferredBy: ['repo_local_tests', 'browser_screenshots', 'production_e2e_without_human_receipt'], reason: 'human owner accepted current UI/UX v1 as production v1 while explicitly not claiming a complete design system' });
  assert.deepEqual(gui.visualQualityGate.requiredBeforeProductionUiClaim, [
    'Figma MCP source context refreshed',
    'desktop screenshot captured and layout-reviewed in local browser',
    'tablet screenshot captured and layout-reviewed in local browser',
    'mobile screenshot captured and layout-reviewed in local browser',
    'compact screenshot captured and layout-reviewed in local browser',
    'browser interaction e2e passed',
    'no hidden overlay intercepts input',
    'no static text overflow across registered responsive breakpoints',
    'interactive touch targets and named controls pass registered browser checks',
    'keyboard focus ring is visible on the primary chat submit control',
    'repo-local keyboard path, API key modal focus trap, and contrast closeout pass browser evidence',
    'structured @科研 result stream is artifact-first without duplicated raw upstream assistant transcript',
    'desktop inspector is verified as a stable right work panel without overlapping main content',
    'OPL green token guard rejects default tech blue or purple primary palette',
    'prefers-reduced-motion path is implemented for UI motion',
    'mobile inspector is verified as a lightweight bottom sheet within height budget',
    'production UI owner receipt completed',
  ]);
  assert.deepEqual(gui.visualQualityGate.acceptance.map((item) => item.id), ['figma_mcp_source_context', 'desktop_screenshot_review', 'tablet_screenshot_review', 'mobile_screenshot_review', 'compact_screenshot_review', 'browser_interaction_e2e', 'hidden_overlay_input_check', 'responsive_visual_qa_closeout', 'ai_native_research_home_v1_shell', 'owner_receipt_closeout']);
  assert.deepEqual(Object.fromEntries(gui.visualQualityGate.acceptance.map((item) => [item.id, item.state])), {
    figma_mcp_source_context: 'done',
    desktop_screenshot_review: 'done',
    tablet_screenshot_review: 'done',
    mobile_screenshot_review: 'done',
    compact_screenshot_review: 'done',
    browser_interaction_e2e: 'done',
    hidden_overlay_input_check: 'done',
    responsive_visual_qa_closeout: 'done',
    ai_native_research_home_v1_shell: 'done',
    owner_receipt_closeout: 'done',
  });
  assert.equal(gui.visualQualityGate.acceptance.find((item) => item.id === 'browser_interaction_e2e').command, 'npm run verify:browser');
  assert.equal(gui.visualQualityGate.baselineEvidence.command, 'npm run verify:browser');
  assert.deepEqual(gui.visualQualityGate.baselineEvidence.viewports, ['desktop', 'tablet', 'mobile', 'compact']);
  assert.equal(gui.visualQualityGate.baselineEvidence.screenshotPathPattern, '.runtime/browser-visual/research-main-path-{mode}-{viewport}-{timestamp}.png');
  assert.deepEqual(gui.visualQualityGate.responsiveVisualQaEvidence.checks, ['noHorizontalOverflow', 'noStaticTextOverflow', 'inspectorWithinViewport', 'activeInspectorPanelVisible', 'hiddenOverlayDoesNotInterceptInput', 'chatInputHitTarget', 'touchTargetsPass', 'namedControlsPass', 'keyboardFocusVisible', 'keyboardPathPass', 'modalFocusTrapPass', 'contrastPass', 'oplGreenTokenGuard', 'prefersReducedMotionPresent', 'mobileInspectorBottomSheet', 'desktopInspectorStablePanel', 'lightweightMobileInspectorSheet', 'researchArtifactDensity']);
  assert.equal(gui.visualQualityGate.productionUiQualityClaim.phaseId, 'production_ui_quality_claim');
  assert.equal(gui.visualQualityGate.productionUiQualityClaim.targetClaim, 'ui_ux_v1_production_accepted');
  assert.equal(gui.visualQualityGate.productionUiQualityClaim.status, 'accepted');
  assert.deepEqual(gui.visualQualityGate.productionUiQualityClaim.designSystemBoundary, { claimed: 'ui_ux_v1_product_surface', notClaimed: 'complete_ui_ux_design_system' });
  assert.deepEqual(gui.visualQualityGate.productionUiQualityClaim.requiredEvidence, ['owner_receipt', 'production_browser_e2e_or_screenshot_evidence', 'accessibility_closeout_boundary', 'sanitized_foldback']);
  assert.deepEqual(gui.visualQualityGate.productionUiQualityClaim.lifecycle.longTermTruth, ['contracts/web-gui-product-contract.json', 'contracts/web-gap-phase-registry.json', 'contracts/web-product-profile.json', 'registered tests', 'docs/status.md', 'docs/active/README.md']);
  assert.deepEqual(gui.visualQualityGate.productionUiQualityClaim.lifecycle.temporaryArtifacts, ['.runtime/browser-visual/*', '.runtime/phase-runs/*', 'production raw logs', 'raw screenshots', 'CI raw output']);
  assert.deepEqual(gui.visualQualityGate.productionUiQualityClaim.productionEvidence, { status: 'done', requiredHost: 'https://opl.medopl.cn', acceptedSources: ['production_browser_e2e', 'production_screenshot_evidence'], latestAcceptedSource: { type: 'production_browser_e2e', runId: 28039468173, runUrl: 'https://github.com/RenDeHuang/OPL-Webui/actions/runs/28039468173', commit: 'c1787da0c13aedf75b84b12c29f26b13193fce74', image: 'uswccr.ccs.tencentyun.com/webopl/opl-webui:c1787da', targetHost: 'https://opl.medopl.cn', foldback: 'sanitized_summary_only' }, rawArtifactsInGit: false, foldback: 'sanitized_summary_only' });
  assert.deepEqual(gui.visualQualityGate.productionUiQualityClaim.accessibilityCloseout, {
    status: 'repo_local_browser_closeout_done_production_owner_pending',
    completedRepoLocalChecks: ['touchTargetsPass', 'namedControlsPass', 'keyboardFocusVisible', 'noStaticTextOverflow', 'hiddenOverlayDoesNotInterceptInput', 'keyboardPathPass', 'modalFocusTrapPass', 'contrastPass'],
    requiredBeforeFullA11yClaim: ['assistive_technology_review'],
  });
  assert.equal(gui.visualQualityGate.cannotClaim.includes('complete UI/UX design system'), true);
  assert.deepEqual(gui.pageTemplates, ['HomeFirstView', 'Skills', 'Workflows', 'Projects', 'MoreOverflow', 'InspectorSheet', 'ModalOverlay', 'OutputPreview']);
  assert.equal(gui.accessibility.keyboardRequired, true);
  assertIncludesAll(gui.acceptanceLayers, ['contract', 'component_state', 'interaction', 'visual'], 'GUI acceptance layer');

  assert.equal(shell.owner, 'one-person-lab-web');
  assert.equal(shell.purpose, 'web_shell_adapter');
  assert.equal(shell.state, 'active');
  assert.equal(shell.activeShell.id, 'opl_web_static_esm_shell');
  assert.equal(shell.activeShell.migrationPolicy, 'stay_static_until_component_state_or_visual_regression_evidence_requires_framework');
  assertIncludesAll(shell.shellMayOwn, ['renderer_components', 'layout_composition', 'panel_resize_behavior', 'figma_code_mapping'], 'shell-owned surface');
  assertIncludesAll(shell.shellMustNotOwn, ['product_truth', 'runtime_truth', 'domain_judgment_truth', 'artifact_body_authority', 'billing_source_of_truth'], 'shell forbidden surface');
  assert.deepEqual(shell.figmaCodeMapping.variantProps.SideNavigation, { state: ['default', 'active', 'hover', 'focus-visible', 'disabled', 'compact'] });
  assert.deepEqual(shell.figmaCodeMapping.variantProps.Sheet, {
    state: ['closed', 'open', 'empty', 'error', 'loading'],
    variant: ['search', 'inspector'],
    motion: ['default', 'reduced_motion'],
  });
  assert.deepEqual(shell.figmaCodeMapping.variantProps.InspectorSheet, {
    state: ['hidden', 'autonomy', 'inputs', 'outputs', 'why_next'],
    width: ['default', 'narrow', 'wide'],
    placement: ['right_resizable_panel', 'right_sheet', 'bottom_sheet'],
  });
  assert.deepEqual(shell.figmaCodeMapping.variantProps.MoreOverflow, { state: ['empty'] });
  assertIncludesAll(shell.figmaCodeMapping.requiredNodeMetadata, ['componentId', 'variantProps'], 'Figma node metadata');
  assert.deepEqual(shell.codeProps.MoreOverflow, { state: ['empty'] });
  assert.equal(shell.codeProps.InspectorSheet.state.includes('autonomy'), true);
  assertIncludesAll(shell.validationCommands, ['npm run verify:contract', 'npm run verify:smoke'], 'shell validation command');
});
