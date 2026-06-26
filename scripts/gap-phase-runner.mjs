#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const registryPath = 'contracts/web-gap-phase-registry.json';
const defaultRuntimeRoot = '.runtime/phase-runs';

export function buildPhaseStatusReport(registry, context = readEvalContext()) {
  const gaps = registry.gaps.map((gap) => {
    const currentPhase = gap.phases.find((phase) => phase.id === gap.currentPhaseId);
    const status = gap.currentStatus ?? statusFromPhase(currentPhase);
    const evalResults = evaluateGap(gap, currentPhase, context);
    const readyToAdvanceBlockedBy = evalResults
      .filter((result) => result.status !== 'pass')
      .map((result) => result.id);
    const readyToAdvance = status === 'done' && readyToAdvanceBlockedBy.length === 0;
    return {
      id: gap.id,
      ownerSurface: gap.ownerSurface,
      currentPhaseId: gap.currentPhaseId,
      status,
      currentStep: {
        id: currentPhase?.id ?? null,
        objective: currentPhase?.objective ?? 'No current phase is registered.',
      },
      acceptance: currentPhase?.acceptance ?? [],
      nextStepOpeners: currentPhase?.nextStepOpeners ?? [],
      ownerReceipt: currentPhase?.ownerReceipt ?? { required: false },
      readyToAdvance,
      readyToAdvanceBlockedBy,
      cannotClaim: gap.cannotClaim,
      blockers: status === 'blocked' ? currentPhase?.blockerTypes ?? [] : [],
      requiredEvals: currentPhase?.requiredEvals.map((evalRef) => evalRef.id) ?? [],
      evidenceSources: currentPhase?.evidenceSources ?? [],
      evalResults,
    };
  });
  const blockedClaims = uniqueStrings(
    registry.gaps
      .filter((gap) => gap.durableCannotClaim === true)
      .flatMap((gap) => gap.cannotClaim)
      .concat(gaps
      .filter((gap) => gap.status !== 'done')
      .flatMap((gap) => gap.cannotClaim)),
  );
  const summary = {
    done: gaps.filter((gap) => gap.status === 'done').length,
    partial: gaps.filter((gap) => gap.status === 'partial').length,
    blocked: gaps.filter((gap) => gap.status === 'blocked').length,
    not_started: gaps.filter((gap) => gap.status === 'not_started').length,
  };

  return {
    productId: registry.productId,
    generatedAt: new Date().toISOString(),
    goalComplete: gaps.every((gap) => gap.status === 'done'),
    readyToAdvanceCount: gaps.filter((gap) => gap.readyToAdvance).length,
    summary,
    runtimeArtifactPolicy: registry.runtimeArtifactPolicy,
    gaps,
    blockedClaims,
  };
}

