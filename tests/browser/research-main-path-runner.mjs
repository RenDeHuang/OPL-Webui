#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import http from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = new URL('../../', import.meta.url).pathname;

const state = {
  cleanup: [],
};

try {
  const browserBinary = findBrowserBinary();
  const upstream = await startMockChatUpstream();
  state.cleanup.push(() => upstream.close());
  const app = await startControlPlane(upstream.baseUrl, state.cleanup);
  const browser = await startBrowser(browserBinary);

  const pageWebSocketDebuggerUrl = await createPageTarget(browser.devtoolsBaseUrl);
  const cdp = await connectCDP(pageWebSocketDebuggerUrl);
  state.cleanup.push(() => cdp.close());
  await cdp.send('DOM.enable');
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: app.baseUrl });
  await waitFor(cdp, 'document.readyState === "complete"');
  await waitFor(cdp, 'document.body.dataset.authState === "anonymous"');

  const email = `browser-${Date.now()}@example.test`;
  const password = 'browser-e2e-password';
  await typeInto(cdp, '#auth-email', email);
  await typeInto(cdp, '#auth-password', password);
  await activate(cdp, '[data-register-button]');
  await waitForAuthState(cdp, 'authenticated_unbound', 'register');
  await activate(cdp, '[data-logout-button]');
  await waitForAuthState(cdp, 'anonymous', 'logout');
  await typeInto(cdp, '#auth-email', email);
  await typeInto(cdp, '#auth-password', password);
  await activate(cdp, '[data-login-button]');
  await waitForAuthState(cdp, 'authenticated_unbound', 'login');

  await typeInto(cdp, '#api-key', 'sk-browser-e2e-secret');
  await activate(cdp, '[data-save-key-button]');
  await waitForAuthState(cdp, 'authenticated_bound', 'api key binding');

  await submitPrompt(cdp, '@科研 帮我拆解研究方向');
  await waitFor(cdp, 'document.querySelector("[data-chat-log]")?.textContent.includes("mock upstream response")');
  await waitForAuditKind(cdp, 'chat.completed');

  await submitPrompt(cdp, '@论文 生成研究选题和证据计划');
  await waitForAuditKindCount(cdp, 'runtime_gate.required', 1);
  await assertPage(cdp, 'document.querySelector("[data-runtime-gate]")?.classList.contains("is-visible")', 'paper runtime gate');

  await submitPrompt(cdp, '@基金 帮我拆解标书结构');
  await waitForAuditKindCount(cdp, 'runtime_gate.required', 2);
  const audit = await readAuditEvents(cdp);
  const kinds = (audit.events ?? []).map((event) => event.eventKind);
  if (!kinds.includes('runtime_gate.required')) {
    throw new Error(`missing runtime_gate.required audit evidence: ${kinds.join(',')}`);
  }
  if (!kinds.includes('chat.completed')) {
    throw new Error(`missing chat.completed audit evidence: ${kinds.join(',')}`);
  }
  const pageStates = await evaluateJSON(cdp, `({
    authState: document.body.dataset.authState,
    chatState: document.body.dataset.chatState,
    providerStatus: document.querySelector('[data-provider-status]')?.textContent,
    runtimeGateVisible: document.querySelector('[data-runtime-gate]')?.classList.contains('is-visible'),
    chatLogText: document.querySelector('[data-chat-log]')?.textContent,
  })`);
  const relevantAuditKinds = [...new Set(kinds)].filter((kind) => ['chat.completed', 'runtime_gate.required'].includes(kind));

  console.log(JSON.stringify({
    ok: true,
    path: 'research-main-path',
    browser: browserBinary,
    baseUrl: app.baseUrl,
    pageStates,
    auditKinds: relevantAuditKinds,
    allAuditKinds: [...new Set(kinds)],
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
  const playwrightChromium = findPlaywrightChromiumBinary();
  if (playwrightChromium) return playwrightChromium;
  throw new Error('No browser binary found. Install Chromium or run with OPL_BROWSER_BINARY=/path/to/chrome. Playwright users can run `npx playwright install chromium` and re-run npm run verify:browser.');
}

function spawnSyncStatus(command, args) {
  return spawnSync(command, args, { stdio: 'ignore' }).status;
}

function findPlaywrightChromiumBinary() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(homedir(), '.cache/ms-playwright'),
  ].filter(Boolean);

  for (const root of roots) {
    if (!existsSync(root)) continue;
    const browserDirs = readdirSync(root)
      .filter((entry) => entry.startsWith('chromium-'))
      .sort()
      .reverse();
    for (const dir of browserDirs) {
      const binary = join(root, dir, 'chrome-linux64', 'chrome');
      if (existsSync(binary)) return binary;
    }
  }
  return '';
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

async function startControlPlane(upstreamBaseUrl, cleanup) {
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
    detached: true,
  });
  cleanup.push(() => closeChildProcess(child));
  const output = [];
  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => output.push(String(chunk)));
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHTTP(`${baseUrl}/healthz`, () => {
    if (child.exitCode !== null) throw new Error(`control plane exited early:\n${output.join('')}`);
  }, 120000);
  return {
    baseUrl,
  };
}

