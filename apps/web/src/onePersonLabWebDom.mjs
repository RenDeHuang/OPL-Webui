import {
  createInitialOnePersonLabViewModel,
  loadOnePersonLabWebState,
  loginAccount,
  logoutAccount,
  registerAccount,
  researchResultForChat,
  reliabilityStatusForResult,
  requiresRuntimeGate,
  runtimeTaskCardForPrompt,
  saveAPIKey,
  chatStateForResult,
  chatStateForPrompt,
  sendChatMessage,
  viewFromHash,
} from './onePersonLabWebState.mjs';

export async function initOnePersonLabWeb() {
  let view = createInitialOnePersonLabViewModel();
  document.body.dataset.shellState = 'home_default';
  document.body.dataset.inspectorState = document.body.dataset.inspectorState || 'hidden';
  document.body.dataset.apiKeyDialogState = document.body.dataset.apiKeyDialogState || 'closed';
  document.body.dataset.chatState = chatStateForResult(null);

  syncHashView();
  window.addEventListener('hashchange', syncHashView);
  bindShellControls();
  bindCapabilityButtons();
  bindAccountPopover();
  bindChatForm(() => view);
  bindSettingsForms(() => view, (next) => {
    view = next;
    renderView(view);
  });

  view = await loadOnePersonLabWebState(fetch, { loadSnapshot: false });
  renderView(view);
}

function syncHashView() {
  const view = viewFromHash(window.location.hash);
  document.body.dataset.view = view;
  syncNavCurrent(view);
  closeTransientOverlays();
  if (view === 'home') {
    document.querySelector('#home')?.setAttribute('tabindex', '-1');
  }
  if (view === 'skills') {
    document.querySelector('#skills')?.setAttribute('tabindex', '-1');
    document.querySelector('#skills')?.focus({ preventScroll: true });
  }
  if (view === 'workflows') {
    document.querySelector('#workflows')?.setAttribute('tabindex', '-1');
    document.querySelector('#workflows')?.focus({ preventScroll: true });
  }
  if (view === 'projects') {
    document.querySelector('#projects')?.setAttribute('tabindex', '-1');
    document.querySelector('#projects')?.focus({ preventScroll: true });
  }
  if (view === 'more') {
    document.querySelector('[data-settings-panel]')?.setAttribute('tabindex', '-1');
    document.querySelector('[data-settings-panel]')?.focus({ preventScroll: true });
  }
}

function bindCapabilityButtons() {
  for (const button of document.querySelectorAll('[data-prompt]')) {
    button.addEventListener('click', () => {
      const input = document.querySelector('#chat-input');
      input.value = button.dataset.prompt;
      input.focus();
      if (button.dataset.researchTaskIntent) {
        document.body.dataset.researchTaskIntent = button.dataset.researchTaskIntent;
      }
      document.body.dataset.chatState = chatStateForPrompt(button.dataset.prompt);
      if (requiresRuntimeGate(button.dataset.prompt)) showRuntimeGate(button.dataset.prompt);
    });
  }
}

function bindAccountPopover() {
  const button = document.querySelector('[data-account-toggle]');
  const popover = document.querySelector('[data-account-popover]');
  if (!button || !popover) return;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleAccountPopover();
  });
  document.querySelector('[data-account-popover-close]')?.addEventListener('click', () => closeAccountPopover(true));
}

