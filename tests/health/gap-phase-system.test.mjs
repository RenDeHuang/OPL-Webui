import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const registryPath = 'contracts/web-gap-phase-registry.json';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assertContractRefExists(ref, label) {
  const [path] = ref.split('#');
  assert.ok(existsSync(path), `${label} references missing contract: ${ref}`);
}

function isCompactedClosedGap(gap) {
  return gap.state === 'closed' && gap.closedSummary;
}

function assertCompactedClosedGap(gap, expected) {
  assert.equal(gap?.state, 'closed', `${expected.id} must remain closed`);
  assert.equal(gap?.currentStatus, 'done', `${expected.id} must remain done`);
  assert.equal(gap?.currentPhaseId, expected.finalPhaseId, `${expected.id} final phase`);
  assert.equal(gap?.closedSummary?.finalPhaseId, expected.finalPhaseId, `${expected.id} closedSummary final phase`);
  assert.deepEqual(gap?.phases, undefined, `${expected.id} compacted closed gap must not keep full phases`);
  assert.ok(gap?.closedSummary?.summary.length > 0, `${expected.id} must keep closed summary`);
  assertIncludesAll(gap?.closedSummary?.stableContracts ?? [], expected.stableContracts, `${expected.id} stable contract`);
  assert.ok(gap?.closedSummary?.tombstoneRef?.startsWith('docs/history/process/closeouts.md#'), `${expected.id} must keep provenance tombstoneRef`);
  assert.ok(gap?.closedSummary?.cannotClaimRetained, `${expected.id} must retain cannotClaim`);
}

function assertIncludesAll(actual, expected, label) {
  for (const item of expected) {
    assert.equal(actual.includes(item), true, `missing ${label}: ${item}`);
  }
}

test('gap phase registry defines phase queues without creating durable process logs', () => {
  assert.equal(existsSync(registryPath), true, 'missing gap phase registry');
  const registry = readJson(registryPath);

  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.productId, 'one-person-lab-web');
  assert.equal(registry.state, 'active_policy');
  assert.equal(registry.runtimeArtifactPolicy.directory, '.runtime/phase-runs');
  assert.equal(registry.runtimeArtifactPolicy.gitTracked, false);
  assert.ok(registry.runtimeArtifactPolicy.ttlDays > 0);
  assert.ok(registry.runtimeArtifactPolicy.ttlDays <= 14);
  assert.ok(registry.runtimeArtifactPolicy.maxRunDirectories <= 20);
  assert.ok(registry.runtimeArtifactPolicy.maxRunBytes <= 10 * 1024 * 1024);
  assert.equal(registry.runtimeArtifactPolicy.rawLogs, 'forbidden_in_git');
  assert.equal(registry.runtimeArtifactPolicy.foldback, 'sanitized_summary_only');
  assert.equal(registry.runtimeArtifactPolicy.cleanupCommand, 'node scripts/gap-phase-runner.mjs cleanup');
  assert.match(registry.machineBoundary, /\.runtime phase run artifacts are temporary/);
  assert.deepEqual(registry.evalDimensionPolicy.dimensions, ['contract', 'repo_local', 'browser', 'production', 'owner', 'cleanup']);
  assert.deepEqual(registry.evalDimensionPolicy.statusValues, ['pass', 'blocked', 'fail']);
  assert.deepEqual(registry.gapStateValues, ['active', 'closed', 'paused']);
  assert.equal(registry.evalDimensionPolicy.advanceRule, 'currentStatus=done and all evalResults pass');
  assert.equal(registry.evalDimensionPolicy.externalEvidenceCannotBeInferredFromRepoLocal, true);
  assert.deepEqual(registry.evalDimensionPolicy.externalEvidenceDimensions, ['production', 'owner']);
  assert.deepEqual(registry.evalDimensionPolicy.requiredFields, ['id', 'dimension', 'status', 'proves', 'doesNotProve']);
});

