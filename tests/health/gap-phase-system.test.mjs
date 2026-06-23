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
    'medopl_readonly_evidence',
    'runtime_execution_boundary',
    'commercial_saas_depth',
    'operations_maturity',
  ]);

  for (const gap of registry.gaps) {
    assert.equal(typeof gap.ownerSurface, 'string', `${gap.id} must declare ownerSurface`);
    assert.ok(gap.ownerSurface.length > 0, `${gap.id} ownerSurface must be non-empty`);
    assert.ok(['active', 'paused'].includes(gap.state), `${gap.id} must declare supported state`);
    assert.ok(gap.phases.length > 0, `${gap.id} must declare phases`);
    assert.ok(gap.phases.some((phase) => phase.id === gap.currentPhaseId), `${gap.id} current phase must exist`);
    assert.ok(Array.isArray(gap.cannotClaim) && gap.cannotClaim.length > 0, `${gap.id} must declare cannotClaim`);

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
  assert.ok(report.gaps.some((gap) => gap.status === 'partial'));
  assert.ok(report.blockedClaims.includes('production MedOPL readonly projection dogfood'));
  assert.ok(report.blockedClaims.includes('OPL runtime execution from Web'));
  assert.ok(report.blockedClaims.includes('complete commercial SaaS lifecycle'));
  assert.equal(report.blockedClaims.includes('complete UI/UX design system'), false);
  for (const gap of report.gaps) {
    assert.equal(typeof gap.currentStep.objective, 'string', `${gap.id} must report current step objective`);
    assert.ok(gap.acceptance.length > 0, `${gap.id} must report acceptance gates`);
    assert.ok(gap.nextStepOpeners.length > 0, `${gap.id} must report next-step openers`);
    assert.equal(gap.readyToAdvance, gap.id === 'ui_ux_product_depth');
  }
});

test('gap phase runner evaluates each gap across repo, production, owner, contract, and cleanup dimensions', async () => {
  const runner = await import('../../scripts/gap-phase-runner.mjs');
  const registry = readJson(registryPath);
  const report = runner.buildPhaseStatusReport(registry);
  const byGap = Object.fromEntries(report.gaps.map((gap) => [gap.id, gap]));

  for (const gap of report.gaps) {
    assert.ok(Array.isArray(gap.evalResults), `${gap.id} must report machine eval results`);
    assert.ok(gap.evalResults.length >= 5, `${gap.id} must evaluate multiple dimensions`);
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
  assert.equal(byGap.medopl_readonly_evidence.evalResults.find((result) => result.id === 'readonly_production_foldback').status, 'blocked');
  assert.equal(byGap.runtime_execution_boundary.evalResults.find((result) => result.id === 'runtime_fail_closed').status, 'pass');
  assert.equal(byGap.runtime_execution_boundary.evalResults.find((result) => result.id === 'runtime_owner_receipt').status, 'blocked');
  assert.equal(
    byGap.runtime_execution_boundary.evalResults.find((result) => result.id === 'runtime_allowlist_eval').evidenceSource,
    'conditions',
  );
  assert.equal(byGap.commercial_saas_depth.evalResults.find((result) => result.id === 'commercial_readonly_projection').status, 'pass');
  assert.equal(byGap.commercial_saas_depth.evalResults.find((result) => result.id === 'commercial_owner_receipt').status, 'blocked');
  assert.equal(
    byGap.commercial_saas_depth.evalResults.find((result) => result.id === 'commercial_consumer_contract').evidenceSource,
    'expansionConditions',
  );
  assert.equal(byGap.operations_maturity.evalResults.find((result) => result.id === 'observability_baseline').status, 'pass');
  assert.equal(byGap.operations_maturity.evalResults.find((result) => result.id === 'ops_owner_receipt').status, 'blocked');
  assert.equal(
    byGap.operations_maturity.evalResults.find((result) => result.id === 'ops_future_contract_placeholders').evidenceSource,
    'evidenceConditions',
  );

  assert.equal(report.readyToAdvanceCount, 1);
  assert.deepEqual(report.summary, {
    done: 1,
    partial: 1,
    blocked: 3,
    not_started: 0,
  });
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
