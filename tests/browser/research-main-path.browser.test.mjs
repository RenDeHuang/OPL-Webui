import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const helperPath = 'tests/browser/research-main-path-runner.mjs';

test('browser e2e runner is a real browser harness, not an HTTP-only smoke', () => {
  const runner = readFileSync(helperPath, 'utf8');

  for (const required of [
    'OPL_BROWSER_BINARY',
    '--remote-debugging-port=0',
    '/json/version',
    '/json/new?about:blank',
    '/json/list',
    'webSocketDebuggerUrl',
    'createPageTarget',
    'Page.navigate',
    'Runtime.evaluate',
    'Input.insertText',
    'data-register-button',
    'data-login-button',
    'data-provider-form',
    'data-chat-form',
    'data-runtime-gate',
    'runtime_gate.required',
  ]) {
    assert.match(runner, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.doesNotMatch(runner, /playwright|puppeteer|selenium/i);
  assert.doesNotMatch(runner, /OPL_DOGFOOD_API_KEY|KUBECONFIG|kubectl|postgres:\/\//i);
});
