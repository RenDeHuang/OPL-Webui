import {
  checkRuntimeGate,
  chatStateForPrompt,
  chatStateForResult,
  createInitialOnePersonLabViewModel,
  loadOnePersonLabWebState,
  loginAccount,
  logoutAccount,
  registerAccount,
  requiresRuntimeGate,
  researchResultForChat,
  runRuntimeTask,
  runtimeTaskCardForGate,
  runtimeTaskCardForPrompt,
  runtimeTaskCardForRun,
  saveAPIKey,
  sendChatMessage,
  viewFromHash,
} from '../product/publicContract.mjs';
import { INSPECTOR_TABS } from '../features/continuation/continuationSurface.mjs';
import { renderAnonymousSurface } from '../features/public-landing/publicAuthSurface.mjs';
import { renderAuthenticatedSurface } from '../features/workbench/workbenchSurface.mjs';

const app = typeof document === 'undefined' ? null : document.querySelector('#app');
const state = {
  view: createInitialOnePersonLabViewModel(),
  shellState: 'public_landing',
  authTab: 'login',
  showPassword: false,
  showAccount: false,
  showSearch: false,
  showBilling: false,
  showInspector: false,
  showModelMenu: false,
  showSkillImport: false,
  inspectorTab: 'autonomy',
  selectedModelProfile: 'auto',
  skillImportState: 'idle',
  activeConversationId: '',
  activeConversationMeta: null,
  messages: [],
  firstValueTurn: null,
  chatTurnStages: [],
  lastResult: null,
  lastRuntimeTaskCard: null,
  pendingPublicTask: null,
  authForm: { email: '', password: '' },
  focusReturnSelector: '',
  pendingFocusSelector: '',
  busy: false,
};

export async function initOnePersonLabWeb() {
  window.addEventListener('hashchange', syncRouteFromLocation);
  document.addEventListener('keydown', handleGlobalKeydown);
  document.addEventListener('click', handleOutsideClick);
  syncRouteFromLocation();
  render();
  state.view = await loadOnePersonLabWebState(fetch, { loadSnapshot: false });
  syncRouteFromLocation();
  syncDocumentState();
  render();
}

function render() {
  if (!app) return;
  const shouldFocusAPIKeyPrimary = document.body.dataset.apiKeyDialogState === 'open';
  syncDocumentState();
  app.innerHTML = state.view.accountState === 'anonymous'
    ? renderAnonymous()
    : renderAuthenticated();
  bindCurrentDOM();
  if (shouldFocusAPIKeyPrimary) app.querySelector('[data-api-key-dialog-primary]')?.focus({ preventScroll: true });
  flushPendingFocus();
}

function renderAnonymous() {
  return renderAnonymousSurface(state, domHelpers());
}

function renderAuthenticated() {
  return renderAuthenticatedSurface(state, domHelpers());
}

function bindCurrentDOM() {
  bindClicks();
  bindForms();
  bindSearch();
}

