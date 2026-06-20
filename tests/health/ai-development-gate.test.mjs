import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const repoRoot = new URL('../..', import.meta.url);

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, repoRoot), 'utf8'));
}

test('development profile defines AI task tiers, required order, bloat, and completion policy', () => {
  const profile = readJson('contracts/web-development-profile.json');

  assert.equal(profile.schemaVersion, 1);
  assert.equal(profile.productId, 'one-person-lab-web');
  assert.deepEqual(profile.taskTiers.map((tier) => tier.id), ['direct', 'inline', 'durable']);
  assert.deepEqual(profile.requiredOrder, [
    'readFixedTruth',
    'selectOneGap',
    'declareOwnerSurface',
    'updateContractWhenNeeded',
    'registerTests',
    'implement',
    'retireReplacedSurfaces',
    'runTargetedLane',
    'runCurrentVerify',
    'foldBackEvidence',
    'declareCanAndCannotClaim',
  ]);
  assert.deepEqual(profile.bloatPolicy.newSurfaceRequires, [
    'ownerSurface',
    'consumer',
    'contractOrMachineBoundary',
    'testOrGate',
    'retirementRuleWhenTemporary',
  ]);
  assert.equal(profile.completionPolicy.docsOnlyCannotComplete, true);
  assert.equal(profile.completionPolicy.testsOnlyCannotClaimProduction, true);
  assert.equal(profile.completionPolicy.productionClaimRequiresFreshRun, true);
});

test('AI development gate is wired into package scripts and review gate', () => {
  const pkg = readJson('package.json');
  const workflowGate = readFileSync(new URL('scripts/workflow-gate.mjs', repoRoot), 'utf8');

  assert.equal(pkg.scripts['gate:ai'], 'node scripts/ai-development-gate.mjs');
  assert.match(workflowGate, /ai development gate/);
  assert.match(workflowGate, /scripts\/ai-development-gate\.mjs/);
});

test('AI development gate rejects stale production browser claims', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'opl-ai-gate-'));
  const releaseProfilePath = join(fixtureRoot, 'web-release-profile.json');

  writeFileSync(releaseProfilePath, `${JSON.stringify({
    productionBrowserE2EReadiness: {
      state: 'attempted_failed',
      latestAttempt: {
        runId: 27862789365,
        status: 'failure',
        failedStage: 'Production Browser E2E',
      },
    },
  }, null, 2)}\n`);

  for (const [name, staleText] of [
    ['english', 'Production browser e2e harness is ready but not yet executed.\n'],
    ['chinese', '本阶段没有执行 production browser e2e；当前生产浏览器 lane 只是 harness ready。\n'],
  ]) {
    const statusPath = join(fixtureRoot, `${name}-status.md`);
    writeFileSync(statusPath, staleText);

    const result = spawnSync(process.execPath, [
      'scripts/ai-development-gate.mjs',
      '--release-profile', releaseProfilePath,
      '--status-doc', statusPath,
      '--skip-diff',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /production browser e2e claim is stale/i);
  }
});

test('AI development gate accepts folded production browser failure claims', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'opl-ai-gate-'));
  const releaseProfilePath = join(fixtureRoot, 'web-release-profile.json');
  const statusPath = join(fixtureRoot, 'status.md');
  const activePath = join(fixtureRoot, 'active.md');

  writeFileSync(releaseProfilePath, `${JSON.stringify({
    productionBrowserE2EReadiness: {
      state: 'attempted_failed',
      latestAttempt: {
        runId: 27862789365,
        status: 'failure',
        failedStage: 'Production Browser E2E',
      },
    },
  }, null, 2)}\n`);
  writeFileSync(statusPath, [
    'Production browser e2e attempted in GitHub Actions run `27862789365` and failed at `Production Browser E2E`.',
    'Cannot claim production browser e2e evidence yet.',
    '',
  ].join('\n'));
  writeFileSync(activePath, [
    'Production browser e2e attempted in GitHub Actions run `27862789365` and failed at `Production Browser E2E`.',
    'Next action: inspect the production browser failure and rerun after the fix.',
    '',
  ].join('\n'));

  const result = spawnSync(process.execPath, [
    'scripts/ai-development-gate.mjs',
    '--release-profile', releaseProfilePath,
    '--status-doc', statusPath,
    '--active-doc', activePath,
    '--skip-diff',
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
});

test('release evidence sync summarizes GitHub run jobs without raw logs', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'opl-release-evidence-'));
  const jobsPath = join(fixtureRoot, 'jobs.json');
  const outputPath = join(fixtureRoot, 'summary.json');

  writeFileSync(jobsPath, `${JSON.stringify({
    jobs: [
      { name: 'Production Dry Run', conclusion: 'success', html_url: 'https://example.test/dry' },
      { name: 'Production Apply', conclusion: 'success', html_url: 'https://example.test/apply' },
      { name: 'Production Authenticated Dogfood E2E', conclusion: 'success', html_url: 'https://example.test/dogfood' },
      { name: 'Production Browser E2E', conclusion: 'failure', html_url: 'https://example.test/browser' },
    ],
  }, null, 2)}\n`);

  execFileSync(process.execPath, [
    'scripts/release-evidence-sync.mjs',
    '--run-id', '27862789365',
    '--commit', 'b19bf01',
    '--jobs-json', jobsPath,
    '--output', outputPath,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(existsSync(outputPath), true);
  const summary = JSON.parse(readFileSync(outputPath, 'utf8'));
  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.runId, 27862789365);
  assert.equal(summary.status, 'failure');
  assert.equal(summary.failedStage, 'Production Browser E2E');
  assert.equal(summary.canClaim.productionBrowserE2E, false);
  assert.equal(summary.canClaim.productionAuthenticatedDogfood, true);
  assert.deepEqual(summary.rawLogPolicy, {
    storesRawLogs: false,
    storesSecretValues: false,
  });
});

