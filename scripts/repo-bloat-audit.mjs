#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ignoredDirectories = ['.git', 'node_modules', '.runtime', '.superpowers'];
const surfaceInventoryPath = 'contracts/web-surface-inventory.json';
const portfolioSignals = {
  mode: 'report-only',
  files: 85,
  markdownDocs: 24,
  scripts: 8,
  tests: 17,
};
const lineBudgetPolicy = {
  hardCap: 1000,
  defaultMode: 'hard-cap',
  exemptions: ['generated', 'fixture', 'schema'],
};
const requiredRecurringDocs = Object.freeze([
  'README.md',
  'AGENTS.md',
  'TASTE.md',
  'docs/project.md',
  'docs/status.md',
  'docs/decisions.md',
  'docs/architecture.md',
  'docs/invariants.md',
  'docs/docs_portfolio_consolidation.md',
  'docs/active/README.md',
  'docs/history/process/closeouts.md',
  'docs/history/tombstones/README.md',
]);
const selectedOwnerSourceSurfaces = Object.freeze([
  'frontend/web/src/onePersonLabWeb.mjs',
  'backend/control-plane-go/cmd/opl-webui-control-plane/main.go',
]);

function gitFiles(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

function walk(dir = '.') {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirectories.includes(entry.name)) continue;
    const path = dir === '.' ? entry.name : join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

const tracked = gitFiles(['ls-files']);
const untracked = gitFiles(['ls-files', '--others', '--exclude-standard']);
const visibleFiles = new Set([...tracked, ...untracked].filter((path) => {
  const first = path.split('/')[0];
  return !ignoredDirectories.includes(first) && statSync(path, { throwIfNoEntry: false })?.isFile();
}));

const allFiles = walk().filter((path) => visibleFiles.has(path));
const durableFiles = allFiles;
const inventory = readSurfaceInventory();
const inventoryPaths = new Set(inventory.surfaces.map((surface) => surface.path));
const monitoredSurfaces = allFiles.filter(isMonitoredSurface);
const ownedGrowth = monitoredSurfaces.filter((path) => inventoryPaths.has(path)).sort();
const orphanGrowth = monitoredSurfaces.filter((path) => !inventoryPaths.has(path)).sort();
const lineCounts = allFiles.map((path) => ({
  path,
  lines: readFileSync(path, 'utf8').split('\n').length,
}));
const largestFile = lineCounts.reduce((largest, file) => file.lines > largest.lines ? file : largest, {
  path: null,
  lines: 0,
});

const counts = {
  files: durableFiles.length,
  markdownDocs: allFiles.filter((path) => path.endsWith('.md')).length,
  scripts: allFiles.filter((path) => path.startsWith('scripts/')).length,
  tests: allFiles.filter((path) => path.startsWith('tests/') && statSync(path).isFile()).length,
  maxFileLines: largestFile.lines,
};

const violations = [];
const portfolioFindings = [];
for (const orphan of orphanGrowth) {
  violations.push({
    name: 'orphanSurface',
    path: orphan,
    message: 'Long-lived surface must be registered in contracts/web-surface-inventory.json with owner and consumer.',
  });
}

for (const [name, budget] of Object.entries(portfolioSignals)) {
  if (name === 'mode') continue;
  if (counts[name] > budget) {
    const ownership = ownershipForPortfolioSignal(name);
    portfolioFindings.push({
      name,
      count: counts[name],
      budget,
      severity: portfolioSignals.mode,
      ownedCount: ownership.ownedCount,
      orphanCount: ownership.orphanCount,
      message: 'Portfolio size signal only; inspect ownership, consumers, and retired surfaces before deleting files.',
    });
  }
}
const lineBudgetFindings = lineCounts
  .map((file) => ({
    ...file,
    severity: lineSeverity(file.lines),
    exempt: isLineBudgetExempt(file.path),
  }))
  .filter((file) => file.severity !== 'ok');

for (const file of lineBudgetFindings) {
  if (!file.exempt) {
    violations.push({
      name: 'lineBudget',
      path: file.path,
      count: file.lines,
      budget: lineBudgetPolicy.hardCap,
    });
  }
}

const report = {
  ok: violations.length === 0,
  budgets: portfolioSignals,
  portfolioPolicy: {
    fileCountMode: 'report-only',
    hardFailures: ['lineBudget', 'retiredSurface', 'testRegistry', 'contractViolation', 'orphanSurface'],
  },
  inventoryOwnership: {
    inventoryPath: surfaceInventoryPath,
    inventorySurfaceCount: inventory.surfaces.length,
    monitoredSurfaceCount: monitoredSurfaces.length,
    ownedCount: ownedGrowth.length,
    orphanCount: orphanGrowth.length,
    ownedGrowth,
    orphanGrowth,
  },
  portfolioFindings,
  lineBudgetPolicy,
  counts,
  largestFile,
  lineBudgetFindings,
  violations,
  ignoredDirectories,
  files: allFiles,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);

function lineSeverity(lines) {
  if (lines > lineBudgetPolicy.hardCap) return 'hard-cap-exceeded';
  return 'ok';
}

function isLineBudgetExempt(path) {
  return /(^|\/)(fixtures?|generated|schema)(\/|$)/i.test(path)
    || /\.(schema|fixture)\./i.test(path)
    || path.endsWith('.schema.json');
}

function readSurfaceInventory() {
  if (!existsSync(surfaceInventoryPath)) {
    return { surfaces: [] };
  }
  const parsed = JSON.parse(readFileSync(surfaceInventoryPath, 'utf8'));
  if (!Array.isArray(parsed.surfaces)) {
    return { surfaces: [] };
  }
  return parsed;
}

function isMonitoredSurface(path) {
  return (path.startsWith('scripts/') && path.endsWith('.mjs'))
    || (path.startsWith('contracts/') && path.endsWith('.json'))
    || path.startsWith('tests/')
    || (path.startsWith('backend/') && path.endsWith('_test.go'))
    || path.startsWith('.github/workflows/')
    || path.startsWith('deploy/web-cloud/')
    || requiredRecurringDocs.includes(path)
    || selectedOwnerSourceSurfaces.includes(path)
    || path === 'package.json';
}

function ownershipForPortfolioSignal(name) {
  const paths = filesForPortfolioSignal(name);
  return {
    ownedCount: paths.filter((path) => inventoryPaths.has(path)).length,
    orphanCount: paths.filter((path) => isMonitoredSurface(path) && !inventoryPaths.has(path)).length,
  };
}

function filesForPortfolioSignal(name) {
  if (name === 'markdownDocs') {
    return allFiles.filter((path) => path.endsWith('.md'));
  }
  if (name === 'scripts') {
    return allFiles.filter((path) => path.startsWith('scripts/'));
  }
  if (name === 'tests') {
    return allFiles.filter((path) => path.startsWith('tests/') && statSync(path).isFile());
  }
  return durableFiles;
}
