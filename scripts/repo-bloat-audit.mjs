#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ignoredDirectories = ['.git', 'node_modules', '.runtime', '.superpowers'];
const budgets = {
  files: 80,
  markdownDocs: 32,
  scripts: 8,
  tests: 16,
  maxFileLines: 260,
};

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
  return !ignoredDirectories.includes(first);
}));

const allFiles = walk().filter((path) => visibleFiles.has(path));
const lineCounts = allFiles.map((path) => ({
  path,
  lines: readFileSync(path, 'utf8').split('\n').length,
}));
const largestFile = lineCounts.reduce((largest, file) => file.lines > largest.lines ? file : largest, {
  path: null,
  lines: 0,
});

const counts = {
  files: visibleFiles.size,
  markdownDocs: allFiles.filter((path) => path.endsWith('.md')).length,
  scripts: allFiles.filter((path) => path.startsWith('scripts/')).length,
  tests: allFiles.filter((path) => path.startsWith('tests/') && statSync(path).isFile()).length,
  maxFileLines: largestFile.lines,
};

const violations = [];
for (const [name, budget] of Object.entries(budgets)) {
  if (counts[name] > budget) {
    violations.push({ name, count: counts[name], budget });
  }
}

const report = {
  ok: violations.length === 0,
  budgets,
  counts,
  largestFile,
  violations,
  ignoredDirectories,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
