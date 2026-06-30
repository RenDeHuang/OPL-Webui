#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OPERATIONS_EVIDENCE_CONTRACTS = Object.freeze([
  { id: 'dashboard', owner: 'operations_owner', state: 'contract_required' },
  { id: 'alerting', owner: 'operations_owner', state: 'contract_required' },
  { id: 'error_budget', owner: 'operations_owner', state: 'contract_required' },
  { id: 'rollback_record', owner: 'release_operator', state: 'contract_required' },
]);

export function buildReleaseEvidenceSummary({ runId, commit, jobsPayload, workflow }) {
  const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : [];
  const failedJob = jobs.find((job) => job.conclusion === 'failure');
  const dogfoodJob = jobs.find((job) => job.name === 'Production Authenticated Dogfood E2E');
  const browserJob = jobs.find((job) => job.name === 'Production Browser E2E');
  const rollbackJob = jobs.find((job) => job.name === 'Production Rollback');
  const completedAt = latestCompletedAt(jobs);

  return {
    schemaVersion: 1,
    runId: Number(runId),
    runUrl: `https://github.com/RenDeHuang/OPL-Webui/actions/runs/${runId}`,
    commit: commit || null,
    workflow: workflow || null,
    completedAt,
    status: failedJob ? 'failure' : 'success',
    failedStage: failedJob?.name ?? null,
    stages: jobs.map((job) => ({
      name: job.name,
      status: job.status ?? 'completed',
      conclusion: job.conclusion ?? null,
      url: job.html_url ?? job.url ?? null,
      completedAt: job.completed_at ?? job.completedAt ?? null,
    })),
    canClaim: {
      productionDryRun: stageSucceeded(jobs, 'Production Dry Run'),
      productionApply: stageSucceeded(jobs, 'Production Apply'),
      productionAuthenticatedDogfood: dogfoodJob?.conclusion === 'success',
      productionBrowserE2E: browserJob?.conclusion === 'success',
      productionAvailabilityAfterApply: stageSucceeded(jobs, 'Production Availability Probe After Apply'),
      productionRollback: rollbackJob?.conclusion === 'success',
      productionAvailabilityAfterRollback: stageSucceeded(jobs, 'Production Availability Probe After Rollback'),
      scheduledProductionAvailabilityProbe: stageSucceeded(jobs, 'Scheduled Production Availability Probe'),
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
  const withFailures = foldReleaseFailureIntoProfile({ profile, summary });
  const withLatestMain = foldLatestMainEvidenceIntoReleaseProfile({ profile: withFailures, summary });
  const withDogfood = foldAuthenticatedDogfoodIntoReleaseProfile({ profile: withLatestMain, summary });
  const withAvailability = foldAvailabilityIntoReleaseProfile({ profile: withDogfood, summary });
  const withScheduledCanary = foldScheduledCanaryIntoReleaseProfile({ profile: withAvailability, summary });
  const withRollback = foldRollbackIntoReleaseProfile({ profile: withScheduledCanary, summary });
  const withOpsCloseout = foldOperationsCloseoutIntoReleaseProfile({ profile: withRollback, summary });
  const withLaunchCloseout = foldLaunchCloseoutIntoReleaseProfile({ profile: withOpsCloseout, summary });
  const browser = withLaunchCloseout.productionBrowserE2EReadiness ?? {};
  if (!summary.browserJobObserved) return withLaunchCloseout;

  const latestAttempt = buildBrowserLatestAttempt(summary);
  const preservedCannotClaim = summary.canClaim.productionBrowserE2E
    ? (browser.cannotClaim ?? []).filter((claim) => claim !== 'production browser e2e')
    : (browser.cannotClaim ?? []);
  const nextCannotClaim = uniqueStrings([
    ...preservedCannotClaim,
    ...(latestAttempt.cannotClaim ?? []),
  ]);

  return {
    ...withLaunchCloseout,
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

function foldLatestMainEvidenceIntoReleaseProfile({ profile, summary }) {
  const requiredStagesPassed = summary.status === 'success'
    && summary.canClaim.productionDryRun
    && summary.canClaim.productionApply
    && summary.canClaim.productionAvailabilityAfterApply
    && summary.canClaim.productionAuthenticatedDogfood
    && summary.canClaim.productionBrowserE2E;
  if (!requiredStagesPassed) return profile;
  const shortCommit = typeof summary.commit === 'string' && summary.commit.length >= 7
    ? summary.commit.slice(0, 7)
    : null;
  const latest = {
    state: `folded_success_run_${summary.runId}`,
    runId: summary.runId,
    runUrl: summary.runUrl,
    commit: summary.commit,
    image: summary.image ?? null,
    workflow: summary.workflow || 'Cloud Rollout',
    completedAt: summary.completedAt,
    requiredStages: [
      'Production Dry Run',
      'Production Image Preflight',
      'Production Apply',
      'Production Availability Probe After Apply',
      'Production Authenticated Dogfood E2E',
      'Production Browser E2E',
    ],
    canClaim: [
      'latest-main production evidence folded back',
      'OPL-Webui controlled launch ready',
      'three-layer knowledge delivery Web platform v1',
    ],
    cannotClaim: [
      'production-ready SaaS',
      'full SaaS',
      'payment/team/RBAC/HA',
      'runtime execution',
      'artifact body/storage truth',
    ],
    rawLogPolicy: summary.rawLogPolicy,
  };
  return {
    ...profile,
    latestMainEvidence: latest,
    controlledLaunchReadiness: {
      ...(profile.controlledLaunchReadiness ?? {}),
      state: shortCommit
        ? `latest_main_${shortCommit}_supported_by_folded_production_evidence_run_${summary.runId}`
        : `latest_main_supported_by_folded_production_evidence_run_${summary.runId}`,
      latestMainEvidence: latest,
    },
    productLayerReadiness: {
      ...(profile.productLayerReadiness ?? {}),
      productionRollout: `folded_success_run_${summary.runId}`,
    },
  };
}

function foldLaunchCloseoutIntoReleaseProfile({ profile, summary }) {
  if (!summary.launchCloseout) return profile;
  const closeout = profile.productionLaunchCloseout ?? {};
  const decision = buildLaunchCloseoutDecision(summary);
  return {
    ...profile,
    productionLaunchCloseout: {
      ...closeout,
      state: decision.decision === 'go'
        ? `accepted_go_run_${summary.runId}`
        : `accepted_no_go_run_${summary.runId}`,
      latestDecision: decision,
      cannotClaim: uniqueStrings([
        ...(closeout.cannotClaim ?? []),
        ...decision.cannotClaim,
      ]),
    },
  };
}

function foldOperationsCloseoutIntoReleaseProfile({ profile, summary }) {
  if (!summary.opsCloseout) return profile;
  const closeout = profile.productionOperationsCloseout ?? {};
  const evidence = buildOperationsCloseoutEvidence(summary);
  const gates = profile.productionObservabilityBaseline?.productionReadinessGates ?? {};
  return {
    ...profile,
    productionOperationsCloseout: {
      ...closeout,
      state: evidence.status === 'accepted' ? `accepted_p0_p1_run_${summary.runId}` : `incomplete_p0_p1_run_${summary.runId}`,
      latestEvidence: evidence,
      cannotClaim: uniqueStrings([...(closeout.cannotClaim ?? []), ...evidence.cannotClaim]),
    },
    productionObservabilityBaseline: {
      ...(profile.productionObservabilityBaseline ?? {}),
      productionReadinessGates: {
        ...gates,
        rollbackPath: { ...(gates.rollbackPath ?? {}), state: evidence.p0.rollback?.state === 'executed' ? 'production_rollback_record_folded_back' : gates.rollbackPath?.state },
        alertingBoundary: { ...(gates.alertingBoundary ?? {}), state: evidence.p0.alerting?.state === 'verified' ? 'alert_route_folded_back' : gates.alertingBoundary?.state },
        dbBackupRestore: { ...(gates.dbBackupRestore ?? {}), state: evidence.p0.dbRestore?.state === 'executed' ? 'restore_drill_folded_back' : gates.dbBackupRestore?.state },
        observabilityDashboard: { ...(gates.observabilityDashboard ?? {}), state: evidence.p0.monitoring?.dashboardUrl ? 'dashboard_url_folded_back' : gates.observabilityDashboard?.state },
        concurrencyEvidence: { ...(gates.concurrencyEvidence ?? {}), state: evidence.p1.load?.state === 'executed' ? 'staging_or_production_load_folded_back' : gates.concurrencyEvidence?.state },
        upstreamBackpressure: { ...(gates.upstreamBackpressure ?? {}), state: evidence.p1.upstreamBackpressure?.failClosed === true ? 'upstream_backpressure_folded_back' : gates.upstreamBackpressure?.state },
        migrationSchemaCompatibility: { ...(gates.migrationSchemaCompatibility ?? {}), state: evidence.p1.migrationCompatibility?.state === 'verified' ? 'migration_compatibility_folded_back' : gates.migrationSchemaCompatibility?.state },
      },
    },
  };
}

function buildOperationsCloseoutEvidence(summary) {
  const receipt = summary.opsCloseout;
  const p0 = receipt.p0 ?? {};
  const p1 = receipt.p1 ?? {};
  const rawLogPolicy = {
    storesRawLogs: receipt.rawLogPolicy?.storesRawLogs === true ? true : false,
    storesSecretValues: receipt.rawLogPolicy?.storesSecretValues === true ? true : false,
  };
  const sanitized = {
    runId: summary.runId,
    runUrl: summary.runUrl,
    commit: summary.commit,
    workflow: summary.workflow || 'Cloud Rollout',
    completedAt: summary.completedAt,
    owner: typeof receipt.owner === 'string' ? receipt.owner : 'release_operator',
    acceptedAt: typeof receipt.acceptedAt === 'string' ? receipt.acceptedAt : summary.completedAt,
    acceptedClaim: typeof receipt.acceptedClaim === 'string' ? receipt.acceptedClaim : null,
    p0: {
      rollback: pickEvidence(p0.rollback, ['state', 'runId', 'automatic']),
      alerting: pickEvidence(p0.alerting, ['state', 'route', 'severityPolicy']),
      dbRestore: pickEvidence(p0.dbRestore, ['state', 'drillId', 'sanitizedVerification']),
      monitoring: pickEvidence(p0.monitoring, ['state', 'dashboardUrl']),
    },
    p1: {
      soak: pickEvidence(p1.soak, ['state', 'runId', 'durationMinutes', 'maxFailures']),
      load: pickEvidence(p1.load, ['state', 'runId', 'concurrentUsers', 'p95Ms', 'upstreamQuotaAuthorized']),
      dbPool: pickEvidence(p1.dbPool, ['state', 'maxOpenConns', 'maxIdleConns']),
      upstreamBackpressure: pickEvidence(p1.upstreamBackpressure, ['state', 'timeoutMs', 'failClosed']),
      migrationCompatibility: pickEvidence(p1.migrationCompatibility, ['state', 'drillId']),
    },
    rawLogPolicy,
  };
  const required = [['p0', 'rollback'], ['p0', 'alerting'], ['p0', 'dbRestore'], ['p0', 'monitoring'], ['p1', 'soak'], ['p1', 'load'], ['p1', 'dbPool'], ['p1', 'upstreamBackpressure'], ['p1', 'migrationCompatibility']];
  const missingEvidence = required.filter(([group, key]) => !sanitized[group][key]).map(([group, key]) => `${group}.${key}`);
  const unsafe = rawLogPolicy.storesRawLogs || rawLogPolicy.storesSecretValues;
  return {
    ...sanitized,
    status: missingEvidence.length === 0 && !unsafe ? 'accepted' : 'incomplete',
    missingEvidence,
    canClaim: missingEvidence.length === 0 && !unsafe ? ['P0/P1 single-node launch operations ready'] : [],
    cannotClaim: uniqueStrings(['multi-node HA', 'automatic rollback', 'complete commercial SaaS lifecycle', ...(missingEvidence.length === 0 && !unsafe ? [] : ['production-ready SaaS'])]),
  };
}

function buildLaunchCloseoutDecision(summary) {
  const receipt = summary.launchCloseout;
  const evidence = receipt.evidence ?? {};
  const decision = receipt.decision === 'go' ? 'go' : 'no_go';
  const requiredEvidence = ['soak', 'load', 'rollback', 'canary', 'alerting', 'dbRestore', 'monitoring', 'ha', 'slo'];
  const missingEvidence = requiredEvidence.filter((id) => !evidence[id]);
  const rawLogPolicy = {
    storesRawLogs: receipt.rawLogPolicy?.storesRawLogs === true ? true : false,
    storesSecretValues: receipt.rawLogPolicy?.storesSecretValues === true ? true : false,
  };
  const hasUnsafeRawArtifacts = rawLogPolicy.storesRawLogs || rawLogPolicy.storesSecretValues;
  const sanitizedDecision = {
    runId: summary.runId,
    runUrl: summary.runUrl,
    commit: summary.commit,
    workflow: summary.workflow || 'Cloud Rollout',
    completedAt: summary.completedAt,
    decision: hasUnsafeRawArtifacts || missingEvidence.length > 0 ? 'no_go' : decision,
    owner: typeof receipt.owner === 'string' ? receipt.owner : 'release_operator',
    acceptedAt: typeof receipt.acceptedAt === 'string' ? receipt.acceptedAt : summary.completedAt,
    acceptedClaim: typeof receipt.acceptedClaim === 'string' ? receipt.acceptedClaim : null,
    evidence: sanitizeLaunchCloseoutEvidence(evidence),
    missingEvidence,
    rawLogPolicy,
  };
  const cannotClaim = ['complete commercial SaaS lifecycle', 'billing source of truth', 'OPL runtime execution'];
  if (sanitizedDecision.evidence.ha?.state !== 'multi_node_verified') cannotClaim.push('multi-node HA');
  if (sanitizedDecision.evidence.rollback?.automatic !== true) cannotClaim.push('automatic rollback');
  if (sanitizedDecision.decision !== 'go') cannotClaim.push('production-ready SaaS');
  return {
    ...sanitizedDecision,
    canClaim: sanitizedDecision.decision === 'go' ? [sanitizedDecision.acceptedClaim].filter(Boolean) : [],
    cannotClaim: uniqueStrings(cannotClaim),
  };
}

function sanitizeLaunchCloseoutEvidence(evidence) {
  return {
    soak: pickEvidence(evidence.soak, ['state', 'runId', 'durationMinutes', 'maxFailures']),
    load: pickEvidence(evidence.load, ['state', 'runId', 'concurrentUsers', 'p95Ms', 'upstreamQuotaAuthorized']),
    rollback: pickEvidence(evidence.rollback, ['state', 'runId', 'automatic']),
    canary: pickEvidence(evidence.canary, ['state', 'runId', 'windowMinutes']),
    alerting: pickEvidence(evidence.alerting, ['state', 'route', 'severityPolicy']),
    dbRestore: pickEvidence(evidence.dbRestore, ['state', 'drillId', 'sanitizedVerification']),
    monitoring: pickEvidence(evidence.monitoring, ['state', 'dashboardUrl']),
    ha: pickEvidence(evidence.ha, ['state', 'ownerAccepted']),
    slo: pickEvidence(evidence.slo, ['state', 'availabilityTarget', 'window']),
  };
}

function pickEvidence(source, keys) {
  if (!source || typeof source !== 'object') return null;
  return Object.fromEntries(keys
    .filter((key) => ['string', 'number', 'boolean'].includes(typeof source[key]))
    .map((key) => [key, source[key]]));
}

function foldReleaseFailureIntoProfile({ profile, summary }) {
  if (summary.status !== 'failure') return profile;
  const failures = profile.productionReleaseFailures ?? {};
  const failureKind = classifyReleaseFailure(summary);
  const latestFailedRun = {
    runId: summary.runId,
    runUrl: summary.runUrl,
    commit: summary.commit,
    image: summary.image ?? null,
    workflow: summary.workflow ?? 'Cloud Rollout',
    targetHost: 'https://opl.medopl.cn',
    status: 'failure',
    failedStage: summary.failedStage,
    failureKind,
    imagePullOccurred: failureKind === 'image_missing_rollout_order_issue'
      ? summary.failedStage === 'Production Apply'
      : null,
    productFailure: failureKind === 'image_missing_rollout_order_issue' ? false : 'unconfirmed',
    rawLogPolicy: summary.rawLogPolicy,
  };
  return {
    ...profile,
    productionReleaseFailures: {
      ...failures,
      latestFailedRun,
      cannotClaim: uniqueStrings([
        ...(failures.cannotClaim ?? []),
        'production-ready SaaS',
      ]),
    },
  };
}

function classifyReleaseFailure(summary) {
  if (summary.failedStage === 'Production Apply' && typeof summary.image === 'string' && summary.image.length > 0) {
    return 'image_missing_rollout_order_issue';
  }
  if (summary.failedStage === 'Production Image Preflight') {
    return 'image_missing_rollout_order_issue';
  }
  return 'release_stage_failed';
}

function foldAuthenticatedDogfoodIntoReleaseProfile({ profile, summary }) {
  if (!summary.canClaim.productionAuthenticatedDogfood) return profile;
  const dogfood = profile.productionDogfoodReadiness ?? {};
  const latest = dogfood.latestSuccessfulRun ?? {};
  const readonlyConfirmed = summary.dogfoodReadonlyConfirmed === true;
  const coverage = buildDogfoodRunCoverage({ summary, readonlyConfirmed });
  return {
    ...profile,
    productionDogfoodReadiness: {
      ...dogfood,
      state: readonlyConfirmed
        ? `executed_success_run_${summary.runId}_real_chat_readonly_confirmed`
        : `executed_success_run_${summary.runId}_real_chat_readonly_unconfirmed`,
      latestSuccessfulRun: {
        ...latest,
        runId: summary.runId,
        runUrl: summary.runUrl,
        commit: summary.commit,
        image: summary.image ?? latest.image ?? null,
        workflow: 'Cloud Rollout',
        targetHost: 'https://opl.medopl.cn',
        completedAt: summary.completedAt ?? latest.completedAt ?? null,
        realChat: summary.canClaim.productionBrowserE2E ? true : latest.realChat ?? 'unconfirmed',
        realChatEvidence: summary.canClaim.productionBrowserE2E ? 'production_browser_e2e' : latest.realChatEvidence ?? 'unconfirmed',
        medoplReadonly: readonlyConfirmed ? true : 'unconfirmed',
        publicMetadataConfirmsReadonlySwitch: readonlyConfirmed,
        readonlyEvidenceBoundary: readonlyConfirmed
          ? 'Folded evidence explicitly confirmed OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1.'
          : 'Public GitHub job metadata confirms Production Authenticated Dogfood E2E success but does not expose repository variable values or dogfood stdout; do not claim MedOPL readonly production coverage until log or variable evidence is folded back.',
        stages: buildSuccessfulStageNames(summary, [
          ['Production Dry Run', 'production_dry_run'],
          ['Production Apply', 'production_apply'],
          ['Production Availability Probe After Apply', 'production_availability_probe_after_apply'],
          ['Production Authenticated Dogfood E2E', 'production_authenticated_dogfood'],
          ['Production Browser E2E', 'production_browser_e2e'],
        ]),
        statusSummary: buildStatusSummary(summary, [
          'Production Dry Run',
          'Production Apply',
          'Production Availability Probe After Apply',
          'Production Authenticated Dogfood E2E',
          'Production Browser E2E',
        ]),
        coverage,
        rawLogPolicy: summary.rawLogPolicy,
      },
    },
  };
}

function foldAvailabilityIntoReleaseProfile({ profile, summary }) {
  if (!summary.canClaim.productionAvailabilityAfterApply) return profile;
  const availability = profile.productionAvailabilityReadiness ?? {};
  const observability = profile.productionObservabilityBaseline ?? {};
  const scheduledCanarySucceeded = observability.nextReadiness?.implementedEvidence?.includes('scheduled_canary_first_success') === true;
  return {
    ...profile,
    productionAvailabilityReadiness: {
      ...availability,
      state: `executed_success_run_${summary.runId}_after_apply`,
      latestSuccessfulRun: {
        ...(availability.latestSuccessfulRun ?? {}),
        runId: summary.runId,
        runUrl: summary.runUrl,
        commit: summary.commit,
        image: summary.image ?? availability.latestSuccessfulRun?.image ?? null,
        targetHost: 'https://opl.medopl.cn',
        workflow: 'Cloud Rollout',
        completedAt: summary.completedAt ?? availability.latestSuccessfulRun?.completedAt ?? null,
        afterStage: 'production_apply_canary_smoke',
        samples: availability.latestSuccessfulRun?.samples ?? 3,
        stages: buildSuccessfulStageNames(summary, [
          ['Production Dry Run', 'production_dry_run'],
          ['Production Apply', 'production_apply'],
          ['Production Availability Probe After Apply', 'production_availability_probe_after_apply'],
        ]),
        statusSummary: buildStatusSummary(summary, [
          'Production Dry Run',
          'Production Apply',
          'Production Availability Probe After Apply',
        ]),
        coverage: [
          'HTTPS /healthz',
          'HTTPS /readyz',
          'HTTPS /metricsz',
          'HTTPS /',
        ],
      },
    },
    productionObservabilityBaseline: {
      ...observability,
      state: scheduledCanarySucceeded
        ? `release_probe_executed_run_${summary.runId}_scheduled_canary_success_pending_long_term_ops`
        : `release_probe_executed_run_${summary.runId}_pending_long_term_ops`,
      latestSuccessfulRun: {
        ...(observability.latestSuccessfulRun ?? {}),
        runId: summary.runId,
        runUrl: summary.runUrl,
        commit: summary.commit,
        image: summary.image ?? observability.latestSuccessfulRun?.image ?? null,
        targetHost: 'https://opl.medopl.cn',
        workflow: 'Cloud Rollout',
        completedAt: summary.completedAt ?? observability.latestSuccessfulRun?.completedAt ?? null,
        coverage: [
          '/healthz repeated samples',
          '/readyz repeated samples',
          '/metricsz repeated samples',
          '/ repeated samples',
          '/metricsz summary fields',
        ],
      },
      nextReadiness: {
        ...(observability.nextReadiness ?? {}),
        evidenceContracts: observability.nextReadiness?.evidenceContracts ?? OPERATIONS_EVIDENCE_CONTRACTS,
      },
    },
  };
}

function foldScheduledCanaryIntoReleaseProfile({ profile, summary }) {
  if (!summary.canClaim.scheduledProductionAvailabilityProbe) return profile;
  const observability = profile.productionObservabilityBaseline ?? {};
  const nextReadiness = observability.nextReadiness ?? {};
  const scheduledCanary = nextReadiness.scheduledCanary ?? {};
  const job = summary.stages.find((stage) => stage.name === 'Scheduled Production Availability Probe');
  const releaseProbeRunId = observability.latestSuccessfulRun?.runId;
  const releaseProbePrefix = releaseProbeRunId ? `release_probe_executed_run_${releaseProbeRunId}` : 'release_probe_ready';

  return {
    ...profile,
    productionObservabilityBaseline: {
      ...observability,
      state: `${releaseProbePrefix}_scheduled_canary_success_pending_long_term_ops`,
      nextReadiness: {
        ...nextReadiness,
        state: `scheduled_canary_first_success_run_${summary.runId}_pending_ops_consumer`,
        evidenceContracts: nextReadiness.evidenceContracts ?? OPERATIONS_EVIDENCE_CONTRACTS,
        implementedEvidence: uniqueStrings([
          ...(nextReadiness.implementedEvidence ?? []),
          'scheduled_canary_workflow',
          'scheduled_canary_first_success',
        ]),
        scheduledCanary: {
          ...scheduledCanary,
          state: `executed_success_run_${summary.runId}`,
          latestSuccessfulRun: {
            runId: summary.runId,
            runUrl: summary.runUrl,
            commit: summary.commit,
            workflow: summary.workflow || 'Production Canary',
            jobName: 'Scheduled Production Availability Probe',
            jobUrl: job?.url ?? null,
            completedAt: summary.completedAt ?? job?.completedAt ?? null,
            targetHost: 'https://opl.medopl.cn',
            samples: scheduledCanary.latestSuccessfulRun?.samples ?? 3,
            coverage: [
              'HTTPS /healthz',
              'HTTPS /readyz',
              'HTTPS /metricsz',
              'HTTPS /',
            ],
            rawLogPolicy: summary.rawLogPolicy,
          },
        },
        requiredFutureEvidence: (nextReadiness.requiredFutureEvidence ?? [])
          .filter((item) => item !== 'scheduled_canary_first_success'),
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
  if (summary.canClaim.productionBrowserE2E) {
    passedStages.push('production_browser_e2e');
    canClaim.push('production browser e2e executed against https://opl.medopl.cn');
  }

  const cannotClaim = uniqueStrings([
    ...(summary.canClaim.productionBrowserE2E ? [] : ['production browser e2e']),
    'multi-node HA',
    'production-ready SaaS',
    'MedOPL runtime execution',
    'billing/payment/storage/node pool mutation',
    'team invite or RBAC lifecycle',
  ]);

  return {
    runId: summary.runId,
    runUrl: summary.runUrl,
    commit: summary.commit,
    image: summary.image ?? null,
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

function buildSuccessfulStageNames(summary, stagePairs) {
  return stagePairs
    .filter(([jobName]) => summary.stages.some((stage) => stage.name === jobName && stage.conclusion === 'success'))
    .map(([, stageName]) => stageName);
}

function buildStatusSummary(summary, stageNames) {
  return stageNames
    .filter((jobName) => summary.stages.some((stage) => stage.name === jobName && stage.conclusion === 'success'))
    .map((jobName) => `${jobName} success`);
}

function stageSucceeded(jobs, stageName) {
  return jobs.some((job) => job.name === stageName && job.conclusion === 'success');
}

function latestCompletedAt(jobs) {
  const completed = jobs
    .map((job) => job.completed_at ?? job.completedAt)
    .filter((value) => typeof value === 'string' && value.length > 0)
    .sort();
  return completed.at(-1) ?? null;
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function buildDogfoodRunCoverage({ summary, readonlyConfirmed }) {
  return uniqueStrings([
    'register_or_login',
    'current_session',
    'api_key_binding',
    'fixed_gateway',
    'raw_api_key_not_returned',
    ...(summary.canClaim.productionBrowserE2E ? ['ordinary_chat_real_completion', 'chat_completed_audit'] : []),
    'runtime_gate_audit',
    'sanitized_audit',
    ...(readonlyConfirmed ? ['medopl_readonly_runtime_status', 'medopl_readonly_materials_deliverables', 'medopl_readonly_billing_summary'] : []),
  ]);
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
    if (token === '--launch-closeout-json') {
      options.launchCloseoutJson = value;
      index += 1;
      continue;
    }
    if (token === '--ops-closeout-json') {
      options.opsCloseoutJson = value;
      index += 1;
      continue;
    }
    if (token === '--image') {
      options.image = value;
      index += 1;
      continue;
    }
    if (token === '--workflow') {
      options.workflow = value;
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
  if (!options.runId) {
    throw new Error('Usage: scripts/release-evidence-sync.mjs --run-id <id> [--jobs-json <path>] [--output <path> | --update-release-profile <path>] [--commit <sha>]');
  }
  if (!options.output && !options.updateReleaseProfile) options.updateReleaseProfile = 'contracts/web-release-profile.json';
  return options;
}

function runCli() {
  const options = parseArgs(process.argv.slice(2));
  const runPayload = options.jobsJson ? null : fetchGitHubRun(options.runId);
  const jobsPayload = options.jobsJson
    ? JSON.parse(readFileSync(options.jobsJson, 'utf8'))
    : { jobs: runPayload.jobs };
  const summary = buildReleaseEvidenceSummary({
    runId: options.runId,
    commit: options.commit ?? runPayload?.headSha,
    jobsPayload,
    workflow: options.workflow ?? runPayload?.workflowName,
  });
  summary.image = options.image ?? runPayload?.sanitizedEvidence?.image ?? inferImageFromCommit(summary.commit);
  summary.dogfoodReadonlyConfirmed = options.dogfoodReadonlyConfirmed === true
    || runPayload?.sanitizedEvidence?.dogfoodReadonlyConfirmed === true;
  if (options.launchCloseoutJson) {
    summary.launchCloseout = JSON.parse(readFileSync(options.launchCloseoutJson, 'utf8'));
  }
  if (options.opsCloseoutJson) {
    summary.opsCloseout = JSON.parse(readFileSync(options.opsCloseoutJson, 'utf8'));
  }
  if (options.output) {
    writeFileSync(options.output, `${JSON.stringify(summary, null, 2)}\n`);
  }
  if (options.updateReleaseProfile) {
    const profile = JSON.parse(readFileSync(options.updateReleaseProfile, 'utf8'));
    const nextProfile = foldSummaryIntoReleaseProfile({ profile, summary });
    writeFileSync(options.updateReleaseProfile, `${formatJsonPreservingCompactTopLevel(nextProfile)}\n`);
    foldLatestMainEvidenceIntoUiReplacementContracts({
      profile: nextProfile,
      summary,
      releaseProfilePath: options.updateReleaseProfile,
    });
  }
}

function foldLatestMainEvidenceIntoUiReplacementContracts({ profile, summary, releaseProfilePath }) {
  if (summary.status !== 'success' || !profile.latestMainEvidence) return;
  const normalizedProfilePath = String(releaseProfilePath || '').replaceAll('\\', '/').replace(/^\.\//, '');
  if (normalizedProfilePath !== 'contracts/web-release-profile.json') return;

  const latest = profile.latestMainEvidence;
  const guiPath = 'contracts/web-gui-product-contract.json';
  const pageStatePath = 'contracts/web-page-state-matrix.json';
  const guiEvidence = `"productionEvidence": {
      "state": "${latest.state}",
      "commit": "${latest.commit}",
      "image": "${latest.image}",
      "runId": ${latest.runId},
      "runUrl": "${latest.runUrl}"
    }`;
  const pageStateEvidence = `"productionEvidence": {
      "commit": "${latest.commit}",
      "image": "${latest.image}",
      "runId": ${latest.runId}
    }`;

  const guiText = readFileSync(guiPath, 'utf8')
    .replace(/"productionEvidence": \{\n      "state": "folded_success_run_\d+",\n      "commit": "[^"]+",\n      "image": "[^"]+",\n      "runId": \d+,\n      "runUrl": "https:\/\/github\.com\/RenDeHuang\/OPL-Webui\/actions\/runs\/\d+"\n    \}/, guiEvidence)
    .replace(/"releaseEvidenceChange": "folded_after_successful_controlled_launch_run_\d+"/, `"releaseEvidenceChange": "folded_after_successful_controlled_launch_run_${latest.runId}"`);
  writeFileSync(guiPath, guiText);

  const pageStateText = readFileSync(pageStatePath, 'utf8')
    .replace(/"releaseEvidenceImpact": "folded_success_run_\d+"/, `"releaseEvidenceImpact": "${latest.state}"`)
    .replace(/"productionEvidence": \{\n      "commit": "[^"]+",\n      "image": "[^"]+",\n      "runId": \d+\n    \}/, pageStateEvidence);
  writeFileSync(pageStatePath, pageStateText);
}

function fetchGitHubRun(runId) {
  const output = execFileSync('gh', [
    'run',
    'view',
    String(runId),
    '--json',
    'headSha,workflowName,jobs',
  ], { encoding: 'utf8' });
  const payload = JSON.parse(output);
  return {
    ...payload,
    sanitizedEvidence: parseGitHubRunLogEvidence(fetchGitHubRunLog(runId)),
  };
}

function fetchGitHubRunLog(runId) {
  try {
    return execFileSync('gh', [
      'run',
      'view',
      String(runId),
      '--log',
    ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch {
    return '';
  }
}

function parseGitHubRunLogEvidence(logText) {
  const image = extractImageFromLog(logText);
  const readonlySwitchConfirmed = /OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY:\s*1/.test(logText);
  const readonlySummaryConfirmed = /"medoplReadonly"\s*:\s*true/.test(logText)
    && /"readonlyProjectionChecks"\s*:\s*\[[^\]]*"runtime_status"[^\]]*"materials_deliverables"[^\]]*"billing_summary"[^\]]*\]/s.test(logText);
  return {
    image,
    dogfoodReadonlyConfirmed: readonlySwitchConfirmed && readonlySummaryConfirmed,
  };
}

function extractImageFromLog(logText) {
  const matches = [...logText.matchAll(/uswccr\.ccs\.tencentyun\.com\/webopl\/opl-webui:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}/g)]
    .map((match) => match[0]);
  return matches.at(-1) ?? null;
}

function inferImageFromCommit(commit) {
  if (typeof commit !== 'string' || commit.length < 7) return null;
  return `uswccr.ccs.tencentyun.com/webopl/opl-webui:${commit.slice(0, 7)}`;
}

function formatJsonPreservingCompactTopLevel(value) {
  const compactKeys = new Set(['latestMainEvidence', 'controlledLaunchReadiness']);
  return formatJsonValue(value, 0, ({ key, value: nestedValue }) => compactKeys.has(key) ? JSON.stringify(nestedValue) : null);
}

function formatJsonValue(value, depth, compactOverride = () => null, key = null) {
  const override = compactOverride({ key, value, depth });
  if (override) return override;
  if (shouldRenderCompact(value)) return JSON.stringify(value);
  const indent = '  '.repeat(depth);
  const childIndent = '  '.repeat(depth + 1);
  if (Array.isArray(value)) {
    const items = value.map((item, index) => {
      const suffix = index === value.length - 1 ? '' : ',';
      return `${childIndent}${formatJsonValue(item, depth + 1, compactOverride)}${suffix}`;
    });
    return `[\n${items.join('\n')}\n${indent}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    const lines = entries.map(([entryKey, entryValue], index) => {
      const suffix = index === entries.length - 1 ? '' : ',';
      return `${childIndent}${JSON.stringify(entryKey)}: ${formatJsonValue(entryValue, depth + 1, compactOverride, entryKey)}${suffix}`;
    });
    return `{\n${lines.join('\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

function shouldRenderCompact(value) {
  if (Array.isArray(value)) {
    if (value.every((item) => !item || typeof item !== 'object')) return true;
    if (value.every((item) => item && typeof item === 'object' && !Array.isArray(item) && Object.values(item).every((nested) => !nested || typeof nested !== 'object'))) return true;
  }
  return false;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