export function cleanupPhaseRuns({
  root = defaultRuntimeRoot,
  nowMs = Date.now(),
  ttlDays = 7,
  maxRunDirectories = 20,
  maxRunBytes = 10 * 1024 * 1024,
} = {}) {
  assertRuntimeRoot(root);
  if (!existsSync(root)) {
    return { root, deleted: [], kept: [], totalBytes: 0 };
  }

  const runs = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const path = join(root, entry.name);
      const stats = statSync(path);
      return {
        path,
        mtimeMs: stats.mtimeMs,
        bytes: directoryBytes(path),
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  const deleted = [];
  let totalBytes = runs.reduce((sum, run) => sum + run.bytes, 0);

  for (const [index, run] of runs.entries()) {
    const isExpired = nowMs - run.mtimeMs > ttlMs;
    const exceedsCount = index >= maxRunDirectories;
    const exceedsBytes = totalBytes > maxRunBytes;
    if (!isExpired && !exceedsCount && !exceedsBytes) continue;
    rmSync(run.path, { recursive: true, force: true });
    deleted.push(run.path);
    totalBytes -= run.bytes;
  }

  const kept = runs.map((run) => run.path).filter((path) => !deleted.includes(path));
  return { root, deleted, kept, totalBytes };
}

export function writePhaseRunSummary({
  registry,
  root = defaultRuntimeRoot,
  runId = safeTimestamp(new Date()),
} = {}) {
  assertRuntimeRoot(root);
  const report = buildPhaseStatusReport(registry);
  const runDir = join(root, runId);
  mkdirSync(runDir, { recursive: true });
  const summaryPath = join(runDir, 'summary.json');
  writeFileSync(summaryPath, `${JSON.stringify(report, null, 2)}\n`);
  return { runDir, summaryPath, report };
}

function statusFromPhase(phase) {
  if (!phase) return 'not_started';
  if (phase.evidenceSources.includes('production_secret_gated')) return 'blocked';
  return 'partial';
}

function readRegistry() {
  return JSON.parse(readFileSync(registryPath, 'utf8'));
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readEvalContext() {
  return {
    gui: readJsonIfExists('contracts/web-gui-product-contract.json'),
    release: readJsonIfExists('contracts/web-release-profile.json'),
    runtime: readJsonIfExists('contracts/web-runtime-bridge.json'),
    product: readJsonIfExists('contracts/web-product-profile.json'),
    registry: readJsonIfExists(registryPath),
  };
}

function evaluateGap(gap, phase, context) {
  const common = [
    evalResult({
      id: 'phase_contract',
      dimension: 'contract',
      status: phase?.requiredEvals?.length > 0 ? 'pass' : 'fail',
      proves: ['current phase declares required eval contracts'],
      doesNotProve: ['external owner receipt', 'production evidence', 'runtime execution readiness'],
    }),
    evalResult({
      id: 'temporary_artifact_cleanup',
      dimension: 'cleanup',
      status: context.registry?.runtimeArtifactPolicy?.gitTracked === false
        && context.registry?.runtimeArtifactPolicy?.cleanupCommand === 'node scripts/gap-phase-runner.mjs cleanup'
        ? 'pass'
        : 'fail',
      proves: ['gap phase artifacts are temporary and cleanable'],
      doesNotProve: ['gap acceptance', 'production readiness', 'owner acceptance'],
    }),
  ];

  const specific = {
    ui_ux_product_depth: evaluateUiUxGap(context),
    medopl_readonly_evidence: evaluateMedoplReadonlyGap(context),
    runtime_execution_boundary: evaluateRuntimeGap(context),
    commercial_saas_depth: evaluateCommercialGap(context),
    operations_maturity: evaluateOperationsGap(context),
    ha_and_resilience: evaluateHaGap(context),
    concurrency_and_load: evaluateConcurrencyGap(context),
    opl_auto_update_from_github: evaluateOplAutoUpdateGap(context),
  }[gap.id] ?? [];

  return [...common, ...specific];
}

function evaluateUiUxGap({ gui }) {
  const quality = gui?.visualQualityGate;
  const productionClaim = quality?.productionUiQualityClaim;
  const sourceFiles = gui?.figmaSource?.requiredSourceFiles ?? [];
  return [
    evalResult({
      id: 'figma_source_context',
      dimension: 'repo_local',
      status: gui?.figmaSource?.fileKey && gui?.figmaSource?.nodeId && sourceFiles.includes('src/app/App.tsx')
        ? 'pass'
        : 'fail',
      proves: ['Figma MCP source context is pinned in GUI contract'],
      doesNotProve: ['production UI acceptance', 'complete UI/UX design system', 'assistive technology conformance'],
    }),
    evalResult({
      id: 'repo_local_visual_evidence',
      dimension: 'repo_local',
      status: quality?.baselineEvidence?.command === 'npm run verify:browser'
        && quality?.responsiveVisualQaEvidence?.checks?.includes('contrastPass')
        ? 'pass'
        : 'fail',
      proves: ['repo-local browser visual and accessibility boundary checks are registered'],
      doesNotProve: ['production visual polish complete', 'owner accepted UI', 'full accessibility'],
    }),
    evalResult({
      id: 'production_ui_evidence',
      dimension: 'production',
      status: productionClaim?.productionEvidence?.status === 'done' ? 'pass' : 'blocked',
      proves: ['production UI evidence has been folded back when present'],
      doesNotProve: ['owner acceptance', 'complete design system', 'runtime behavior'],
    }),
    evalResult({
      id: 'owner_receipt',
      dimension: 'owner',
      status: productionClaim?.status === 'accepted'
        || quality?.ownerReceipt?.acceptedClaim === 'ui_ux_v1_production_accepted'
        ? 'pass'
        : 'blocked',
      proves: ['human owner accepted the UI/UX production claim when present'],
      doesNotProve: ['production evidence', 'complete UI/UX design system', 'assistive technology conformance'],
    }),
  ];
}

function evaluateMedoplReadonlyGap({ release }) {
  const dogfood = release?.productionDogfoodReadiness;
  return [
    evalResult({
      id: 'readonly_foldback_policy',
      dimension: 'contract',
      status: dogfood?.readonlyFoldbackPolicy?.requiredEvidence?.includes('OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1')
        && dogfood?.readonlyFoldbackPolicy?.forbidRawLogs === true
        ? 'pass'
        : 'fail',
      proves: ['MedOPL readonly foldback requires explicit production evidence and sanitized storage'],
      doesNotProve: ['readonly production dogfood executed', 'runtime execution', 'billing source of truth'],
    }),
    evalResult({
      id: 'readonly_production_foldback',
      dimension: 'production',
      status: dogfood?.latestSuccessfulRun?.medoplReadonly === true
        && dogfood?.latestSuccessfulRun?.publicMetadataConfirmsReadonlySwitch === true
        ? 'pass'
        : 'blocked',
      proves: ['secret-gated readonly projection dogfood evidence is folded back when present'],
      doesNotProve: ['MedOPL runtime execution', 'payment readiness', 'long-term production stability'],
    }),
    evalResult({
      id: 'readonly_raw_artifact_policy',
      dimension: 'cleanup',
      status: dogfood?.latestSuccessfulRun?.rawLogPolicy?.storesRawLogs === false
        && dogfood?.latestSuccessfulRun?.rawLogPolicy?.storesSecretValues === false
        ? 'pass'
        : 'fail',
      proves: ['readonly foldback does not store raw logs or secrets in active truth'],
      doesNotProve: ['production readonly switch was enabled', 'runtime execution correctness'],
    }),
  ];
}

function evaluateRuntimeGap({ runtime }) {
  const admission = runtime?.executionAdmission;
  const conditions = admission?.conditions ?? [];
  const conditionStatus = (id) => conditions.find((condition) => condition.id === id)?.status ?? 'missing';
  const commandPolicy = admission?.webRuntimeCommandPolicy ?? {};
  const bridgeBoundaryAccepted = Array.isArray(commandPolicy.allowedCommands)
    && commandPolicy.allowedCommands.length === 0
    && commandPolicy.productAccessPolicy === false
    && admission?.ownerReceipt?.acceptedClaim === 'medopl_runtime_gate_run_bridge_local_refs_only_accepted';
  return [
    evalResult({
      id: 'runtime_fail_closed',
      dimension: 'repo_local',
      status: runtime?.webuiRuntimeExecution === 'forbidden'
        && admission?.currentStatus === 'not_admitted'
        ? 'pass'
        : 'fail',
      proves: ['Web runtime mutation remains fail-closed'],
      doesNotProve: ['runtime execution readiness', 'artifact body authority', 'MedOPL runtime behavior'],
    }),
    evalResult({
      id: 'runtime_admission_contract',
      dimension: 'contract',
      status: Array.isArray(admission?.requiredBeforeAnyExecution)
        && admission.requiredBeforeAnyExecution.includes('production MedOPL runtime execution evidence')
        && admission.requiredBeforeAnyExecution.includes('registered bridge eval')
        ? 'pass'
        : 'fail',
      proves: ['runtime bridge admission and production execution prerequisites are explicit'],
      doesNotProve: ['the prerequisites exist', 'Web may execute runtime commands'],
    }),
    evalResult({
      id: 'runtime_owner_receipt',
      dimension: 'owner',
      status: bridgeBoundaryAccepted ? 'pass' : 'blocked',
      proves: ['runtime owner accepted the local MedOPL gate/run refs-only boundary when present'],
      doesNotProve: ['runtime execution readiness', 'non-empty Web runtime command policy', 'artifact body authority'],
    }),
    evalResult({
      id: 'runtime_command_policy_eval',
      dimension: 'repo_local',
      status: bridgeBoundaryAccepted
        && conditionStatus('registered_bridge_eval') === 'pass'
        && conditionStatus('web_runtime_command_policy') === 'present'
        ? 'pass'
        : 'blocked',
      evidenceSource: 'conditions',
      proves: ['empty Web runtime command policy is the accepted fail-closed mutation boundary and not product access policy'],
      doesNotProve: ['production runtime execution', 'domain-agent quality', 'non-empty Web runtime command policy'],
    }),
  ];
}

function evaluateCommercialGap({ product }) {
  const lifecycle = product?.commercialLifecycle;
  const conditions = lifecycle?.expansionConditions ?? [];
  const conditionStatus = (id) => conditions.find((condition) => condition.id === id)?.status ?? 'missing';
  return [
    evalResult({
      id: 'commercial_readonly_projection',
      dimension: 'repo_local',
      status: lifecycle?.mode === 'authenticated_readonly_personal_status_projection'
        && lifecycle?.projectionOnly === true
        ? 'pass'
        : 'fail',
      proves: ['commercial lifecycle remains readonly personal projection'],
      doesNotProve: ['team invite readiness', 'billing source of truth', 'payment readiness'],
    }),
    evalResult({
      id: 'commercial_forbidden_expansions',
      dimension: 'contract',
      status: lifecycle?.forbiddenExpansions?.includes('payment_mutation')
        && lifecycle?.forbiddenExpansions?.includes('billing_source_of_truth')
        ? 'pass'
        : 'fail',
      proves: ['commercial expansions stay blocked without real consumer and tests'],
      doesNotProve: ['real buyer workflow exists', 'subscription readiness', 'RBAC readiness'],
    }),
    evalResult({
      id: 'commercial_owner_receipt',
      dimension: 'owner',
      status: lifecycle?.ownerReceipt?.acceptedClaim ? 'pass' : 'blocked',
      proves: ['external owner accepted a real commercial consumer when present'],
      doesNotProve: ['payment implementation', 'billing authority', 'team lifecycle'],
    }),
    evalResult({
      id: 'commercial_consumer_contract',
      dimension: 'contract',
      status: conditionStatus('real_consumer') === 'present'
        && conditionStatus('surface_contract') === 'present'
        && conditionStatus('registered_tests') === 'pass'
        && conditionStatus('medopl_billing_authority_preserved') === 'present'
        ? 'pass'
        : 'blocked',
      evidenceSource: 'expansionConditions',
      proves: ['commercial consumer contract exists when unblocked'],
      doesNotProve: ['production payment evidence', 'pricing correctness'],
    }),
  ];
}

function evaluateOperationsGap({ release }) {
  const baseline = release?.productionObservabilityBaseline;
  const contracts = baseline?.nextReadiness?.evidenceContracts ?? [];
  const conditions = baseline?.nextReadiness?.evidenceConditions ?? [];
  const conditionStatus = (id) => conditions.find((condition) => condition.id === id)?.status ?? 'missing';
  const rollbackRecord = baseline?.nextReadiness?.rollbackRecordV1;
  const readinessLevel = (id) => baseline?.productionReadinessLevels?.find((level) => level.id === id);
  const gate = (id) => baseline?.productionReadinessGates?.[id];
  const closeout = release?.productionLaunchCloseout;
  const closeoutDecision = closeout?.latestDecision;
  const opsCloseout = release?.productionOperationsCloseout;
  const opsEvidence = opsCloseout?.latestEvidence;
  return [
    evalResult({
      id: 'observability_baseline',
      dimension: 'production',
      status: baseline?.latestSuccessfulRun?.runId && baseline?.nextReadiness?.scheduledCanary?.latestSuccessfulRun?.runId
        ? 'pass'
        : 'blocked',
      proves: ['observability baseline and scheduled canary first success are folded back'],
      doesNotProve: ['dashboard', 'alerting', 'error budget enforcement', 'automatic rollback'],
    }),
    evalResult({
      id: 'ops_future_contract_placeholders',
      dimension: 'contract',
      status: ['dashboard', 'alerting', 'error_budget'].every((id) =>
        contracts.some((contract) => contract.id === id && contract.state === 'contract_required'))
        && contracts.some((contract) => contract.id === 'rollback_record' && contract.state === 'contract_present')
        && ['dashboard_contract', 'alerting_contract', 'error_budget_contract', 'rollback_record_contract'].every((id) =>
          conditionStatus(id) === 'missing' || conditionStatus(id) === 'present')
        ? 'pass'
        : 'fail',
      evidenceSource: 'evidenceConditions',
      proves: ['future operations surfaces require explicit contracts before claims'],
      doesNotProve: ['dashboard exists', 'alerting exists', 'error budget is enforced', 'automatic rollback exists'],
    }),
    evalResult({
      id: 'ops_owner_receipt',
      dimension: 'owner',
      status: baseline?.ownerReceipt?.acceptedClaim ? 'pass' : 'blocked',
      proves: ['operations owner accepted the v1 baseline plus rollback-record contract boundary when present'],
      doesNotProve: ['production rollback executed', 'automatic rollback', 'long-term operations maturity'],
    }),
    evalResult({
      id: 'rollback_record_evidence',
      dimension: 'production',
      status: rollbackRecord?.state === 'contract_present_pending_first_production_run'
        && rollbackRecord?.rawLogPolicy?.storesRawLogs === false
        && release?.productionRollbackReadiness?.recordContract?.state === 'present'
        ? 'pass'
        : 'blocked',
      proves: ['rollback record contract exists without raw logs or secret values'],
      doesNotProve: ['production rollback executed', 'automatic rollback', 'data migration rollback', 'multi-node HA'],
    }),
    evalResult({
      id: 'p0_launch_operations_contract',
      dimension: 'contract',
      status: readinessLevel('p0_launch_operations')?.gates?.includes('rollback_path')
        && readinessLevel('p0_launch_operations')?.gates?.includes('alerting_boundary')
        && readinessLevel('p0_launch_operations')?.gates?.includes('db_backup_restore_strategy')
        && gate('alertingBoundary')?.state === 'contract_present_pending_alert_route'
        && gate('dbBackupRestore')?.state === 'contract_present_pending_restore_drill'
        && gate('securityOpsBaseline')?.state === 'contract_present'
        && gate('incidentRunbookOwner')?.state === 'contract_present'
        && gate('costQuotaGuard')?.state === 'contract_present'
        ? 'pass'
        : 'fail',
      proves: ['P0 launch operations gates are explicit without claiming external production evidence'],
      doesNotProve: ['production rollback executed', 'external alert routing exists', 'production DB restore drill executed'],
    }),
    evalResult({
      id: 'p1_commercial_operations_contract',
      dimension: 'contract',
      status: readinessLevel('p1_commercial_operations')?.gates?.includes('staging_or_production_concurrency_evidence')
        && readinessLevel('p1_commercial_operations')?.gates?.includes('upstream_backpressure_boundary')
        && readinessLevel('p1_commercial_operations')?.gates?.includes('migration_schema_compatibility_policy')
        && readinessLevel('p1_commercial_operations')?.gates?.includes('observability_dashboard_entry')
        && gate('concurrencyEvidence')?.state === 'staging_safe_baseline_present_production_claim_pending'
        && gate('upstreamBackpressure')?.state === 'repo_local_timeout_fail_closed_pending_production_sla'
        && gate('migrationSchemaCompatibility')?.state === 'contract_present_pending_migration_drill'
        && gate('observabilityDashboard')?.state === 'contract_present_pending_dashboard_url'
        ? 'pass'
        : 'fail',
      proves: ['P1 commercial operations gates are explicit and keep production scale claims pending'],
      doesNotProve: ['production concurrent SaaS readiness', 'production migration drill executed', 'external dashboard exists'],
    }),
    evalResult({
      id: 'p2_sla_operations_contract',
      dimension: 'contract',
      status: readinessLevel('p2_sla_operations')?.gates?.includes('ha_topology_evidence')
        && readinessLevel('p2_sla_operations')?.gates?.includes('slo_error_budget_contract')
        && readinessLevel('p2_sla_operations')?.gates?.includes('automatic_rollback_admission_policy')
        && gate('haTopologyEvidence')?.state === 'paused_pending_second_node'
        && gate('sloErrorBudget')?.state === 'contract_required_pending_owner_receipt'
        && gate('automaticRollbackAdmission')?.state === 'not_admitted_manual_only'
        ? 'pass'
        : 'fail',
      proves: ['P2 SLA and HA gates are explicit while HA and automatic rollback remain unclaimed'],
      doesNotProve: ['multi-node HA', 'error budget enforcement', 'automatic rollback readiness'],
    }),
    evalResult({
      id: 'launch_closeout_contract',
      dimension: 'contract',
      status: Array.isArray(closeout?.requiredEvidence)
        && ['soak', 'load', 'rollback', 'canary', 'alerting', 'dbRestore', 'monitoring', 'ha', 'slo'].every((id) => closeout.requiredEvidence.includes(id))
        && closeout?.rawLogPolicy?.storesRawLogs === false
        && closeout?.rawLogPolicy?.storesSecretValues === false
        ? 'pass'
        : 'fail',
      proves: ['final release decision receipt requires soak, load, rollback, canary, alerting, restore, monitoring, HA, and SLO evidence'],
      doesNotProve: ['the final release decision exists', 'external evidence executed', 'production-ready SaaS'],
    }),
    evalResult({
      id: 'p0_p1_operations_closeout_contract',
      dimension: 'contract',
      status: Array.isArray(opsCloseout?.requiredEvidence)
        && ['p0.rollback', 'p0.alerting', 'p0.dbRestore', 'p0.monitoring', 'p1.soak', 'p1.load', 'p1.dbPool', 'p1.upstreamBackpressure', 'p1.migrationCompatibility'].every((id) => opsCloseout.requiredEvidence.includes(id))
        && opsCloseout?.rawLogPolicy?.storesRawLogs === false
        && opsCloseout?.rawLogPolicy?.storesSecretValues === false
        ? 'pass'
        : 'fail',
      proves: ['P0/P1 single-node operations closeout contract is explicit'],
      doesNotProve: ['P0/P1 evidence executed', 'multi-node HA', 'automatic rollback'],
    }),
    evalResult({
      id: 'p0_p1_operations_external_evidence',
      dimension: 'production',
      status: opsEvidence?.status === 'accepted'
        && Array.isArray(opsEvidence?.missingEvidence)
        && opsEvidence.missingEvidence.length === 0
        && opsEvidence?.rawLogPolicy?.storesRawLogs === false
        && opsEvidence?.rawLogPolicy?.storesSecretValues === false
        ? 'pass'
        : 'blocked',
      proves: ['P0/P1 single-node operations evidence exists when folded back'],
      doesNotProve: ['multi-node HA', 'automatic rollback', 'complete commercial SaaS lifecycle'],
    }),
    evalResult({
      id: 'final_release_decision_receipt',
      dimension: 'owner',
      status: closeoutDecision?.decision === 'go'
        && closeoutDecision?.rawLogPolicy?.storesRawLogs === false
        && closeoutDecision?.rawLogPolicy?.storesSecretValues === false
        && Array.isArray(closeoutDecision?.missingEvidence)
        && closeoutDecision.missingEvidence.length === 0
        ? 'pass'
        : 'blocked',
      proves: ['final release owner accepted the explicit release decision when present'],
      doesNotProve: ['complete commercial SaaS lifecycle', 'billing source of truth', 'OPL runtime execution'],
    }),
    evalResult({
      id: 'production_ops_external_evidence',
      dimension: 'production',
      status: gate('rollbackPath')?.state === 'production_rollback_record_folded_back'
        && gate('dbBackupRestore')?.state === 'restore_drill_folded_back'
        && gate('observabilityDashboard')?.state === 'dashboard_url_folded_back'
        && gate('haTopologyEvidence')?.state === 'multi_node_ha_folded_back'
        ? 'pass'
        : 'blocked',
      proves: ['external production operations evidence exists when folded back'],
      doesNotProve: ['repo-local contract readiness', 'billing source of truth', 'OPL runtime execution'],
    }),
  ];
}

function evaluateHaGap({ release }) {
  const ha = release?.productionHAReadiness;
  const requiredEvidence = ha?.requiredEvidence ?? [];
  return [
    evalResult({
      id: 'single_node_pause_policy',
      dimension: 'repo_local',
      status: ha?.state === 'paused_single_pod_launch_pending_second_node'
        && ha?.currentApplyManifest?.replicas === 1
        && ha?.currentApplyManifest?.haPaused === true
        ? 'pass'
        : 'fail',
      proves: ['current production deployment shape is explicitly single-node launch-safe while HA is paused'],
      doesNotProve: ['multi-node HA', 'zero-downtime rollout', 'CLB two-backend health'],
    }),
    evalResult({
      id: 'ha_required_evidence_contract',
      dimension: 'contract',
      status: ['replicas_2', 'two_ready_pods', 'distinct_nodes', 'ingress_backend_at_least_2'].every((id) =>
        requiredEvidence.includes(id))
        ? 'pass'
        : 'fail',
      proves: ['future HA evidence requirements are explicit'],
      doesNotProve: ['the production cluster has multiple schedulable nodes', 'production HA was executed'],
    }),
    evalResult({
      id: 'multi_node_ha_evidence',
      dimension: 'production',
      status: ha?.latestSuccessfulRun?.twoReadyPods === true
        && ha?.latestSuccessfulRun?.distinctNodes === true
        && ha?.latestSuccessfulRun?.ingressBackendsHealthy >= 2
        ? 'pass'
        : 'blocked',
      proves: ['multi-node HA production evidence exists when folded back'],
      doesNotProve: ['database HA', 'runtime execution resilience', 'payment readiness'],
    }),
  ];
}

function evaluateConcurrencyGap({ product }) {
  const concurrency = product?.concurrencyAndLoad;
  const conditions = concurrency?.evidenceConditions ?? [];
  const conditionStatus = (id) => conditions.find((condition) => condition.id === id)?.status ?? 'missing';
  return [
    evalResult({
      id: 'local_tenant_isolation_contract',
      dimension: 'repo_local',
      status: conditionStatus('local_tenant_isolation_contract') === 'present'
        && conditionStatus('postgres_store_path') === 'present'
        ? 'pass'
        : 'fail',
      proves: ['local tenant isolation and Postgres-backed store path evidence exist'],
      doesNotProve: ['production concurrent SaaS readiness', 'load-tested multi-user chat'],
    }),
    evalResult({
      id: 'load_boundary_contract',
      dimension: 'contract',
      status: concurrency?.mode === 'staging_safe_10_user_baseline_no_production_load_claim'
        && concurrency?.productionEvidence?.status === 'not_claimed'
        && concurrency?.requiredBeforeProductionClaim?.includes('production_or_staging_concurrent_register_login_chat_api_key_quota_test')
        ? 'pass'
        : 'fail',
      proves: ['staging-safe local proof and production load proof are separated by contract'],
      doesNotProve: ['production throughput', 'database pool sizing', 'slow upstream backpressure readiness'],
    }),
    evalResult({
      id: 'production_load_evidence',
      dimension: 'production',
      status: conditionStatus('staging_10_user_baseline') === 'pass'
        && conditionStatus('database_pool_sizing') === 'present'
        && conditionStatus('slow_upstream_backpressure') === 'pass'
        ? 'pass'
        : 'blocked',
      evidenceSource: 'evidenceConditions',
      proves: ['staging-safe 10-user concurrency baseline exists when present'],
      doesNotProve: ['production concurrent SaaS readiness', 'multi-node HA', 'payment lifecycle', 'runtime execution'],
    }),
  ];
}

function evaluateOplAutoUpdateGap({ release }) {
  const readiness = release?.oplAutoUpdateReadiness;
  const conditions = readiness?.evidenceConditions ?? [];
  const conditionStatus = (id) => conditions.find((condition) => condition.id === id)?.status ?? 'missing';
  return [
    evalResult({
      id: 'image_build_pinned_opl_context',
      dimension: 'repo_local',
      status: readiness?.mode === 'build_time_pinned_opl_context'
        && conditionStatus('image_build_pinned_opl_context') === 'present'
        ? 'pass'
        : 'fail',
      proves: ['OPL CLI/framework context is pinned into immutable Web image builds'],
      doesNotProve: ['runtime continuous GitHub sync', 'background updater parity with one-person-lab-app'],
    }),
    evalResult({
      id: 'runtime_sync_forbidden_mechanisms',
      dimension: 'contract',
      status: ['not_implemented', 'forbidden_by_current_policy'].includes(readiness?.runtimeGithubSync)
        && readiness?.forbiddenRuntimeMechanisms?.includes('git_pull_inside_pod')
        && readiness?.forbiddenRuntimeMechanisms?.includes('unverified_github_head_sync')
        ? 'pass'
        : 'fail',
      proves: ['runtime sync mechanisms remain forbidden without admission evidence'],
      doesNotProve: ['self-healing OPL framework updates', 'runtime update rollback'],
    }),
    evalResult({
      id: 'runtime_github_sync_loop',
      dimension: 'owner',
      status: conditionStatus('runtime_github_sync_loop') === 'forbidden_by_policy'
        && conditionStatus('owner_update_policy') === 'accepted'
        && conditionStatus('runtime_sync_rollback_plan') === 'not_required_for_build_time_pinned_policy'
        ? 'pass'
        : 'blocked',
      evidenceSource: 'evidenceConditions',
      proves: ['owner accepted build-time pinned update policy and runtime sync remains forbidden'],
      doesNotProve: ['runtime continuous GitHub sync', 'domain-agent correctness', 'tenant data migration safety'],
    }),
  ];
}

function evalResult({ id, dimension, status, proves, doesNotProve, evidenceSource }) {
  return {
    id,
    dimension,
    status,
    ...(evidenceSource ? { evidenceSource } : {}),
    proves,
    doesNotProve,
  };
}

function assertRuntimeRoot(root) {
  const normalized = relative('.', root);
  if (normalized === '..' || normalized.startsWith(`..${pathSeparator()}`) || normalized === '') {
    throw new Error('gap phase runner refuses to clean outside .runtime');
  }
  if (!normalized.startsWith('.runtime')) {
    throw new Error('gap phase runner refuses to clean outside .runtime');
  }
}

function pathSeparator() {
  return process.platform === 'win32' ? '\\' : '/';
}

function directoryBytes(path) {
  let total = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      total += directoryBytes(child);
    } else if (entry.isFile()) {
      total += statSync(child).size;
    }
  }
  return total;
}

function safeTimestamp(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function runCli() {
  const command = process.argv[2] ?? 'status';
  const registry = readRegistry();
  const policy = registry.runtimeArtifactPolicy;
  if (command === 'cleanup') {
    const result = cleanupPhaseRuns({
      root: policy.directory,
      ttlDays: policy.ttlDays,
      maxRunDirectories: policy.maxRunDirectories,
      maxRunBytes: policy.maxRunBytes,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'write') {
    const result = writePhaseRunSummary({ registry, root: policy.directory });
    console.log(JSON.stringify({
      summaryPath: result.summaryPath,
      goalComplete: result.report.goalComplete,
      blockedClaims: result.report.blockedClaims,
    }, null, 2));
    return;
  }
  if (command !== 'status') {
    throw new Error(`Unsupported gap phase command: ${command}`);
  }
  console.log(JSON.stringify(buildPhaseStatusReport(registry), null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