function bindChatForm(getView) {
  document.querySelector('[data-chat-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const view = getView();
    const input = document.querySelector('#chat-input');
    const message = input.value.trim();
    if (!message) return;
    document.body.dataset.chatState = chatStateForPrompt(message);
    appendMessage('你', message, 'user-message');
    if (view.accountState === 'anonymous') {
      setShellTurnState('blocked_turn');
      renderReliabilityStatus(reliabilityStatusForResult({ ok: false, errorCode: 'AUTH_REQUIRED' }));
      appendMessage('OPL', '请先登录或注册后再发送。', 'assistant-message');
      window.location.hash = 'more';
      return;
    }
    if (view.accountState === 'authenticated_unbound') {
      setShellTurnState('blocked_turn');
      openAPIKeyDialog();
      renderReliabilityStatus(reliabilityStatusForResult({ ok: false, errorCode: 'API_KEY_REQUIRED' }));
      appendMessage('OPL', '请先在 More 绑定 API Key。', 'assistant-message');
      return;
    }
    setShellTurnState('running_turn');
    document.body.dataset.chatState = chatStateForResult(null, true);
    renderReliabilityStatus(reliabilityStatusForResult(null));
    const result = await sendChatMessage(fetch, message);
    document.body.dataset.chatState = chatStateForResult(result);
    setShellTurnState(result.ok ? 'home_default' : 'blocked_turn');
    renderReliabilityStatus(reliabilityStatusForResult(result));
    if (result.errorCode === 'RUNTIME_REQUIRED') showRuntimeGate(message);
    appendMessage('OPL', result.assistantMessage?.content || result.message || result.errorCode || '上游暂时不可用。', 'assistant-message');
    const researchResult = result.ok ? researchResultForChat({ ...result, prompt: message }) : null;
    if (researchResult) appendResearchResult(researchResult);
  });
}

function bindShellControls() {
  for (const action of document.querySelectorAll('[data-shell-action]')) {
    action.addEventListener('click', (event) => {
      const handled = runShellAction(action.dataset.shellAction);
      if (handled) event.preventDefault();
    });
  }

  for (const button of document.querySelectorAll('[data-inspector-open]')) {
    button.addEventListener('click', () => openInspector(button.dataset.inspectorOpen || 'files', button));
  }

  for (const tab of document.querySelectorAll('[data-inspector-tab]')) {
    tab.addEventListener('click', () => openInspector(tab.dataset.inspectorTab || 'files', tab));
  }

  bindInspectorResize();
  document.querySelector('[data-inspector-close]')?.addEventListener('click', () => closeInspector(true));
  for (const close of document.querySelectorAll('[data-overlay-close]')) {
    close.addEventListener('click', () => closeOverlay(close.dataset.overlayClose, true));
  }
  document.querySelector('[data-api-key-dialog-close]')?.addEventListener('click', () => closeAPIKeyDialog(true));
  document.querySelector('[data-api-key-dialog-primary]')?.addEventListener('click', () => closeAPIKeyDialog());
  document.querySelector('[data-local-search]')?.addEventListener('input', (event) => filterLocalEntries(event.currentTarget.value));
  document.addEventListener('keydown', handleGlobalKeydown);
  document.addEventListener('click', handleOutsideClick);
}

function runShellAction(action) {
  const input = document.querySelector('#chat-input');
  if (action === 'home') {
    setHashView('home');
    document.body.dataset.shellState = 'home_default';
    input?.focus({ preventScroll: true });
    return true;
  }
  if (action === 'skills' || action === 'workflows' || action === 'projects') {
    setHashView(action);
    return true;
  }
  if (action === 'search') {
    setHashView('home');
    openOverlay('search', document.querySelector('[data-search-trigger]'));
    document.querySelector('[data-local-search]')?.focus({ preventScroll: true });
    return true;
  }
  if (action === 'more') {
    setHashView('more');
    return true;
  }
  return false;
}

function setHashView(view) {
  const nextHash = view === 'home' ? '#home' : `#${view}`;
  if (window.location.hash === nextHash) syncHashView();
  else window.location.hash = nextHash;
}

function filterLocalEntries(query) {
  const normalized = String(query || '').trim().toLowerCase();
  for (const entry of document.querySelectorAll('[data-local-search-entry]')) {
    const matches = !normalized || entry.textContent.toLowerCase().includes(normalized) || (entry.dataset.prompt || '').toLowerCase().includes(normalized);
    entry.hidden = !matches;
  }
}

function syncNavCurrent(view) {
  const currentID = ['home', 'skills', 'workflows', 'projects', 'more'].includes(view) ? view : 'home';
  for (const item of document.querySelectorAll('[data-nav-item]')) {
    if (item.dataset.navItem === currentID) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }
}

