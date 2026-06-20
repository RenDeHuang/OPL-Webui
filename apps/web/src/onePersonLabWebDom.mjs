import {
  createInitialOnePersonLabViewModel,
  loadOnePersonLabWebState,
  loginAccount,
  logoutAccount,
  registerAccount,
  researchResultForChat,
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
  document.body.dataset.chatState = chatStateForResult(null);

  syncHashView();
  window.addEventListener('hashchange', syncHashView);
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
  if (view === 'settings') {
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
      appendMessage('OPL', '请先登录/注册后开始聊天。', 'assistant-message');
      window.location.hash = 'settings';
      return;
    }
    if (view.accountState === 'authenticated_unbound') {
      appendMessage('OPL', '请先在 Settings 绑定 API Key。', 'assistant-message');
      window.location.hash = 'settings';
      return;
    }
    document.body.dataset.chatState = chatStateForResult(null, true);
    const result = await sendChatMessage(fetch, message);
    document.body.dataset.chatState = chatStateForResult(result);
    if (result.errorCode === 'RUNTIME_REQUIRED') showRuntimeGate(message);
    appendMessage('OPL', result.assistantMessage?.content || result.message || result.errorCode || '上游暂时不可用。', 'assistant-message');
    const researchResult = result.ok ? researchResultForChat({ ...result, prompt: message }) : null;
    if (researchResult) appendResearchResult(researchResult);
  });
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
