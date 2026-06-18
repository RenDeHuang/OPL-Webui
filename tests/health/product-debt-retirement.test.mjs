import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const activeRoots = [
  'AGENTS.md',
  'TASTE.md',
  'changes/README.md',
  'docs',
  'contracts',
  'deploy',
  'scripts',
  'tests',
  'apps',
  'services',
  'package.json',
];

const allowedPatterns = [
  /^changes\/archive\/closeouts\.md$/,
  /^changes\/active\/product-debt-retirement\//,
  /^tests\/health\/product-debt-retirement\.test\.mjs$/,
  /^tests\/health\/stale-retirement-guard\.test\.mjs$/,
  /^tests\/contract\/go-control-plane-http\.test\.mjs$/,
  /^tests\/contract\/one-person-lab-web-data\.test\.mjs$/,
  /^tests\/smoke\/web-shell\.test\.mjs$/,
  /^apps\/web\/styles\.css$/,
];

function* walk(path) {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (!stat) return;
  if (stat.isFile()) {
    yield path;
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.runtime') continue;
    yield* walk(join(path, entry.name));
  }
}

function activeTextFiles() {
  return activeRoots
    .flatMap((root) => [...walk(root)])
    .filter((path) => /\.(?:go|mjs|js|md|json|css|html|toml|yml)$/.test(path))
    .filter((path) => !allowedPatterns.some((pattern) => pattern.test(path)));
}

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

test('line budget policy uses one product hard cap only', async () => {
  const source = readFileSync('scripts/repo-bloat-audit.mjs', 'utf8');
  const report = JSON.parse(
    await import('node:child_process').then(({ execFileSync }) =>
      execFileSync(process.execPath, ['scripts/repo-bloat-audit.mjs'], { encoding: 'utf8' }),
    ),
  );

  assert.equal(report.lineBudgetPolicy.hardCap, 1000);
  assert.equal(report.lineBudgetPolicy.defaultMode, 'hard-cap');
  assert.equal(report.lineBudgetPolicy.warning, undefined);
  assert.equal(report.lineBudgetPolicy.reviewRequired, undefined);
  assert.equal(report.lineBudgetPolicy.splitRequired, undefined);
  assert.equal(report.lineBudgetFindings.length, 0);
  assert.doesNotMatch(source, /\b260\b|\b400\b|\b600\b|strict-lines|strictMode|reviewRequired|splitRequired/);
});