test('each gap phase has owner, eval, evidence, cannot-claim, and blocker boundaries', () => {
  const registry = readJson(registryPath);
  const gapIds = registry.gaps.map((gap) => gap.id);

  assert.deepEqual(gapIds, [
    'ui_ux_product_depth',
    'commercial_launch_ui_implementation',
    'commercial_launch_readiness_closeout',
    'medopl_readonly_evidence',
    'commercial_runtime_admission_alignment_v1',
    'commercial_product_maturity_gap_v1',
    'commercial_product_user_journey_depth_v1',
    'runtime_execution_boundary',
    'commercial_saas_depth',
    'operations_maturity',
    'ha_and_resilience',
    'concurrency_and_load',
    'opl_auto_update_from_github',
    'commercial_cross_repo_dynamic_current_truth_sync',
  ]);

  for (const gap of registry.gaps) {
    assert.equal(typeof gap.ownerSurface, 'string', `${gap.id} must declare ownerSurface`);
    assert.ok(gap.ownerSurface.length > 0, `${gap.id} ownerSurface must be non-empty`);
    assert.ok(registry.gapStateValues.includes(gap.state), `${gap.id} must declare supported state`);
    assert.ok(Array.isArray(gap.cannotClaim) && gap.cannotClaim.length > 0, `${gap.id} must declare cannotClaim`);

    if (isCompactedClosedGap(gap)) {
      assert.equal(gap.currentStatus, 'done', `${gap.id} compacted closed gap must remain done`);
      assert.equal(gap.closedSummary.finalPhaseId, gap.currentPhaseId, `${gap.id} closed summary must point at final phase`);
      assert.equal(gap.closedSummary.cannotClaimRetained, true, `${gap.id} closed summary must retain cannotClaim`);
      assert.ok(gap.closedSummary.summary.length > 0, `${gap.id} compacted closed gap must declare summary`);
      assert.ok(gap.closedSummary.stableContracts.length > 0, `${gap.id} compacted closed gap must declare stable contracts`);
      assert.ok(gap.closedSummary.tombstoneRef.length > 0, `${gap.id} compacted closed gap must declare tombstoneRef`);
      for (const ref of gap.closedSummary.stableContracts) {
        assertContractRefExists(ref, `${gap.id} closedSummary stable contract`);
      }
      continue;
    }

    assert.ok(gap.phases.length > 0, `${gap.id} active paused or un-compacted closed gap must declare phases`);
    assert.ok(gap.phases.some((phase) => phase.id === gap.currentPhaseId), `${gap.id} current phase must exist`);

    for (const phase of gap.phases) {
      assert.equal(typeof phase.objective, 'string', `${gap.id}/${phase.id} must declare objective`);
      assert.ok(phase.entryCriteria.length > 0, `${gap.id}/${phase.id} must declare entry criteria`);
      assert.ok(phase.exitCriteria.length > 0, `${gap.id}/${phase.id} must declare exit criteria`);
      assert.ok(phase.requiredEvals.length > 0, `${gap.id}/${phase.id} must declare required evals`);
      assert.ok(phase.evidenceSources.length > 0, `${gap.id}/${phase.id} must declare evidence sources`);
      assert.ok(phase.blockerTypes.length > 0, `${gap.id}/${phase.id} must declare typed blockers`);
      assert.ok(phase.acceptance.length > 0, `${gap.id}/${phase.id} must declare machine acceptance`);
      assert.ok(phase.nextStepOpeners.length > 0, `${gap.id}/${phase.id} must declare next step openers`);
      assert.ok(phase.ownerReceipt.required !== undefined, `${gap.id}/${phase.id} must declare owner receipt policy`);

      for (const evalRef of phase.requiredEvals) {
        assert.equal(typeof evalRef.id, 'string', `${gap.id}/${phase.id} eval must declare id`);
        assert.equal(typeof evalRef.contract, 'string', `${evalRef.id} must declare contract`);
        assertContractRefExists(evalRef.contract, evalRef.id);
        assert.ok(evalRef.proves.length > 0, `${evalRef.id} must declare proves`);
        assert.ok(evalRef.doesNotProve.length > 0, `${evalRef.id} must declare doesNotProve`);
        assert.ok(evalRef.failureBlocks.length > 0, `${evalRef.id} must declare failureBlocks`);
      }
    }
  }
});

