import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { readWebSource } from './helpers/web-source-reader.mjs';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assertIncludesAll(actual, expected, label) {
  for (const item of expected) {
    assert.equal(actual.includes(item), true, `missing ${label}: ${item}`);
  }
}

test('public growth layer contract is implemented without expanding into full SaaS', () => {
  const product = readJson('contracts/web-product-profile.json');
  const pageState = readJson('contracts/web-page-state-matrix.json');
  const release = readJson('contracts/web-release-profile.json');
  const api = readJson('contracts/web-api.openapi.json');

  assert.equal(product.positioning, 'One Person Lab Web interaction platform / browser entry for knowledge delivery');
  assert.deepEqual([product.topLevelProductCategory, product.productIdentity.category, product.productIdentity.primaryRole], ['web_interaction_platform', 'web_interaction_platform', 'browser_entry']);
  assert.equal(product.productLayers.find((layer) => layer.id === 'public_growth_layer')?.status, 'done_v1');
  assert.equal(product.gapMap.layers.find((layer) => layer.id === 'growth_layer')?.status, 'done_v1');
  assert.equal(pageState.productLayers.find((layer) => layer.id === 'public_growth_layer')?.status, 'done_v1');
  assert.equal(release.productLayerReadiness.publicGrowthLayer, 'done_v1');
  assert.equal(api['x-product-layers'].publicGrowthLayer.status, 'done_v1');

  const growth = product.publicGrowthLayerContract;
  assert.equal(growth.owner, 'one-person-lab-web');
  assert.equal(growth.consumer, 'anonymous_research_user');
  assert.equal(growth.surface, 'public_homepage');
  assert.equal(growth.startPath.returnAfterAuth, 'return_to_selected_task_entry');
  assert.deepEqual(growth.sections.map((section) => section.id), ['hero', 'task_entries', 'outputs', 'audience', 'trust_boundary', 'start_path']);
  assertIncludesAll(growth.taskEntries.map((entry) => entry.marker), ['@科研', '@论文', '@基金', '@综述', '@文件', '@PPT', '@书'], 'public task marker');
  assertIncludesAll(growth.outputs, ['progress_refs', 'deliverable_refs', 'materials_refs', 'blocker_next_step', 'medopl_opl_deeplink'], 'public output');
  assertIncludesAll(growth.audiences, ['individual_researcher', 'masters_student', 'phd_student', 'principal_investigator', 'research_group_or_organization'], 'public audience');
  assertIncludesAll(growth.trustBoundary.webOwns, ['entry', 'task_state', 'sanitized_projection', 'refs', 'deeplink'], 'public Web boundary');
  assertIncludesAll(growth.trustBoundary.externalAuthority, ['MedOPL runtime/storage/billing/resource control', 'OPL Framework/domain agent execution and artifact authority'], 'public external authority');
  assert.equal(growth.trustBoundary.upstreamFailurePolicy, 'fail_closed_no_fabricated_result');
  assertIncludesAll(growth.cannotClaim, ['authenticated task success', 'runtime execution', 'artifact body authority', 'full SaaS', 'payment/team/RBAC/HA'], 'public cannot-claim');

  assertIncludesAll(product.userProductExpansionGaps, ['research_group_workspace', 'organization_workspace', 'members', 'sharing'], 'future user product expansion gap');
  assertIncludesAll(product.claims.cannotClaim, ['team invite lifecycle', 'RBAC lifecycle', 'payment lifecycle', 'production-ready SaaS'], 'product cannot-claim');
});

