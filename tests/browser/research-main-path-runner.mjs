#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = new URL('../../', import.meta.url).pathname;

const state = {
  cleanup: [],
};

try {
  const browserBinary = findBrowserBinary();
  const upstream = await startMockChatUpstream();
  state.cleanup.push(() => upstream.close());
  const app = await startControlPlane(upstream.baseUrl);
  state.cleanup.push(() => app.close());
  const browser = await startBrowser(browserBinary);
  state.cleanup.push(() => browser.close());

  const cdp = await connectCDP(browser.webSocketDebuggerUrl);
  state.cleanup.push(() => cdp.close());
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: app.baseUrl });
  await waitFor(cdp, 'document.querySelector("[data-register-button]")');

  const email = `browser-${Date.now()}@example.test`;
  const password = 'browser-e2e-password';
  await setValue(cdp, '#auth-email', email);
  await setValue(cdp, '#auth-password', password);
  await click(cdp, '[data-register-button]');
  await waitFor(cdp, 'document.body.dataset.authState === "authenticated_unbound"');
  await click(cdp, '[data-logout-button]');
  await waitFor(cdp, 'document.body.dataset.authState === "anonymous"');
  await setValue(cdp, '#auth-email', email);
  await setValue(cdp, '#auth-password', password);
  await click(cdp, '[data-login-button]');
  await waitFor(cdp, 'document.body.dataset.authState === "authenticated_unbound"');

  await setValue(cdp, '#api-key', 'sk-browser-e2e-secret');
  await submit(cdp, '[data-provider-form]');
  await waitFor(cdp, 'document.body.dataset.authState === "authenticated_bound"');

  await submitPrompt(cdp, '@科研 帮我拆解研究方向');
  await waitFor(cdp, 'document.body.dataset.chatState === "idle"');
  await assertPage(cdp, 'document.querySelector("[data-chat-log]")?.textContent.includes("mock upstream response")', 'ordinary chat fallback');

  await submitPrompt(cdp, '@论文 生成研究选题和证据计划');
  await waitFor(cdp, 'document.body.dataset.chatState === "runtime_required"');
  await assertPage(cdp, 'document.querySelector("[data-runtime-gate]")?.classList.contains("is-visible")', 'paper runtime gate');

  await submitPrompt(cdp, '@基金 帮我拆解标书结构');
  await waitFor(cdp, 'document.body.dataset.chatState === "runtime_required"');
  const audit = await evaluateJSON(cdp, 'fetch("/api/account/audit-events").then((response) => response.json())');
  const kinds = (audit.events ?? []).map((event) => event.eventKind);
  if (!kinds.includes('runtime_gate.required')) {
    throw new Error(`missing runtime_gate.required audit evidence: ${kinds.join(',')}`);
  }
  if (!kinds.includes('chat.completed')) {
    throw new Error(`missing chat.completed audit evidence: ${kinds.join(',')}`);
  }

  console.log(JSON.stringify({
    ok: true,
    path: 'research-main-path',
    browser: browserBinary,
    baseUrl: app.baseUrl,
    auditKinds: [...new Set(kinds)],
    upstreamRequests: upstream.requests.length,
  }));
} catch (error) {
  console.error(error?.stack || error);
  process.exitCode = 1;
} finally {
  for (const cleanup of state.cleanup.reverse()) {
    await cleanup().catch?.(() => {});
  }
}

function findBrowserBinary() {
  if (process.env.OPL_BROWSER_BINARY) return process.env.OPL_BROWSER_BINARY;
  for (const candidate of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome']) {
    if (spawnSyncStatus('which', [candidate]) === 0) return candidate;
  }
  throw new Error('No browser binary found. Set OPL_BROWSER_BINARY to a Chrome/Chromium executable to run browser e2e.');
}

function spawnSyncStatus(command, args) {
  return spawnSync(command, args, { stdio: 'ignore' }).status;
}