test('gap phase runner reports partial or blocked phases instead of complete claims', async () => {
  const runner = await import('../../scripts/gap-phase-runner.mjs');
  const registry = readJson(registryPath);
  const report = runner.buildPhaseStatusReport(registry);

  assert.equal(report.goalComplete, false);
  assert.ok(report.gaps.some((gap) => gap.status === 'blocked'));
  assert.equal(report.blockedClaims.includes('production MedOPL readonly projection dogfood'), false);
  assert.ok(report.blockedClaims.includes('OPL runtime execution from Web'));
  assert.ok(report.blockedClaims.includes('complete commercial SaaS lifecycle'));
  assert.equal(report.blockedClaims.includes('complete UI/UX design system'), false);
  for (const gap of report.gaps) {
    assert.equal(typeof gap.currentStep.objective, 'string', `${gap.id} must report current step objective`);
    assert.ok(gap.acceptance.length > 0, `${gap.id} must report acceptance gates`);
    assert.ok(gap.nextStepOpeners.length > 0, `${gap.id} must report next-step openers`);
    assert.equal(
      !['commercial_product_user_journey_depth_v1', 'commercial_saas_depth', 'operations_maturity', 'ha_and_resilience'].includes(gap.id),
      gap.readyToAdvance,
    );
  }
});

