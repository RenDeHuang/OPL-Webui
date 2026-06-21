#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const registryPath = 'contracts/web-gap-phase-registry.json';
const defaultRuntimeRoot = '.runtime/phase-runs';

export function buildPhaseStatusReport(registry) {
  const gaps = registry.gaps.map((gap) => {
    const currentPhase = gap.phases.find((phase) => phase.id === gap.currentPhaseId);
    const status = gap.currentStatus ?? statusFromPhase(currentPhase);
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
      readyToAdvance: status === 'done',
      cannotClaim: gap.cannotClaim,
      blockers: status === 'blocked' ? currentPhase?.blockerTypes ?? [] : [],
      requiredEvals: currentPhase?.requiredEvals.map((evalRef) => evalRef.id) ?? [],
      evidenceSources: currentPhase?.evidenceSources ?? [],
    };
  });
  const blockedClaims = uniqueStrings(
    gaps
      .filter((gap) => gap.status !== 'done')
      .flatMap((gap) => gap.cannotClaim),
  );

  return {
    productId: registry.productId,
    generatedAt: new Date().toISOString(),
    goalComplete: gaps.every((gap) => gap.status === 'done'),
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
