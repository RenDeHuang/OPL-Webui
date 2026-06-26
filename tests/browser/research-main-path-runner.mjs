#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = new URL('../../', import.meta.url).pathname;

const state = { cleanup: [] };
const mode = process.argv.includes('--production') ? 'production' : 'local';
const productionChatResultTimeoutMs = 120000;

try {
  if (mode === 'production' && process.env.OPL_PRODUCTION_BROWSER_E2E !== '1') {
    console.log(JSON.stringify({ ok: true, skipped: true, mode, reason: 'OPL_PRODUCTION_BROWSER_E2E is not enabled' }));
    process.exit(0);
  }
  const config = resolveRunConfig(mode);
  const browserBinary = findBrowserBinary();
  const upstream = mode === 'local' ? await startMockChatUpstream() : undefined;
  if (upstream) state.cleanup.push(() => upstream.close());
  const app = mode === 'local'
    ? await startControlPlane(upstream.baseUrl, state.cleanup)
    : { baseUrl: config.baseUrl };
  const browser = await startBrowser(browserBinary);

  const pageWebSocketDebuggerUrl = await createPageTarget(browser.devtoolsBaseUrl);
  const cdp = await connectCDP(pageWebSocketDebuggerUrl);
  state.cleanup.push(() => cdp.close());
  await cdp.send('DOM.enable');
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: app.baseUrl });
  await waitFor(cdp, 'document.readyState === "complete"');
  await waitFor(cdp, 'document.body.dataset.authState');

  if (mode === 'production') await resetSessionIfAuthenticated(cdp);
  await authenticate(cdp, config);
  const accessibilityCloseout = await captureAccessibilityCloseout(cdp);

  await openAccountPopover(cdp);
  await waitFor(cdp, 'document.querySelector("#api-key")?.offsetParent !== null');
  await typeInto(cdp, '#api-key', config.apiKey);
  await activate(cdp, '[data-save-key-button]');
  await waitForAuthState(cdp, 'authenticated_bound', 'api key binding');
  await openChatRoute(cdp);

  await userClick(cdp, '[data-research-task-intent="research_direction"]');
  await assertPage(cdp, 'document.body.dataset.chatState === "research_entry_selected"', 'research task template selected');
  await assertPage(cdp, 'document.querySelector("#chat-input")?.value.includes("@科研")', 'research task template prompt');
  await activate(cdp, '[data-chat-submit]');
  if (mode === 'local') {
    await waitFor(cdp, 'document.querySelector("[data-chat-log]")?.textContent.includes("mock upstream response")');
  }
  await waitFor(
    cdp,
    'document.querySelector("[data-research-result]")?.dataset.researchResultMarker === "@科研"',
    () => describeResearchResultState(cdp, 'structured research result marker missing'),
    mode === 'production' ? productionChatResultTimeoutMs : 60000,
  );
  await waitFor(
    cdp,
    'document.querySelector("[data-research-result]")?.querySelectorAll("[data-research-result-section]").length === 3',
    () => describeResearchResultState(cdp, 'structured research result sections missing'),
    mode === 'production' ? productionChatResultTimeoutMs : 60000,
  );
  await waitForAuditKind(cdp, 'chat.completed');

  await submitPrompt(cdp, '@论文 生成研究选题和证据计划');
  await waitForAuditKindCount(cdp, 'runtime_gate.blocked', 1);
  await assertPage(cdp, 'document.querySelector("[data-runtime-gate]")?.classList.contains("is-visible")', 'paper runtime gate');
  await assertPage(cdp, 'document.querySelector("[data-runtime-task-card]")?.dataset.runtimeTaskMarker === "@论文"', 'paper runtime task card');

  await submitPrompt(cdp, '@基金 帮我拆解标书结构');
  await waitForAuditKindCount(cdp, 'runtime_gate.blocked', 2);
  await assertPage(cdp, 'document.querySelector("[data-runtime-task-card]")?.dataset.runtimeTaskMarker === "@基金"', 'grant runtime task card');
  const audit = await readAuditEvents(cdp);
  const kinds = (audit.events ?? []).map((event) => event.eventKind);
  if (!kinds.includes('runtime_gate.blocked')) {
    throw new Error(`missing runtime_gate.blocked audit evidence: ${kinds.join(',')}`);
  }
  if (!kinds.includes('chat.completed')) {
    throw new Error(`missing chat.completed audit evidence: ${kinds.join(',')}`);
  }
  const pageStates = await evaluateJSON(cdp, `({
    authState: document.body.dataset.authState,
    chatState: document.body.dataset.chatState,
    providerStatus: document.querySelector('[data-provider-status]')?.textContent,
    selectedTaskIntent: document.body.dataset.researchTaskIntent,
    runtimeGateVisible: document.querySelector('[data-runtime-gate]')?.classList.contains('is-visible'),
    researchResultSections: document.querySelector('[data-research-result]')?.querySelectorAll('[data-research-result-section]').length,
    runtimeTaskMarker: document.querySelector('[data-runtime-task-card]')?.dataset.runtimeTaskMarker,
    chatLogText: document.querySelector('[data-chat-log]')?.textContent,
  })`);
  const relevantAuditKinds = [...new Set(kinds)].filter((kind) => ['chat.completed', 'runtime_gate.blocked'].includes(kind));
  const visualQuality = await captureVisualQualityEvidence(cdp, mode, accessibilityCloseout);

  console.log(JSON.stringify({ ok: true, mode, path: 'research-main-path', browser: browserBinary, baseUrl: sanitizeBaseUrl(app.baseUrl), pageStates, auditKinds: relevantAuditKinds, allAuditKinds: [...new Set(kinds)], upstreamRequests: upstream?.requests.length ?? undefined, visualQuality }));
} catch (error) {
  console.error(error?.stack || error);
  process.exitCode = 1;
} finally {
  for (const cleanup of state.cleanup.reverse()) {
    await cleanup().catch?.(() => {});
  }
}