test('gap phase runner evaluates each gap across repo, production, owner, contract, and cleanup dimensions', async () => {
  const runner = await import('../../scripts/gap-phase-runner.mjs');
  const registry = readJson(registryPath);
  const report = runner.buildPhaseStatusReport(registry);
  const byGap = Object.fromEntries(report.gaps.map((gap) => [gap.id, gap]));

  for (const gap of report.gaps) {
    assert.ok(Array.isArray(gap.evalResults), `${gap.id} must report machine eval results`);
    assert.ok(gap.evalResults.length >= 3, `${gap.id} must evaluate multiple dimensions`);
    assert.ok(gap.evalResults.some((result) => result.dimension === 'cleanup'), `${gap.id} must evaluate cleanup`);
    assert.ok(gap.evalResults.every((result) => registry.evalDimensionPolicy.dimensions.includes(result.dimension)), `${gap.id} eval dimensions must be declared by contract`);
    assert.ok(gap.evalResults.every((result) => typeof result.id === 'string' && result.id.length > 0), `${gap.id} eval ids must be stable`);
    assert.ok(gap.evalResults.every((result) => ['pass', 'blocked', 'fail'].includes(result.status)), `${gap.id} eval statuses must be typed`);
    assert.ok(gap.evalResults.every((result) => Array.isArray(result.proves) && result.proves.length > 0), `${gap.id} evals must declare proves`);
    assert.ok(gap.evalResults.every((result) => Array.isArray(result.doesNotProve) && result.doesNotProve.length > 0), `${gap.id} evals must declare doesNotProve`);
  }

  assert.equal(byGap.ui_ux_product_depth.evalResults.find((result) => result.id === 'owner_receipt').status, 'pass');
  assert.equal(byGap.ui_ux_product_depth.evalResults.find((result) => result.id === 'production_ui_evidence').status, 'pass');
  assert.equal(byGap.ui_ux_product_depth.evalResults.find((result) => result.id === 'figma_source_context').status, 'pass');
  assert.equal(byGap.commercial_launch_ui_implementation.status, 'done');
  assert.equal(byGap.commercial_launch_ui_implementation.currentPhaseId, 'figma_dialog_sheet_projection_slice');
  assert.equal(byGap.commercial_launch_ui_implementation.readyToAdvance, true);
  assert.equal(byGap.commercial_launch_ui_implementation.evalResults.find((result) => result.id === 'closed_summary_stable_contracts').status, 'pass');
  assert.equal(byGap.commercial_launch_readiness_closeout.status, 'done');
  assert.equal(byGap.commercial_launch_readiness_closeout.currentPhaseId, 'post_release_closeout');
  assert.equal(byGap.commercial_launch_readiness_closeout.readyToAdvance, true);
  assert.equal(byGap.commercial_launch_readiness_closeout.evalResults.find((result) => result.id === 'closed_summary_stable_contracts').status, 'pass');
  assert.equal(byGap.medopl_readonly_evidence.evalResults.find((result) => result.id === 'closed_summary_stable_contracts').status, 'pass');
  assert.equal(byGap.commercial_runtime_admission_alignment_v1.status, 'done');
  assert.equal(byGap.commercial_runtime_admission_alignment_v1.currentPhaseId, 'production_e2e_rerun_after_alignment');
  assert.equal(byGap.commercial_runtime_admission_alignment_v1.readyToAdvance, true);
  assert.equal(byGap.commercial_runtime_admission_alignment_v1.evalResults.find((result) => result.id === 'closed_summary_stable_contracts').status, 'pass');
  assert.equal(byGap.commercial_product_maturity_gap_v1.status, 'done');
  assert.equal(byGap.commercial_product_maturity_gap_v1.currentPhaseId, 'ops_diagnostics_and_troubleshooting');
  assert.equal(byGap.commercial_product_maturity_gap_v1.evalResults.find((result) => result.id === 'maturity_classification_contract').status, 'pass');
  assert.equal(byGap.commercial_product_maturity_gap_v1.evalResults.find((result) => result.id === 'webui_owner_boundary').status, 'pass');
  assert.equal(byGap.commercial_product_maturity_gap_v1.evalResults.find((result) => result.id === 'maturity_implementation_queue').status, 'pass');
  assert.equal(byGap.commercial_product_user_journey_depth_v1.status, 'partial');
  assert.equal(byGap.commercial_product_user_journey_depth_v1.currentPhaseId, 'first_value_optimization');
  assert.equal(byGap.commercial_product_user_journey_depth_v1.evalResults.find((result) => result.id === 'commercial_product_journey_map').status, 'pass');
  assert.equal(byGap.commercial_product_user_journey_depth_v1.evalResults.find((result) => result.id === 'webui_medopl_product_owner_split').status, 'pass');
  assert.equal(byGap.commercial_product_user_journey_depth_v1.evalResults.find((result) => result.id === 'product_depth_implementation_open').status, 'blocked');
  assert.equal(byGap.runtime_execution_boundary.evalResults.find((result) => result.id === 'closed_summary_stable_contracts').status, 'pass');
  assert.equal(byGap.commercial_saas_depth.evalResults.find((result) => result.id === 'commercial_readonly_projection').status, 'pass');
  assert.equal(byGap.commercial_saas_depth.evalResults.find((result) => result.id === 'commercial_owner_receipt').status, 'pass');
  assert.equal(byGap.commercial_saas_depth.evalResults.find((result) => result.id === 'commercial_consumer_contract').status, 'blocked');
  assert.equal(
    byGap.commercial_saas_depth.evalResults.find((result) => result.id === 'commercial_consumer_contract').evidenceSource,
    'expansionConditions',
  );
  assert.equal(byGap.operations_maturity.evalResults.find((result) => result.id === 'observability_baseline').status, 'pass');
  assert.equal(byGap.operations_maturity.status, 'partial');
  assert.equal(byGap.operations_maturity.evalResults.find((result) => result.id === 'ops_owner_receipt').status, 'pass');
  assert.equal(byGap.operations_maturity.evalResults.find((result) => result.id === 'rollback_record_evidence').status, 'pass');
  assert.equal(byGap.operations_maturity.evalResults.find((result) => result.id === 'p0_launch_operations_contract').status, 'pass');
  assert.equal(byGap.operations_maturity.evalResults.find((result) => result.id === 'p1_commercial_operations_contract').status, 'pass');
  assert.equal(byGap.operations_maturity.evalResults.find((result) => result.id === 'p2_sla_operations_contract').status, 'pass');
  assert.equal(byGap.operations_maturity.evalResults.find((result) => result.id === 'launch_closeout_contract').status, 'pass');
  assert.equal(byGap.operations_maturity.evalResults.find((result) => result.id === 'p0_p1_operations_closeout_contract').status, 'pass');
  assert.equal(byGap.operations_maturity.evalResults.find((result) => result.id === 'p0_p1_operations_external_evidence').status, 'blocked');
  assert.equal(byGap.operations_maturity.evalResults.find((result) => result.id === 'final_release_decision_receipt').status, 'blocked');
  assert.equal(byGap.operations_maturity.evalResults.find((result) => result.id === 'production_ops_external_evidence').status, 'blocked');
  assert.equal(
    byGap.operations_maturity.evalResults.find((result) => result.id === 'ops_future_contract_placeholders').evidenceSource,
    'evidenceConditions',
  );
  assert.equal(byGap.ha_and_resilience.evalResults.find((result) => result.id === 'single_node_pause_policy').status, 'pass');
  assert.equal(byGap.ha_and_resilience.evalResults.find((result) => result.id === 'multi_node_ha_evidence').status, 'blocked');
  assert.equal(byGap.concurrency_and_load.status, 'done');
  assert.equal(byGap.concurrency_and_load.evalResults.find((result) => result.id === 'closed_summary_stable_contracts').status, 'pass');
  assert.equal(byGap.opl_auto_update_from_github.status, 'done');
  assert.equal(byGap.opl_auto_update_from_github.evalResults.find((result) => result.id === 'closed_summary_stable_contracts').status, 'pass');

  assert.equal(byGap.commercial_cross_repo_dynamic_current_truth_sync.status, 'done');
  assert.equal(byGap.commercial_cross_repo_dynamic_current_truth_sync.evalResults.find((result) => result.id === 'closed_summary_stable_contracts').status, 'pass');

  assert.equal(report.readyToAdvanceCount, 10);
  assert.deepEqual(report.summary, {
    done: 10,
    partial: 2,
    blocked: 2,
    not_started: 0,
  });
});