function openInspector(state = 'files', trigger = null) {
  const inspector = document.querySelector('[data-inspector-sheet]');
  if (!inspector) return;
  const normalized = ['files', 'progress', 'output'].includes(state) ? state : 'files';
  setFocusReturn(inspector, trigger);
  inspector.hidden = false;
  inspector.dataset.inspectorState = normalized;
  document.body.dataset.inspectorState = normalized;
  document.body.dataset.shellState = `inspector_${normalized}`;
  for (const tab of document.querySelectorAll('[data-inspector-tab]')) {
    tab.setAttribute('aria-selected', String(tab.dataset.inspectorTab === normalized));
  }
  for (const panel of document.querySelectorAll('[data-inspector-panel]')) {
    panel.hidden = panel.dataset.inspectorPanel !== normalized;
  }
}

function closeInspector(restoreFocus = false) {
  const inspector = document.querySelector('[data-inspector-sheet]');
  if (!inspector) return;
  inspector.hidden = true;
  inspector.dataset.inspectorState = 'hidden';
  document.body.dataset.inspectorState = 'hidden';
  document.body.dataset.shellState = 'home_default';
  if (restoreFocus) restoreFocusFor(inspector);
}

function bindInspectorResize() {
  const inspector = document.querySelector('[data-inspector-sheet]');
  const handle = document.querySelector('[data-inspector-resize-handle]');
  if (!inspector || !handle) return;
  const clampWidth = (value) => Math.max(320, Math.min(520, value));
  const setWidth = (value) => {
    const width = clampWidth(value);
    inspector.style.setProperty('--inspector-width', `${width}px`);
    inspector.dataset.inspectorWidth = String(width);
  };
  handle.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const current = Number(inspector.dataset.inspectorWidth || inspector.getBoundingClientRect().width || 420);
    setWidth(current + (event.key === 'ArrowLeft' ? 24 : -24));
  });
  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startWidth = inspector.getBoundingClientRect().width;
    const move = (moveEvent) => setWidth(startWidth + startX - moveEvent.clientX);
    const stop = () => {
      handle.releasePointerCapture?.(event.pointerId);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', stop);
      document.removeEventListener('pointercancel', stop);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', stop);
    document.addEventListener('pointercancel', stop);
  });
}

function openAPIKeyDialog() {
  const dialog = document.querySelector('[data-api-key-dialog]');
  if (!dialog) return;
  setFocusReturn(dialog, document.querySelector('[data-chat-submit]'));
  dialog.hidden = false;
  dialog.dataset.apiKeyDialogState = 'open';
  document.body.dataset.apiKeyDialogState = 'open';
  document.body.dataset.shellState = 'api_key_required_modal';
  dialog.querySelector('[data-api-key-dialog-primary]')?.focus({ preventScroll: true });
}

function closeAPIKeyDialog(restoreFocus = false) {
  const dialog = document.querySelector('[data-api-key-dialog]');
  if (!dialog) return;
  dialog.hidden = true;
  dialog.dataset.apiKeyDialogState = 'closed';
  document.body.dataset.apiKeyDialogState = 'closed';
  if (document.body.dataset.shellState === 'api_key_required_modal') {
    document.body.dataset.shellState = 'home_default';
  }
  if (restoreFocus) restoreFocusFor(dialog);
}

function setShellTurnState(state) {
  document.querySelector('[data-running-turn]').hidden = state !== 'running_turn';
  document.querySelector('[data-blocked-turn]').hidden = state !== 'blocked_turn';
  document.body.dataset.shellState = state;
}

function openOverlay(name, trigger = null) {
  const overlay = document.querySelector(`[data-${name}-sheet]`);
  if (!overlay) return;
  closeTransientOverlays(name);
  setFocusReturn(overlay, trigger);
  overlay.hidden = false;
  overlay.dataset.overlayState = 'open';
  document.body.dataset.shellState = `${name}_sheet_open`;
  overlay.querySelector('input, button, a[href], textarea')?.focus({ preventScroll: true });
}

function closeOverlay(name, restoreFocus = false) {
  const overlay = document.querySelector(`[data-${name}-sheet]`);
  if (!overlay) return;
  overlay.hidden = true;
  overlay.dataset.overlayState = 'closed';
  if (document.body.dataset.shellState === `${name}_sheet_open`) {
    document.body.dataset.shellState = 'home_default';
  }
  if (restoreFocus) restoreFocusFor(overlay);
}

