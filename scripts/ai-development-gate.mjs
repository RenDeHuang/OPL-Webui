#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_RELEASE_PROFILE = 'contracts/web-release-profile.json';
const DEFAULT_STATUS_DOC = 'docs/status.md';
const DEFAULT_ACTIVE_DOC = 'docs/active/README.md';

export function runAiDevelopmentGate(options = {}) {
  const findings = [];
  const releaseProfilePath = options.releaseProfile ?? DEFAULT_RELEASE_PROFILE;
  const statusDocPath = options.statusDoc ?? DEFAULT_STATUS_DOC;
  const activeDocPath = options.activeDoc ?? DEFAULT_ACTIVE_DOC;

  requireFile('contracts/web-development-profile.json', findings);
  requireFile(releaseProfilePath, findings);
  requireFile(statusDocPath, findings);

  const releaseProfile = readJsonIfExists(releaseProfilePath);
  const statusText = readTextIfExists(statusDocPath);
  const activeText = readTextIfExists(activeDocPath);
  validateProductionBrowserClaimFreshness({ releaseProfile, statusText, activeText, findings });

  if (!options.skipDiff) {
    validateChangedFiles(findings);
  }

  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`[gate:ai] ${finding}`);
    }
    return 1;
  }

  console.log('[gate:ai] development profile, claim freshness, and changed-file policy passed');
  return 0;
}

export function validateProductionBrowserClaimFreshness({ releaseProfile, statusText, activeText, findings }) {
  const browser = releaseProfile?.productionBrowserE2EReadiness;
  const latestAttempt = browser?.latestAttempt;
  if (!latestAttempt || latestAttempt.status !== 'failure') {
    return;
  }

  const combinedText = `${statusText}\n${activeText}`;
  const stalePendingClaim = /production browser e2e harness is ready(?:[\s\S]{0,160})not yet executed/i.test(combinedText)
    || /Production browser e2e harness is ready but not yet executed/i.test(combinedText)
    || /没有执行 production browser e2e/i.test(combinedText)
    || /production browser e2e[\s\S]{0,80}只是 harness ready/i.test(combinedText);
  const mentionsFailedRun = String(latestAttempt.runId ? latestAttempt.runId : '').length > 0
    && combinedText.includes(String(latestAttempt.runId))
    && /failed|failure|失败/i.test(combinedText);

  if (stalePendingClaim || !mentionsFailedRun) {
    findings.push(
      `production browser e2e claim is stale: latest attempt ${latestAttempt.runId ?? '(unknown run)'} failed at ${latestAttempt.failedStage ?? 'unknown stage'}`,
    );
  }
}

function validateChangedFiles(findings) {
  const changedFiles = collectChangedFiles();
  if (changedFiles.length === 0) {
    return;
  }

  if (changedFiles.some((file) => file === 'tests/health/ai-development-gate.test.mjs')) {
    requireChanged(changedFiles, 'contracts/web-development-profile.json', findings);
    requireChanged(changedFiles, 'scripts/ai-development-gate.mjs', findings);
    requireChanged(changedFiles, 'scripts/test-classification.mjs', findings);
  }

  const newTests = changedFiles.filter((file) => file.startsWith('tests/') && file.endsWith('.test.mjs') && isUntracked(file));
  if (newTests.length > 0) {
    const registryText = readTextIfExists('scripts/test-classification.mjs');
    for (const testFile of newTests) {
      if (!registryText.includes(testFile)) {
        findings.push(`new test is not registered in scripts/test-classification.mjs: ${testFile}`);
      }
    }
  }
}

function requireFile(path, findings) {
  if (!existsSync(path)) {
    findings.push(`missing required development gate file: ${path}`);
  }
}

function requireChanged(changedFiles, requiredFile, findings) {
  if (!changedFiles.includes(requiredFile)) {
    findings.push(`change set must include ${requiredFile}`);
  }
}

function collectChangedFiles() {
  const base = resolveBaseRef();
  const files = new Set();
  const diff = spawnSync('git', ['diff', '--name-only', base], { encoding: 'utf8' });
  if (diff.status === 0) {
    for (const line of diff.stdout.split('\n').filter(Boolean)) {
      files.add(normalizePath(line));
    }
  }
  const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' });
  if (untracked.status === 0) {
    for (const line of untracked.stdout.split('\n').filter(Boolean)) {
      files.add(normalizePath(line));
    }
  }
  return [...files].sort();
}

function isUntracked(file) {
  const result = spawnSync('git', ['ls-files', '--error-unmatch', file], { stdio: 'ignore' });
  return result.status !== 0;
}

function resolveBaseRef() {
  if (process.env.OPL_LANE_BASE) {
    return process.env.OPL_LANE_BASE;
  }
  for (const candidate of ['origin/main', 'main', 'HEAD']) {
    const result = spawnSync('git', ['merge-base', 'HEAD', candidate], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }
  }
  return 'HEAD';
}

function readJsonIfExists(path) {
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readTextIfExists(path) {
  if (!existsSync(path)) {
    return '';
  }
  return readFileSync(path, 'utf8');
}

function normalizePath(file) {
  return String(file ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--skip-diff') {
      options.skipDiff = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    if (token === '--release-profile') {
      options.releaseProfile = value;
      index += 1;
      continue;
    }
    if (token === '--status-doc') {
      options.statusDoc = value;
      index += 1;
      continue;
    }
    if (token === '--active-doc') {
      options.activeDoc = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(runAiDevelopmentGate(parseArgs(process.argv.slice(2))));
}
