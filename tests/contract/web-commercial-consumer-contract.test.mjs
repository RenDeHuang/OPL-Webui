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

test('OPL-Webui commercial consumer contract keeps MedOPL as commercial runtime authority', () => {
  const contract = readJson('contracts/web-commercial-consumer-contract.json');

  assert.equal(contract.id, 'opl_webui_commercial_consumer_contract');
  assert.equal(contract.ownerSurface, 'opl-webui-commercial-consumer');
  assert.equal(contract.productRole, 'web_interaction_platform_consumer');
  assert.equal(contract.authoritativeFor, 'OPL-Webui consumption of MedOPL projections and deeplinks');
  assert.equal(contract.notAuthoritativeFor, 'MedOPL current truth or payment/billing/runtime/storage/resource-control ownership');

  assert.deepEqual(contract.productBoundary.webuiOwns, [
    'ordinary_chat',
    'research_interaction',
    'task_intent',
    'task_experience',
    'account_session',
    'byok_binding',
    'page_state',
    'readonly_projection_rendering',
    'deeplink_handoff',
  ]);
  assertIncludesAll(contract.productBoundary.medoplOwns, [
    'account_plan_truth',
    'balance_quota_truth',
    'runtime_admission_truth',
    'storage_status_truth',
    'billing_payment_truth',
    'resource_control_truth',
    'account_resource_provisioning_truth',
  ], 'MedOPL authority');
  assertIncludesAll(contract.productBoundary.onePersonLabOwns, [
    'framework_execution_semantics',
    'task_lifecycle_semantics',
    'domain_execution_boundaries',
  ], 'one-person-lab authority');

  assert.equal(contract.ordinaryPath.defaultRequiresRuntime, false);
  assert.equal(contract.ordinaryPath.defaultRequiresStorage, false);
  assert.equal(contract.ordinaryPath.runtimeStoragePolicy, 'not_required_by_default');
  assertIncludesAll(contract.ordinaryPath.webuiOwnedInteractions, ['ordinary_chat', '@科研', 'task_intent_capture', 'prompt_composer'], 'ordinary interaction');
  assertIncludesAll(contract.ordinaryPath.forbiddenClaims, ['runtime_execution', 'storage_truth', 'artifact_body_authority'], 'ordinary forbidden claim');

  assert.equal(contract.specialistPath.enteredOnlyWhenRuntimeRequired, true);
  assert.equal(contract.specialistPath.runtimeResourceOwner, 'MedOPL');
  assert.equal(contract.specialistPath.webuiMode, 'projection_consumer_and_deeplink_handoff');
  assertIncludesAll(contract.specialistPath.taskMarkers, ['@论文', '@基金', '@综述', '@文件', '@PPT', '@书'], 'specialist marker');
  assertIncludesAll(contract.specialistPath.allowedStates, ['blocked', 'ready', 'onboarding_required'], 'specialist state');
  assert.equal(contract.specialistPath.autoRunWithoutMedOPLReadyProjection, false);
  assert.equal(contract.specialistPath.fakeReadyForbidden, true);

  const projectionIds = contract.projectionSurfaces.map((surface) => surface.id);
  assertIncludesAll(projectionIds, [
    'account',
    'plan',
    'balance_quota',
    'runtime_admission',
    'storage_status',
    'billing',
    'release',
  ], 'projection surface');

  for (const surface of contract.projectionSurfaces) {
    assert.equal(surface.sourceOwner, 'MedOPL', `${surface.id} sourceOwner`);
    assert.equal(surface.webuiMode, 'readonly_projection', `${surface.id} webuiMode`);
    assert.equal(surface.webuiMutationAllowed, false, `${surface.id} mutation boundary`);
    assert.equal(surface.webuiSourceOfTruth, false, `${surface.id} source of truth boundary`);
    assert.equal(surface.fakeProjectionAllowed, false, `${surface.id} fake projection boundary`);
    assertIncludesAll(surface.forbiddenUse, ['source_of_truth_claim', 'mutation', 'fake_ready'], `${surface.id} forbidden use`);
  }

  assert.equal(contract.deeplinkContract.sourceOwner, 'MedOPL');
  assert.equal(contract.deeplinkContract.webuiOwnsDeepLinkRendering, true);
  assert.equal(contract.deeplinkContract.webuiOwnsTargetBehavior, false);
  assert.equal(contract.deeplinkContract.returnToOplRequired, true);
  assertIncludesAll(contract.deeplinkContract.allowedTargets, ['plan', 'billing', 'runtime', 'storage', 'onboarding', 'return_to_task'], 'deeplink target');

  assertIncludesAll(contract.apiConsumers, [
    '/api/account/commercial-status',
    '/api/account/billing-summary',
    '/api/medopl/runtime/status',
    '/api/medopl/materials-deliverables/projection',
    '/api/opl/runtime-gate',
    '/api/opl/runs',
    '/api/tasks',
  ], 'api consumer endpoint');

  assertIncludesAll(contract.forbiddenWebuiClaims, [
    'payment_truth',
    'billing_truth',
    'runtime_truth',
    'storage_truth',
    'resource_control_truth',
    'artifact_body_authority',
    'full_saas',
    'production_ready_saas',
  ], 'forbidden Webui claim');

  for (const placeholder of contract.futureCapabilityPlaceholders) {
    assert.equal(placeholder.currentStatus, 'current_stage_evidence_boundary_not_permanent_denial', `${placeholder.id} status`);
    assert.equal(placeholder.requiresMedOPLAuthority, true, `${placeholder.id} MedOPL authority`);
    assert.equal(placeholder.requiresNewContractAndTests, true, `${placeholder.id} contract/tests`);
    assert.equal(placeholder.webuiMaySelfAuthorize, false, `${placeholder.id} self authorization`);
  }

  assertIncludesAll(contract.doesNotProve, [
    'production rollout',
    'MedOPL readiness',
    'payment readiness',
    'billing source of truth',
    'runtime execution',
    'storage truth',
    'resource-control truth',
    'full SaaS capability',
  ], 'does-not-prove boundary');
});
