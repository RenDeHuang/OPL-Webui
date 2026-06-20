#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function buildReleaseEvidenceSummary({ runId, commit, jobsPayload }) {
  const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : [];
  const failedJob = jobs.find((job) => job.conclusion === 'failure');
  const dogfoodJob = jobs.find((job) => job.name === 'Production Authenticated Dogfood E2E');
  const browserJob = jobs.find((job) => job.name === 'Production Browser E2E');
  const rollbackJob = jobs.find((job) => job.name === 'Production Rollback');

  return {
    schemaVersion: 1,
    runId: Number(runId),
    runUrl: `https://github.com/RenDeHuang/OPL-Webui/actions/runs/${runId}`,
    commit: commit || null,
    status: failedJob ? 'failure' : 'success',
    failedStage: failedJob?.name ?? null,
    stages: jobs.map((job) => ({
      name: job.name,
      status: job.status ?? 'completed',
      conclusion: job.conclusion ?? null,
      url: job.html_url ?? null,
    })),
    canClaim: {
      productionDryRun: stageSucceeded(jobs, 'Production Dry Run'),
      productionApply: stageSucceeded(jobs, 'Production Apply'),
      productionAuthenticatedDogfood: dogfoodJob?.conclusion === 'success',
      productionBrowserE2E: browserJob?.conclusion === 'success',
      productionRollback: rollbackJob?.conclusion === 'success',
      productionAvailabilityAfterRollback: stageSucceeded(jobs, 'Production Availability Probe After Rollback'),
    },
    browserJobObserved: Boolean(browserJob),
    cannotClaim: failedJob ? [
      failedJob.name,
      'production-ready SaaS',
    ] : [
      'production-ready SaaS without explicit release owner acceptance',
    ],
    rawLogPolicy: {
      storesRawLogs: false,
      storesSecretValues: false,
    },
  };
}

export function foldSummaryIntoReleaseProfile({ profile, summary }) {
  const nextProfile = foldDogfoodReadonlyIntoReleaseProfile({ profile, summary });
  const withRollback = foldRollbackIntoReleaseProfile({ profile: nextProfile, summary });
  const browser = withRollback.productionBrowserE2EReadiness ?? {};
  if (!summary.browserJobObserved) return withRollback;

  const latestAttempt = buildBrowserLatestAttempt(summary);
  const preservedCannotClaim = summary.canClaim.productionBrowserE2E
    ? (browser.cannotClaim ?? []).filter((claim) => claim !== 'production browser e2e')
    : (browser.cannotClaim ?? []);
  const nextCannotClaim = uniqueStrings([
    ...preservedCannotClaim,
    ...(latestAttempt.cannotClaim ?? []),
  ]);

  return {
    ...withRollback,
    productionBrowserE2EReadiness: {
      ...browser,
      state: summary.canClaim.productionBrowserE2E
        ? `executed_success_run_${summary.runId}`
        : `attempted_failed_run_${summary.runId}`,
      latestAttempt,
      cannotClaim: nextCannotClaim,
    },
  };
}

function foldDogfoodReadonlyIntoReleaseProfile({ profile, summary }) {
  if (!summary.dogfoodReadonlyConfirmed || !summary.canClaim.productionAuthenticatedDogfood) return profile;
  const dogfood = profile.productionDogfoodReadiness ?? {};
  const latest = dogfood.latestSuccessfulRun ?? {};
  const coverage = uniqueStrings([
    ...(latest.coverage ?? []),
    'medopl_readonly_runtime_status',
    'medopl_readonly_materials_deliverables',
    'medopl_readonly_billing_summary',
  ]);
  return {
    ...profile,
    productionDogfoodReadiness: {
      ...dogfood,
      state: `executed_success_run_${summary.runId}_real_chat_readonly_confirmed`,
      latestSuccessfulRun: {
        ...latest,
        runId: summary.runId,
        runUrl: summary.runUrl,
        commit: summary.commit,
        image: summary.image ?? latest.image ?? null,
        workflow: 'Cloud Rollout',
        targetHost: 'https://opl.medopl.cn',
        medoplReadonly: true,
        publicMetadataConfirmsReadonlySwitch: true,
        coverage,
        rawLogPolicy: summary.rawLogPolicy,
      },
    },
  };
}