function bindClicks() {
  app?.querySelectorAll('[data-public-start-cta]').forEach((button) => button.addEventListener('click', () => openAnonymousAuth(button.dataset.authMode, '[data-public-start-cta]')));
  app?.querySelectorAll('[data-public-task-entry], [data-research-task]').forEach((button) => button.addEventListener('click', () => applyTaskPrompt(button)));
  app?.querySelectorAll('[data-chat-submit]').forEach((button) => button.addEventListener('click', (event) => {
    const form = button.form || button.closest('form');
    if (!form || button.disabled) return;
    event.preventDefault();
    form.requestSubmit();
  }));
  app?.querySelectorAll('[data-auth-tab]').forEach((button) => button.addEventListener('click', () => { state.authTab = button.dataset.authTab; render(); }));
  app?.querySelectorAll('[data-auth-submit]').forEach((button) => button.addEventListener('click', () => { state.authTab = button.dataset.authAction || state.authTab; }));
  app?.querySelector('[data-auth-close]')?.addEventListener('click', () => closeAnonymousAuth());
  app?.querySelector('[data-toggle-password]')?.addEventListener('click', () => { state.showPassword = !state.showPassword; render(); });
  app?.querySelectorAll('[data-shell-action]').forEach((button) => button.addEventListener('click', () => runShellAction(button.dataset.shellAction)));
  app?.querySelector('[data-search-trigger]')?.addEventListener('click', () => { state.showSearch = true; state.focusReturnSelector = '[data-search-trigger]'; render(); });
  app?.querySelector('[data-account-toggle]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (state.view.accountState === 'anonymous') {
      openAnonymousAuth(event.currentTarget.dataset.authMode, '[data-account-toggle]');
      return;
    }
    state.showAccount = !state.showAccount;
    state.focusReturnSelector = '[data-account-toggle]';
    render();
  });
  app?.querySelector('[data-account-popover-close]')?.addEventListener('click', () => { state.showAccount = false; focusAfterRender('[data-account-toggle]'); render(); });
  app?.querySelectorAll('[data-overlay-close="search"]').forEach((button) => button.addEventListener('click', () => { state.showSearch = false; focusAfterRender('[data-search-trigger]'); render(); }));
  app?.querySelectorAll('[data-billing-close]').forEach((button) => button.addEventListener('click', () => { state.showBilling = false; render(); }));
  app?.querySelector('[data-billing-summary-open]')?.addEventListener('click', () => { state.showBilling = true; render(); });
  app?.querySelector('[data-logout-button]')?.addEventListener('click', logoutAndRefresh);
  app?.querySelector('[data-model-selector]')?.addEventListener('click', () => { state.showModelMenu = !state.showModelMenu; render(); });
  app?.querySelector('[data-model-menu-close]')?.addEventListener('click', () => { state.showModelMenu = false; focusAfterRender('[data-model-selector]'); render(); });
  app?.querySelectorAll('[data-model-option]').forEach((button) => button.addEventListener('click', () => { state.selectedModelProfile = button.dataset.modelOption || 'auto'; state.showModelMenu = false; focusAfterRender('[data-model-selector]'); render(); }));
  app?.querySelectorAll('[data-plus-file-trigger]').forEach((button) => button.addEventListener('click', () => runPlusAction('attach_file')));
  app?.querySelector('[data-skill-import-open]')?.addEventListener('click', () => openSkillImport());
  app?.querySelector('[data-skill-import-trigger]')?.addEventListener('click', () => validateSkillImport());
  app?.querySelector('[data-skill-import-close]')?.addEventListener('click', () => { state.showSkillImport = false; focusAfterRender('[data-skill-import-open]'); render(); });
  app?.querySelectorAll('[data-inspector-open]').forEach((button) => button.addEventListener('click', () => openInspector(button.dataset.inspectorOpen || 'autonomy', '[data-inspector-open]')));
  app?.querySelector('[data-inspector-close]')?.addEventListener('click', () => closeInspector());
  app?.querySelectorAll('[data-inspector-tab]').forEach((button) => button.addEventListener('click', () => openInspector(button.dataset.inspectorTab, state.focusReturnSelector || '[data-inspector-open]')));
  app?.querySelector('[data-api-key-dialog-close]')?.addEventListener('click', () => closeAPIKeyDialog());
  app?.querySelector('[data-api-key-dialog-primary]')?.addEventListener('click', () => { closeAPIKeyDialog(false); state.showAccount = true; render(); document.querySelector('#api-key')?.focus({ preventScroll: true }); });
}

function bindForms() {
  app?.querySelector('[data-auth-form]')?.addEventListener('submit', authSubmit);
  app?.querySelector('#auth-email')?.addEventListener('input', (event) => { state.authForm.email = event.currentTarget.value; });
  app?.querySelector('#auth-password')?.addEventListener('input', (event) => { state.authForm.password = event.currentTarget.value; });
  app?.querySelectorAll('[data-chat-form]').forEach((form) => form.addEventListener('submit', chatSubmit));
  app?.querySelector('[data-provider-form]')?.addEventListener('submit', providerSubmit);
}

function bindSearch() {
  app?.querySelector('[data-window-search]')?.addEventListener('input', (event) => {
    const value = event.currentTarget.value.trim().toLowerCase();
    let visible = 0;
    app.querySelectorAll('[data-project-window-search-result]').forEach((entry) => {
      const show = !value || entry.textContent.toLowerCase().includes(value);
      entry.hidden = !show;
      if (show) visible += 1;
    });
    const empty = app.querySelector('[data-project-window-search-empty]');
    if (empty) empty.hidden = visible > 0;
  });
}

function openAnonymousAuth(mode = 'login', focusReturnSelector = '[data-public-start-cta]') {
  state.authTab = mode === 'register' ? 'register' : 'login';
  state.shellState = 'auth_login_register';
  state.focusReturnSelector = focusReturnSelector;
  render();
  document.querySelector('#auth-email')?.focus({ preventScroll: true });
}

function preserveInteractiveShellAfterBootstrap() {
  return state.view.accountState === 'anonymous' && state.shellState === 'auth_login_register';
}