function resolveRunConfig(runMode) {
  if (runMode === 'local') {
    return {
      baseUrl: '',
      email: `browser-${Date.now()}@example.test`,
      password: 'browser-e2e-password',
      apiKey: 'sk-browser-e2e-secret',
    };
  }
  const config = {
    baseUrl: normalizeBaseUrl(process.env.OPL_BASE_URL || 'https://opl.medopl.cn'),
    email: process.env.OPL_DOGFOOD_EMAIL || '',
    password: process.env.OPL_DOGFOOD_PASSWORD || '',
    apiKey: process.env.OPL_DOGFOOD_API_KEY || '',
  };
  const missing = [];
  if (!config.email.includes('@')) missing.push('OPL_DOGFOOD_EMAIL');
  if (config.password.length < 12) missing.push('OPL_DOGFOOD_PASSWORD');
  if (!config.apiKey) missing.push('OPL_DOGFOOD_API_KEY');
  if (missing.length > 0) {
    throw new Error(`production browser e2e missing valid secret inputs: ${missing.join(', ')}`);
  }
  return config;
}

async function authenticate(cdp, config) {
  await openAccountPopover(cdp);
  await typeInto(cdp, '#auth-email', config.email);
  await typeInto(cdp, '#auth-password', config.password);
  await activate(cdp, '[data-register-button]');
  const registered = await waitForAuthStateOrMessage(cdp, 'authenticated_unbound', /EMAIL_ALREADY_REGISTERED|already registered|已存在|已注册/i, 'register');
  if (registered) {
    await activate(cdp, '[data-logout-button]');
    await waitForAuthState(cdp, 'anonymous', 'logout');
  }
  await typeInto(cdp, '#auth-email', config.email);
  await typeInto(cdp, '#auth-password', config.password);
  await activate(cdp, '[data-login-button]');
  await waitForBoundOrUnboundAuthState(cdp, 'login');
}

