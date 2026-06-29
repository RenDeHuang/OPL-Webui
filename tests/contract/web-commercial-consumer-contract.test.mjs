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

test('OPL-Webui commercial launch matrix fixes cross-repo identity and handoff contract', () => {
  const contract = readJson('contracts/web-commercial-consumer-contract.json');
  const launch = contract.commercialWebuiMedoplE2ELaunchContract;

  assert.equal(launch.goalId, 'goal-commercial-webui-medopl-e2e-launch-contract');
  assert.equal(launch.scope, 'cross_repo_local_contract_only');
  assert.equal(launch.medoplContractRef, 'contracts/medopl-api-contract.json#/medopl_api_contract/opl_webui_e2e_launch_contract');
  assert.equal(launch.buildPushDeployLiveTestAllowed, false);
  assert.equal(launch.doesNotReplaceMedoplNextRecommendedGoal, 'goal-commercial-release-metadata-rollback-maturity');

  assert.deepEqual(launch.identityMapping.sharedKeys, ['userId', 'email', 'tenantId', 'workspaceId']);
  assert.equal(launch.identityMapping.webuiSessionProjection.owner, 'OPL-Webui');
  assert.equal(launch.identityMapping.webuiSessionProjection.sourceOfCommercialTruth, false);
  assert.equal(launch.identityMapping.medoplCommercialTruth.owner, 'MedOPL');
  assert.equal(launch.identityMapping.medoplCommercialTruth.sourceOfCommercialTruth, true);
  assertIncludesAll(launch.identityMapping.medoplCommercialTruth.fields, [
    'accountId',
    'planId',
    'balance',
    'quota',
    'runtimeBindingId',
    'storageBindingId',
    'billingAttributionId',
  ], 'MedOPL commercial truth field');
  assertIncludesAll(launch.identityMapping.forbiddenCrossings, [
    'rawProviderKey',
    'paymentToken',
    'runtimeToken',
    'storageObjectKey',
    'artifactBody',
  ], 'forbidden identity crossing');

  const paths = new Map(launch.pathMatrix.map((path) => [path.id, path]));
  assert.deepEqual([...paths.keys()], [
    'ordinary_path',
    'specialist_blocked_handoff',
    'specialist_onboarding_required',
    'specialist_ready_projection',
  ]);

  assert.equal(paths.get('ordinary_path').runtimeRequired, false);
  assert.equal(paths.get('ordinary_path').storageRequired, false);
  assert.equal(paths.get('ordinary_path').medoplProjectionRequired, false);
  assertIncludesAll(paths.get('ordinary_path').webuiEvidence, ['session_current', 'ordinary_chat_allowed'], 'ordinary path evidence');
  assertIncludesAll(paths.get('ordinary_path').cannotClaim, ['runtime execution', 'storage truth'], 'ordinary path cannot-claim');

  assert.equal(paths.get('specialist_blocked_handoff').runtimeRequired, true);
  assert.equal(paths.get('specialist_blocked_handoff').medoplProjectionRequired, true);
  assert.equal(paths.get('specialist_blocked_handoff').webuiAutoRunAllowed, false);
  assertIncludesAll(paths.get('specialist_blocked_handoff').medoplReadonlyProjection, [
    'account',
    'plan',
    'balance_quota',
    'runtime_admission',
    'storage_status',
    'billing',
    'release',
  ], 'blocked projection');
  assertIncludesAll(paths.get('specialist_blocked_handoff').handoffNextActions, [
    'open_medopl_onboarding',
    'select_plan',
    'recharge_or_credit_required',
    'open_runtime_storage',
  ], 'blocked next action');
  assert.equal(paths.get('specialist_blocked_handoff').deeplinkRequired, true);

  assert.equal(paths.get('specialist_onboarding_required').state, 'onboarding_required');
  assert.equal(paths.get('specialist_onboarding_required').webuiAutoRunAllowed, false);
  assertIncludesAll(paths.get('specialist_onboarding_required').handoffNextActions, ['open_medopl_onboarding'], 'onboarding next action');

  assert.equal(paths.get('specialist_ready_projection').state, 'ready');
  assert.equal(paths.get('specialist_ready_projection').readySourceOwner, 'MedOPL');
  assert.deepEqual(paths.get('specialist_ready_projection').allowedWebuiBridgeActions, [
    'POST /api/opl/runtime-gate',
    'POST /api/opl/runs',
  ]);
  assert.equal(paths.get('specialist_ready_projection').projectionPolicy, 'refs_progress_deliverables_only');
  assertIncludesAll(paths.get('specialist_ready_projection').cannotClaim, [
    'runtime execution completed',
    'artifact body authority',
    'storage truth ownership',
  ], 'ready path cannot-claim');

  assertIncludesAll(launch.verification.localCommands, ['npm run verify:contract', 'npm run verify:health', 'npm run verify'], 'local verification command');
  assertIncludesAll(launch.canClaim, [
    'cross-repo commercial launch contract matrix is defined locally',
    'OPL-Webui ordinary path remains outside runtime/storage blocking',
    'OPL-Webui specialist path consumes MedOPL readonly projection and deeplink handoff',
  ], 'can-claim');
  assertIncludesAll(launch.cannotClaim, [
    'cloud deploy executed',
    'build or push executed',
    'live production test executed',
    'MedOPL payment readiness',
    'MedOPL runtime execution completed',
    'storage truth ownership by OPL-Webui',
  ], 'cannot-claim');
});

