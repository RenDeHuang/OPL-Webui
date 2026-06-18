export const FIXED_BASE_URL = 'https://gflabtoken.cn/v1';
export const MEDOPL_DEEP_LINK = 'https://medopl.medopl.cn';
export const OPL_CAPABILITY_MANIFEST = {
  source: { syncMode: 'source_path_pinned_manifest', dynamicSync: false, commitPin: 'blocked_by_github_tls_timeout',
    appContract: 'github.com/gaofeng21cn/one-person-lab-app/contracts/app-product-profile.json',
    frameworkContract: 'github.com/gaofeng21cn/one-person-lab/contracts/opl-framework/domains.json' },
  capabilities: [
    ['普通问答', '解释 OPL 如何帮助复杂知识工作', false, 'chat'],
    ['论文/综述', '@论文 生成研究选题和证据计划', true, 'mas'],
    ['基金', '@基金 帮我拆解标书结构', true, 'mag'],
    ['PPT', '生成一页汇报 PPT 大纲', false, 'rca'],
    ['数据分析', '解释这组数据可以如何分析', false, 'chat'],
    ['长任务', '@长任务 规划一项复杂任务', true, 'mas'],
  ],
};

export async function loadOnePersonLabWebState(fetchRef = fetch, options = {}) {
  const shouldProbeSession = options.probeSession !== false;
  const shouldLoadSnapshot = options.loadSnapshot !== false;
  const session = shouldProbeSession ? await readJSON(fetchRef, '/api/session/current') : { ok: false };
  const provider = session.ok ? await readJSON(fetchRef, '/api/settings/model-provider') : providerFallback();
  const conversations = session.ok ? await readJSON(fetchRef, '/api/chat/conversations') : { conversations: [] };
  const oplSnapshot = shouldLoadSnapshot ? await readJSON(fetchRef, '/api/opl/snapshot') : { ok: false };
  return createOnePersonLabViewModel({ session, provider, conversations, oplSnapshot });
}

export async function registerAccount(fetchRef, email, password) {
  return writeJSON(fetchRef, '/api/auth/register', { email, password });
}

export async function loginAccount(fetchRef, email, password) {
  return writeJSON(fetchRef, '/api/auth/login', { email, password });
}

export async function logoutAccount(fetchRef) {
  return fetchRef('/api/auth/logout', { method: 'POST' });
}

export async function saveAPIKey(fetchRef, apiKey, session = { ok: true }) {
  if (!session?.ok) return { ok: false, errorCode: 'AUTH_REQUIRED', message: '请先登录后再绑定 API Key。' };
  return writeJSON(fetchRef, '/api/settings/model-provider', { apiKey }, 'PUT');
}

export async function sendChatMessage(fetchRef, message, conversationId = '') {
  return writeJSON(fetchRef, '/api/chat', { message, conversationId });
}