async function authSubmit(event) {
  event.preventDefault();
  if (state.busy) return;
  const email = app.querySelector('#auth-email')?.value.trim() || '';
  const password = app.querySelector('#auth-password')?.value || '';
  state.authForm = { email, password };
  const activeSubmitter = document.activeElement?.closest?.('[data-auth-submit]');
  const authAction = event.submitter?.dataset?.authAction || activeSubmitter?.dataset?.authAction || state.authTab;
  const wasRegister = authAction === 'register';
  state.authTab = wasRegister ? 'register' : 'login';
  state.busy = true;
  render();
  const result = wasRegister
    ? await registerAccount(fetch, email, password)
    : await loginAccount(fetch, email, password);
  state.busy = false;
  if (!result.ok) {
    state.shellState = 'auth_login_register';
    render();
    setSettingsMessage(result.message || result.errorCode || '认证失败。');
    return;
  }
  document.body.dataset.authState = 'authenticated_unbound';
  state.view = await loadOnePersonLabWebState(fetch, { loadSnapshot: false });
  state.authForm = { email: '', password: '' };
  state.shellState = 'home_default';
  state.showAccount = false;
  render();
  restorePendingPublicTask();
}

async function providerSubmit(event) {
  event.preventDefault();
  const apiKey = app.querySelector('#api-key')?.value.trim() || '';
  const result = await saveAPIKey(fetch, apiKey, state.view.session);
  if (!result.ok) {
    setSettingsMessage(result.message || result.errorCode || '保存失败。');
    return;
  }
  state.view = await loadOnePersonLabWebState(fetch, { loadSnapshot: false });
  state.showAccount = true;
  render();
  setSettingsMessage(`API Key 已更新：${result.maskedKey || '已绑定'}`);
}

async function chatSubmit(event) {
  event.preventDefault();
  const input = app.querySelector('#chat-input');
  const message = input?.value.trim() || '';
  if (!message) return;
  document.body.dataset.chatState = chatStateForPrompt(message);
  state.messages.push({ role: 'user', content: message });
  if (state.view.accountState === 'authenticated_unbound') {
    openAPIKeyDialog();
    state.messages.push({ role: 'assistant', content: '请先绑定 API Key 后继续。' });
    render();
    return;
  }
  if (requiresRuntimeGate(message)) {
    await handleRuntimePrompt(message);
    return;
  }
  state.shellState = 'running_turn';
  state.showInspector = shouldAutoOpenInspector();
  state.lastResult = null;
  state.chatTurnStages = ['submitted', 'progressive'];
  state.firstValueTurn = firstValueTurnForPrompt(message, 'progressive');
  render();
  await yieldRenderedTurn();
  state.chatTurnStages = ['submitted', 'progressive', 'waiting_upstream'];
  render();
  await yieldRenderedTurn();
  const result = await sendChatMessage(fetch, message);
  document.body.dataset.chatState = chatStateForResult(result);
  if (!result.ok) {
    state.chatTurnStages = ['submitted', 'progressive', 'waiting_upstream', 'error'];
    state.firstValueTurn = firstValueTurnForPrompt(message, 'error', result.message || result.errorCode || '上游暂时不可用。');
    state.messages.push({ role: 'assistant', content: result.message || result.errorCode || '上游暂时不可用。' });
    render();
    return;
  }
  const researchResult = researchResultForChat({ ...result, prompt: message });
  state.lastResult = { prompt: message, researchResult };
  state.chatTurnStages = ['submitted', 'progressive', 'waiting_upstream', researchResult ? 'complete' : 'error'];
  state.firstValueTurn = firstValueTurnForPrompt(message, researchResult ? 'complete' : 'error');
  if (!researchResult) state.messages.push({ role: 'assistant', content: result.assistantMessage?.content || '已收到。' });
  state.view = await loadOnePersonLabWebState(fetch, { loadSnapshot: false });
  render();
}

function firstValueTurnForPrompt(prompt, stateName, message = '已生成研究计划草案。') {
  if (!String(prompt || '').includes('@科研')) return null;
  const byState = { submitted: '已提交研究问题。', progressive: '正在拆解研究问题、证据线索和下一步。', waiting_upstream: '等待账号能力返回结构化结果。', complete: message, error: message };
  return {
    state: stateName,
    progressiveBoundary: 'request_lifecycle_not_token_stream',
    message: byState[stateName] || message,
  };
}

function yieldRenderedTurn() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

