import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { evaluateCommand } from '../../packages/opl-adapter/src/commandPolicy.mjs';
import { MockOplAdapter } from '../../packages/opl-adapter/src/mockAdapter.mjs';

const policyPath = 'packages/contracts/opl/command-policy.json';

test('OPL adapter command whitelist contract exists and is explicit', () => {
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));

  assert.equal(policy.defaultMode, 'deny');
  assert.ok(Array.isArray(policy.allowed), `${policyPath} must expose an allowed command array`);
  assert.ok(policy.allowed.length > 0, `${policyPath} must not allow an empty implicit policy`);
  for (const entry of policy.allowed) {
    assert.equal(typeof entry.id, 'string');
    assert.equal(entry.mode, 'readonly');
    assert.ok(Array.isArray(entry.command), `${entry.id} must use argv array form`);
    assert.ok(entry.command.length > 0);
    assert.equal(entry.command.includes('*'), false, `wildcard command is not allowed: ${entry.id}`);
  }
});

test('OPL adapter allows only exact readonly command matches', () => {
  assert.equal(evaluateCommand(['opl', 'help', '--json']).allowed, true);
  assert.equal(evaluateCommand(['opl', 'help']).allowed, false);
  assert.equal(evaluateCommand(['opl', 'modules']).allowed, true);
  assert.equal(evaluateCommand(['opl', 'module', 'exec', '--module', 'mas']).allowed, false);
  assert.equal(evaluateCommand(['opl', 'family-runtime', 'enqueue']).allowed, false);
});

test('mock OPL adapter fails closed for denied commands', async () => {
  const adapter = new MockOplAdapter();
  const denied = await adapter.run(['opl', 'install']);
  const allowed = await adapter.run(['opl', 'contract', 'domains']);

  assert.equal(denied.ok, false);
  assert.equal(denied.errorCode, 'OPL_COMMAND_DENIED');
  assert.equal(allowed.ok, true);
  assert.equal(allowed.mode, 'readonly');
});