async function startMockChatUpstream() {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    requests.push({ path: request.url, body });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      choices: [{ message: { content: 'mock upstream response for research chat' } }],
    }));
  });
  await listen(server);
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () => closeServer(server),
  };
}

async function startControlPlane(upstreamBaseUrl) {
  const port = await freePort();
  const child = spawn('go', ['run', './services/control-plane-go/cmd/opl-webui-control-plane'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      OPL_WEBUI_ENV: 'development',
      OPL_SESSION_SECRET: 'browser-e2e-session-secret-32-bytes',
      OPL_API_KEY_ENCRYPTION_SECRET: 'browser-e2e-api-key-secret-32-bytes',
      OPL_CHAT_TEST_UPSTREAM_BASE_URL: upstreamBaseUrl,
      OPL_CHAT_MODEL: 'browser-e2e-model',
      OPL_DATABASE_URL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = [];
  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => output.push(String(chunk)));
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHTTP(`${baseUrl}/healthz`, () => {
    if (child.exitCode !== null) throw new Error(`control plane exited early:\n${output.join('')}`);
  });
  return {
    baseUrl,
    close: async () => {
      child.kill('SIGTERM');
      await Promise.race([once(child, 'exit'), delay(1500).then(() => child.kill('SIGKILL'))]);
    },
  };
}

async function startBrowser(binary) {
  const userDataDir = mkdtempSync(join(tmpdir(), 'opl-browser-e2e-'));
  const child = spawn(binary, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let devtools = '';
  child.stderr.on('data', (chunk) => {
    const text = String(chunk);
    const match = text.match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) devtools = match[1];
  });
  await waitUntil(() => {
    if (child.exitCode !== null) throw new Error('browser exited before DevTools became available');
    return devtools;
  });
  const versionURL = devtools.replace(/^ws:\/\/([^/]+).*$/, 'http://$1/json/version');
  const version = await fetchJSON(versionURL);
  if (!version.webSocketDebuggerUrl) throw new Error('/json/version did not expose webSocketDebuggerUrl');
  return {
    webSocketDebuggerUrl: version.webSocketDebuggerUrl,
    close: async () => {
      child.kill('SIGTERM');
      await Promise.race([once(child, 'exit'), delay(1500).then(() => child.kill('SIGKILL'))]);
      rmSync(userDataDir, { recursive: true, force: true });
    },
  };
}

async function connectCDP(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await once(socket, 'open');
  let nextID = 1;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      const id = nextID++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() {
      socket.close();
      return Promise.resolve();
    },
  };
}

async function setValue(cdp, selector, value) {
  await cdp.send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(selector)}).focus()` });
  await cdp.send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(selector)}).value = ''` });
  await cdp.send('Input.insertText', { text: value });
}

async function submitPrompt(cdp, prompt) {
  await setValue(cdp, '#chat-input', prompt);
  await submit(cdp, '[data-chat-form]');
}

async function click(cdp, selector) {
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector(${JSON.stringify(selector)})?.click()`,
    awaitPromise: true,
  });
}

async function submit(cdp, selector) {
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector(${JSON.stringify(selector)})?.requestSubmit()`,
    awaitPromise: true,
  });
}

async function waitFor(cdp, expression) {
  await waitUntil(async () => Boolean((await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })).result?.value));
}

async function assertPage(cdp, expression, label) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
  if (!result.result?.value) throw new Error(`browser assertion failed: ${label}`);
}

async function evaluateJSON(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: `JSON.stringify(await (${expression}))`,
    returnByValue: true,
    awaitPromise: true,
  });
  return JSON.parse(result.result?.value || '{}');
}

async function waitUntil(check, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw lastError || new Error('timed out');
}

async function waitForHTTP(url, failFast) {
  await waitUntil(async () => {
    failFast?.();
    try {
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }, 60000);
}

async function fetchJSON(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
}

async function freePort() {
  const server = http.createServer();
  await listen(server);
  const { port } = server.address();
  await closeServer(server);
  return port;
}

function closeServer(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