async function handleRuntimePrompt(message) {
  state.shellState = 'blocked_turn';
  state.lastRuntimeTaskCard = runtimeTaskCardForPrompt(message);
  render();
  const gate = await checkRuntimeGate(fetch, runtimeTaskFromPrompt(message));
  state.lastRuntimeTaskCard = runtimeTaskCardForGate(message, gate) || state.lastRuntimeTaskCard;
  document.body.dataset.chatState = chatStateForResult(gate);
  if (gate.ok && gate.gateState?.ready) {
    const run = await runRuntimeTask(fetch, runtimeTaskFromPrompt(message));
    document.body.dataset.chatState = run.ok ? 'runtime_required' : chatStateForResult(run);
    if (run.ok) {
      state.lastRuntimeTaskCard = runtimeTaskCardForRun(message, run) || state.lastRuntimeTaskCard;
    }
  }
  state.view = await loadOnePersonLabWebState(fetch, { loadSnapshot: false });
  render();
}

function applyTaskPrompt(button) {
  const prompt = button.dataset.prompt || '';
  if (state.view.accountState === 'anonymous') {
    state.pendingPublicTask = { prompt, intent: button.dataset.researchTaskIntent || '' };
    document.body.dataset.pendingPublicTaskIntent = state.pendingPublicTask.intent;
    document.body.dataset.researchTaskIntent = state.pendingPublicTask.intent;
    document.body.dataset.chatState = chatStateForPrompt(prompt);
    state.authTab = 'login';
    state.shellState = 'auth_login_register';
    state.focusReturnSelector = '[data-public-task-entry]';
    render();
    return;
  }
  state.shellState = 'home_default';
  render();
  const input = app.querySelector('#chat-input');
  if (input) {
    input.value = prompt;
    input.focus({ preventScroll: true });
  }
  document.body.dataset.researchTaskIntent = button.dataset.researchTaskIntent || '';
  document.body.dataset.chatState = chatStateForPrompt(prompt);
}

function restorePendingPublicTask() {
  if (!state.pendingPublicTask) return;
  const pending = state.pendingPublicTask;
  state.shellState = 'home_default';
  render();
  const input = app.querySelector('#chat-input');
  if (input) {
    input.value = pending.prompt;
    input.focus({ preventScroll: true });
  }
  document.body.dataset.loginReturnState = state.view.accountState;
  document.body.dataset.pendingPublicTaskIntent = pending.intent;
  document.body.dataset.researchTaskIntent = pending.intent;
  document.body.dataset.chatState = chatStateForPrompt(pending.prompt);
  state.pendingPublicTask = null;
}

function runShellAction(action) {
  if (action === 'home') {
    state.shellState = 'home_default';
    state.showInspector = false;
    state.firstValueTurn = null;
    state.lastResult = null;
    state.messages = [];
    setHashView('home');
  } else if (action === 'projects') {
    state.shellState = 'project_window_continuation_center';
    setHashView('projects');
  } else if (action === 'skills') {
    state.shellState = 'skill_plaza';
    setHashView('skills');
  } else if (action === 'workflows') {
    state.shellState = 'workflow_plaza';
    setHashView('workflows');
  } else if (action === 'more') {
    state.shellState = 'more';
    setHashView('more');
  }
  render();
}

function runPlusAction(action) {
  if (action === 'attach_file') {
    state.lastRuntimeTaskCard = runtimeTaskCardForPrompt('@文件 处理资料输入');
    state.shellState = 'blocked_turn';
    render();
  } else {
    render();
  }
}

function openSkillImport() {
  state.skillImportState = 'select';
  state.showSkillImport = true;
  render();
}

function validateSkillImport() {
  state.skillImportState = 'validate';
  syncDocumentState();
  state.skillImportState = 'error';
  render();
}

async function logoutAndRefresh() {
  await logoutAccount(fetch);
  state.view = await loadOnePersonLabWebState(fetch, { loadSnapshot: false });
  state.shellState = 'auth_login_register';
  state.authTab = 'login';
  state.showAccount = false;
  state.messages = [];
  render();
}

function syncRouteFromLocation() {
  if (window.location.pathname === '/login' && state.view.accountState === 'anonymous') {
    state.shellState = 'auth_login_register';
    state.authTab = state.authTab === 'register' ? 'register' : 'login';
    document.body.dataset.view = 'home';
    return;
  }
  if (preserveInteractiveShellAfterBootstrap()) {
    document.body.dataset.view = 'home';
    return;
  }
  if (state.view.accountState === 'anonymous') {
    state.shellState = 'public_landing';
    document.body.dataset.view = 'home';
    return;
  }
  const view = viewFromHash(window.location.pathname === '/home' ? window.location.hash : '');
  document.body.dataset.view = view;
  if (view === 'skills') state.shellState = 'skill_plaza';
  else if (view === 'workflows') state.shellState = 'workflow_plaza';
  else if (view === 'projects') state.shellState = 'project_window_continuation_center';
  else if (view === 'more') state.shellState = 'more';
  else state.shellState = state.shellState === 'public_landing' ? 'home_default' : state.shellState;
}

