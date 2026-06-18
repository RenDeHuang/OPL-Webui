import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

test('foundation manifest, scripts, and test registry exist', () => {
  assert.equal(existsSync('AGENTS.md'), true);
  assert.equal(existsSync('package.json'), true);
  assert.equal(existsSync('scripts/test-classification.mjs'), true);
  assert.equal(existsSync('scripts/verify.mjs'), true);
  assert.equal(existsSync('tests/README.md'), false);
});