test('compacted closed gaps keep stable contract provenance without full phase queues', () => {
  const registry = readJson(registryPath);
  const compacted = [
    ['commercial_launch_ui_implementation', 'figma_dialog_sheet_projection_slice', ['contracts/web-product-profile.json#/uiSourceTruth', 'contracts/web-gui-product-contract.json#/figmaParityUiReplacementTarget']],
    ['commercial_launch_readiness_closeout', 'post_release_closeout', ['contracts/web-product-profile.json#/commercialLaunchReadiness', 'contracts/web-release-profile.json#/latestMainEvidence']],
    ['medopl_readonly_evidence', 'production_readonly_foldback', ['contracts/web-release-profile.json#/productionDogfoodReadiness']],
    ['commercial_runtime_admission_alignment_v1', 'production_e2e_rerun_after_alignment', ['contracts/web-runtime-bridge.json#/commercialRuntimeAdmission', 'contracts/web-release-profile.json#/productionBrowserE2EReadiness']],
    ['runtime_execution_boundary', 'execution_admission', ['contracts/web-runtime-bridge.json#/executionAdmission']],
    ['concurrency_and_load', 'production_concurrency_load_evidence', ['contracts/web-product-profile.json#/concurrencyAndLoad']],
    ['opl_auto_update_from_github', 'runtime_sync_admission', ['contracts/web-release-profile.json#/oplAutoUpdateReadiness']],
    ['commercial_cross_repo_dynamic_current_truth_sync', 'dynamic_current_truth_sync', ['contracts/web-commercial-consumer-contract.json#/commercialCrossRepoDynamicCurrentTruthSync', 'contracts/web-release-profile.json#/commercialCrossRepoDynamicCurrentTruthSync']],
  ];

  for (const [id, finalPhaseId, stableContracts] of compacted) {
    assertCompactedClosedGap(registry.gaps.find((gap) => gap.id === id), { id, finalPhaseId, stableContracts });
  }

  const active = registry.gaps.find((gap) => gap.id === 'commercial_saas_depth');
  const partial = registry.gaps.find((gap) => gap.id === 'operations_maturity');
  const paused = registry.gaps.find((gap) => gap.id === 'ha_and_resilience');
  assert.ok(active.phases.length > 0, 'active gaps keep full phases');
  assert.ok(partial.phases.length > 0, 'partial active gaps keep full phases');
  assert.ok(paused.phases.length > 0, 'paused gaps keep full phases');
});