export function viewFromHash(hash) {
  const normalized = String(hash || '').replace(/^#/, '');
  return ['settings', 'capabilities'].includes(normalized) ? normalized : 'chat';
}

export function accountState(session, provider) {
  if (!session?.ok) return 'anonymous';
  if (!provider?.apiKeyConfigured) return 'authenticated_unbound';
  return 'authenticated_bound';
}

export function createOnePersonLabViewModel(state) {
  const provider = state.provider?.ok ? state.provider : providerFallback();
  const session = state.session ?? { ok: false };
  const currentAccountState = accountState(session, provider);
  return {
    title: '严肃工作的 AI 工作台',
    subtitle: '从普通聊天进入 Research、Grant、Presentation 等专业工作流',
    session,
    accountState: currentAccountState,
    primaryCTA: ctaForState(currentAccountState),
    provider: {
      baseUrl: provider.baseUrl ?? FIXED_BASE_URL,
      baseUrlEditable: false,
      apiKeyConfigured: Boolean(provider.apiKeyConfigured),
      maskedKey: provider.maskedKey ?? '',
    },
    conversations: state.conversations?.conversations ?? [],
    capabilitySource: OPL_CAPABILITY_MANIFEST.source,
    capabilities: OPL_CAPABILITY_MANIFEST.capabilities.map(([label, prompt, runtimeRequired, sourceAssistant]) => ({
      label, prompt, runtimeRequired, sourceAssistant,
    })),
    workbenchSteps: [
      { title: '选择专业工作', description: 'Foundry 启动中心，不是泛 Agent 列表。' },
      { title: '绑定真实材料', description: '围绕材料、引用和版本组织输入，不伪造文件能力。' },
      { title: '推进长任务', description: '展示阶段、进度和人工确认，不假装后台已经执行。' },
      { title: '沉淀交付物', description: '面向证据包、申请书、PPT 和修回材料的交付闭环。' },
      { title: '管理运行时', description: '只展示 readiness 与 MedOPL 开通入口。' },
    ],
    runtimeGate: {
      title: '需要 MedOPL Runtime',
      message: '该能力需要托管运行环境、存储或 node pool',
      deepLink: MEDOPL_DEEP_LINK,
    },
    readonly: {
      mode: state.oplSnapshot?.mode ?? 'readonly',
      ok: Boolean(state.oplSnapshot?.ok),
    },
  };
}

function ctaForState(state) {
  if (state === 'anonymous') return '登录/注册后开始';
  return state === 'authenticated_unbound' ? '绑定 API Key' : '发送';
}

async function writeJSON(fetchRef, url, body, method = 'POST') {
  const response = await fetchRef(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readResponse(response);
}

async function readJSON(fetchRef, url) {
  try {
    return readResponse(await fetchRef(url));
  } catch {
    return { ok: false };
  }
}

async function readResponse(response) {
  const body = await response.json();
  if (!response.ok && body && !body.ok) return body;
  return body;
}

function providerFallback() {
  return { ok: false, provider: 'gflabtoken', baseUrl: FIXED_BASE_URL, apiKeyConfigured: false, maskedKey: '' };
}

if (typeof document !== 'undefined') {
  initOnePersonLabWeb();
}

async function initOnePersonLabWeb() {
  let view = createOnePersonLabViewModel({
    session: { ok: false }, provider: providerFallback(), conversations: { conversations: [] }, oplSnapshot: { ok: false },
  });

  syncHashView();
  window.addEventListener('hashchange', syncHashView);
  bindCapabilityButtons();
  bindChatForm(() => view);
  bindSettingsForms(() => view, (next) => {
    view = next;
    renderView(view);
  });

  view = await loadOnePersonLabWebState(fetch, { probeSession: false, loadSnapshot: false });
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
      if (button.dataset.prompt.includes('@')) showRuntimeGate();
    });
  }
}

function bindChatForm(getView) {
  document.querySelector('[data-chat-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const view = getView();
    const input = document.querySelector('#chat-input');
    const message = input.value.trim();
    if (!message) return;
    appendMessage('你', message, 'user-message');
    if (message.includes('@')) {
      showRuntimeGate();
      appendMessage('OPL', '需要 MedOPL Runtime。该能力需要托管运行环境、存储或 node pool。', 'assistant-message');
      return;
    }
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
    const result = await sendChatMessage(fetch, message);
    appendMessage('OPL', result.assistantMessage?.content || result.message || result.errorCode || '上游暂时不可用。', 'assistant-message');
  });
}

function bindSettingsForms(getView, setView) {
  document.querySelector('[data-register-button]')?.addEventListener('click', async () => authAction('register', setView));
  document.querySelector('[data-login-button]')?.addEventListener('click', async () => authAction('login', setView));
  document.querySelector('[data-logout-button]')?.addEventListener('click', async () => {
    await logoutAccount(fetch);
    setSettingsMessage('已退出登录。');
    setView(await loadOnePersonLabWebState());
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
    setView(await loadOnePersonLabWebState());
  });
}

async function authAction(kind, setView) {
  const email = document.querySelector('#auth-email').value.trim();
  const password = document.querySelector('#auth-password').value;
  const result = kind === 'register'
    ? await registerAccount(fetch, email, password)
    : await loginAccount(fetch, email, password);
  setSettingsMessage(result.ok ? '账号已就绪。' : result.message || result.errorCode || '认证失败。');
  if (result.ok) setView(await loadOnePersonLabWebState());
}

function renderView(view) {
  document.body.dataset.authState = view.accountState;
  document.querySelector('[data-chat-submit]').textContent = view.primaryCTA;
  document.querySelector('[data-session-label]').textContent = view.session.ok ? view.session.email : '未登录';
  document.querySelector('[data-session-status]').textContent = view.session.ok ? `已登录：${view.session.email}` : '未登录';
  const providerStatus = view.provider.apiKeyConfigured ? `已绑定：${view.provider.maskedKey}` : '未绑定';
  document.querySelector('[data-provider-status]').textContent = providerStatus;
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

function showRuntimeGate() {
  document.querySelector('[data-runtime-gate]')?.classList.add('is-visible');
}

function setSettingsMessage(message) {
  document.querySelector('[data-settings-message]').textContent = message;
}