test('OPL-Webui records dynamic cross-repo current truth sync fail-closed matrix', () => {
  const contract = readJson('contracts/web-commercial-consumer-contract.json');
  const release = readJson('contracts/web-release-profile.json');
  const sync = contract.commercialCrossRepoDynamicCurrentTruthSync;

  assert.equal(sync.goalId, 'goal-commercial-cross-repo-dynamic-current-truth-sync');
  assert.equal(sync.mode, 'contract_pointer_remote_head_current_truth_readout_validation_gate');
  assert.equal(sync.state, 'fresh_sync_recorded_2026-06-29');
  assert.equal(sync.rawEvidencePolicy.commitsRawEvidence, false);
  assert.equal(sync.operationBoundary.cloudAllowed, false);
  assert.equal(sync.operationBoundary.buildPushImageAllowed, false);
  assert.equal(sync.operationBoundary.deployLiveTestAllowed, false);
  assert.equal(sync.operationBoundary.secretReadAllowed, false);

  assert.equal(sync.repoIdentity.medopl.branch, 'recovery/platform-v22-trunk');
  assert.equal(sync.repoIdentity.medopl.remoteHead, 'e6d2e7ae54ee3bcb2fd86fd21d56c35492ac7b35');
  assert.equal(sync.repoIdentity.medopl.latestCloseout.goalId, 'goal-commercial-current-truth-stale-pointer-cleanup');
  assert.equal(sync.repoIdentity.medopl.nextRecommendedGoal, 'goal-commercial-release-metadata-rollback-maturity');
  assert.equal(sync.repoIdentity.oplWebui.branch, 'main');
  assert.equal(sync.repoIdentity.oplWebui.remoteHead, '94704dc55b9d689655d6e0a34625e8dd10d73b4a');
  assert.equal(sync.repoIdentity.oplWebui.latestCloseout.goalId, 'gap-registry-compaction-v1');
  assert.equal(sync.repoIdentity.oplWebui.nextRecommendedGoal, 'goal-commercial-webui-ha-resilience-error-budget-readiness');

  assertIncludesAll(sync.readoutSources.medopl, [
    'docs/active/README.md',
    'tests/fixtures/v22/goal-current.json',
    'contracts/medopl-api-contract.json',
    'contracts/medopl-release-boundary.json',
  ], 'MedOPL readout source');
  assertIncludesAll(sync.readoutSources.oplWebui, [
    'docs/status.md',
    'docs/active/README.md',
    'contracts/web-commercial-consumer-contract.json',
    'contracts/web-gap-phase-registry.json',
    'contracts/web-release-profile.json',
    'contracts/web-runtime-bridge.json',
  ], 'OPL-Webui readout source');

  assertIncludesAll(sync.ownershipBoundary.medoplOwns, [
    'account',
    'plan',
    'balance',
    'quota',
    'runtime',
    'storage',
    'billing_ledger',
    'statement_reconciliation',
    'release',
    'destroy',
    'stop_billing',
    'future_payment_psp_truth',
  ], 'MedOPL owner boundary');
  assertIncludesAll(sync.ownershipBoundary.oplWebuiOwns, [
    'ordinary_chat',
    'research_interaction',
    'task_experience',
    'page_state',
    'readonly_medopl_projection_rendering',
    'deeplink_handoff',
  ], 'OPL-Webui owner boundary');

  assertIncludesAll(sync.cannotClaimBoundary.oplWebuiCannotClaim, [
    'payment_truth',
    'billing_truth',
    'runtime_truth',
    'storage_truth',
    'artifact_body_authority',
  ], 'OPL-Webui cannot-claim');
  assertIncludesAll(sync.cannotClaimBoundary.medoplCannotClaim, [
    'ordinary_chat_task_ux_ownership',
    'opl_webui_page_state_ownership',
    'external_psp_settlement',
    'all_users_all_tenants',
    'sla_multi_region_production_complete',
  ], 'MedOPL cannot-claim');

  const states = new Map(sync.e2eStateMatrix.map((state) => [state.id, state]));
  assert.equal(states.get('ordinary_path').runtimeStorageRequired, false);
  assert.equal(states.get('ordinary_path').owner, 'OPL-Webui');
  assert.equal(states.get('specialist_blocked_onboarding').requiresMedoplProjection, true);
  assert.equal(states.get('specialist_blocked_onboarding').requiresDeeplink, true);
  assert.deepEqual(states.get('specialist_ready').readyRequires, [
    'MedOPL approved account',
    'MedOPL plan',
    'MedOPL balance/quota',
    'MedOPL runtime ready',
    'MedOPL storage ready',
  ]);

  assertIncludesAll(sync.dynamicSyncTriggers, [
    'public_contract_changed',
    'current_truth_or_next_recommended_goal_changed',
    'can_claim_or_cannot_claim_changed',
    'payment_psp_billing_runtime_storage_release_boundary_changed',
    'opl_webui_projection_deeplink_runtime_bridge_changed',
    'ha_rollback_production_evidence_or_broader_tenant_canary_completed',
    'live_e2e_evidence_added_or_expired',
  ], 'dynamic sync trigger');

  assert.equal(sync.failClosedRule.onMismatch, true);
  assertIncludesAll(sync.failClosedRule.blockedActions, [
    'live_e2e',
    'rollout',
    'production_complete_claim',
  ], 'fail-closed blocked action');
  assertIncludesAll(sync.failClosedRule.mismatchReportFields, [
    'ownership_conflict',
    'claim_inconsistency',
    'head_mismatch',
    'contract_field_missing',
    'cannot_claim_upgraded',
  ], 'mismatch report field');

  assert.deepEqual(sync.nextLiveE2EPrerequisites, [
    'MedOPL release metadata / rollback maturity',
    'OPL-Webui HA / resilience / error-budget readiness',
    'future PSP goal before payment-to-runtime E2E',
  ]);
  assert.equal(sync.retirement.closeoutAfterSync, true);
  assert.equal(sync.retirement.longTermActiveBlocker, false);

  assert.equal(
    release.commercialCrossRepoDynamicCurrentTruthSync.contract,
    'contracts/web-commercial-consumer-contract.json#/commercialCrossRepoDynamicCurrentTruthSync',
  );
  assert.deepEqual(release.commercialCrossRepoDynamicCurrentTruthSync.nextLiveE2EPrerequisites, sync.nextLiveE2EPrerequisites);
});
