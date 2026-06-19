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
    'document.readyState === "complete"',
    'data-register-button',
    'document.body.dataset.authState === "anonymous"',
    'data-login-button',
    'data-provider-form',
    'data-chat-form',
    'data-runtime-gate',
    'waitForAuditKindCount',
    'runtime_gate.required',
    'chat.completed',
  ]) {
    assert.match(runner, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.doesNotMatch(runner, /playwright|puppeteer|selenium/i);
  assert.doesNotMatch(runner, /OPL_DOGFOOD_API_KEY|KUBECONFIG|kubectl|postgres:\/\//i);
});

test('browser e2e runner tolerates cold Go startup and cleans partial launches', () => {
  const runner = readFileSync(helperPath, 'utf8');

  assert.match(runner, /waitForHTTP\(`\$\{baseUrl\}\/healthz`[^,]*,\s*[^,]*,\s*120000\)/s);
  assert.match(runner, /const app = await startControlPlane\(upstream\.baseUrl,\s*state\.cleanup\)/);
  assert.match(runner, /detached:\s*true/);
  assert.match(runner, /cleanup\.push\(\(\) => closeChildProcess\(child\)\)/);
  assert.match(runner, /process\.kill\(-child\.pid,\s*'SIGTERM'\)/);
  assert.match(runner, /finally\s*\{\s*afterClose\(\)/);
  assert.match(runner, /closeAllConnections/);
});

test('browser e2e runner creates Chrome page targets with request init', () => {
  const runner = readFileSync(helperPath, 'utf8');

  assert.match(runner, /fetchJSON\(`\$\{devtoolsBaseUrl\}\/json\/new\?about:blank`,\s*\{\s*method:\s*'PUT'\s*\}\)/);
  assert.match(runner, /async function fetchJSON\(url,\s*init = \{\}\)/);
  assert.match(runner, /fetch\(url,\s*init\)/);
  assert.match(runner, /async function evaluateJSON/);
  assert.match(runner, /\(async \(\) => JSON\.stringify\(await \(\$\{expression\}\)\)\)\(\)/);
});

test('browser e2e runner writes form values through DOM events', () => {
  const runner = readFileSync(helperPath, 'utf8');

  assert.match(runner, /function setValue/);
  assert.match(runner, /value ===/);
  assert.match(runner, /dispatchEvent\(new Event\('input'/);
  assert.match(runner, /dispatchEvent\(new Event\('change'/);
});
