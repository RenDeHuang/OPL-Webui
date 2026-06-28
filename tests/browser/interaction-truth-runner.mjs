#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import http from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = new URL('../../', import.meta.url).pathname;
const state = { cleanup: [] };

try {
  const browserBinary = findBrowserBinary();
  const app = await startControlPlane(state.cleanup);
  const browser = await startBrowser(browserBinary);
  const pageWebSocketDebuggerUrl = await createPageTarget(browser.devtoolsBaseUrl);
  const cdp = await connectCDP(pageWebSocketDebuggerUrl);
  state.cleanup.push(() => cdp.close());
  await cdp.send('DOM.enable');
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const routeTruth = {};
  await navigate(cdp, `${app.baseUrl}/`);
  routeTruth.publicLanding = await pageState(cdp);
  await navigate(cdp, `${app.baseUrl}/login`);
  routeTruth.login = await pageState(cdp);
  await navigate(cdp, `${app.baseUrl}/home`);
  routeTruth.anonymousHome = await pageState(cdp);

  await navigate(cdp, `${app.baseUrl}/`);
  await waitFor(cdp, 'Boolean(document.querySelector(\'[data-public-task-entry][data-research-task-intent="grant_plan"]\') && document.querySelector(\'[data-public-task-entry][data-research-task-intent="grant_plan"]\').offsetParent !== null)');
  await activate(cdp, '[data-public-task-entry][data-research-task-intent="grant_plan"]');
  await waitFor(cdp, 'Boolean(document.querySelector("[data-auth-surface]") && document.querySelector("[data-auth-surface]").offsetParent !== null)');
  const loginVisible = await isVisible(cdp, '[data-login-button]');
  const registerVisible = await isVisible(cdp, '[data-register-button]');
  const afterTaskClick = await pageState(cdp, {
    loginVisible,
    registerVisible,
  });

  const email = `interaction-truth-${Date.now()}@example.test`;
  await activate(cdp, '[data-auth-tab="register"]');
  await waitFor(cdp, 'Boolean(document.querySelector("[data-register-button]") && document.querySelector("[data-register-button]").offsetParent !== null) && !document.querySelector("[data-login-button]")');
  await typeInto(cdp, '#auth-email', email);
  await typeInto(cdp, '#auth-password', 'interaction-truth-password');
  await submitVisibleButton(cdp, '[data-register-button]');
  await waitFor(cdp, 'document.body.dataset.authState === "authenticated_unbound"', 120000);
  await waitFor(cdp, `document.querySelector("[data-app-shell]")?.offsetParent !== null
    && document.body.dataset.researchTaskIntent === "grant_plan"
    && document.querySelector("#chat-input")?.value?.startsWith("@基金") === true
    && document.querySelector("[data-side-navigation]")?.textContent.includes("任务历史")`);
  const afterAuth = await pageState(cdp, {
    sidebarText: await textContent(cdp, '[data-side-navigation]'),
    taskHistoryEmptyVisible: await isVisible(cdp, '[data-task-history-empty]'),
    taskHistoryItems: await count(cdp, '[data-task-history-item]'),
  });

  console.log(JSON.stringify({
    ok: true,
    path: 'interaction-truth',
    browser: browserBinary,
    baseUrl: sanitizeBaseUrl(app.baseUrl),
    routeTruth,
    afterTaskClick,
    afterAuth,
    cannotClaim: [
      'payment',
      'runtime execution',
      'artifact body/storage truth',
      'full SaaS',
      'production-ready SaaS',
      'fake project/workspace data retired',
    ],
  }));
} catch (error) {
  console.error(error?.stack || error);
  process.exitCode = 1;
} finally {
  for (const cleanup of state.cleanup.reverse()) {
    await cleanup().catch?.(() => {});
  }
}

async function pageState(cdp, extra = {}) {
  return evaluateJSON(cdp, `(() => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      return Boolean(element && (element.offsetWidth || element.offsetHeight || element.getClientRects().length));
    };
    return {
    locationPathname: window.location.pathname,
    locationHash: window.location.hash,
    shellState: document.body.dataset.shellState,
    authState: document.body.dataset.authState,
    view: document.body.dataset.view,
    pendingPublicTaskIntent: document.body.dataset.pendingPublicTaskIntent,
    researchTaskIntent: document.body.dataset.researchTaskIntent,
    chatState: document.body.dataset.chatState,
    publicLandingVisible: visible('[data-public-landing-surface]'),
    authSurfaceVisible: visible('[data-auth-surface]'),
    workbenchVisible: visible('[data-app-shell]'),
    taskHistoryEmptyVisible: visible('[data-task-history-empty]'),
    taskHistoryItemCount: document.querySelectorAll('[data-task-history-item]').length,
    prompt: document.querySelector('#chat-input')?.value || '',
    ${Object.entries(extra).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',\n    ')}
    };
  })()`);
}