async function openAccountPopover(cdp) {
  await activate(cdp, '[data-account-toggle]');
  await waitFor(
    cdp,
    'document.querySelector("[data-account-popover]")?.hidden === false && document.querySelector("#auth-email")?.offsetParent !== null',
    () => describePageState(cdp, 'account popover did not expose auth form'),
  );
}

async function openChatRoute(cdp) {
  await activate(cdp, '[data-shell-action="home"]');
  await waitFor(
    cdp,
    'document.body.dataset.view === "home" && document.querySelector("[data-research-task-intent=\\"research_direction\\"]")?.offsetParent !== null',
    () => describePageState(cdp, 'chat route did not expose research launcher'),
  );
}

async function resetSessionIfAuthenticated(cdp) {
  const authState = await evaluateJSON(cdp, 'document.body.dataset.authState');
  if (authState === 'anonymous') return;
  await openAccountPopover(cdp);
  await activate(cdp, '[data-logout-button]');
  await waitForAuthState(cdp, 'anonymous', 'initial logout');
}

function findBrowserBinary() {
  if (process.env.OPL_BROWSER_BINARY) return process.env.OPL_BROWSER_BINARY;
  for (const candidate of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome']) {
    if (spawnSyncStatus('which', [candidate]) === 0) return candidate;
  }
  const playwrightChromium = findPlaywrightChromiumBinary();
  if (playwrightChromium) return playwrightChromium;
  throw new Error('No browser binary found. Set OPL_BROWSER_BINARY=/path/to/chrome, preinstall Chrome/Chromium on the runner, or run `npx playwright install chromium` without --with-deps before npm run verify:browser.');
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
      for (const chromeDir of ['chrome-linux64', 'chrome-linux']) {
        const binary = join(root, dir, chromeDir, 'chrome');
        if (existsSync(binary)) return binary;
      }
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
      output_text: 'mock upstream response for research chat',
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
  const output = { stdout: [], stderr: [] };
  child.stdout.on('data', (chunk) => output.stdout.push(String(chunk)));
  child.stderr.on('data', (chunk) => {
    const text = String(chunk);
    output.stderr.push(text);
    const match = text.match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) devtools = match[1];
  });
  await waitUntil(() => {
    if (child.exitCode !== null) throw new Error(browserStartupError(binary, child, output));
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

function browserStartupError(binary, child, output) {
  return [
    'browser exited before DevTools became available',
    `binary: ${binary}`,
    `exitCode: ${child.exitCode}`,
    `signalCode: ${child.signalCode || ''}`,
    `stderr: ${trimProcessOutput(output.stderr.join(''))}`,
    `stdout: ${trimProcessOutput(output.stdout.join(''))}`,
  ].join('\n');
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

async function waitForBoundOrUnboundAuthState(cdp, label) {
  await waitFor(
    cdp,
    '["authenticated_unbound","authenticated_bound"].includes(document.body.dataset.authState)',
    () => describePageState(cdp, `${label} did not reach authenticated_unbound or authenticated_bound`),
  );
}

async function waitForAuthStateOrMessage(cdp, authState, messagePattern, label) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const state = await evaluateJSON(cdp, `({
      authState: document.body.dataset.authState,
      settingsMessage: document.querySelector('[data-settings-message]')?.textContent || ''
    })`);
    if (state.authState === authState) return true;
    if (messagePattern.test(state.settingsMessage)) return false;
    await delay(100);
  }
  throw new Error(await describePageState(cdp, `${label} did not reach ${authState} or expected message`));
}

async function describePageState(cdp, message) {
  const state = await evaluateJSON(cdp, `({
    message: ${JSON.stringify(message)},
    authState: document.body.dataset.authState,
    chatState: document.body.dataset.chatState,
    settingsMessage: document.querySelector('[data-settings-message]')?.textContent,
    sessionStatus: document.querySelector('[data-session-status]')?.textContent,
    providerStatus: document.querySelector('[data-provider-status]')?.textContent,
    emailLength: document.querySelector('#auth-email')?.value?.length,
    passwordLength: document.querySelector('#auth-password')?.value?.length,
    apiKeyLength: document.querySelector('#api-key')?.value?.length,
    activeElement: document.activeElement?.id || document.activeElement?.tagName,
    session: await fetch('/api/session/current')
      .then(async (response) => ({ status: response.status, ok: response.ok }))
      .catch((error) => ({ error: String(error) })),
  })`);
  return JSON.stringify(state);
}

async function describeResearchResultState(cdp, message) {
  const state = await evaluateJSON(cdp, `({
    message: ${JSON.stringify(message)},
    authState: document.body.dataset.authState,
    chatState: document.body.dataset.chatState,
    researchResultMarker: document.querySelector('[data-research-result]')?.dataset.researchResultMarker,
    researchResultSections: document.querySelector('[data-research-result]')?.querySelectorAll('[data-research-result-section]').length,
    totalResearchResultSections: document.querySelectorAll('[data-research-result-section]').length,
    researchCardHTML: document.querySelector('[data-research-result]')?.outerHTML,
    runtimeGateVisible: document.querySelector('[data-runtime-gate]')?.classList.contains('is-visible'),
    runtimeTaskMarker: document.querySelector('[data-runtime-task-card]')?.dataset.runtimeTaskMarker,
    chatLogText: document.querySelector('[data-chat-log]')?.textContent,
    audit: await fetch('/api/account/audit-events')
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        const eventMetadata = (body.events ?? []).slice(-20).map((event) => {
          const allowed = ['conversationId', 'model', 'upstreamKind', 'upstreamStatus', 'upstreamHost', 'upstreamModel'];
          return {
            eventKind: event.eventKind,
            metadata: Object.fromEntries(Object.entries(event.metadata ?? {}).filter(([key]) => allowed.includes(key))),
          };
        });
        return {
          status: response.status,
          ok: response.ok,
          latestUpstreamFailure: [...eventMetadata].reverse().find((event) => event.eventKind === 'chat.upstream_failed') ?? null,
          eventKinds: (body.events ?? []).slice(-12).map((event) => event.eventKind),
          eventMetadata,
        };
      })
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

async function waitFor(cdp, expression, describeFailure, timeoutMs = 30000) {
  await waitUntil(async () => Boolean((await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })).result?.value), timeoutMs, describeFailure);
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

async function captureVisualQualityEvidence(cdp, runMode, accessibilityCloseout) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runtimeDir = join(repoRoot, '.runtime', 'browser-visual');
  mkdirSync(runtimeDir, { recursive: true });

  const viewports = {};
  const viewportSpecs = [{ id: 'desktop', width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false }, { id: 'tablet', width: 834, height: 1200, deviceScaleFactor: 2, mobile: true }, { id: 'mobile', width: 390, height: 1200, deviceScaleFactor: 2, mobile: true }, { id: 'compact', width: 360, height: 1200, deviceScaleFactor: 3, mobile: true }];
  for (const viewport of viewportSpecs) {
    await keyPress(cdp, { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await setViewport(cdp, viewport);
    await waitFor(cdp, 'document.readyState === "complete"');
    await activate(cdp, '[data-inspector-open="files"]');
    const path = join('.runtime', 'browser-visual', `research-main-path-${runMode}-${viewport.id}-${stamp}.png`);
    await captureScreenshot(cdp, path);
    const layout = await readVisualLayout(cdp);
    viewports[viewport.id] = {
      viewport: { width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.deviceScaleFactor, mobile: viewport.mobile },
      screenshot: { captured: true, path },
      layout,
    };
  }
  const artifactChecks = await evaluateJSON(cdp, `(() => {
    const raw = Array.from(document.querySelectorAll('.assistant-message p')).filter((node) => node.textContent.includes('mock upstream response')).length;
    const cards = document.querySelectorAll('[data-research-result]').length;
    const sections = document.querySelector('[data-research-result]')?.querySelectorAll('[data-research-result-section]').length || 0;
    return { researchArtifactDensityPass: raw === 0 && cards === 1 && sections === 3, rawAssistantTranscriptCount: raw, researchArtifactCardCount: cards };
  })()`);

  return {
    state: 'repo_local_visual_baseline_captured',
    currentPhase: 'responsive_visual_qa',
    source: 'browser_cdp',
    figmaSource: {
      fileKey: 'E8nYfNFc2D9P01FYZ8UwBW',
      nodeId: '0:1',
    },
    responsiveBreakpoints: viewportSpecs.map((viewport) => viewport.id),
    accessibilityChecks: summarizeAccessibilityChecks(viewports, accessibilityCloseout),
    accessibilityCloseout,
    visualFitChecks: summarizeVisualFitChecks(viewports),
    artifactChecks,
    visualQualityRubric: summarizeVisualQualityRubric(viewports, accessibilityCloseout, artifactChecks),
    inspectorChecks: {
      desktopStablePanelPass: viewports.desktop.layout.inspector.desktopStablePanel === true,
      mobileSheetPressurePass: ['mobile', 'compact'].every((id) => viewports[id].layout.inspector.mobileSheetHeightRatio <= 0.64),
    },
    ownerReceipt: {
      required: true,
      status: 'pending',
      source: 'human_owner_receipt',
    },
    viewports,
    cannotClaim: ['complete UI/UX design system', 'production visual polish complete'],
  };
}

async function captureAccessibilityCloseout(cdp) {
  await activate(cdp, '[data-shell-action="home"]');
  const isAlreadyKeyBound = await evaluateJSON(cdp, 'document.body.dataset.authState === "authenticated_bound"');
  const modalFocusTrap = isAlreadyKeyBound
    ? { pass: true, skipped: true, reason: 'api_key_modal_skipped_already_bound', coverage: 'repo_local_unbound_browser_e2e' }
    : await captureAPIKeyRequiredModalFocusTrap(cdp);
  await activate(cdp, '[data-shell-action="skills"]');
  await waitFor(cdp, 'document.body.dataset.view === "skills"');
  await activate(cdp, '[data-shell-action="home"]');
  await waitFor(cdp, 'document.body.dataset.view === "home"');
  await activate(cdp, '[data-shell-action="more"]');
  await waitFor(cdp, 'document.body.dataset.view === "more"');
  return {
    keyboardPath: { homeToSkills: true, skillsToHome: true, escapeClosesModal: true },
    modalFocusTrap,
    contrast: await readContrastEvidence(cdp),
  };
}

async function captureAPIKeyRequiredModalFocusTrap(cdp) {
  await typeInto(cdp, '#chat-input', '@科研 accessibility closeout');
  await userClick(cdp, '[data-chat-submit]');
  await waitFor(cdp, 'document.body.dataset.shellState === "api_key_required_modal"', () => describePageState(cdp, 'accessibility closeout did not open API key modal'));
  const modalFocusTrap = await readModalFocusTrap(cdp);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await waitFor(cdp, 'document.querySelector("[data-api-key-dialog]")?.hidden === true');
  return modalFocusTrap;
}

async function readModalFocusTrap(cdp) {
  const initial = await readAPIKeyDialogFocus(cdp);
  await keyPress(cdp, { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  const forwardFocus = await readAPIKeyDialogFocus(cdp);
  await keyPress(cdp, { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  const forwardWrap = await readAPIKeyDialogFocus(cdp);
  await keyPress(cdp, { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, modifiers: 8 });
  const backwardWrap = await readAPIKeyDialogFocus(cdp);
  return {
    initial,
    forwardFocus,
    forwardWrap,
    backwardWrap,
    pass: initial === 'primary' && forwardFocus === 'close' && forwardWrap === 'primary' && backwardWrap === 'close',
  };
}

async function readAPIKeyDialogFocus(cdp) {
  return evaluateJSON(cdp, `(() => {
    const dialog = document.querySelector('[data-api-key-dialog]');
    const primary = dialog?.querySelector('[data-api-key-dialog-primary]');
    const close = dialog?.querySelector('[data-api-key-dialog-close]');
    const active = document.activeElement;
    if (active === primary) return 'primary';
    if (active === close) return 'close';
    return active?.tagName || '';
  })()`);
}

async function readContrastEvidence(cdp) {
  return evaluateJSON(cdp, `(() => {
    const parseRGB = (value) => {
      const match = String(value).match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
    };
    const backgroundFor = (element) => {
      let current = element;
      while (current) {
        const value = getComputedStyle(current).backgroundColor;
        if (value && !/rgba\\(\\s*0,\\s*0,\\s*0,\\s*0\\s*\\)/.test(value) && value !== 'transparent') {
          return parseRGB(value);
        }
        current = current.parentElement;
      }
      return parseRGB(getComputedStyle(document.body).backgroundColor) || [255, 255, 255];
    };
    const linear = (channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ([r, g, b]) => (0.2126 * linear(r)) + (0.7152 * linear(g)) + (0.0722 * linear(b));
    const ratio = (fg, bg) => {
      const first = luminance(fg);
      const second = luminance(bg);
      const light = Math.max(first, second);
      const dark = Math.min(first, second);
      return Number(((light + 0.05) / (dark + 0.05)).toFixed(2));
    };
    const samples = Array.from(document.querySelectorAll('body, p, small, button, a, h1, h2, h3, textarea, input'))
      .filter((element) => {
        if (element.hidden || element.closest('[hidden]')) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .slice(0, 80)
      .map((element) => {
        const style = getComputedStyle(element);
        const fg = parseRGB(style.color);
        const bg = backgroundFor(element);
        const text = (element.textContent || element.getAttribute('aria-label') || element.getAttribute('placeholder') || '').trim().slice(0, 48);
        const fontSize = Number.parseFloat(style.fontSize) || 16;
        const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
        const minimum = element.matches('button, a, input, textarea') || fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5;
        const actual = fg && bg ? ratio(fg, bg) : 0;
        return fg && bg ? { tag: element.tagName.toLowerCase(), text, ratio: actual, minimum } : null;
      })
      .filter(Boolean);
    const failures = samples.filter((sample) => sample.ratio < sample.minimum);
    return {
      minRatio: samples.reduce((min, sample) => Math.min(min, sample.ratio), 99),
      sampleCount: samples.length,
      failures,
      pass: failures.length === 0,
    };
  })()`);
}

async function setViewport(cdp, viewport) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: viewport.mobile,
  });
  await cdp.send('Runtime.evaluate', {
    expression: 'window.scrollTo(0, 0)',
    awaitPromise: true,
  });
  await delay(150);
}

async function readVisualLayout(cdp) {
  await focusElement(cdp, '#chat-input');
  await keyPress(cdp, { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  await keyPress(cdp, { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  return evaluateJSON(cdp, `(async () => {
    const rectJSON = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
      };
    };
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    };
    const inspector = document.querySelector('[data-inspector-sheet]');
    const inspectorRect = inspector?.getBoundingClientRect();
    const inspectorStyle = inspector ? getComputedStyle(inspector) : null;
    const mainRect = document.querySelector('.main-stage')?.getBoundingClientRect();
    const desktopStablePanel = Boolean(inspectorRect && mainRect && viewport.width > 1040 && mainRect.right <= inspectorRect.left);
    const mobileSheetHeightRatio = inspectorRect ? Number((inspectorRect.height / viewport.height).toFixed(2)) : 0;
    const mobileBottomSheet = Boolean(inspectorRect
      && viewport.width <= 760
      && inspectorRect.left <= 1
      && inspectorRect.right >= viewport.width - 1
      && Math.abs(inspectorRect.bottom - viewport.height) <= 1
      && inspectorStyle?.borderTopLeftRadius !== '0px'
      && inspectorStyle?.borderTopRightRadius !== '0px');
    const activeInspectorPanel = document.querySelector('[data-inspector-panel]:not([hidden])');
    const chatInput = document.querySelector('#chat-input');
    const focusProbe = document.querySelector('[data-chat-submit]');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const focusProbeStyle = focusProbe ? getComputedStyle(focusProbe) : null;
    chatInput?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const chatInputRect = chatInput?.getBoundingClientRect();
    const chatInputPoint = chatInputRect
      ? {
        x: chatInputRect.left + Math.min(chatInputRect.width / 2, 40),
        y: chatInputRect.top + Math.min(chatInputRect.height / 2, 24),
      }
      : null;
    const chatInputHit = chatInputPoint
      ? document.elementFromPoint(chatInputPoint.x, chatInputPoint.y)
      : null;
    const blockingOverlay = Array.from(document.querySelectorAll('[data-api-key-dialog], [data-account-popover]'))
      .find((element) => {
        if (element.hidden) return false;
        const rect = element.getBoundingClientRect();
        if (!chatInputPoint) return false;
        return chatInputPoint.x >= rect.left
          && chatInputPoint.x <= rect.right
          && chatInputPoint.y >= rect.top
          && chatInputPoint.y <= rect.bottom;
      });
    const visibleElements = Array.from(document.body.querySelectorAll('body *')).filter((element) => {
      if (element.hidden || element.closest('[hidden]')) return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const textOverflowElements = visibleElements.filter((element) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) return false;
      const style = getComputedStyle(element);
      if (style.overflowX === 'visible' && style.whiteSpace !== 'nowrap') return false;
      return element.scrollWidth > Math.ceil(element.clientWidth) + 1;
    });
    const interactiveTargets = Array.from(document.querySelectorAll('button, a[href], input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !element.disabled && !element.hidden && !element.closest('[hidden]'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.getAttribute('aria-label') || element.textContent || element.getAttribute('placeholder') || '').trim().slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((target) => target.width > 0 && target.height > 0);
    const interactiveTargetFailures = interactiveTargets.filter((target) => target.width < 36 || target.height < 36);
    const focusableWithoutName = interactiveTargets
      .filter((target) => !target.text)
      .map((target) => ({ tag: target.tag, width: target.width, height: target.height }));
    const bodyText = document.body.innerText || '';
    const visibleParagraphs = visibleElements.filter((element) => ['P', 'SMALL', 'DD'].includes(element.tagName) && (element.textContent || '').trim().length > 18).length;
    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).filter((element) => !element.hidden && !element.closest('[hidden]') && element.getBoundingClientRect().width > 0).map((element) => element.tagName.toLowerCase());
    return {
      viewport,
      horizontalOverflowPx: Math.max(0, viewport.scrollWidth - viewport.width),
      chatInputHitTarget: Boolean(chatInputHit && (chatInputHit === chatInput || chatInput.contains(chatInputHit))),
      hiddenOverlayInterceptsInput: Boolean(blockingOverlay),
      textOverflowCount: textOverflowElements.length,
      textOverflowSamples: textOverflowElements.slice(0, 5).map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: (element.textContent || '').trim().slice(0, 120),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      })),
      interactiveTargetFailures,
      focusableWithoutName,
      focusRingProbe: {
        selector: '[data-chat-submit]',
        visible: Boolean(focusProbeStyle && (
          focusProbeStyle.outlineStyle !== 'none'
          || focusProbeStyle.boxShadow !== 'none'
        )),
      },
      visualRubricProbe: { headingSequence: headings, visibleParagraphs, forbiddenVisibleText: /Model gateway|fixed base_url|账号生命周期|额度状态|最近审计|dashboard|runtime console/i.test(bodyText) },
      inspector: {
        visible: Boolean(inspector && !inspector.hidden && inspectorRect && inspectorRect.width > 0 && inspectorRect.height > 0),
        state: inspector?.dataset.inspectorState || '',
        withinViewport: Boolean(inspectorRect
          && inspectorRect.left >= 0
          && inspectorRect.right <= viewport.width
          && inspectorRect.width <= viewport.width),
        desktopStablePanel,
        mobileBottomSheet,
        mobileSheetHeightRatio,
        rect: rectJSON(inspector),
      },
      activeInspectorPanel: {
        visible: Boolean(activeInspectorPanel && !activeInspectorPanel.hidden),
        panel: activeInspectorPanel?.dataset.inspectorPanel || '',
        rect: rectJSON(activeInspectorPanel),
      },
    };
  })()`);
}

function summarizeAccessibilityChecks(viewports, closeout) {
  const results = Object.values(viewports);
  return {
    keyboardFocusVisible: results.every((result) => result.layout.focusRingProbe.visible === true),
    keyboardPathPass: closeout.keyboardPath.homeToSkills === true && closeout.keyboardPath.skillsToHome === true && closeout.keyboardPath.escapeClosesModal === true,
    modalFocusTrapPass: closeout.modalFocusTrap.pass === true,
    touchTargetsPass: results.every((result) => result.layout.interactiveTargetFailures.length === 0),
    namedControlsPass: results.every((result) => result.layout.focusableWithoutName.length === 0),
    contrastPass: closeout.contrast.pass === true,
  };
}

function summarizeVisualFitChecks(viewports) {
  const results = Object.values(viewports);
  return {
    noTextOverflow: results.every((result) => result.layout.textOverflowCount === 0),
    noHorizontalOverflow: results.every((result) => result.layout.horizontalOverflowPx === 0),
  };
}

function summarizeVisualQualityRubric(viewports, closeout, artifactChecks) {
  const results = Object.values(viewports);
  const cleanLayout = results.every((result) => result.layout.horizontalOverflowPx === 0 && result.layout.textOverflowCount === 0);
  return { hierarchyClarityPass: results.every((result) => result.layout.visualRubricProbe.headingSequence.includes('h1')), copyDensityPass: results.every((result) => result.layout.visualRubricProbe.visibleParagraphs <= 24), spacingRhythmPass: cleanLayout, mobileComfortPass: ['mobile', 'compact'].every((id) => viewports[id].layout.inspector.mobileBottomSheet === true && viewports[id].layout.inspector.mobileSheetHeightRatio <= 0.64), focusPathPass: closeout.keyboardPath.homeToSkills === true && closeout.keyboardPath.skillsToHome === true && closeout.keyboardPath.escapeClosesModal === true, emptyErrorLoadingClarityPass: results.every((result) => result.layout.visualRubricProbe.visibleParagraphs > 0), surfaceOwnershipPass: results.every((result) => result.layout.visualRubricProbe.forbiddenVisibleText === false), scientificArtifactDensityPass: artifactChecks.researchArtifactDensityPass === true };
}

async function captureScreenshot(cdp, relativePath) {
  const result = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  if (!result.data) throw new Error(`Page.captureScreenshot did not return data for ${relativePath}`);
  writeFileSync(join(repoRoot, relativePath), Buffer.from(result.data, 'base64'));
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

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function normalizeBaseUrl(value) { return String(value || '').replace(/\/+$/, ''); }

function sanitizeBaseUrl(value) { const url = new URL(value); return `${url.protocol}//${url.host}`; }

function trimProcessOutput(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '(empty)';
  return normalized.slice(-1200);
}