async function startBrowser(binary) {
  const userDataDir = mkdtempSync(join(tmpdir(), 'opl-browser-e2e-'));
  const child = spawn(binary, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  state.cleanup.push(() => closeChildProcess(child, () => rmSync(userDataDir, { recursive: true, force: true })));

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
  const devtoolsBaseUrl = versionURL.replace('/json/version', '');
  return {
    devtoolsBaseUrl,
  };
}

async function createPageTarget(devtoolsBaseUrl) {
  const created = await fetchJSON(`${devtoolsBaseUrl}/json/new?about:blank`, { method: 'PUT' });
  if (created.webSocketDebuggerUrl) return created.webSocketDebuggerUrl;
  const targets = await fetchJSON(`${devtoolsBaseUrl}/json/list`);
  const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
  if (!page) throw new Error('Chrome did not expose a page target webSocketDebuggerUrl');
  return page.webSocketDebuggerUrl;
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

async function submitPrompt(cdp, prompt) {
  await typeInto(cdp, '#chat-input', prompt);
  await activate(cdp, '[data-chat-submit]');
}

async function typeInto(cdp, selector, text) {
  await userClick(cdp, selector);
  await focusElement(cdp, selector);
  await selectAll(cdp);
  await keyPress(cdp, { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  if (text) await cdp.send('Input.insertText', { text });
  await waitFor(
    cdp,
    `document.querySelector(${JSON.stringify(selector)})?.value === ${JSON.stringify(text)}`,
    async () => {
      const state = await evaluateJSON(cdp, `({
        selector: ${JSON.stringify(selector)},
        expected: ${JSON.stringify(text)},
        actual: document.querySelector(${JSON.stringify(selector)})?.value,
        activeElement: document.activeElement?.id || document.activeElement?.tagName,
      })`);
      return `typeInto did not update input: ${JSON.stringify(state)}`;
    },
  );
}

async function userClick(cdp, selector) {
  const { x, y } = await elementCenter(cdp, selector);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  await delay(50);
}

async function activate(cdp, selector) {
  await userClick(cdp, selector);
  await focusElement(cdp, selector);
  await keyPress(cdp, { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
  await delay(50);
}

async function elementCenter(cdp, selector) {
  const selectorJSON = JSON.stringify(selector);
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector(${selectorJSON})?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })`,
    awaitPromise: true,
  });
  return waitUntil(async () => {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const element = document.querySelector(${selectorJSON});
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        if (!hit || (hit !== element && !element.contains(hit))) return null;
        return { x, y };
      })()`,
      returnByValue: true,
    });
    return result.result?.value;
  }, 5000, () => `element is not clickable at center: ${selector}`);
}

async function focusElement(cdp, selector) {
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector(${JSON.stringify(selector)})?.focus()`,
    awaitPromise: true,
  });
  await waitFor(cdp, `document.activeElement === document.querySelector(${JSON.stringify(selector)})`);
}

async function waitForAuthState(cdp, authState, label) {
  await waitFor(
    cdp,
    `document.body.dataset.authState === ${JSON.stringify(authState)}`,
    () => describePageState(cdp, `${label} did not reach ${authState}`),
  );
}

async function describePageState(cdp, message) {
  const state = await evaluateJSON(cdp, `({
    message: ${JSON.stringify(message)},
    authState: document.body.dataset.authState,
    chatState: document.body.dataset.chatState,
    settingsMessage: document.querySelector('[data-settings-message]')?.textContent,
    sessionStatus: document.querySelector('[data-session-status]')?.textContent,
    providerStatus: document.querySelector('[data-provider-status]')?.textContent,
    emailValue: document.querySelector('#auth-email')?.value,
    passwordLength: document.querySelector('#auth-password')?.value?.length,
    apiKeyLength: document.querySelector('#api-key')?.value?.length,
    activeElement: document.activeElement?.id || document.activeElement?.tagName,
    session: await fetch('/api/session/current')
      .then(async (response) => ({ status: response.status, body: await response.text() }))
      .catch((error) => ({ error: String(error) })),
  })`);
  return JSON.stringify(state);
}

async function selectAll(cdp) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17 });
}

async function keyPress(cdp, key) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...key });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
}

async function waitFor(cdp, expression, describeFailure) {
  await waitUntil(async () => Boolean((await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })).result?.value), 30000, describeFailure);
}

async function assertPage(cdp, expression, label) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
  if (!result.result?.value) throw new Error(`browser assertion failed: ${label}`);
}

async function evaluateJSON(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: `(async () => JSON.stringify(await (${expression})))()`,
    returnByValue: true,
    awaitPromise: true,
  });
  return JSON.parse(result.result?.value || '{}');
}

async function readAuditEvents(cdp) {
  return evaluateJSON(cdp, 'fetch("/api/account/audit-events").then((response) => response.json())');
}

async function waitForAuditKind(cdp, eventKind) {
  await waitForAuditKindCount(cdp, eventKind, 1);
}

async function waitForAuditKindCount(cdp, eventKind, count) {
  await waitUntil(async () => {
    const audit = await readAuditEvents(cdp);
    const actual = (audit.events ?? []).filter((event) => event.eventKind === eventKind).length;
    return actual >= count;
  }, 60000);
}

async function waitUntil(check, timeoutMs = 30000, describeFailure) {
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
  if (describeFailure) {
    throw new Error(await describeFailure());
  }
  throw lastError || new Error('timed out');
}

async function waitForHTTP(url, failFast, timeoutMs = 60000) {
  await waitUntil(async () => {
    failFast?.();
    try {
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }, timeoutMs);
}

async function fetchJSON(url, init = {}) {
  const response = await fetch(url, init);
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
  server.closeAllConnections?.();
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function closeChildProcess(child, afterClose = () => {}) {
  try {
    if (child.exitCode === null) {
      process.kill(-child.pid, 'SIGTERM');
      await Promise.race([once(child, 'exit'), delay(1500).then(() => process.kill(-child.pid, 'SIGKILL'))]);
    }
  } finally {
    afterClose();
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
