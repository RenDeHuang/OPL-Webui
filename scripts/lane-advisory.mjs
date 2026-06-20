#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TARGET_ORDER = Object.freeze(['smoke', 'contract', 'go', 'browser', 'deploy', 'health', 'full']);

const RULES = Object.freeze([
  Object.freeze({
    name: 'opl bridge or runtime gate',
    matches: (file) => file.startsWith('services/control-plane-go/internal/oplbridge/')
      || file.startsWith('services/control-plane-go/internal/runtimegate/')
      || file === 'contracts/web-runtime-bridge.json',
    targets: Object.freeze(['contract', 'go', 'full']),
  }),
  Object.freeze({
    name: 'page state contract',
    matches: (file) => file === 'contracts/web-page-state-matrix.json',
    targets: Object.freeze(['contract', 'browser']),
  }),
  Object.freeze({
    name: 'web shell',
    matches: (file) => file.startsWith('apps/web/'),
    targets: Object.freeze(['smoke', 'browser']),
  }),
  Object.freeze({
    name: 'go control plane',
    matches: (file) => file.startsWith('services/control-plane-go/'),
    targets: Object.freeze(['contract', 'go']),
  }),
  Object.freeze({
    name: 'deploy surface',
    matches: (file) => file.startsWith('deploy/')
      || file.startsWith('.github/workflows/')
      || file === 'scripts/cloud-rollout.mjs'
      || file === 'scripts/release-evidence-sync.mjs'
      || file === 'Dockerfile'
      || file === 'Dockerfile.cloud'
      || file === '.dockerignore'
      || file === '.dockerignore.cloud'
      || file === 'contracts/web-release-profile.json',
    targets: Object.freeze(['deploy', 'health']),
  }),
  Object.freeze({
    name: 'public contract',
    matches: (file) => file.startsWith('contracts/') || file.startsWith('tests/contract/'),
    targets: Object.freeze(['contract']),
  }),
  Object.freeze({
    name: 'test workflow',
    matches: (file) => file === 'package.json'
      || file === 'scripts/verify.mjs'
      || file === 'scripts/test-classification.mjs'
      || file === 'scripts/workflow-gate.mjs'
      || file === 'scripts/lane-advisory.mjs'
      || file === 'scripts/lane-check.mjs'
      || file === 'scripts/ai-development-gate.mjs'
      || file === 'contracts/web-development-profile.json'
      || file.startsWith('tests/health/'),
    targets: Object.freeze(['health']),
  }),
  Object.freeze({
    name: 'browser test',
    matches: (file) => file.startsWith('tests/browser/'),
    targets: Object.freeze(['browser']),
  }),
  Object.freeze({
    name: 'smoke test',
    matches: (file) => file.startsWith('tests/smoke/'),
    targets: Object.freeze(['smoke']),
  }),
  Object.freeze({
    name: 'go test',
    matches: (file) => file.endsWith('_test.go'),
    targets: Object.freeze(['go']),
  }),
]);

export function recommendedVerifyTargetsForFiles(files) {
  const targets = new Set();
  for (const file of files.map(normalizePath).filter(Boolean)) {
    for (const rule of RULES) {
      if (!rule.matches(file)) {
        continue;
      }
      for (const target of rule.targets) {
        targets.add(target);
      }
    }
  }
  return TARGET_ORDER.filter((target) => targets.has(target));
}

function changedFilesFromGit() {
  const result = spawnSync('git', ['diff', '--name-only', 'HEAD'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return [];
  }
  return result.stdout.split('\n').filter(Boolean);
}

function normalizePath(file) {
  return String(file ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
}

function printAdvisory(files) {
  const changedFiles = files.length > 0 ? files : changedFilesFromGit();
  const targets = recommendedVerifyTargetsForFiles(changedFiles);

  if (changedFiles.length === 0) {
    console.log('[lane-advisory] no changed files detected');
    return;
  }

  console.log(`[lane-advisory] changed files: ${changedFiles.join(', ')}`);
  if (targets.length === 0) {
    console.log('[lane-advisory] no targeted lanes inferred; run npm run verify for current gate coverage');
    return;
  }

  console.log(`[lane-advisory] recommended: ${targets.map((target) => `npm run verify:${target}`).join(' && ')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  printAdvisory(process.argv.slice(2));
}
