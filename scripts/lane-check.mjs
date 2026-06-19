#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { recommendedVerifyTargetsForFiles } from './lane-advisory.mjs';

export const DEFAULT_EVIDENCE_PATH = '.runtime/verify-runs/latest.json';

export function evaluateLaneEvidence({ changedFiles, evidence, diffFingerprint }) {
  const requiredTargets = recommendedVerifyTargetsForFiles(changedFiles);
  const coveredTargets = new Set();
  for (const run of evidence?.runs ?? []) {
    if (run.status !== 'passed') {
      continue;
    }
    if (run.diffFingerprint !== diffFingerprint) {
      continue;
    }
    if (run.target) {
      coveredTargets.add(run.target);
    }
    for (const lane of run.lanes ?? []) {
      coveredTargets.add(lane);
    }
  }

  const missingTargets = requiredTargets.filter((target) => !coveredTargets.has(target));
  return {
    ok: missingTargets.length === 0,
    requiredTargets,
    missingTargets,
    coveredTargets: [...coveredTargets].sort(),
  };
}

export function readVerifyEvidence(path = DEFAULT_EVIDENCE_PATH) {
  if (!existsSync(path)) {
    return { schemaVersion: 1, runs: [] };
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function collectChangedFiles(baseRef = resolveDefaultBaseRef()) {
  const changed = new Set();
  const diff = spawnSync('git', ['diff', '--name-only', baseRef], {
    encoding: 'utf8',
  });
  if (diff.status !== 0) {
    throw new Error(`git diff --name-only ${baseRef} failed:\n${diff.stderr}`);
  }
  for (const file of diff.stdout.split('\n').filter(Boolean)) {
    changed.add(normalizePath(file));
  }

  const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  });
  if (untracked.status !== 0) {
    throw new Error(`git ls-files --others --exclude-standard failed:\n${untracked.stderr}`);
  }
  for (const file of untracked.stdout.split('\n').filter(Boolean)) {
    changed.add(normalizePath(file));
  }

  return [...changed].sort();
}

export function currentDiffFingerprint(baseRef = resolveDefaultBaseRef()) {
  const hash = createHash('sha256');
  hash.update(`base:${baseRef}\n`);

  const diff = spawnSync('git', ['diff', '--binary', baseRef], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50,
  });
  if (diff.status !== 0) {
    throw new Error(`git diff --binary ${baseRef} failed:\n${diff.stderr}`);
  }
  hash.update(diff.stdout);

  const untracked = collectChangedFiles(baseRef).filter((file) => !isTracked(file));
  for (const file of untracked) {
    hash.update(`\nuntracked:${file}\n`);
    if (existsSync(file)) {
      hash.update(readFileSync(file));
    }
  }

  return hash.digest('hex');
}

export function resolveDefaultBaseRef() {
  if (process.env.OPL_LANE_BASE) {
    return process.env.OPL_LANE_BASE;
  }
  for (const candidate of ['origin/main', 'main', 'HEAD']) {
    const result = spawnSync('git', ['merge-base', 'HEAD', candidate], {
      encoding: 'utf8',
    });
    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }
  }
  return 'HEAD';
}

function isTracked(file) {
  const result = spawnSync('git', ['ls-files', '--error-unmatch', file], {
    stdio: 'ignore',
  });
  return result.status === 0;
}

function normalizePath(file) {
  return String(file ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
}

function runCLI() {
  const baseRef = process.env.OPL_LANE_BASE ?? resolveDefaultBaseRef();
  const changedFiles = collectChangedFiles(baseRef);
  const diffFingerprint = currentDiffFingerprint(baseRef);
  const evidence = readVerifyEvidence();
  const result = evaluateLaneEvidence({ changedFiles, evidence, diffFingerprint });

  if (changedFiles.length === 0) {
    console.log('[lane-check] no changed files detected');
    return 0;
  }

  console.log(`[lane-check] base: ${baseRef}`);
  console.log(`[lane-check] changed files: ${changedFiles.join(', ')}`);
  if (result.requiredTargets.length === 0) {
    console.log('[lane-check] no targeted lanes inferred');
    return 0;
  }

  console.log(`[lane-check] required: ${result.requiredTargets.join(', ')}`);
  console.log(`[lane-check] covered: ${result.coveredTargets.join(', ') || '(none)'}`);
  if (result.ok) {
    console.log('[lane-check] required lanes have fresh verification evidence');
    return 0;
  }

  console.error(`[lane-check] missing fresh verification evidence: ${result.missingTargets.join(', ')}`);
  console.error('[lane-check] run the missing npm run verify:<lane> commands after the current diff is final');
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(runCLI());
}
