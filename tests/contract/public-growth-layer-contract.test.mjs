import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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

  assert.equal(product.positioning, 'One Person Lab knowledge delivery Web platform');
  assert.equal(product.topLevelProductCategory, 'knowledge_delivery_web_platform');
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

test('Figma parity UI replacement target is scoped to public and user product UI only', () => {
  const gui = readJson('contracts/web-gui-product-contract.json');
  const pageState = readJson('contracts/web-page-state-matrix.json');
  const target = gui.figmaParityUiReplacementTarget;

  assert.equal(gui.uiUxReferenceCandidate, undefined);
  assert.equal(target.id, 'figma_make_ui_ux_for_commercial_launch');
  assert.equal(target.state, 'deployed_replacement_candidate');
  assert.equal(target.role, 'figma_parity_ui_replacement_target');
  assert.equal(target.productionEvidence.state, 'folded_success_run_28282021822');
  assert.equal(target.productionEvidence.runId, 28282021822);
  assert.equal(target.productionEvidence.commit, 'd9f50522e1f116a6f8d9827c33bc0b08a4e1f721');
  assert.equal(target.productionEvidence.image, 'uswccr.ccs.tencentyun.com/webopl/opl-webui:d9f5052');
  assert.deepEqual(target.appliesTo, ['public_growth_layer', 'account_based_user_product_layer']);
  assertIncludesAll(target.doesNotApplyTo, ['minimal_admin_ops_layer', '/_ops', 'operator_controls'], 'replacement exclusion');
  assert.deepEqual(target.appliesToProductLayers, ['public_growth_layer', 'account_based_user_product_layer']);
  assertIncludesAll(target.notApplicableToProductLayers, ['minimal_admin_ops_layer', '/_ops', 'operator_controls'], 'replacement product layer exclusion');
  assert.equal(target.claimSemantics.currentCannotClaimMeaning, 'current_stage_evidence_boundary_not_permanent_product_vision_denial');
  assert.equal(target.references.publicGrowthLayerUIReference.purpose, 'product_introduction_task_scenarios_output_showcase_start_path');
  assert.equal(target.references.accountBasedUserProductLayerUIReference.purpose, 'authenticated_workbench_task_entry_task_history_refs_blocker_next_step_deeplink');
  assertIncludesAll(target.acceptedVisualPatterns, ['public_product_intro', 'task_scenario_gallery', 'output_refs_showcase', 'authenticated_research_workbench', 'task_history_continuation_center'], 'target visual pattern');
  assertIncludesAll(target.acceptedInteractionPatterns, ['start_path_after_auth_return', 'task_entry_to_composer', 'task_history_continue', 'blocker_next_step_handoff', 'medopl_opl_deeplink'], 'target interaction pattern');
  assertIncludesAll(target.acceptedUserProductSurfaces, ['public_landing', 'login_register', 'byok_binding', 'task_entry_composer', 'refs_only_result', 'task_history_continuation', 'runtime_gate_projection'], 'target user surface');
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
  assert.equal(target.implementationPolicy.releaseEvidenceChange, 'folded_after_successful_controlled_launch_run_28282021822');

  assert.equal(pageState.uiReplacementTarget.id, 'figma_make_ui_ux_for_commercial_launch');
  assert.equal(pageState.uiReplacementTarget.state, 'deployed_replacement_candidate');
  assert.equal(pageState.uiReplacementTarget.productionUiReplaced, true);
  assert.equal(pageState.uiReplacementTarget.releaseEvidenceImpact, 'folded_success_run_28282021822');
  assert.equal(pageState.uiReplacementTarget.productionEvidence.runId, 28282021822);
  assert.deepEqual(pageState.uiReplacementTarget.appliesToRoutes, ['home', 'projects', 'skills', 'workflows']);
  assertIncludesAll(pageState.uiReplacementTarget.doesNotApplyTo, ['minimal_admin_ops_layer', '/_ops', 'operator_controls'], 'page-state replacement exclusion');
});
