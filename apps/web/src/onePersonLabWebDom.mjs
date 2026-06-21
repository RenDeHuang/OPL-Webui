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
  document.body.dataset.shellState = 'app_default_chat';
  document.body.dataset.leftRailState = document.body.dataset.leftRailState || 'collapsed';
  document.body.dataset.rightInspectorState = document.body.dataset.rightInspectorState || 'hidden';
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
  syncRailCurrent(view);
  if (view === 'settings') {
    document.querySelector('[data-settings-panel]')?.setAttribute('tabindex', '-1');
    document.querySelector('[data-settings-panel]')?.focus({ preventScroll: true });
  }
  if (view === 'skill') {
    document.querySelector('#skill')?.setAttribute('tabindex', '-1');
    document.querySelector('#skill')?.focus({ preventScroll: true });
  }
  if (view === 'medopl') showRuntimeGate();
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
  button.addEventListener('click', () => {
    const nextExpanded = popover.hidden;
    popover.hidden = !nextExpanded;
    button.setAttribute('aria-expanded', String(nextExpanded));
  });
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
      appendMessage('OPL', '请先登录/注册后开始聊天。', 'assistant-message');
      window.location.hash = 'settings';
      return;
    }
    if (view.accountState === 'authenticated_unbound') {
      setShellTurnState('blocked_turn');
      openAPIKeyDialog();
      renderReliabilityStatus(reliabilityStatusForResult({ ok: false, errorCode: 'API_KEY_REQUIRED' }));
      appendMessage('OPL', '请先在 Settings 绑定 API Key。', 'assistant-message');
      window.location.hash = 'settings';
      return;
    }
    setShellTurnState('running_turn');
    document.body.dataset.chatState = chatStateForResult(null, true);
    renderReliabilityStatus(reliabilityStatusForResult(null));
    const result = await sendChatMessage(fetch, message);
    document.body.dataset.chatState = chatStateForResult(result);
    setShellTurnState(result.ok ? 'app_default_chat' : 'blocked_turn');
    renderReliabilityStatus(reliabilityStatusForResult(result));
    if (result.errorCode === 'RUNTIME_REQUIRED') showRuntimeGate(message);
    appendMessage('OPL', result.assistantMessage?.content || result.message || result.errorCode || '上游暂时不可用。', 'assistant-message');
    const researchResult = result.ok ? researchResultForChat({ ...result, prompt: message }) : null;
    if (researchResult) appendResearchResult(researchResult);
  });
}

function bindShellControls() {
  document.querySelector('[data-left-rail-toggle]')?.addEventListener('click', () => {
    const expanded = document.body.dataset.leftRailState !== 'expanded';
    document.body.dataset.leftRailState = expanded ? 'expanded' : 'collapsed';
    document.body.dataset.shellState = expanded ? 'left_sidebar_expanded' : 'app_default_chat';
    document.querySelector('[data-left-rail-toggle]')?.setAttribute('aria-expanded', String(expanded));
  });

  for (const action of document.querySelectorAll('[data-shell-action]')) {
    action.addEventListener('click', (event) => {
      const handled = runShellAction(action.dataset.shellAction);
      if (handled) event.preventDefault();
    });
  }

  for (const button of document.querySelectorAll('[data-right-inspector-open]')) {
    button.addEventListener('click', () => openRightInspector(button.dataset.rightInspectorOpen || 'files'));
  }

  for (const tab of document.querySelectorAll('[data-right-inspector-tab]')) {
    tab.addEventListener('click', () => openRightInspector(tab.dataset.rightInspectorTab || 'files'));
  }

  document.querySelector('[data-right-inspector-close]')?.addEventListener('click', () => closeRightInspector());
  document.querySelector('[data-api-key-dialog-close]')?.addEventListener('click', () => closeAPIKeyDialog());
  document.querySelector('[data-api-key-dialog-primary]')?.addEventListener('click', () => closeAPIKeyDialog());
  document.querySelector('[data-local-search]')?.addEventListener('input', (event) => filterLocalSidebar(event.currentTarget.value));
}

function runShellAction(action) {
  const input = document.querySelector('#chat-input');
  if (action === 'new_chat') {
    setHashView('chat');
    openLocalSidebarPanel('recent');
    document.body.dataset.shellState = 'app_default_chat';
    input?.focus({ preventScroll: true });
    return true;
  }
  if (action === 'projects') {
    setHashView('chat');
    openLocalSidebarPanel('projects');
    focusLocalSidebar('[data-project-panel] button');
    return true;
  }
  if (action === 'skill') {
    setHashView('skill');
    openLocalSidebarPanel('recent');
    return true;
  }
  if (action === 'search') {
    setHashView('chat');
    openLocalSidebarPanel('search');
    document.querySelector('[data-local-search]')?.focus({ preventScroll: true });
    return true;
  }
  if (action === 'more') {
    setHashView('settings');
    openLocalSidebarPanel('more');
    focusLocalSidebar('[data-more-panel] a');
    return true;
  }
  return false;
}