test('commercial product maturity gap queue classifies reference-project maturity without copying ownership', () => {
  const registry = readJson(registryPath);
  const gap = registry.gaps.find((item) => item.id === 'commercial_product_maturity_gap_v1');
  const classification = gap?.maturityClassification ?? {};

  assert.equal(gap?.state, 'closed');
  assert.equal(gap?.ownerSurface, 'product-boundary');
  assert.equal(gap?.currentPhaseId, 'ops_diagnostics_and_troubleshooting');
  assert.equal(gap?.currentStatus, 'done');
  assert.deepEqual(gap?.phases.map((phase) => phase.id), [
    'maturity_gap_queue_registration',
    'webui_config_deploy_baseline',
    'release_security_ci_hardening',
    'ops_diagnostics_and_troubleshooting',
  ]);
  assert.equal(gap?.phases.find((phase) => phase.id === 'webui_config_deploy_baseline')?.status, 'done');
  assert.equal(gap?.phases.find((phase) => phase.id === 'release_security_ci_hardening')?.status, 'done');
  assert.equal(gap?.phases.find((phase) => phase.id === 'ops_diagnostics_and_troubleshooting')?.status, 'done');
  for (const path of [
    'deploy/README.md',
    'deploy/.env.example',
    'deploy/config.example.yaml',
    'deploy/docker-compose.local.yml',
    'deploy/docker-compose.standalone.yml',
    'deploy/docker-compose.prod.example.yml',
    'deploy/scripts/config-check.sh',
  ]) {
    assert.equal(existsSync(path), true, `missing deploy baseline surface: ${path}`);
  }
  assert.deepEqual(classification.mustHaveInOplWebui.map((item) => item.id), [
    'frontend_backend_boundary',
    'deploy_directory',
    'env_example',
    'config_example_yaml',
    'release_workflow_maturity',
    'backend_ci',
    'security_scan',
    'troubleshooting',
  ]);
  assert.deepEqual(classification.shouldHaveInOplWebui.map((item) => item.id), [
    'docker_compose_examples',
    'local_standalone_deploy_scripts',
    'admin_payment_projection_docs',
    'backup_migration_owner_split',
    'minimal_ops_diagnostics',
  ]);
  assert.deepEqual(classification.later.map((item) => item.id), ['setup_wizard']);
  assert.deepEqual(classification.medoplOwned.map((item) => item.id), [
    'migrations_canonical_business_runtime',
    'postgresql_redis_canonical_truth',
    'payment_docs',
    'runtime_resource_billing_storage',
  ]);
  assert.deepEqual(classification.onePersonLabOwned.map((item) => item.id), ['framework_execution_semantics']);
  assert.deepEqual(classification.explicitlyNotForOplWebui.map((item) => item.id), [
    'generic_product_installer',
    'production_mutation_installer',
    'complete_data_management_sidecar',
    'web_owned_runtime_storage_payment_artifact_truth',
  ]);
  assert.equal(gap?.dynamicRetirement.markDoneWhen, 'all current Webui-owned maturity phases are done or moved to owner-specific queues');
  assert.equal(gap?.dynamicRetirement.noLongTermOrdinaryUiBlocker, true);
  assert.ok(gap?.cannotClaim.includes('Web-owned runtime/storage/payment/artifact truth'));
  assert.ok(gap?.cannotClaim.includes('PostgreSQL/Redis canonical business truth'));
});

test('gap phase runner refuses advancement when a done status lacks required eval evidence', async () => {
  const runner = await import('../../scripts/gap-phase-runner.mjs');
  const registry = readJson(registryPath);
  const forgedRegistry = structuredClone(registry);
  const originalGui = readJson('contracts/web-gui-product-contract.json');
  const forgedGui = structuredClone(originalGui);
  const uiGap = forgedRegistry.gaps.find((gap) => gap.id === 'ui_ux_product_depth');
  uiGap.currentStatus = 'done';
  const productionClaim = uiGap.phases.find((phase) => phase.id === 'production_ui_quality_claim');
  productionClaim.ownerReceipt = {
    ...productionClaim.ownerReceipt,
    status: 'pending',
    acceptedClaim: null,
  };
  forgedGui.visualQualityGate.ownerReceipt.acceptedClaim = null;
  forgedGui.visualQualityGate.productionUiQualityClaim.status = 'pending_owner_receipt_and_production_evidence';
  forgedGui.visualQualityGate.productionUiQualityClaim.productionEvidence.status = 'pending';

  const report = runner.buildPhaseStatusReport(forgedRegistry, {
    gui: forgedGui,
    release: readJson('contracts/web-release-profile.json'),
    runtime: readJson('contracts/web-runtime-bridge.json'),
    product: readJson('contracts/web-product-profile.json'),
    registry: forgedRegistry,
  });
  const uiReport = report.gaps.find((gap) => gap.id === 'ui_ux_product_depth');

  assert.equal(uiReport.status, 'done');
  assert.equal(uiReport.readyToAdvance, false);
  assert.deepEqual(uiReport.readyToAdvanceBlockedBy, ['production_ui_evidence', 'owner_receipt']);
  assert.equal(report.goalComplete, false);
});

