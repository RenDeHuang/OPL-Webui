#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
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
    && document.querySelector("[data-side-navigation]")?.textContent.includes("项目")`);
  const workbenchEvidence = await workbenchState(cdp);
  const afterAuthBase = await pageState(cdp, {
    ...workbenchEvidence,
    sidebarText: await textContent(cdp, '[data-side-navigation]'),
    projectWindowEmptyVisible: await isVisible(cdp, '[data-project-window-empty]'),
    projectWindowItems: await count(cdp, '[data-project-window-item]'),
  });
  const projectionEvidence = await dialogSheetProjectionState(cdp);
  const controlsEvidence = await commercialProductControlsState(cdp);
  const afterAuth = {
    ...afterAuthBase,
    ...projectionEvidence,
    ...controlsEvidence,
  };

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

async function commercialProductControlsState(cdp) {
  await activate(cdp, '[data-model-selector]');
  await waitFor(cdp, visibleSelectorExpression('[data-model-menu]'));
  const modelSelector = await evaluateJSON(cdp, `(() => {
    const menu = document.querySelector('[data-model-menu]');
    return {
      open: Boolean(menu && !menu.hidden),
      selected: document.querySelector('[data-model-option][aria-selected="true"]')?.dataset.modelOption || '',
      text: menu?.textContent || '',
      baseUrlVisible: /base_url|gateway|gflabtoken|https?:\\/\\//i.test(menu?.textContent || ''),
    };
  })()`);
  await activate(cdp, '[data-model-option="auto"]');

  const plusFileAttachTriggerVisible = await isVisible(cdp, '[data-plus-file-trigger]');
  await activate(cdp, '[data-plus-file-trigger]');
  await waitFor(cdp, 'document.body.dataset.shellState === "blocked_turn" && document.querySelector("[data-runtime-task-marker]")?.dataset.runtimeTaskMarker === "@文件"');
  const plusFileAttach = await evaluateJSON(cdp, `(() => {
    return {
      triggerVisible: ${JSON.stringify(plusFileAttachTriggerVisible)},
      marker: document.querySelector('[data-runtime-task-marker]')?.dataset.runtimeTaskMarker || '',
      runtimeHandoffVisible: Boolean(document.querySelector('[data-runtime-gate]')),
      forbiddenMixedActionsVisible: Boolean(document.querySelector('[data-plus-action="import_skill"], [data-plus-action="bind_api_key"], [data-plus-action="select_model"], [data-plus-action="new_window"], [data-plus-menu]')),
      deadClick: !document.querySelector('[data-runtime-gate]'),
    };
  })()`);
  await activate(cdp, '[data-shell-action="home"]');
  await waitFor(cdp, 'document.body.dataset.shellState === "home_default"');
  await activate(cdp, '[data-shell-action="skills"]');
  await waitFor(cdp, 'document.body.dataset.shellState === "skill_plaza"');
  await activate(cdp, '[data-skill-import-open]');
  await waitFor(cdp, 'document.body.dataset.skillImportState === "select"');

  await activate(cdp, '[data-skill-import-trigger]');
  await waitFor(cdp, '["validate","error"].includes(document.body.dataset.skillImportState)');
  const skillImport = await evaluateJSON(cdp, `(() => ({
    states: (document.body.dataset.skillImportStates || '').split(',').filter(Boolean),
    fakeImported: document.body.dataset.skillImportState === 'imported' && !document.querySelector('[data-skill-import-source]'),
  }))()`);
  await activate(cdp, '[data-skill-import-close]');

  return {
    commercialProductControls: {
      modelSelector,
      plusFileAttach,
      skillImport,
    },
  };
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
    projectWindowEmptyVisible: visible('[data-project-window-empty]'),
    projectWindowItemCount: document.querySelectorAll('[data-project-window-item]').length,
    retiredTaskHistorySelectorCount: document.querySelectorAll('[data-task-history-empty], [data-task-history-item], [data-task-history-center]').length,
    prompt: document.querySelector('#chat-input')?.value || '',
    ${Object.entries(extra).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',\n    ')}
    };
  })()`);
}

async function dialogSheetProjectionState(cdp) {
  await waitFor(cdp, 'Boolean(document.querySelector("[data-search-trigger]")?.offsetParent !== null)');
  await typeInto(cdp, '#chat-input', '');
  await activate(cdp, '[data-search-trigger]');
  await waitFor(cdp, visibleSelectorExpression('[data-search-sheet]'));
  const searchOpen = await overlayState(cdp, 'search');
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await waitFor(cdp, '!document.querySelector("[data-search-sheet]")');
  const searchClosed = await evaluateJSON(cdp, 'document.activeElement?.matches("[data-search-trigger]") === true');

  await activate(cdp, '[data-account-toggle]');
  await waitFor(cdp, visibleSelectorExpression('[data-account-popover]'));
  const accountOpen = await overlayState(cdp, 'account');
  await activate(cdp, '[data-account-popover-close]');
  await waitFor(cdp, '!document.querySelector("[data-account-popover]")');
  const accountClosed = await evaluateJSON(cdp, 'document.activeElement?.matches("[data-account-toggle]") === true');

  await typeInto(cdp, '#chat-input', '普通问题');
  await submitVisibleButton(cdp, '[data-chat-submit]');
  await waitFor(cdp, 'document.body.dataset.apiKeyDialogState === "open"');
  const apiKeyOpen = await overlayState(cdp, 'apiKey');
  await activate(cdp, '[data-api-key-dialog-close]');
  await waitFor(cdp, 'document.body.dataset.apiKeyDialogState === "closed"');
  const apiKeyClosed = await evaluateJSON(cdp, 'document.activeElement?.id === "chat-input"');

  await activate(cdp, '[data-inspector-open="autonomy"]');
  await waitFor(cdp, visibleSelectorExpression('[data-inspector-sheet]'));
  const inspectorOpen = await overlayState(cdp, 'inspector');
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await waitFor(cdp, '!document.querySelector("[data-inspector-sheet]")');
  const inspectorClosed = await evaluateJSON(cdp, 'document.activeElement?.matches("[data-inspector-open]") === true');

  return {
    dialogSheetProjection: {
      searchOpen,
      searchClosed,
      accountOpen,
      accountClosed,
      apiKeyOpen,
      apiKeyClosed,
      inspectorOpen,
      inspectorClosed,
    },
  };
}

