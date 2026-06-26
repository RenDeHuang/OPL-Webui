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

test('commercial launch Figma Make candidate is scoped to public and user product UI only', () => {
  const gui = readJson('contracts/web-gui-product-contract.json');
  const candidate = gui.uiUxReferenceCandidate;

  assert.equal(candidate.id, 'figma_make_ui_ux_for_commercial_launch');
  assert.equal(candidate.state, 'accepted_reference_candidate');
  assert.deepEqual(candidate.appliesTo, ['public_growth_layer', 'account_based_user_product_layer']);
  assert.deepEqual(candidate.doesNotApplyTo, ['minimal_admin_ops_layer']);
  assert.deepEqual(candidate.appliesToProductLayers, ['public_growth_layer', 'account_based_user_product_layer']);
  assert.deepEqual(candidate.notApplicableToProductLayers, ['minimal_admin_ops_layer']);
  assert.equal(candidate.role, 'visual_direction_and_user_flow_reference_only');
  assert.equal(candidate.claimSemantics.currentCannotClaimMeaning, 'current_stage_evidence_boundary_not_permanent_product_vision_denial');
  assert.equal(candidate.references.publicGrowthLayerUIReference.purpose, 'product_introduction_task_scenarios_output_showcase_start_path');
  assert.equal(candidate.references.accountBasedUserProductLayerUIReference.purpose, 'authenticated_workbench_task_entry_task_history_refs_blocker_next_step_deeplink');
  assertIncludesAll(candidate.acceptedVisualPatterns, ['public_product_intro', 'task_scenario_gallery', 'output_refs_showcase', 'authenticated_research_workbench', 'task_history_continuation_center'], 'candidate visual pattern');
  assertIncludesAll(candidate.acceptedInteractionPatterns, ['start_path_after_auth_return', 'task_entry_to_composer', 'task_history_continue', 'blocker_next_step_handoff', 'medopl_opl_deeplink'], 'candidate interaction pattern');
  assertIncludesAll(candidate.acceptedUserProductSurfaces, ['public_landing', 'login_register', 'byok_binding', 'task_entry_composer', 'refs_only_result', 'task_history_continuation', 'runtime_gate_projection'], 'candidate user surface');
  assert.deepEqual(candidate.canonicalCopyGrammar['Commercial Launch'], ['Controlled Knowledge Delivery', 'One Person Lab Web']);
  assertIncludesAll(candidate.canonicalCopyGrammar['Pro/credit/recharge'], ['account capability', 'API key', 'quota projection', 'external capability handoff'], 'candidate commercial copy grammar');
  assert.equal(candidate.canonicalCopyGrammar['runtime completed'], 'MedOPL continuation ready / refs available');
  assert.equal(candidate.canonicalCopyGrammar['storage ready'], 'MedOPL storage status projection');
  assert.equal(candidate.canonicalCopyGrammar['artifact body'], 'deliverable refs');
  assert.equal(candidate.canonicalCopyGrammar['payment status'], 'readonly commercial projection');
  assertIncludesAll(candidate.rewriteRequiredTerms, ['Commercial Launch', 'Pro', 'credit', 'recharge', 'runtime completed', 'storage ready', 'artifact body', 'payment status', 'workspace'], 'candidate rewrite term');
  assertIncludesAll(candidate.wordingRewriteRequirements.mustRewriteTerms, candidate.rewriteRequiredTerms, 'candidate legacy rewrite term');
  assertIncludesAll(candidate.forbiddenVisibleClaims, ['web_owned_payment', 'web_owned_runtime_execution', 'web_owned_storage_truth', 'artifact_body_authority', 'full_saas', 'admin_ops_operator_controls', '_ops_ui', 'operator_controls'], 'candidate visible false claim');
  assertIncludesAll(candidate.forbiddenFalseClaims, candidate.forbiddenVisibleClaims, 'candidate false claim');
  assertIncludesAll(candidate.futureCapabilityPlaceholders, ['payment_or_commercial_lifecycle_with_contract_and_evidence', 'medopl_owned_runtime_execution_with_contract_and_evidence', 'medopl_owned_storage_or_artifact_body_with_contract_and_evidence', 'team_rbac_or_org_workspace_with_contract_and_evidence'], 'future capability placeholder');
  assert.equal(candidate.implementationPolicy.adminOpsImplementation, 'forbidden');
  assert.equal(candidate.implementationPolicy.releaseEvidenceChange, 'forbidden_in_this_slice');
});
