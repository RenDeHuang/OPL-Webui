import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

test('repo bloat audit reports JSON and stays within budget', () => {
  const stdout = execFileSync(process.execPath, ['scripts/repo-bloat-audit.mjs'], {
    encoding: 'utf8',
  });
  const report = JSON.parse(stdout);

  assert.equal(report.ok, true, JSON.stringify(report.violations, null, 2));
  assert.ok(report.budgets.files >= report.counts.files);
  assert.ok(Array.isArray(report.ignoredDirectories));
});
