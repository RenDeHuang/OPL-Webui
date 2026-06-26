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
  await cdp.send('Page.navigate', { url: app.baseUrl });
  await waitFor(cdp, 'document.readyState === "complete"');
  await waitFor(cdp, 'document.body.dataset.authState === "anonymous"');

  await waitFor(cdp, 'document.querySelector(\'[data-public-task-entry][data-research-task-intent="grant_plan"]\')?.offsetParent !== null');
  await activate(cdp, '[data-public-task-entry][data-research-task-intent="grant_plan"]');
  await waitFor(cdp, 'document.querySelector("[data-account-popover]")?.hidden === false');
  await waitFor(cdp, 'document.body.dataset.chatState === "grant_entry_selected"');
  await waitFor(cdp, 'document.querySelector("#chat-input")?.value?.startsWith("@基金") === true');
  const afterTaskClick = await evaluateJSON(cdp, `({
    initialAuthState: 'anonymous',
    accountPopoverOpenAfterTaskClick: document.querySelector('[data-account-popover]')?.hidden === false,
    pendingPublicTaskIntent: document.body.dataset.pendingPublicTaskIntent,
    chatStateAfterTaskClick: document.body.dataset.chatState,
    promptAfterTaskClick: document.querySelector('#chat-input')?.value,
  })`);

  const email = `public-growth-${Date.now()}@example.test`;
  await typeInto(cdp, '#auth-email', email);
  await typeInto(cdp, '#auth-password', 'public-growth-password');
  await activate(cdp, '[data-register-button]');
  await waitFor(cdp, 'document.body.dataset.authState === "authenticated_unbound"');
  await waitFor(cdp, 'document.body.dataset.researchTaskIntent === "grant_plan"');
  await waitFor(cdp, 'document.body.dataset.chatState === "grant_entry_selected"');
  await waitFor(cdp, 'document.querySelector("#chat-input")?.value?.startsWith("@基金") === true');
  await waitFor(cdp, 'document.body.dataset.loginReturnState === "authenticated_unbound"');
  const pageStates = await evaluateJSON(cdp, `({
    ...${JSON.stringify(afterTaskClick)},
    authStateAfterLogin: document.body.dataset.authState,
    restoredTaskIntent: document.body.dataset.researchTaskIntent,
    restoredChatState: document.body.dataset.chatState,
    restoredPrompt: document.querySelector('#chat-input')?.value,
    focusReturnedToComposer: document.activeElement?.id === 'chat-input',
  })`);

  console.log(JSON.stringify({
    ok: true,
    path: 'public-growth-login-return',
    browser: browserBinary,
    baseUrl: sanitizeBaseUrl(app.baseUrl),
    pageStates,
    cannotClaim: ['authenticated task success', 'runtime execution', 'artifact body authority', 'full SaaS', 'payment/team/RBAC/HA'],
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
      OPL_SESSION_SECRET: 'public-growth-session-secret-32-bytes',
      OPL_API_KEY_ENCRYPTION_SECRET: 'public-growth-api-key-secret-32-bytes',
      OPL_CHAT_MODEL: 'public-growth-browser-model',
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
  const userDataDir = mkdtempSync(join(tmpdir(), 'opl-webui-public-growth-browser-'));
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
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  return {
    send(method, params = {}) {
      id += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() {
      socket.close();
      return Promise.resolve();
    },
  };
}

async function activate(cdp, selector) {
  const { x, y } = await elementCenter(cdp, selector);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await wait(50);
}

async function typeInto(cdp, selector, value) {
  await activate(cdp, selector);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2 });
  await cdp.send('Input.insertText', { text: value });
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
    if (!hit || (hit !== element && !element.contains(hit))) return null;
    return { x, y };
  })()`);
  if (!center) throw new Error(`element not clickable at center: ${selector}`);
  return center;
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
    authState: document.body.dataset.authState,
    chatState: document.body.dataset.chatState,
    researchTaskIntent: document.body.dataset.researchTaskIntent,
    pendingPublicTaskIntent: document.body.dataset.pendingPublicTaskIntent,
    loginReturnState: document.body.dataset.loginReturnState,
    prompt: document.querySelector("#chat-input")?.value,
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
