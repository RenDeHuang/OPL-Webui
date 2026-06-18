import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import test from 'node:test';

test('repo bloat audit reports JSON and stays within budget', () => {
  const stdout = execFileSync(process.execPath, ['scripts/repo-bloat-audit.mjs'], {
    encoding: 'utf8',
  });
  const report = JSON.parse(stdout);
  const activeChangeDocPattern = /^changes\/active\/[^/]+\/(?:proposal|spec-delta|design|tasks|eval-plan|review|closeout)\.md$/;
  const activeChangeDocs = report.files.filter((file) => activeChangeDocPattern.test(file));
  const durableMarkdownDocs = report.files.filter((file) => file.endsWith('.md') && !activeChangeDocPattern.test(file));

  assert.equal(report.ok, true, JSON.stringify(report.violations, null, 2));
  assert.ok(report.budgets.files >= report.counts.files);
  assert.equal(report.budgets.maxFileLines, undefined);
  assert.equal(report.lineBudgetPolicy.warning, 260);
  assert.equal(report.lineBudgetPolicy.reviewRequired, 400);
  assert.equal(report.lineBudgetPolicy.splitRequired, 600);
  assert.equal(report.lineBudgetPolicy.defaultMode, 'advisory');
  assert.equal(report.lineBudgetPolicy.strictMode, false);
  assert.equal(
    report.lineBudgetPolicy.exemptions.join(','),
    'generated,fixture,schema',
  );
  assert.equal(
    report.violations.some((violation) => violation.name === 'maxFileLines'),
    false,
  );
  assert.equal(report.counts.activeChangeDocs, activeChangeDocs.length);
  assert.equal(report.counts.markdownDocs, durableMarkdownDocs.length);
  assert.equal(
    report.counts.files,
    report.files.filter((file) => !activeChangeDocPattern.test(file)).length,
  );
  assert.ok(Array.isArray(report.ignoredDirectories));
  assert.equal(existsSync(report.largestFile.path), true);
  assert.equal(report.counts.files, report.files.length - report.counts.activeChangeDocs);
  for (const file of report.files) {
    assert.equal(existsSync(file), true, `bloat audit counted missing file: ${file}`);
  }
});
