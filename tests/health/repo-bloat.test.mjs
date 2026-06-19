import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('repo bloat audit reports JSON and treats file count as portfolio signal', () => {
  const source = readFileSync('scripts/repo-bloat-audit.mjs', 'utf8');
  const stdout = execFileSync(process.execPath, ['scripts/repo-bloat-audit.mjs'], {
    encoding: 'utf8',
  });
  const report = JSON.parse(stdout);
  const durableMarkdownDocs = report.files.filter((file) => file.endsWith('.md'));

  assert.equal(report.ok, true, JSON.stringify(report.violations, null, 2));
  assert.equal(report.budgets.mode, 'report-only');
  assert.equal(report.portfolioPolicy.fileCountMode, 'report-only');
  assert.deepEqual(report.portfolioPolicy.hardFailures, [
    'lineBudget', 'retiredSurface', 'testRegistry', 'contractViolation',
  ]);
  assert.ok(report.budgets.files > 0);
  assert.equal(report.budgets.maxFileLines, undefined);
  assert.equal(report.lineBudgetPolicy.hardCap, 1000);
  assert.equal(report.lineBudgetPolicy.defaultMode, 'hard-cap');
  assert.equal(report.lineBudgetPolicy.warning, undefined);
  assert.equal(report.lineBudgetPolicy.reviewRequired, undefined);
  assert.equal(report.lineBudgetPolicy.splitRequired, undefined);
  assert.equal(
    report.lineBudgetPolicy.exemptions.join(','),
    'generated,fixture,schema',
  );
  assert.equal(report.lineBudgetFindings.length, 0);
  assert.equal(
    report.violations.some((violation) => violation.name === 'maxFileLines'),
    false,
  );
  assert.doesNotMatch(source, /\b260\b|\b400\b|\b600\b|strict-lines|strictMode|reviewRequired|splitRequired/);
  assert.equal(report.counts.activeChangeDocs, undefined);
  assert.equal(report.counts.markdownDocs, durableMarkdownDocs.length);
  assert.equal(report.counts.files, report.files.length);
  assert.equal(Array.isArray(report.portfolioFindings), true);
  for (const finding of report.portfolioFindings) {
    assert.equal(finding.severity, 'report-only');
    assert.match(finding.message, /Portfolio size signal only/);
  }
  assert.ok(Array.isArray(report.ignoredDirectories));
  assert.equal(existsSync(report.largestFile.path), true);
  for (const file of report.files) {
    assert.equal(existsSync(file), true, `bloat audit counted missing file: ${file}`);
  }
});
