import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('foundation manifest, scripts, and test taxonomy exist', () => {
  assert.equal(existsSync('AGENTS.md'), true);
  assert.equal(existsSync('package.json'), true);
  assert.equal(existsSync('scripts/test-classification.mjs'), true);
  assert.equal(existsSync('scripts/verify.mjs'), true);
  assert.equal(existsSync('tests/README.md'), true);
});

test('test taxonomy states markdown prose is not a machine interface', () => {
  const text = readFileSync('tests/README.md', 'utf8');
  assert.match(text, /Markdown prose 不作为机器接口/);
});
