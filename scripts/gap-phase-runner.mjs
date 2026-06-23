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
    gaps
      .filter((gap) => gap.status !== 'done')
      .flatMap((gap) => gap.cannotClaim),
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
        && admission.requiredBeforeAnyExecution.includes('Go-side runtime execution contract')
        && admission.requiredBeforeAnyExecution.includes('registered eval covering command allowlist')
        ? 'pass'
        : 'fail',
      proves: ['runtime execution admission prerequisites are explicit'],
      doesNotProve: ['the prerequisites exist', 'Web may execute runtime commands'],
    }),
    evalResult({
      id: 'runtime_owner_receipt',
      dimension: 'owner',
      status: admission?.ownerReceipt?.acceptedClaim ? 'pass' : 'blocked',
      proves: ['runtime owner accepted a real execution consumer and command class when present'],
      doesNotProve: ['allowlist implementation', 'runtime eval pass', 'artifact body authority'],
    }),
    evalResult({
      id: 'runtime_allowlist_eval',
      dimension: 'repo_local',
      status: conditionStatus('registered_allowlist_eval') === 'pass'
        && conditionStatus('command_allowlist') === 'present'
        ? 'pass'
        : 'blocked',
      evidenceSource: 'conditions',
      proves: ['command allowlist and authorization eval passed when admitted'],
      doesNotProve: ['production runtime execution', 'domain-agent quality'],
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
      status: ['dashboard', 'alerting', 'error_budget', 'rollback_record'].every((id) =>
        contracts.some((contract) => contract.id === id && contract.state === 'contract_required'))
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
      proves: ['operations owner selected and accepted the next operations surface when present'],
      doesNotProve: ['production rollback record', 'automatic rollback', 'long-term operations maturity'],
    }),
    evalResult({
      id: 'rollback_record_evidence',
      dimension: 'production',
      status: release?.productionRollbackReadiness?.latestAttempt ? 'pass' : 'blocked',
      proves: ['production rollback record exists when present'],
      doesNotProve: ['automatic rollback', 'data migration rollback', 'multi-node HA'],
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