function findBrowserBinary() {
  if (process.env.OPL_BROWSER_BINARY) return process.env.OPL_BROWSER_BINARY;
  for (const candidate of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome']) {
    if (spawnSync('which', [candidate], { stdio: 'ignore' }).status === 0) return candidate;
  }
  const playwrightChromium = findPlaywrightChromiumBinary();
  if (playwrightChromium) return playwrightChromium;
  throw new Error('No browser binary found. Set OPL_BROWSER_BINARY=/path/to/chrome or install Chromium.');
}

function findPlaywrightChromiumBinary() {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), '.cache/ms-playwright')].filter(Boolean);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root).filter((entry) => entry.startsWith('chromium-')).sort().reverse()) {
      for (const chromeDir of ['chrome-linux64', 'chrome-linux']) {
        const binary = join(root, dir, chromeDir, 'chrome');
        if (existsSync(binary)) return binary;
      }
    }
  }
  return '';
}

async function startControlPlane(cleanup) {
  const port = await freePort();
  const child = spawn('go', ['run', './services/control-plane-go/cmd/opl-webui-control-plane'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      OPL_WEBUI_ENV: 'development',
      OPL_SESSION_SECRET: 'interaction-truth-session-secret-32-bytes',
      OPL_API_KEY_ENCRYPTION_SECRET: 'interaction-truth-api-key-secret-32-bytes',
      OPL_CHAT_MODEL: 'interaction-truth-browser-model',
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
  return { baseUrl };
}

async function startBrowser(binary) {
  const userDataDir = mkdtempSync(join(tmpdir(), 'opl-webui-interaction-truth-browser-'));
  mkdirSync(userDataDir, { recursive: true });
  state.cleanup.push(async () => rmSync(userDataDir, { recursive: true, force: true }));
  const port = await freePort();
  const child = spawn(binary, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  state.cleanup.push(() => closeChildProcess(child));
  const devtoolsBaseUrl = `http://127.0.0.1:${port}`;
  await waitForHTTP(`${devtoolsBaseUrl}/json/version`, () => {
    if (child.exitCode !== null) throw new Error(`browser exited before DevTools became available: ${child.exitCode}`);
  }, 30000);
  return { devtoolsBaseUrl };
}

async function createPageTarget(devtoolsBaseUrl) {
  const response = await fetch(`${devtoolsBaseUrl}/json/new?about:blank`, { method: 'PUT' });
  const target = await response.json();
  return target.webSocketDebuggerUrl;
}

async function connectCDP(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await once(socket, 'open');
  let id = 0;
  const pending = new Map();
  const eventWaiters = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    if (message.method && eventWaiters.has(message.method)) {
      const waiters = eventWaiters.get(message.method);
      eventWaiters.delete(message.method);
      for (const waiter of waiters) waiter.resolve(message.params || {});
    }
  });
  return {
    send(method, params = {}) {
      id += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    onceEvent(method, timeoutMs = 60000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const waiters = (eventWaiters.get(method) || []).filter((waiter) => waiter.resolve !== resolve);
          if (waiters.length > 0) eventWaiters.set(method, waiters);
          else eventWaiters.delete(method);
          reject(new Error(`timed out waiting for CDP event: ${method}`));
        }, timeoutMs);
        const waiter = {
          resolve: (params) => {
            clearTimeout(timer);
            resolve(params);
          },
        };
        eventWaiters.set(method, [...(eventWaiters.get(method) || []), waiter]);
      });
    },
    close() {
      socket.close();
      return Promise.resolve();
    },
  };
}

async function navigate(cdp, url) {
  const loadEvent = cdp.onceEvent('Page.loadEventFired').catch(() => null);
  const result = await cdp.send('Page.navigate', { url });
  if (result.errorText) throw new Error(`navigation failed: ${url} ${result.errorText}`);
  await Promise.race([
    loadEvent,
    waitFor(cdp, 'document.readyState === "complete"', 60000),
  ]);
  await waitFor(cdp, 'document.readyState === "complete"', 60000);
  await waitFor(cdp, 'Boolean(document.querySelector("#app")?.children.length)', 60000);
  await waitFor(cdp, 'Boolean(document.body?.dataset?.shellState)', 60000);
}