test('release evidence sync can fold production browser failure into release profile', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'opl-release-evidence-'));
  const jobsPath = join(fixtureRoot, 'jobs.json');
  const profilePath = join(fixtureRoot, 'web-release-profile.json');

  writeFileSync(jobsPath, `${JSON.stringify({
    jobs: [
      { name: 'Production Dry Run', conclusion: 'success', html_url: 'https://example.test/dry' },
      { name: 'Production Apply', conclusion: 'success', html_url: 'https://example.test/apply' },
      { name: 'Production Availability Probe After Apply', conclusion: 'success', html_url: 'https://example.test/availability' },
      { name: 'Production Authenticated Dogfood E2E', conclusion: 'success', html_url: 'https://example.test/dogfood' },
      { name: 'Production Browser E2E', conclusion: 'failure', html_url: 'https://example.test/browser' },
    ],
  }, null, 2)}\n`);
  writeFileSync(profilePath, `${JSON.stringify({
    schemaVersion: 1,
    productionBrowserE2EReadiness: {
      mode: 'secret_gated_chromium_research_main_path',
      state: 'harness_ready_pending_first_run',
      cannotClaim: ['production-ready SaaS'],
    },
  }, null, 2)}\n`);

  execFileSync(process.execPath, [
    'scripts/release-evidence-sync.mjs',
    '--run-id', '27862789365',
    '--commit', 'b19bf01',
    '--jobs-json', jobsPath,
    '--update-release-profile', profilePath,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  assert.equal(profile.productionBrowserE2EReadiness.state, 'attempted_failed_run_27862789365');
  assert.equal(profile.productionBrowserE2EReadiness.latestAttempt.runId, 27862789365);
  assert.equal(profile.productionBrowserE2EReadiness.latestAttempt.failedStage, 'Production Browser E2E');
  assert.equal(profile.productionBrowserE2EReadiness.latestAttempt.canClaim.includes('production authenticated dogfood executed in the same rollout'), true);
  assert.equal(profile.productionBrowserE2EReadiness.latestAttempt.cannotClaim.includes('production browser e2e'), true);
  assert.equal(profile.productionBrowserE2EReadiness.latestAttempt.rawLogPolicy.storesRawLogs, false);
  assert.equal(profile.productionBrowserE2EReadiness.latestAttempt.rawLogPolicy.storesSecretValues, false);
});

test('release evidence sync does not manufacture browser evidence when browser job is absent', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'opl-release-evidence-'));
  const jobsPath = join(fixtureRoot, 'jobs.json');
  const profilePath = join(fixtureRoot, 'web-release-profile.json');

  writeFileSync(jobsPath, `${JSON.stringify({
    jobs: [
      { name: 'Production Dry Run', conclusion: 'success', html_url: 'https://example.test/dry' },
      { name: 'Production Apply', conclusion: 'success', html_url: 'https://example.test/apply' },
      { name: 'Production Authenticated Dogfood E2E', conclusion: 'success', html_url: 'https://example.test/dogfood' },
    ],
  }, null, 2)}\n`);
  writeFileSync(profilePath, `${JSON.stringify({
    schemaVersion: 1,
    productionBrowserE2EReadiness: {
      mode: 'secret_gated_chromium_research_main_path',
      state: 'harness_ready_pending_first_run',
      cannotClaim: ['production browser e2e'],
    },
  }, null, 2)}\n`);

  execFileSync(process.execPath, [
    'scripts/release-evidence-sync.mjs',
    '--run-id', '27870000000',
    '--commit', 'abc123',
    '--jobs-json', jobsPath,
    '--update-release-profile', profilePath,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  assert.equal(profile.productionBrowserE2EReadiness.state, 'harness_ready_pending_first_run');
  assert.equal(profile.productionBrowserE2EReadiness.latestAttempt, undefined);
});

test('release evidence sync clears production browser cannot-claim when browser job succeeds', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'opl-release-evidence-'));
  const jobsPath = join(fixtureRoot, 'jobs.json');
  const profilePath = join(fixtureRoot, 'web-release-profile.json');

  writeFileSync(jobsPath, `${JSON.stringify({
    jobs: [
      { name: 'Production Dry Run', conclusion: 'success', html_url: 'https://example.test/dry' },
      { name: 'Production Apply', conclusion: 'success', html_url: 'https://example.test/apply' },
      { name: 'Production Browser E2E', conclusion: 'success', html_url: 'https://example.test/browser' },
    ],
  }, null, 2)}\n`);
  writeFileSync(profilePath, `${JSON.stringify({
    schemaVersion: 1,
    productionBrowserE2EReadiness: {
      mode: 'secret_gated_chromium_research_main_path',
      state: 'attempted_failed_run_27862789365',
      cannotClaim: ['production browser e2e', 'production-ready SaaS'],
    },
  }, null, 2)}\n`);

  execFileSync(process.execPath, [
    'scripts/release-evidence-sync.mjs',
    '--run-id', '27880000000',
    '--commit', 'def456',
    '--jobs-json', jobsPath,
    '--update-release-profile', profilePath,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  assert.equal(profile.productionBrowserE2EReadiness.state, 'executed_success_run_27880000000');
  assert.equal(profile.productionBrowserE2EReadiness.latestAttempt.status, 'success');
  assert.equal(profile.productionBrowserE2EReadiness.cannotClaim.includes('production browser e2e'), false);
  assert.equal(profile.productionBrowserE2EReadiness.cannotClaim.includes('production-ready SaaS'), true);
});
