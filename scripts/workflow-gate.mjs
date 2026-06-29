#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REVIEW_GATE_STEPS = Object.freeze([
  Object.freeze({
    label: 'diff hygiene',
    command: 'git',
    args: Object.freeze(['diff', '--check']),
  }),
  Object.freeze({
    label: 'repo bloat audit',
    command: process.execPath,
    args: Object.freeze(['scripts/repo-bloat-audit.mjs']),
  }),
  Object.freeze({
    label: 'ai development gate',
    command: process.execPath,
    args: Object.freeze(['scripts/ai-development-gate.mjs']),
  }),
  Object.freeze({
    label: 'required lane evidence check',
    command: process.execPath,
    args: Object.freeze(['scripts/lane-check.mjs']),
  }),
  Object.freeze({
    label: 'fast verify',
    command: process.execPath,
    args: Object.freeze(['scripts/verify.mjs', 'fast']),
  }),
]);

export function runReviewGate() {
  let failed = false;
  for (const step of REVIEW_GATE_STEPS) {
    console.log(`[gate] ${step.label}`);
    const result = spawnSync(step.command, step.args, {
      cwd: step.cwd,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      failed = true;
    }
  }

  return failed ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(runReviewGate());
}
