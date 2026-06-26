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
  assert.equal(product.productLayers.find((layer) => layer.id === 'public_growth_layer')?.status, 'basically_done');
  assert.equal(product.gapMap.layers.find((layer) => layer.id === 'growth_layer')?.status, 'basically_done');
  assert.equal(pageState.productLayers.find((layer) => layer.id === 'public_growth_layer')?.status, 'current_public_surface');
  assert.equal(release.productLayerReadiness.publicGrowthLayer, 'basically_done');
  assert.equal(api['x-product-layers'].publicGrowthLayer.status, 'basically_done');

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