test('public page-state contract exposes anonymous task start and login return path', () => {
  const pageState = readJson('contracts/web-page-state-matrix.json');
  const growth = pageState.publicGrowthLayer;

  assert.equal(growth.owner, 'one-person-lab-web');
  assert.equal(growth.defaultAudience, 'anonymous_user');
  assert.deepEqual(growth.requiredSections, ['hero', 'task_entries', 'outputs', 'audience', 'trust_boundary', 'start_path']);
  assert.deepEqual(growth.observableSelectors, [
    '[data-public-growth-layer]',
    '[data-public-hero]',
    '[data-public-task-section]',
    '[data-public-output-section]',
    '[data-public-audience-section]',
    '[data-public-trust-section]',
    '[data-public-start-path]',
    '[data-public-task-entry]',
    '[data-public-start-cta]',
  ]);
  assert.deepEqual(growth.startPath, {
    anonymousAction: 'open_login_register_popover',
    pendingTaskStorage: 'document.body.dataset.pendingPublicTaskIntent',
    afterAuth: 'restore_selected_task_prompt_and_focus_composer',
  });
  assertIncludesAll(growth.cannotClaim, ['authenticated task success', 'runtime execution', 'artifact body authority', 'full SaaS', 'payment/team/RBAC/HA'], 'page-state cannot-claim');
});

test('public direct-copy auth entry does not rely on authenticated account popover state', () => {
  const domSource = readWebSource();

  assert.match(domSource, /function openAnonymousAuth/);
  assert.match(domSource, /data-public-start-cta[\s\S]*?openAnonymousAuth/);
  assert.match(domSource, /state\.view\.accountState === 'anonymous'[\s\S]*?state\.shellState = 'auth_login_register'/);
  assert.match(domSource, /data-account-toggle[\s\S]*?state\.view\.accountState === 'anonymous'[\s\S]*?openAnonymousAuth/);
  assert.match(domSource, /preserveInteractiveShellAfterBootstrap/);
  assert.match(domSource, /state\.shellState === 'auth_login_register'/);
});