function foldRollbackIntoReleaseProfile({ profile, summary }) {
  const rollbackStage = summary.stages.find((stage) => stage.name === 'Production Rollback');
  if (!rollbackStage || rollbackStage.conclusion === 'skipped') return profile;
  const rollback = profile.productionRollbackReadiness ?? {};
  const passedStages = [];
  if (summary.canClaim.productionDryRun) passedStages.push('production_dry_run');
  if (summary.canClaim.productionRollback) passedStages.push('production_rollback');
  if (summary.canClaim.productionAvailabilityAfterRollback) passedStages.push('production_availability_probe_after_rollback');
  const latestAttempt = {
    runId: summary.runId,
    runUrl: summary.runUrl,
    commit: summary.commit,
    image: summary.image ?? null,
    workflow: 'Cloud Rollout',
    targetHost: 'https://opl.medopl.cn',
    status: summary.canClaim.productionRollback ? 'success' : 'failure',
    failedStage: summary.canClaim.productionRollback ? null : summary.failedStage ?? 'Production Rollback',
    passedStages,
    canClaim: summary.canClaim.productionRollback ? ['manual environment-approved rollback executed'] : [],
    cannotClaim: ['automatic rollback', 'production-ready SaaS'],
    rawLogPolicy: summary.rawLogPolicy,
  };
  return {
    ...profile,
    productionRollbackReadiness: {
      ...rollback,
      state: summary.canClaim.productionRollback
        ? `executed_success_run_${summary.runId}`
        : `attempted_failed_run_${summary.runId}`,
      latestAttempt,
      cannotClaim: uniqueStrings([
        ...(rollback.cannotClaim ?? []),
        'automatic rollback',
        'production-ready SaaS',
      ]),
    },
  };
}

function buildBrowserLatestAttempt(summary) {
  const passedStages = [];
  const canClaim = [];
  const stageClaims = [
    ['productionDryRun', 'production_dry_run', 'production dry run executed in the same rollout'],
    ['productionApply', 'production_apply', 'production apply executed in the same rollout'],
    ['productionAuthenticatedDogfood', 'production_authenticated_dogfood', 'production authenticated dogfood executed in the same rollout'],
  ];
  for (const [claimKey, stageName, claimText] of stageClaims) {
    if (!summary.canClaim[claimKey]) continue;
    passedStages.push(stageName);
    canClaim.push(claimText);
  }
  if (summary.stages.some((stage) => stage.name === 'Production Availability Probe After Apply' && stage.conclusion === 'success')) {
    passedStages.push('production_availability_probe_after_apply');
    canClaim.push('production availability probe executed in the same rollout');
  }

  const cannotClaim = summary.canClaim.productionBrowserE2E ? [] : [
    'production browser e2e',
    'production-ready SaaS',
  ];

  return {
    runId: summary.runId,
    runUrl: summary.runUrl,
    commit: summary.commit,
    workflow: 'Cloud Rollout',
    targetHost: 'https://opl.medopl.cn',
    status: summary.status,
    failedStage: summary.failedStage,
    passedStages,
    canClaim,
    cannotClaim,
    rawLogPolicy: summary.rawLogPolicy,
  };
}

function stageSucceeded(jobs, stageName) {
  return jobs.some((job) => job.name === stageName && job.conclusion === 'success');
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--dogfood-readonly-confirmed') {
      options.dogfoodReadonlyConfirmed = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    if (token === '--run-id') {
      options.runId = value;
      index += 1;
      continue;
    }
    if (token === '--commit') {
      options.commit = value;
      index += 1;
      continue;
    }
    if (token === '--jobs-json') {
      options.jobsJson = value;
      index += 1;
      continue;
    }
    if (token === '--image') {
      options.image = value;
      index += 1;
      continue;
    }
    if (token === '--output') {
      options.output = value;
      index += 1;
      continue;
    }
    if (token === '--update-release-profile') {
      options.updateReleaseProfile = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!options.runId || !options.jobsJson || (!options.output && !options.updateReleaseProfile)) {
    throw new Error('Usage: scripts/release-evidence-sync.mjs --run-id <id> --jobs-json <path> (--output <path> | --update-release-profile <path>) [--commit <sha>]');
  }
  return options;
}

function runCli() {
  const options = parseArgs(process.argv.slice(2));
  const jobsPayload = JSON.parse(readFileSync(options.jobsJson, 'utf8'));
  const summary = buildReleaseEvidenceSummary({
    runId: options.runId,
    commit: options.commit,
    jobsPayload,
  });
  summary.image = options.image ?? null;
  summary.dogfoodReadonlyConfirmed = options.dogfoodReadonlyConfirmed === true;
  if (options.output) {
    writeFileSync(options.output, `${JSON.stringify(summary, null, 2)}\n`);
  }
  if (options.updateReleaseProfile) {
    const profile = JSON.parse(readFileSync(options.updateReleaseProfile, 'utf8'));
    const nextProfile = foldSummaryIntoReleaseProfile({ profile, summary });
    writeFileSync(options.updateReleaseProfile, `${JSON.stringify(nextProfile, null, 2)}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