function closeTransientOverlays(except = '') {
  for (const name of ['search']) {
    if (name !== except) closeOverlay(name);
  }
  closeAccountPopover();
}

function toggleAccountPopover() {
  const popover = document.querySelector('[data-account-popover]');
  const button = document.querySelector('[data-account-toggle]');
  if (!button || !popover) return;
  const opening = popover.hidden;
  if (opening) {
    closeTransientOverlays();
    setFocusReturn(popover, button);
  }
  popover.hidden = !opening;
  button.setAttribute('aria-expanded', String(opening));
}

function closeAccountPopover(restoreFocus = false) {
  const popover = document.querySelector('[data-account-popover]');
  const button = document.querySelector('[data-account-toggle]');
  if (!button || !popover || popover.hidden) return;
  popover.hidden = true;
  button.setAttribute('aria-expanded', 'false');
  if (restoreFocus) restoreFocusFor(popover);
}

function handleGlobalKeydown(event) {
  if (trapAPIKeyDialogFocus(event)) return;
  if (event.key !== 'Escape') return;
  closeAPIKeyDialog(true);
  closeInspector(true);
  for (const name of ['search']) closeOverlay(name, true);
  closeAccountPopover(true);
}

function trapAPIKeyDialogFocus(event) {
  if (event.key !== 'Tab') return false;
  const dialog = document.querySelector('[data-api-key-dialog]');
  if (!dialog || dialog.hidden) return false;
  const focusable = getFocusableElements(dialog);
  if (focusable.length === 0) return false;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus({ preventScroll: true });
    return true;
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return true;
  }
  if (!dialog.contains(document.activeElement)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return true;
  }
  return false;
}

function getFocusableElements(root) {
  return Array.from(root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
}

function handleOutsideClick(event) {
  const target = event.target;
  if (!target.closest('[data-account-popover], [data-account-toggle]')) closeAccountPopover();
  for (const name of ['search']) {
    const overlay = document.querySelector(`[data-${name}-sheet]`);
    const trigger = document.querySelector(`[data-shell-action="${name}"]`);
    if (overlay && !overlay.hidden && !target.closest(`[data-${name}-sheet]`) && !trigger?.contains(target)) {
      closeOverlay(name);
    }
  }
}

function setFocusReturn(surface, trigger) {
  if (!surface || !trigger) return;
  const key = `focus-return-${Math.random().toString(36).slice(2)}`;
  trigger.dataset.focusReturnKey = key;
  surface.dataset.focusReturnKey = key;
}

function restoreFocusFor(surface) {
  const key = surface?.dataset.focusReturnKey;
  if (!key) return;
  document.querySelector(`[data-focus-return-key="${key}"]`)?.focus({ preventScroll: true });
}

function bindSettingsForms(getView, setView) {
  document.querySelector('[data-register-button]')?.addEventListener('click', async () => authAction('register', setView));
  document.querySelector('[data-login-button]')?.addEventListener('click', async () => authAction('login', setView));
  document.querySelector('[data-logout-button]')?.addEventListener('click', async () => {
    await logoutAccount(fetch);
    setSettingsMessage('已退出登录。');
    setView(await loadOnePersonLabWebState(fetch, { loadSnapshot: false }));
  });
  document.querySelector('[data-provider-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const view = getView();
    const apiKey = document.querySelector('#api-key').value.trim();
    const result = await saveAPIKey(fetch, apiKey, view.session);
    if (!result.ok) {
      setSettingsMessage(result.message || result.errorCode || '保存失败。');
      renderReliabilityStatus(reliabilityStatusForResult(result));
      return;
    }
    document.querySelector('#api-key').value = '';
    setSettingsMessage(`API Key 已更新：${result.maskedKey || '已绑定'}`);
    setView(await loadOnePersonLabWebState(fetch, { loadSnapshot: false }));
  });
}

async function authAction(kind, setView) {
  const email = document.querySelector('#auth-email').value.trim();
  const password = document.querySelector('#auth-password').value;
  const result = kind === 'register'
    ? await registerAccount(fetch, email, password)
    : await loginAccount(fetch, email, password);
  setSettingsMessage(result.ok ? '账号已就绪。' : result.message || result.errorCode || '认证失败。');
  if (!result.ok) renderReliabilityStatus(reliabilityStatusForResult(result));
  if (result.ok) setView(await loadOnePersonLabWebState(fetch, { loadSnapshot: false }));
}