test('Figma parity UI replacement target is scoped to public and user product UI only', () => {
  const gui = readJson('contracts/web-gui-product-contract.json');
  const product = readJson('contracts/web-product-profile.json');
  const pageState = readJson('contracts/web-page-state-matrix.json');
  const release = readJson('contracts/web-release-profile.json');
  const target = gui.figmaParityUiReplacementTarget;
  const uiTruth = product.uiSourceTruth;
  const latest = release.latestMainEvidence;

  assert.equal(uiTruth.state, 'figma_canonical_source_v1');
  assert.equal(uiTruth.source.fileKey, '1MNO5l7PQYKZVNqQgw6DGS');
  assert.equal(uiTruth.source.fileName, 'UI_UX for Commercial Launch');
  assert.equal(uiTruth.source.url, 'https://www.figma.com/make/1MNO5l7PQYKZVNqQgw6DGS/UI-UX-for-Commercial-Launch?p=f&t=yJdcYUdu4fOW4gIY-0');
  assert.equal(uiTruth.source.primaryAppSource, 'src/app/App.tsx');
  assert.deepEqual(uiTruth.source.styleSourcesToRead, ['src/styles/theme.css']);
  assert.deepEqual(uiTruth.appliesTo, ['public_growth_layer', 'account_based_user_product_layer']);
  assertIncludesAll(uiTruth.doesNotApplyTo, ['minimal_admin_ops_layer', '/_ops', 'operator_controls'], 'UI source exclusion');
  assert.equal(uiTruth.implementationBoundary.codexMaySelfDesignSurfaces, false);
  assert.equal(uiTruth.implementationBoundary.doNotVendorGeneratedApp, true);
  assert.equal(uiTruth.mockTruthPolicy.figmaMockDataIsProductTruth, false);
  assertIncludesAll(uiTruth.mockTruthPolicy.staticProjectCopyForbiddenAsTruth, ['New project', 'opl', 'medopl', '空项目', '新建项目'], 'Figma mock static copy');
  assertIncludesAll(uiTruth.mockTruthPolicy.mockRuntimeStoragePaymentCopyForbiddenAsTruth, ['runtime completed', 'storage ready', 'artifact body', 'payment status', 'Pro', 'credit', 'recharge'], 'Figma mock capability copy');
  assert.equal(uiTruth.contractProofBoundary.contractTestsReplaceFigmaVisualTruth, false);
  assert.equal(uiTruth.implementationMap, undefined);
  assert.equal(uiTruth.implementationSummary.status, 'closed_repo_local_implementation_complete');
  assert.deepEqual(uiTruth.implementationSummary.sourceFilesRead, ['src/app/App.tsx', 'src/styles/theme.css']);
  assertIncludesAll(
    uiTruth.implementationSummary.closedPhaseIds,
    ['figma_to_code_implementation_map', 'figma_public_landing_slice', 'figma_auth_surface_slice', 'figma_home_workbench_shell_slice', 'figma_dialog_sheet_projection_slice'],
    'closed Figma phase',
  );
  assertIncludesAll(
    uiTruth.implementationSummary.surfaceIds,
    ['public_landing', 'auth_surface', 'authenticated_workbench_shell', 'task_launcher_runtime_blocker', 'results_refs_deliverables', 'project_window_continuation', 'dialog_sheet_projection'],
    'Figma implementation summary surface',
  );
  assertIncludesAll(
    uiTruth.implementationSummary.stableContractRefs,
    ['contracts/web-gui-product-contract.json#/figmaParityUiReplacementTarget', 'contracts/web-page-state-matrix.json', 'contracts/web-interaction-contract.json', 'contracts/web-gap-phase-registry.json#/gaps/commercial_launch_ui_implementation/closedSummary'],
    'Figma implementation stable contract ref',
  );
  assertIncludesAll(
    uiTruth.implementationSummary.mockTruthRetirement,
    ['initProjects', 'fileItems', 'mockResult', 'quota recharge copy', 'runtime completed copy', 'storage ready copy'],
    'Figma mock truth retirement',
  );
  assert.equal(uiTruth.implementationSummary.replacementPolicy.includes('instead of restoring detailed implementation maps'), true);
  assert.equal(gui.uiUxReferenceCandidate, undefined);
  assert.equal(target.id, 'figma_make_ui_ux_for_commercial_launch');
  assert.equal(target.state, 'deployed_replacement_candidate');
  assert.equal(target.role, 'figma_parity_ui_replacement_target');
  assert.deepEqual(target.productionEvidence, {
    state: latest.state,
    commit: latest.commit,
    image: latest.image,
    runId: latest.runId,
    runUrl: latest.runUrl,
  });
  assert.deepEqual(target.appliesTo, ['public_growth_layer', 'account_based_user_product_layer']);
  assertIncludesAll(target.doesNotApplyTo, ['minimal_admin_ops_layer', '/_ops', 'operator_controls'], 'replacement exclusion');
  assert.deepEqual(target.appliesToProductLayers, ['public_growth_layer', 'account_based_user_product_layer']);
  assertIncludesAll(target.notApplicableToProductLayers, ['minimal_admin_ops_layer', '/_ops', 'operator_controls'], 'replacement product layer exclusion');
  assert.equal(target.claimSemantics.currentCannotClaimMeaning, 'current_stage_evidence_boundary_not_permanent_product_vision_denial');
  assert.equal(target.references.publicGrowthLayerUIReference.purpose, 'product_introduction_task_scenarios_output_showcase_start_path');
  assert.equal(target.references.accountBasedUserProductLayerUIReference.purpose, 'authenticated_workbench_task_entry_project_window_refs_blocker_next_step_deeplink');
  assertIncludesAll(target.acceptedVisualPatterns, ['public_product_intro', 'task_scenario_gallery', 'output_refs_showcase', 'authenticated_research_workbench', 'project_window_continuation_center'], 'target visual pattern');
  assertIncludesAll(target.acceptedInteractionPatterns, ['start_path_after_auth_return', 'task_entry_to_composer', 'project_window_continue', 'blocker_next_step_handoff', 'medopl_opl_deeplink'], 'target interaction pattern');
  assertIncludesAll(target.acceptedUserProductSurfaces, ['public_landing', 'login_register', 'byok_binding', 'task_entry_composer', 'refs_only_result', 'project_window_continuation', 'runtime_gate_projection'], 'target user surface');
  assert.deepEqual(target.canonicalCopyGrammar['Commercial Launch'], ['Controlled Knowledge Delivery', 'One Person Lab Web']);
  assertIncludesAll(target.canonicalCopyGrammar['Pro/credit/recharge'], ['account capability', 'API key', 'quota projection', 'external capability handoff'], 'target commercial copy grammar');
  assert.equal(target.canonicalCopyGrammar['runtime completed'], 'MedOPL continuation ready / refs available');
  assert.equal(target.canonicalCopyGrammar['storage ready'], 'MedOPL storage status projection');
  assert.equal(target.canonicalCopyGrammar['artifact body'], 'deliverable refs');
  assert.equal(target.canonicalCopyGrammar['payment status'], 'readonly commercial projection');
  assertIncludesAll(target.rewriteRequiredTerms, ['Commercial Launch', 'Pro', 'credit', 'recharge', 'runtime completed', 'storage ready', 'artifact body', 'payment status', 'workspace'], 'target rewrite term');
  assertIncludesAll(target.wordingRewriteRequirements.mustRewriteTerms, target.rewriteRequiredTerms, 'target legacy rewrite term');
  assertIncludesAll(target.forbiddenVisibleClaims, ['web_owned_payment', 'web_owned_runtime_execution', 'web_owned_storage_truth', 'artifact_body_authority', 'full_saas', 'admin_ops_operator_controls', '_ops_ui', 'operator_controls'], 'target visible false claim');
  assertIncludesAll(target.forbiddenFalseClaims, target.forbiddenVisibleClaims, 'target false claim');
  assertIncludesAll(target.futureCapabilityPlaceholders, ['payment_or_commercial_lifecycle_with_contract_and_evidence', 'medopl_owned_runtime_execution_with_contract_and_evidence', 'medopl_owned_storage_or_artifact_body_with_contract_and_evidence', 'team_rbac_or_org_workspace_with_contract_and_evidence'], 'future capability placeholder');
  assert.equal(target.replacementPolicy.oldSurfacesMustBeRetiredPerReplacementSlice, true);
  assert.equal(target.replacementPolicy.noParallelOldNewShellAfterSliceCloseout, true);
  assert.equal(target.replacementPolicy.visualInteractionParityTarget, 'as_close_to_1_to_1_as_current_contracts_allow');
  assert.equal(target.replacementPolicy.dataStateTruth, 'go_control_plane_and_contracts_only');
  assert.equal(target.replacementPolicy.mockTruthPolicy, 'forbidden');
  assertIncludesAll(target.replacementPolicy.eachSliceMustDeclare, ['target_surface', 'old_surface_retirement', 'new_implementation', 'contract_page_state_mapping', 'browser_visual_test', 'repo_bloat_check'], 'replacement slice requirement');
  assert.equal(target.implementationPolicy.adminOpsImplementation, 'forbidden');
  assert.equal(target.implementationPolicy.releaseEvidenceChange, `folded_after_successful_controlled_launch_run_${latest.runId}`);

  assert.equal(pageState.uiReplacementTarget.id, 'figma_make_ui_ux_for_commercial_launch');
  assert.equal(pageState.uiReplacementTarget.state, 'deployed_replacement_candidate');
  assert.equal(pageState.uiReplacementTarget.productionUiReplaced, true);
  assert.equal(pageState.uiReplacementTarget.releaseEvidenceImpact, latest.state);
  assert.equal(pageState.uiReplacementTarget.productionEvidence.runId, latest.runId);
  assert.deepEqual(pageState.uiReplacementTarget.appliesToRoutes, ['home', 'projects', 'skills', 'workflows']);
  assertIncludesAll(pageState.uiReplacementTarget.doesNotApplyTo, ['minimal_admin_ops_layer', '/_ops', 'operator_controls'], 'page-state replacement exclusion');
});