function setHashView(view) {
  const nextHash = view === 'chat' ? '#chat' : `#${view}`;
  if (window.location.hash === nextHash) syncHashView();
  else window.location.hash = nextHash;
}

function openLocalSidebarPanel(panelName) {
  document.body.dataset.leftRailState = 'expanded';
  document.querySelector('[data-left-rail-toggle]')?.setAttribute('aria-expanded', 'true');
  document.body.dataset.shellState = panelName === 'recent' ? 'app_default_chat' : 'left_sidebar_expanded';
  for (const panel of document.querySelectorAll('[data-local-sidebar-panel]')) {
    panel.hidden = panel.dataset.localSidebarPanel !== panelName;
  }
}

function focusLocalSidebar(selector) {
  document.querySelector(selector)?.focus({ preventScroll: true });
}

function filterLocalSidebar(query) {
  const normalized = String(query || '').trim().toLowerCase();
  for (const entry of document.querySelectorAll('[data-local-search-entry]')) {
    const matches = !normalized || entry.textContent.toLowerCase().includes(normalized) || (entry.dataset.prompt || '').toLowerCase().includes(normalized);
    entry.hidden = !matches;
  }
}

function syncRailCurrent(view) {
  const currentByView = { chat: 'new_chat', settings: 'more', skill: 'skill', medopl: 'more' };
  const currentID = currentByView[view] || 'new_chat';
  for (const item of document.querySelectorAll('[data-left-rail-item]')) {
    if (item.dataset.leftRailItem === currentID) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }
}

function openRightInspector(state = 'files') {
  const inspector = document.querySelector('[data-right-inspector]');
  if (!inspector) return;
  const normalized = ['files', 'progress', 'output'].includes(state) ? state : 'files';
  inspector.hidden = false;
  inspector.dataset.rightInspectorState = normalized;
  document.body.dataset.rightInspectorState = normalized;
  document.body.dataset.shellState = 'right_inspector_open';
  for (const tab of document.querySelectorAll('[data-right-inspector-tab]')) {
    tab.setAttribute('aria-selected', String(tab.dataset.rightInspectorTab === normalized));
  }
  for (const panel of document.querySelectorAll('[data-right-inspector-panel]')) {
    panel.hidden = panel.dataset.rightInspectorPanel !== normalized;
  }
}

function closeRightInspector() {
  const inspector = document.querySelector('[data-right-inspector]');
  if (!inspector) return;
  inspector.hidden = true;
  inspector.dataset.rightInspectorState = 'hidden';
  document.body.dataset.rightInspectorState = 'hidden';
  document.body.dataset.shellState = 'app_default_chat';
}

function openAPIKeyDialog() {
  const dialog = document.querySelector('[data-api-key-dialog]');
  if (!dialog) return;
  dialog.hidden = false;
  dialog.dataset.apiKeyDialogState = 'open';
  document.body.dataset.apiKeyDialogState = 'open';
  document.body.dataset.shellState = 'api_key_required_modal';
  dialog.querySelector('[data-api-key-dialog-primary]')?.focus({ preventScroll: true });
}

function closeAPIKeyDialog() {
  const dialog = document.querySelector('[data-api-key-dialog]');
  if (!dialog) return;
  dialog.hidden = true;
  dialog.dataset.apiKeyDialogState = 'closed';
  document.body.dataset.apiKeyDialogState = 'closed';
  if (document.body.dataset.shellState === 'api_key_required_modal') {
    document.body.dataset.shellState = 'app_default_chat';
  }
}

function setShellTurnState(state) {
  document.querySelector('[data-running-turn]').hidden = state !== 'running_turn';
  document.querySelector('[data-blocked-turn]').hidden = state !== 'blocked_turn';
  document.body.dataset.shellState = state;
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
  document.querySelector('[data-chat-submit]').textContent = view.primaryCTA;
  document.querySelector('[data-session-label]').textContent = view.session.ok ? view.session.email : '未登录';
  setTextAll('[data-session-status]', view.session.ok ? `已登录：${view.session.email}` : '未登录');
  const providerStatus = view.provider.apiKeyConfigured ? `已绑定：${view.provider.maskedKey}` : '未绑定';
  setTextAll('[data-provider-status]', providerStatus);
  setTextAll('[data-account-lifecycle-status]', view.accountLifecycle.lifecycleLabel);
  setTextAll('[data-team-readiness-status]', view.accountLifecycle.teamReadinessLabel);
  setTextAll('[data-quota-status]', view.accountLifecycle.quotaLabel);
  setTextAll('[data-account-audit-status]', view.accountLifecycle.auditLabel);
  renderReliabilityStatus(view.reliabilityStatus);
  document.querySelector('[data-account-hint]').textContent = view.primaryCTA;
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