function syncDocumentState() {
  document.body.dataset.authState = state.view.accountState || 'anonymous';
  document.body.dataset.shellState = state.shellState;
  document.body.dataset.inspectorState = state.showInspector ? state.inspectorTab : 'hidden';
  document.body.dataset.skillImportState = state.skillImportState;
  document.body.dataset.skillImportStates = 'select,validate,error';
  document.body.dataset.apiKeyDialogState = document.body.dataset.apiKeyDialogState || 'closed';
}

function setHashView(view) {
  const hash = view === 'home' ? '#home' : `#${view}`;
  if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  document.body.dataset.view = view;
}

function openInspector(tab = 'autonomy', focusReturnSelector = '[data-inspector-open]') {
  state.inspectorTab = INSPECTOR_TABS.includes(tab) ? tab : 'autonomy';
  state.showInspector = true;
  state.focusReturnSelector = focusReturnSelector;
  render();
}

function closeInspector() {
  state.showInspector = false;
  focusAfterRender(state.focusReturnSelector || '[data-inspector-open]');
  render();
}

function shouldAutoOpenInspector() {
  return window.matchMedia?.('(min-width: 1041px)').matches === true;
}

function openAPIKeyDialog() {
  document.body.dataset.apiKeyDialogState = 'open';
  state.shellState = 'api_key_required_modal';
}

function closeAPIKeyDialog(shouldRender = true) {
  document.body.dataset.apiKeyDialogState = 'closed';
  if (state.shellState === 'api_key_required_modal') state.shellState = 'home_default';
  focusAfterRender('#chat-input');
  if (shouldRender) render();
}

function handleGlobalKeydown(event) {
  if (document.body.dataset.apiKeyDialogState === 'open' && event.key === 'Tab') {
    const dialog = app?.querySelector('[data-api-key-dialog]');
    const focusable = [...(dialog?.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])') || [])].filter((node) => !node.disabled && !node.hidden);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (first && last && event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); return; }
    if (first && last && !event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); return; }
  }
  if (event.key !== 'Escape') return;
  if (state.view.accountState === 'anonymous' && state.shellState === 'auth_login_register') {
    closeAnonymousAuth();
    return;
  }
  const focusTarget = state.showSearch ? '[data-search-trigger]'
    : state.showAccount ? '[data-account-toggle]'
      : state.showInspector ? (state.focusReturnSelector || '[data-inspector-open]')
        : document.body.dataset.apiKeyDialogState === 'open' ? '#chat-input'
          : '';
  state.showSearch = false;
  state.showBilling = false;
  state.showAccount = false;
  closeAPIKeyDialog(false);
  if (state.showInspector) state.showInspector = false;
  if (focusTarget) focusAfterRender(focusTarget);
  render();
}

function handleOutsideClick(event) {
  const target = event.target;
  if (!target.closest?.('[data-account-popover], [data-account-toggle]') && state.showAccount) {
    state.showAccount = false;
    focusAfterRender('[data-account-toggle]');
    render();
  }
}

function setSettingsMessage(message) {
  const node = app.querySelector('[data-settings-message]');
  if (node) node.textContent = message;
}

function runtimeTaskFromPrompt(prompt = '') {
  const marker = ['@论文', '@基金', '@综述', '@文件', '@PPT', '@书'].find((candidate) => prompt.includes(candidate)) || '';
  const intentByMarker = {
    '@论文': 'paper_question',
    '@基金': 'grant_plan',
    '@综述': 'review_map',
    '@文件': 'materials_refs',
    '@PPT': 'presentation_foundry',
    '@书': 'book_foundry',
  };
  return { taskIntent: intentByMarker[marker] || 'runtime_required_task', marker, prompt };
}

function closeAnonymousAuth() {
  state.shellState = 'public_landing';
  focusAfterRender(state.focusReturnSelector || '[data-public-start-cta]');
  render();
}

function focusAfterRender(selector) {
  state.pendingFocusSelector = selector || '';
}

function flushPendingFocus() {
  if (!state.pendingFocusSelector) return;
  const selector = state.pendingFocusSelector;
  state.pendingFocusSelector = '';
  document.querySelector(selector)?.focus({ preventScroll: true });
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
  return escapeHTML(value).replaceAll('`', '&#96;');
}

function domHelpers() {
  return { escapeHTML, escapeAttr, formatShortDate };
}
