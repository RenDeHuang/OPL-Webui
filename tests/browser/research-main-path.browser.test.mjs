import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runnerPath = 'tests/browser/research-main-path-runner.mjs';

test('research main path runs in a real browser and records page-state evidence', { timeout: 180000 }, () => {
  const result = spawnSync(process.execPath, [runnerPath], {
    encoding: 'utf8',
    timeout: 170000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const evidence = JSON.parse(result.stdout.trim().split('\n').at(-1));

  assert.equal(evidence.ok, true);
  assert.equal(evidence.path, 'research-main-path');
  assert.match(evidence.browser, /chrome|chromium/i);
  assert.equal(evidence.pageStates.authState, 'authenticated_bound');
  assert.equal(evidence.pageStates.chatState, 'runtime_required');
  assert.equal(evidence.pageStates.researchResultSections, 3);
  assert.equal(evidence.pageStates.runtimeTaskMarker, '@基金');
  assert.deepEqual(evidence.auditKinds.sort(), ['chat.completed', 'runtime_gate.required']);
  assert.ok(evidence.upstreamRequests >= 1);
});

test('browser runner uses user-like browser input instead of direct DOM mutation', () => {
  const runner = readFileSync(runnerPath, 'utf8');

  for (const required of [
    '--production',
    'OPL_PRODUCTION_BROWSER_E2E',
    'OPL_DOGFOOD_EMAIL',
    'OPL_DOGFOOD_PASSWORD',
    'OPL_DOGFOOD_API_KEY',
    'https://opl.medopl.cn',
    'Input.dispatchMouseEvent',
    'Input.dispatchKeyEvent',
    'Input.insertText',
    'getBoundingClientRect',
    'Page.navigate',
    'webSocketDebuggerUrl',
    'document.readyState === "complete"',
  ]) {
    assert.match(runner, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.doesNotMatch(runner, /\.value\s*=(?!=)/);
  assert.doesNotMatch(runner, /\.click\(\)/);
  assert.doesNotMatch(runner, /requestSubmit\(\)/);
  assert.doesNotMatch(runner, /KUBECONFIG|kubectl|postgres:\/\//i);
  assert.doesNotMatch(runner, /console\.log[^\n]*(OPL_DOGFOOD_API_KEY|OPL_DOGFOOD_PASSWORD|config\.apiKey|config\.password)/);
});