async function activate(cdp, selector) {
  const { x, y } = await elementCenter(cdp, selector);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector(${JSON.stringify(selector)})?.focus()`,
    awaitPromise: true,
  });
  await wait(50);
}

async function typeInto(cdp, selector, value) {
  await focusElement(cdp, selector);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2 });
  await cdp.send('Input.insertText', { text: value });
  await waitFor(cdp, `document.querySelector(${JSON.stringify(selector)})?.value === ${JSON.stringify(value)}`);
}

async function focusElement(cdp, selector) {
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector(${JSON.stringify(selector)})?.focus()`,
    awaitPromise: true,
  });
  await waitFor(cdp, `document.activeElement === document.querySelector(${JSON.stringify(selector)})`);
}

async function submitVisibleButton(cdp, selector) {
  await activate(cdp, selector);
  await wait(100);
  const stillOnSubmit = await evaluateJSON(cdp, `Boolean(document.querySelector(${JSON.stringify(selector)})?.offsetParent !== null && document.body.dataset.authState === "anonymous")`);
  if (!stillOnSubmit) return;
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
}

async function elementCenter(cdp, selector) {
  const selectorJSON = JSON.stringify(selector);
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector(${selectorJSON})?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })`,
    awaitPromise: true,
  });
  const center = await evaluateJSON(cdp, `(() => {
    const element = document.querySelector(${selectorJSON});
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (!hit || (hit !== element && !element.contains(hit))) {
      return {
        error: 'not_hit',
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        hit: hit ? { tag: hit.tagName, text: hit.textContent?.slice(0, 80), className: hit.className } : null,
      };
    }
    return { x, y };
  })()`);
  if (!center || center.error) throw new Error(`element not clickable at center: ${selector} ${JSON.stringify(center)}`);
  return center;
}

async function isVisible(cdp, selector) {
  const selectorJSON = JSON.stringify(selector);
  return evaluateJSON(cdp, `Boolean((() => {
    const element = document.querySelector(${selectorJSON});
    return Boolean(element && (element.offsetWidth || element.offsetHeight || element.getClientRects().length));
  })())`);
}

async function count(cdp, selector) {
  return evaluateJSON(cdp, `document.querySelectorAll(${JSON.stringify(selector)}).length`);
}

async function textContent(cdp, selector) {
  return evaluateJSON(cdp, `document.querySelector(${JSON.stringify(selector)})?.textContent || ''`);
}

async function evaluateJSON(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  return result.result.value;
}

async function waitFor(cdp, expression, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluateJSON(cdp, `Boolean(${expression})`)) return;
    await wait(100);
  }
  const debug = await evaluateJSON(cdp, `({
    readyState: document.readyState,
    pathname: window.location.pathname,
    hash: window.location.hash,
    authState: document.body.dataset.authState,
    shellState: document.body.dataset.shellState,
    appChildCount: document.querySelector("#app")?.children.length || 0,
    scriptCount: document.scripts.length,
    pendingPublicTaskIntent: document.body.dataset.pendingPublicTaskIntent,
    prompt: document.querySelector('#chat-input')?.value,
    settingsMessage: document.querySelector('[data-settings-message]')?.textContent || '',
    emailLength: document.querySelector('#auth-email')?.value?.length || 0,
    passwordLength: document.querySelector('#auth-password')?.value?.length || 0,
    activeElement: document.activeElement?.id || document.activeElement?.tagName,
  })`);
  throw new Error(`timed out waiting for: ${expression}\nstate: ${JSON.stringify(debug)}`);
}

async function waitForHTTP(url, onAttempt, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    onAttempt?.();
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await wait(100);
    }
  }
  throw new Error(`timed out waiting for HTTP ${url}`);
}

async function freePort() {
  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function closeChildProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
    await Promise.race([once(child, 'exit'), wait(1500).then(() => process.kill(-child.pid, 'SIGKILL'))]);
  } catch {
    child.kill();
    await Promise.race([once(child, 'exit'), wait(1000)]);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeBaseUrl(value) {
  return String(value || '').replace(/:\d+$/, ':<port>');
}
