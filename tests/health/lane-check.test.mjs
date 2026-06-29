import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  evaluateLaneEvidence,
  readVerifyEvidence,
} from '../../scripts/lane-check.mjs';

test('lane check fails when required lanes have no matching verification evidence', () => {
  const result = evaluateLaneEvidence({
    changedFiles: ['frontend/web/src/onePersonLabWeb.mjs'],
    evidence: { runs: [] },
    diffFingerprint: 'current-diff',
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.requiredTargets, ['ui', 'smoke', 'interaction', 'browser:golden']);
  assert.deepEqual(result.missingTargets, ['ui', 'smoke', 'interaction', 'browser:golden']);
});

test('lane check accepts targeted lane evidence for the same diff fingerprint', () => {
  const result = evaluateLaneEvidence({
    changedFiles: ['frontend/web/src/onePersonLabWeb.mjs'],
    evidence: {
      runs: [
        { status: 'passed', target: 'fast', lanes: ['fast', 'ui', 'api', 'health-light', 'go-light'], diffFingerprint: 'current-diff' },
        { status: 'passed', target: 'smoke', lanes: ['smoke'], diffFingerprint: 'current-diff' },
        { status: 'passed', target: 'interaction', lanes: ['interaction', 'interaction-browser'], diffFingerprint: 'current-diff' },
        { status: 'passed', target: 'browser:golden', lanes: ['browser'], diffFingerprint: 'current-diff' },
      ],
    },
    diffFingerprint: 'current-diff',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.requiredTargets, ['ui', 'smoke', 'interaction', 'browser:golden']);
  assert.deepEqual(result.missingTargets, []);
});

test('lane check rejects stale verification evidence from an older diff fingerprint', () => {
  const result = evaluateLaneEvidence({
    changedFiles: ['contracts/web-page-state-matrix.json'],
    evidence: {
      runs: [
        { status: 'passed', target: 'contract', lanes: ['contract'], diffFingerprint: 'old-diff' },
        { status: 'passed', target: 'browser:golden', lanes: ['browser'], diffFingerprint: 'old-diff' },
      ],
    },
    diffFingerprint: 'current-diff',
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.requiredTargets, ['interaction', 'contract', 'browser:golden']);
  assert.deepEqual(result.missingTargets, ['interaction', 'contract', 'browser:golden']);
});

test('lane check can read verify evidence from disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'opl-lane-check-'));
  try {
    const evidencePath = join(dir, 'latest.json');
    writeFileSync(evidencePath, JSON.stringify({
      schemaVersion: 1,
      runs: [
        { status: 'passed', target: 'go', lanes: ['go'], diffFingerprint: 'current-diff' },
      ],
    }));

    assert.deepEqual(readVerifyEvidence(evidencePath).runs.map((run) => run.target), ['go']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('verify runner writes lane evidence for a passed target', () => {
  const dir = mkdtempSync(join(tmpdir(), 'opl-verify-evidence-'));
  try {
    const evidencePath = join(dir, 'latest.json');
    execFileSync(process.execPath, ['scripts/verify.mjs', 'suite', 'smoke'], {
      env: {
        ...process.env,
        OPL_VERIFY_EVIDENCE_PATH: evidencePath,
        OPL_LANE_BASE: 'HEAD',
      },
      stdio: 'pipe',
    });

    assert.equal(existsSync(evidencePath), true);
    const evidence = readVerifyEvidence(evidencePath);
    assert.equal(evidence.schemaVersion, 1);
    assert.equal(evidence.runs.length, 1);
    assert.equal(evidence.runs[0].target, 'smoke');
    assert.deepEqual(evidence.runs[0].lanes, ['smoke']);
    assert.equal(evidence.runs[0].status, 'passed');
    assert.equal(typeof evidence.runs[0].diffFingerprint, 'string');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('verify runner serializes browser lane tests because each starts its own Go control plane and browser', () => {
  const verify = readFileSync('scripts/verify.mjs', 'utf8');

  assert.match(verify, /serializedNodeLanes/);
  assert.match(verify, /'browser'/);
  assert.match(verify, /--test-concurrency=1/);
});
