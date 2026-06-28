#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TARGET_ORDER = Object.freeze([
  'smoke',
  'interaction',
  'contract',
  'go',
  'browser',
  'integration',
  'real-medopl',
  'health',
  'release',
  'full',
]);

const RULES = Object.freeze([
  Object.freeze({
    name: 'opl bridge or runtime gate',
    matches: (file) => file.startsWith('services/control-plane-go/internal/oplbridge/')
      || file.startsWith('services/control-plane-go/internal/runtimegate/')
      || file === 'contracts/web-runtime-bridge.json',
    targets: Object.freeze(['integration']),
  }),
  Object.freeze({
    name: 'interaction contract',
    matches: (file) => file === 'contracts/web-interaction-contract.json'
      || file === 'contracts/web-gui-product-contract.json',
    targets: Object.freeze(['interaction', 'contract']),
  }),
  Object.freeze({
    name: 'page state contract',
    matches: (file) => file === 'contracts/web-page-state-matrix.json',
    targets: Object.freeze(['interaction', 'contract', 'browser']),
  }),
  Object.freeze({
    name: 'web shell',
    matches: (file) => file.startsWith('apps/web/'),
    targets: Object.freeze(['smoke', 'interaction', 'browser']),
  }),
  Object.freeze({
    name: 'go control plane',
    matches: (file) => file.startsWith('services/control-plane-go/')
      && !file.startsWith('services/control-plane-go/internal/oplbridge/')
      && !file.startsWith('services/control-plane-go/internal/runtimegate/'),
    targets: Object.freeze(['contract', 'go']),
  }),
  Object.freeze({
    name: 'release surface',
    matches: (file) => file.startsWith('deploy/')
      || file.startsWith('.github/workflows/')
      || file === 'scripts/cloud-rollout.mjs'
      || file === 'scripts/release-evidence-sync.mjs'
      || file === 'Dockerfile'
      || file === 'Dockerfile.cloud'
      || file === '.dockerignore'
      || file === '.dockerignore.cloud'
      || file === 'contracts/web-release-profile.json',
    targets: Object.freeze(['release']),
  }),
  Object.freeze({
    name: 'public contract',
    matches: (file) => (file.startsWith('contracts/') || file.startsWith('tests/contract/'))
      && file !== 'contracts/web-release-profile.json'
      && file !== 'contracts/web-runtime-bridge.json'
      && file !== 'contracts/web-interaction-contract.json'
      && file !== 'contracts/web-gui-product-contract.json'
      && file !== 'contracts/web-page-state-matrix.json'
      && file !== 'contracts/web-development-profile.json'
      && file !== 'contracts/web-surface-inventory.json',
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
      || file === 'contracts/web-development-profile.json'
      || file === 'contracts/web-surface-inventory.json'
      || (file.startsWith('tests/health/') && file !== 'tests/health/ai-development-gate.test.mjs' && file !== 'tests/health/workflow-entrypoint.test.mjs'),
    targets: Object.freeze(['health']),
  }),
  Object.freeze({
    name: 'release workflow',
    matches: (file) => file === 'scripts/ai-development-gate.mjs'
      || file === 'tests/health/ai-development-gate.test.mjs'
      || file === 'tests/health/workflow-entrypoint.test.mjs',
    targets: Object.freeze(['release']),
  }),
  Object.freeze({
    name: 'interaction browser test',
    matches: (file) => file === 'tests/browser/public-growth-login-return.browser.test.mjs'
      || file === 'tests/browser/interaction-truth.browser.test.mjs',
    targets: Object.freeze(['interaction', 'browser']),
  }),
  Object.freeze({
    name: 'browser test',
    matches: (file) => file.startsWith('tests/browser/')
      && file !== 'tests/browser/public-growth-login-return.browser.test.mjs'
      && file !== 'tests/browser/interaction-truth.browser.test.mjs',
    targets: Object.freeze(['browser']),
  }),
  Object.freeze({
    name: 'real medopl e2e',
    matches: (file) => file.startsWith('tests/real-medopl/'),
    targets: Object.freeze(['real-medopl']),
  }),
  Object.freeze({
    name: 'smoke test',
    matches: (file) => file.startsWith('tests/smoke/'),
    targets: Object.freeze(['smoke']),
  }),
  Object.freeze({
    name: 'go test',
    matches: (file) => file.endsWith('_test.go')
      && !file.startsWith('services/control-plane-go/internal/oplbridge/')
      && !file.startsWith('services/control-plane-go/internal/runtimegate/'),
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