function visibleSelectorExpression(selector) {
  return `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node || node.hidden) return false;
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects().length);
  })()`;
}

async function overlayState(cdp, kind) {
  return evaluateJSON(cdp, `(() => {
    const selectors = {
      search: '[data-search-sheet]',
      account: '[data-account-popover]',
      apiKey: '[data-api-key-dialog]',
      inspector: '[data-inspector-sheet]',
    };
    const element = document.querySelector(selectors[${JSON.stringify(kind)}]);
    const text = element?.textContent || '';
    return {
      slice: element?.getAttribute('data-figma-slice') || '',
      visible: isVisible(element),
      hasClose: Boolean(element?.querySelector('button[aria-label*="关闭"], [data-overlay-close], [data-api-key-dialog-close], [data-inspector-close], [data-account-popover-close]')),
      hasEmptyState: Boolean(element?.querySelector('[data-project-window-search-empty], [data-settings-message], [data-inspector-panel], [data-api-key-dialog-primary]')),
      projectionOnly: !/artifact body|runtime completed|storage ready|payment status|Pro 套餐|积分余额|充值/.test(text),
      scope: element?.querySelector('[data-window-search]')?.dataset.windowSearchScope || '',
    };
    function isVisible(node) {
      if (!node || node.hidden) return false;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects().length);
    }
  })()`);
}

async function workbenchState(cdp) {
  return evaluateJSON(cdp, `(() => {
    const shell = document.querySelector('[data-app-shell]');
    const sidebar = document.querySelector('[data-side-navigation]');
    const composer = document.querySelector('[data-workbench-surface]');
    const composerBox = document.querySelector('[data-composer-box]');
    const toolbar = document.querySelector('[data-composer-toolbar]');
    const input = document.querySelector('#chat-input');
    const sidebarRect = sidebar?.getBoundingClientRect();
    const composerRect = composer?.getBoundingClientRect();
    const composerBoxRect = composerBox?.getBoundingClientRect();
    const viewportCenter = (sidebarRect?.right || 0) + ((window.innerWidth - (sidebarRect?.right || 0)) / 2);
    const composerCenter = composerBoxRect ? composerBoxRect.left + composerBoxRect.width / 2 : 0;
    return {
      workbenchSlice: shell?.getAttribute('data-figma-slice') || '',
      workbench: {
        sidebarVisible: Boolean(sidebar && sidebar.offsetParent !== null),
        sidebarWidth: Math.round(sidebarRect?.width || 0),
        composerVisible: Boolean(composer && composer.offsetParent !== null),
        composerCentered: Boolean(composerBoxRect && Math.abs(composerCenter - viewportCenter) < 18),
        composerMaxWidth: Math.round(composerBoxRect?.width || 0),
        toolbarVisible: Boolean(toolbar && toolbar.offsetParent !== null),
        taskLauncherCount: document.querySelectorAll('[data-research-task]').length,
        promptRestored: input?.value?.startsWith('@基金') === true,
        projectWindowProjectionOnly: Boolean(document.querySelector('[data-project-window-list]') && document.querySelector('[data-project-window-empty]')),
        accountTriggerVisible: Boolean(document.querySelector('[data-account-toggle]')?.offsetParent !== null),
        searchTriggerVisible: Boolean(document.querySelector('[data-search-trigger]')?.offsetParent !== null),
      },
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
  const child = spawn('go', ['run', './backend/control-plane-go/cmd/opl-webui-control-plane'], {
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
  state.cleanup.push(async () => rmSync(userDataDir, { recursive: true, force: true }));
  let devtools = '';
  const output = { stdout: [], stderr: [] };
  const child = spawn(binary, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  state.cleanup.push(() => closeChildProcess(child));
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
  }, 30000, () => browserStartupError(binary, child, output));
  const versionURL = devtools.replace(/^ws:\/\/([^/]+).*$/, 'http://$1/json/version');
  const version = await fetchJSON(versionURL);
  if (!version.webSocketDebuggerUrl) throw new Error('/json/version did not expose webSocketDebuggerUrl');
  const devtoolsBaseUrl = versionURL.replace('/json/version', '');
  return { devtoolsBaseUrl };
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
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  if (!await elementExists(cdp, selector)) {
    await wait(50);
    return;
  }
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector(${JSON.stringify(selector)})?.focus()`,
    awaitPromise: true,
  });
  await wait(50);
}

async function elementExists(cdp, selector) {
  return evaluateJSON(cdp, `document.querySelector(${JSON.stringify(selector)}) !== null`);
}

async function typeInto(cdp, selector, value) {
  await focusElement(cdp, selector);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
  if (value === '') {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await waitFor(cdp, `document.querySelector(${JSON.stringify(selector)})?.value === ""`);
    return;
  }
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

async function waitUntil(predicate, timeoutMs = 30000, describe = () => 'condition timed out') {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await predicate();
    if (result) return result;
    await wait(100);
  }
  throw new Error(typeof describe === 'function' ? await describe() : String(describe));
}

async function fetchJSON(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function trimProcessOutput(value) {
  const text = String(value || '').trim();
  return text.length > 2000 ? `${text.slice(-2000)}` : text;
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
