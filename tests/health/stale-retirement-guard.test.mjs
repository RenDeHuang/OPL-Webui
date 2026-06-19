import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const scannedRoots = [
  'apps/web',
  'services/control-plane-go',
  'scripts',
  'contracts',
  'tests',
];

const allowedFiles = new Set([
  'tests/health/stale-retirement-guard.test.mjs',
  'tests/contract/fixed-truth-lifecycle.test.mjs',
  'tests/smoke/web-shell.test.mjs',
  'tests/contract/go-control-plane-http.test.mjs',
  'tests/contract/one-person-lab-web-data.test.mjs',
]);

const forbiddenPatterns = [
  /services\/control-plane-go\/internal\/mvp/i,
  /internal\/mvp/i,
  /package\s+mvp\b/i,
  /\bmvp\./,
  /\/api\/mvp\/task/i,
  /demoData/i,
  /demo:\/\//i,
  /fake storage/i,
  /fake billing/i,
  /fake runtime execution/i,
];

const activeRoots = [
  'AGENTS.md',
  'TASTE.md',
  'README.md',
  'docs',
  'contracts',
  'deploy',
  'scripts',
  'tests',
  'apps',
  'services',
  'package.json',
];

const productDebtAllowedPatterns = [
  /^docs\/history\/process\/closeouts\.md$/,
  /^docs\/history\/tombstones\/README\.md$/,
  /^tests\/health\/stale-retirement-guard\.test\.mjs$/,
  /^tests\/contract\/fixed-truth-lifecycle\.test\.mjs$/,
  /^tests\/contract\/go-control-plane-http\.test\.mjs$/,
  /^tests\/contract\/one-person-lab-web-data\.test\.mjs$/,
  /^tests\/smoke\/web-shell\.test\.mjs$/,
  /^apps\/web\/styles\.css$/,
];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
      continue;
    }
    if (entry.isFile() && /\.(?:go|mjs|js|md|json|css|html)$/.test(entry.name)) {
      yield path;
    }
  }
}

function* walkAny(path) {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (!stat) return;
  if (stat.isFile()) {
    yield path;
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.runtime') continue;
    yield* walkAny(join(path, entry.name));
  }
}

function activeTextFiles() {
  return activeRoots
    .flatMap((root) => [...walkAny(root)])
    .filter((path) => /\.(?:go|mjs|js|md|json|css|html|toml|yml)$/.test(path))
    .filter((path) => !productDebtAllowedPatterns.some((pattern) => pattern.test(path)));
}

test('active surfaces do not revive retired demo or public MVP vocabulary', () => {
  const violations = [];

  for (const root of scannedRoots) {
    if (!existsSync(root)) continue;
    for (const file of walk(root)) {
      if (allowedFiles.has(file)) continue;
      const text = readFileSync(file, 'utf8');
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(text)) {
          violations.push(`${file}: ${pattern}`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('active product surfaces do not present MVP transition naming', () => {
  const violations = [];
  for (const file of activeTextFiles()) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of [/cloud-mvp/i, /cloud_mvp/i, /\bmvp\b/i]) {
      if (pattern.test(text)) {
        violations.push(`${file}: ${pattern}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
