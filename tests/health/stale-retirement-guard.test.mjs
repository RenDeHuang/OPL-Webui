import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