test('UI/UX production claim phase keeps owner receipt and raw artifacts out of inferred truth', () => {
  const registry = readJson(registryPath);
  const uiGap = registry.gaps.find((gap) => gap.id === 'ui_ux_product_depth');
  const productionClaim = uiGap.phases.find((phase) => phase.id === 'production_ui_quality_claim');

  assert.equal(uiGap.currentPhaseId, 'production_ui_quality_claim');
  assert.deepEqual(uiGap.phases.map((phase) => phase.id), ['production_ui_quality_claim']);
  assert.equal(uiGap.currentStatus, 'done');
  assert.equal(
    productionClaim.objective,
    'Claim UI/UX v1 production acceptance only after human owner receipt and sanitized production evidence exist, without claiming a complete design system.',
  );
  assert.deepEqual(productionClaim.entryCriteria, [
    'repo-local responsive visual QA evidence is folded into web GUI product contract',
    'Figma MCP source context remains pinned',
    'human owner accepted the current production v1 surface claim',
  ]);
  assert.equal(productionClaim.nextStepOpeners.every((item) => !item.includes('partial')), true);
  assert.deepEqual(productionClaim.exitCriteria, [
    'human owner receipt acceptedClaim=ui_ux_v1_production_accepted',
    'production browser e2e or production screenshot evidence is folded back as sanitized summary',
    'repo-local accessibility closeout boundary remains folded back without claiming assistive technology conformance',
    'complete design system remains explicitly not claimed',
  ]);
  assert.deepEqual(productionClaim.ownerReceipt, {
    required: true,
    source: 'human_owner_receipt',
    status: 'accepted',
    acceptedClaim: 'ui_ux_v1_production_accepted',
    acceptedAt: '2026-06-23',
    acceptedScope: 'current production UI/UX v1 product surface only',
    cannotBeInferredBy: ['repo_local_tests', 'browser_screenshots', 'production_e2e_without_human_receipt'],
  });
  assert.deepEqual(productionClaim.artifactLifecycle.longTermTruth, [
    'contracts/web-gui-product-contract.json',
    'contracts/web-gap-phase-registry.json',
    'contracts/web-product-profile.json',
    'registered tests',
    'docs/status.md',
    'docs/active/README.md',
  ]);
  assert.deepEqual(productionClaim.artifactLifecycle.temporaryArtifacts, [
    '.runtime/browser-visual/*',
    '.runtime/phase-runs/*',
    'production raw logs',
    'raw screenshots',
    'CI raw output',
  ]);
  assert.equal(productionClaim.artifactLifecycle.rawArtifactsInGit, false);
  assert.equal(productionClaim.artifactLifecycle.foldback, 'sanitized_summary_only');
  assert.deepEqual(productionClaim.designSystemBoundary, {
    claimed: 'ui_ux_v1_product_surface',
    notClaimed: 'complete_ui_ux_design_system',
  });
});

test('gap phase runner creates ignored runtime summaries and cleans stale phase artifacts', async () => {
  const runner = await import('../../scripts/gap-phase-runner.mjs');
  const root = join('.runtime', 'gap-phase-test-runs');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });

  const oldRun = join(root, '2026-01-01T00-00-00Z-old');
  const newRun = join(root, '2026-06-21T00-00-00Z-new');
  mkdirSync(oldRun, { recursive: true });
  mkdirSync(newRun, { recursive: true });
  writeFileSync(join(oldRun, 'summary.json'), JSON.stringify({ stale: true }));
  writeFileSync(join(newRun, 'summary.json'), JSON.stringify({ stale: false }));
  utimesSync(oldRun, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'));
  utimesSync(newRun, new Date('2026-06-21T00:00:00Z'), new Date('2026-06-21T00:00:00Z'));

  const cleanup = runner.cleanupPhaseRuns({
    root,
    nowMs: Date.parse('2026-06-21T00:00:00Z'),
    ttlDays: 7,
    maxRunDirectories: 20,
    maxRunBytes: 10 * 1024 * 1024,
  });

  assert.equal(existsSync(oldRun), false);
  assert.equal(existsSync(newRun), true);
  assert.ok(cleanup.deleted.includes(oldRun));
  assert.throws(() => runner.cleanupPhaseRuns({ root: 'docs', nowMs: Date.now() }), /refuses to clean outside \.runtime/);

  rmSync(root, { recursive: true, force: true });
});

test('gap phase system is wired as a registered health workflow surface', () => {
  const pkg = readJson('package.json');
  const inventory = readJson('contracts/web-surface-inventory.json');
  const surfacePaths = new Set(inventory.surfaces.map((surface) => surface.path));

  assert.equal(pkg.scripts['gap:phase'], 'node scripts/gap-phase-runner.mjs');
  assert.ok(surfacePaths.has(registryPath));
  assert.ok(surfacePaths.has('scripts/gap-phase-runner.mjs'));
  assert.ok(surfacePaths.has('tests/health/gap-phase-system.test.mjs'));
});
