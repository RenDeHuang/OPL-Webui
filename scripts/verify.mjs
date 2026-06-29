#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { TEST_LANE_REGISTRY, VERIFY_SUITES } from './test-classification.mjs';
import {
  collectChangedFiles,
  currentDiffFingerprint,
  DEFAULT_EVIDENCE_PATH,
  resolveDefaultBaseRef,
} from './lane-check.mjs';
import { recommendedVerifyTargetsForFiles } from './lane-advisory.mjs';

const mode = process.argv[2] ?? 'current';
const target = mode === 'suite' ? process.argv[3] : mode;
const changedFiles = mode === 'dev' ? process.argv.slice(3) : [];
const lanes = resolveLanes(mode, target, changedFiles);
const serializedNodeLanes = new Set(['browser']);

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
    const args = ['--test', ...(serializedNodeLanes.has(laneName) ? ['--test-concurrency=1'] : []), ...nodeFiles];
    const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
    if (result.status !== 0) {
      failed = true;
    }
  }

  const goEntries = lane.tests.filter((entry) => entry.runner === 'go');
  for (const entry of uniqueGoPackageEntries(goEntries)) {
    console.log(`[verify] ${laneName}: go test ${entry.goPackage}`);
    const result = spawnSync('go', ['test', entry.goPackage], { cwd: entry.cwd, stdio: 'inherit' });
    if (result.status !== 0) {
      failed = true;
    }
  }
}

if (!failed) {
  writeVerifyEvidence({ target, lanes });
}

process.exit(failed ? 1 : 0);

function resolveLanes(currentMode, currentTarget, files) {
  if (currentMode === 'dev') {
    const changed = files.length > 0 ? files : collectChangedFiles(resolveDefaultBaseRef());
    const impactedTargets = recommendedVerifyTargetsForFiles(changed);
    const devTargets = impactedTargets.length > 0 ? impactedTargets : ['fast'];
    const laneNames = new Set(['fast']);
    for (const devTarget of devTargets) {
      const suite = VERIFY_SUITES[devTarget] ?? (TEST_LANE_REGISTRY[devTarget] ? [devTarget] : undefined);
      if (!suite) {
        throw new Error(`Dev verify inferred unknown target: ${devTarget}`);
      }
      for (const laneName of suite) {
        laneNames.add(laneName);
      }
    }
    return [...laneNames];
  }

  return VERIFY_SUITES[currentTarget] ?? (TEST_LANE_REGISTRY[currentTarget] ? [currentTarget] : undefined);
}

function uniqueGoPackageEntries(entries) {
  const seen = new Set();
  const unique = [];
  for (const entry of entries) {
    const key = `${entry.cwd}:${entry.goPackage}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(entry);
  }
  return unique;
}

function writeVerifyEvidence(run) {
  const evidencePath = process.env.OPL_VERIFY_EVIDENCE_PATH ?? DEFAULT_EVIDENCE_PATH;
  const previous = readExistingEvidence(evidencePath);
  const baseRef = process.env.OPL_LANE_BASE ?? resolveDefaultBaseRef();
  const nextRun = {
    target: run.target,
    lanes: run.lanes,
    status: 'passed',
    baseRef,
    diffFingerprint: currentDiffFingerprint(baseRef),
    completedAt: new Date().toISOString(),
  };
  const runs = [...(previous.runs ?? []), nextRun].slice(-50);
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify({ schemaVersion: 1, runs }, null, 2)}\n`);
}

function readExistingEvidence(evidencePath) {
  try {
    return JSON.parse(readFileSync(evidencePath, 'utf8'));
  } catch {
    return { schemaVersion: 1, runs: [] };
  }
}