function renderView(view) {
  document.body.dataset.authState = view.accountState;
  document.body.dataset.chatState = document.body.dataset.chatState || chatStateForResult(null);
  document.querySelector('[data-chat-submit]').textContent = '发送';
  document.querySelector('[data-session-label]').textContent = view.session.ok ? view.session.email : '未登录';
  setTextAll('[data-session-status]', view.session.ok ? `已登录：${view.session.email}` : '未登录');
  const providerStatus = view.provider.apiKeyConfigured ? `已绑定：${view.provider.maskedKey}` : '未绑定';
  setTextAll('[data-provider-status]', providerStatus);
  setTextAll('[data-account-lifecycle-status]', view.accountLifecycle.lifecycleLabel);
  setTextAll('[data-team-readiness-status]', view.accountLifecycle.teamReadinessLabel);
  setTextAll('[data-quota-status]', view.accountLifecycle.quotaLabel);
  setTextAll('[data-account-audit-status]', view.accountLifecycle.auditLabel);
  renderReliabilityStatus(view.reliabilityStatus);
  document.querySelector('[data-account-hint]').textContent = view.session.ok ? '账号状态' : '登录 / 注册';
}

function setTextAll(selector, text) {
  for (const node of document.querySelectorAll(selector)) node.textContent = text;
}

function appendMessage(sender, content, className) {
  const log = document.querySelector('[data-chat-log]');
  const message = document.createElement('article');
  message.className = `message ${className}`;
  message.innerHTML = `<span></span><p></p>`;
  message.querySelector('span').textContent = sender;
  message.querySelector('p').textContent = content;
  log.append(message);
}

function appendResearchResult(result) {
  const log = document.querySelector('[data-chat-log]');
  const card = document.createElement('article');
  card.className = 'research-result-card';
  card.dataset.researchResult = result.kind;
  card.dataset.researchResultMarker = result.marker;
  const title = document.createElement('h3');
  title.textContent = result.title;
  card.append(title);
  const sectionList = document.createElement('div');
  sectionList.className = 'research-result-sections';
  for (const section of result.sections) {
    const item = document.createElement('section');
    item.dataset.researchResultSection = section.id;
    const heading = document.createElement('h4');
    heading.textContent = section.title;
    const body = document.createElement('p');
    body.textContent = section.body;
    item.append(heading, body);
    sectionList.append(item);
  }
  card.append(sectionList);
  log.append(card);
}

function showRuntimeGate(prompt = '') {
  const gate = document.querySelector('[data-runtime-gate]');
  if (!gate) return;
  gate.classList.add('is-visible');
  const taskCard = runtimeTaskCardForPrompt(prompt);
  if (!taskCard) return;
  renderRuntimeTaskCard(gate, taskCard);
}

function renderRuntimeTaskCard(gate, taskCard) {
  gate.querySelector('[data-runtime-task-card]')?.remove();
  const card = document.createElement('article');
  card.className = 'runtime-task-card';
  card.dataset.runtimeTaskCard = taskCard.kind;
  card.dataset.runtimeTaskMarker = taskCard.marker;
  const title = document.createElement('h3');
  title.textContent = taskCard.title;
  const body = document.createElement('p');
  body.textContent = taskCard.message;
  const meta = document.createElement('p');
  meta.className = 'runtime-task-meta';
  meta.textContent = `required capability: ${taskCard.requiredCapability}; Web execution: ${taskCard.webuiRuntimeExecution}`;
  card.append(title, body, meta);
  gate.prepend(card);
}

function setSettingsMessage(message) {
  document.querySelector('[data-settings-message]').textContent = message;
}

function renderReliabilityStatus(status) {
  const panel = document.querySelector('[data-reliability-status]');
  if (!panel || !status) return;
  panel.dataset.state = status.state;
  panel.querySelector('[data-reliability-title]').textContent = status.title;
  panel.querySelector('[data-reliability-action]').textContent = status.action;
  panel.querySelector('[data-reliability-details]').textContent = status.details || '';
}