test('commercial product user journey depth is admitted separately from interaction completion', () => {
  const product = readJson('contracts/web-product-profile.json');
  const depth = product.commercialProductUserJourneyDepth;

  assert.equal(depth.state, 'active_gap_admitted');
  assert.equal(depth.currentProductValueStatus, 'repo_browser_product_acceptance_done_owner_pending_v1');
  assert.equal(depth.interactionCompleteDoesNotProveProductValueComplete, true);
  assert.deepEqual(depth.journeyOrder, [
    'visitor',
    'new_user',
    'ordinary_user',
    'specialist_not_ready',
    'specialist_ready',
    'medopl_handoff',
    'returning_user',
  ]);
  assert.equal(depth.firstValueMoment.status, 'repo_browser_optimized_v1_streaming_turn_done');
  assert.equal(depth.firstValueMoment.progressiveBoundary, 'request_lifecycle_not_token_stream');
  assert.equal(depth.firstValueMoment.target, 'ordinary_research_chat_first_value_in_project_window');
  assert.equal(depth.projectWindowModel.businessName, '项目 / 窗口');
  assert.equal(depth.projectWindowModel.windowSearchScope, 'project_windows');
  assert.equal(depth.projectWindowModel.status, 'implemented_projection_backed_v1');
  assert.equal(depth.chatInteractionModel.requiredFeel, 'request_lifecycle_progressive_turns');
  assert.equal(depth.chatInteractionModel.status, 'repo_browser_done_v1');
  assert.deepEqual(depth.chatInteractionModel.requiredStages, ['submitted', 'progressive', 'waiting_upstream', 'complete', 'error']);
  assert.equal(depth.chatInteractionModel.progressiveBoundary, 'request_lifecycle_not_token_stream');
  assertIncludesAll(depth.chatInteractionModel.doesNotProve, ['token streaming implemented', 'upstream provider streaming support'], 'chat turn lifecycle boundary');
  assert.equal(depth.medoplHandoff.productRole, 'specialist_conversion_handoff_not_error');
  assert.equal(depth.medoplHandoff.status, 'repo_browser_productized_v1');
  assert.equal(depth.medoplHandoff.visualMode, 'conversion_handoff_card');
  assertIncludesAll(depth.medoplHandoff.triggers, ['run_specialist_task', 'upload_file', 'runtime_required', 'storage_or_resource_binding_required'], 'MedOPL handoff trigger');
  assertIncludesAll(depth.medoplHandoff.requiredSignals, ['capability_marker', 'reason', 'next_action', 'medopl_deeplink', 'return_context'], 'MedOPL handoff signal');
  assertIncludesAll(depth.medoplHandoff.mustNotLookLike, ['generic_error_page', 'dead_link', 'web_runtime_admin'], 'MedOPL handoff forbidden mode');
  assert.deepEqual(depth.skillSurface.scopes, ['opl_skills', 'my_skills']);
  assertIncludesAll(depth.skillSurface.importStates, ['select', 'validate', 'imported', 'error'], 'skill import state');
  assertIncludesAll(depth.inspectorAutonomy.requiredSignals, ['current_objective', 'activity_timeline', 'input_refs', 'output_refs', 'blocker_why', 'next_action'], 'autonomy inspector signal');
  assertIncludesAll(depth.modelAndPlusToolbar.requiredControls, ['model_selector', 'plus_file_attach'], 'toolbar control');
  assert.equal(depth.modelAndPlusToolbar.status, 'repo_browser_done_v1');
  assert.equal(depth.skillSurface.status, 'repo_browser_typed_import_error_v1');
  assert.equal(depth.productAcceptance.repoBrowserStatus, 'done_v1');
  assert.equal(depth.productAcceptance.ownerVisualCopyReceipt.status, 'pending');
  assert.deepEqual(depth.webOwnedGaps, []);
  assert.equal(depth.webOwnedGaps.includes('skill_import'), false);
  assert.equal(depth.webOwnedGaps.includes('model_selector'), false);
  assert.equal(depth.webOwnedGaps.includes('plus_menu'), false);
  assert.equal(depth.webOwnedGaps.includes('autonomy_inspector'), false);
  assertIncludesAll(depth.medoplOwned, ['runtime_readiness', 'storage_resource_binding', 'billing_payment_truth', 'file_runtime_processing'], 'MedOPL-owned product journey item');
  assertIncludesAll(depth.ownerVisualCopyReview, ['reduce_primary_surface_explanatory_copy', 'project_window_language', 'medopl_conversion_copy', 'inspector_information_density'], 'owner copy review item');
  assertIncludesAll(depth.cannotClaim, ['commercial product journey complete', 'dedicated project/window persistence API', 'token streaming implemented', 'production-ready SaaS'], 'product journey cannot claim');
});
