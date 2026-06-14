#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

import { TEST_LANE_REGISTRY, VERIFY_SUITES } from './test-classification.mjs';

const mode = process.argv[2] ?? 'current';
const target = mode === 'suite' ? process.argv[3] : mode;
const lanes = VERIFY_SUITES[target] ?? (TEST_LANE_REGISTRY[target] ? [target] : undefined);

if (!lanes) {
  console.error(`Unknown verify target: ${target}`);
  console.error(`Known targets: ${[...Object.keys(VERIFY_SUITES), ...Object.keys(TEST_LANE_REGISTRY)].join(', ')}`);
  process.exit(1);
}

let failed = false;
for (const laneName of lanes) {
  const lane = TEST_LANE_REGISTRY[laneName];
  if (!lane) {
    console.error(`Suite ${target} references unknown lane: ${laneName}`);
    failed = true;
    continue;
  }

  if (lane.tests.length === 0) {
    console.log(`[verify] ${laneName}: no tests registered`);
    continue;
  }

  const nodeFiles = lane.tests.filter((entry) => entry.runner === 'node').map((entry) => entry.file);
  if (nodeFiles.length > 0) {
    console.log(`[verify] ${laneName}: ${nodeFiles.join(', ')}`);
    const result = spawnSync(process.execPath, ['--test', ...nodeFiles], { stdio: 'inherit' });
    if (result.status !== 0) {
      failed = true;
    }
  }

  const goEntries = lane.tests.filter((entry) => entry.runner === 'go');
  for (const entry of goEntries) {
    console.log(`[verify] ${laneName}: go test ${entry.goPackage}`);
    const result = spawnSync('go', ['test', entry.goPackage], { cwd: entry.cwd, stdio: 'inherit' });
    if (result.status !== 0) {
      failed = true;
    }
  }
}

process.exit(failed ? 1 : 0);
