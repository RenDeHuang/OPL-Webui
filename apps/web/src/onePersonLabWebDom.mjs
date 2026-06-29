import {
  FIGMA_MAKE_SOURCE,
  MEDOPL_DEEP_LINK,
  RESEARCH_TASK_INTENTS,
  checkRuntimeGate,
  chatStateForPrompt,
  chatStateForResult,
  createInitialOnePersonLabViewModel,
  loadOnePersonLabWebState,
  loginAccount,
  logoutAccount,
  registerAccount,
  reliabilityStatusForResult,
  requiresRuntimeGate,
  researchResultForChat,
  runRuntimeTask,
  runtimeTaskCardForGate,
  runtimeTaskCardForPrompt,
  runtimeTaskCardForRun,
  saveAPIKey,
  sendChatMessage,
  viewFromHash,
} from './onePersonLabWebState.mjs';
import {
  INSPECTOR_TABS,
  projectWindowTitle,
  renderInspector,
  renderProjectWindowCenter,
  renderSearchSheet,
} from './onePersonLabWebContinuation.mjs';

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
  inspectorTab: 'autonomy',
  activeConversationId: '',
  activeConversationMeta: null,
  messages: [],
  firstValueTurn: null,
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
  if (state.shellState === 'auth_login_register') return renderAuthPage();
  return renderPublicLanding();
}

function renderPublicLanding() {
  return `
    <div class="public-landing" data-shell-state="public_landing" data-public-growth-layer data-public-landing-surface data-figma-slice="figma_public_landing_slice">
      <header class="public-nav">
        <span class="brand-text">One Person Lab</span>
        <div class="nav-actions">
          <button class="text-button" type="button" data-public-start-cta data-auth-mode="login">登录</button>
          <button class="primary-button" type="button" data-public-start-cta data-account-toggle data-auth-mode="register">注册</button>
        </div>
      </header>
      <main class="public-hero" data-public-hero>
        <div class="hero-content">
          <div class="status-pill"><span></span>AI 原生科研工作台 · opl.medopl.cn</div>
          <h1>为研究者而建的<br>AI 工作台</h1>
          <p>从开题到成稿，覆盖论文、基金、综述、演示的全链路 AI 科研辅助。账户制，多端同步，数据隔离。</p>
          <div class="hero-pills" data-public-task-section>
            ${RESEARCH_TASK_INTENTS.map((task) => `
              <button type="button" data-public-task-entry data-research-task-intent="${escapeAttr(task.id)}" data-prompt="${escapeAttr(task.prompt)}">
                <span>${escapeHTML(task.marker)}</span>${escapeHTML(shortTaskLabel(task.label))}
              </button>
            `).join('')}
          </div>
          <div class="hero-actions">
            <button class="primary-button large" type="button" data-public-start-cta data-public-primary-start data-auth-mode="register">开始使用 <span aria-hidden="true">-></span></button>
            <button class="secondary-button large" type="button" data-public-start-cta data-public-secondary-start data-auth-mode="login">了解更多</button>
          </div>
        </div>
        <div class="trust-strip" data-public-trust-strip>
          <span data-public-output-section>progress refs · deliverable refs · materials refs</span>
          <span data-public-audience-section>个人研究者 · 博士/硕士 · PI · 课题组/单位</span>
          <span data-public-trust-section>blocker/next step · MedOPL/OPL deeplink</span>
          <span data-public-start-path>登录后回到任务入口</span>
        </div>
      </main>
    </div>`;
}

function renderAuthPage() {
  const isRegister = state.authTab === 'register';
  const pendingPrompt = state.pendingPublicTask?.prompt || '';
  return `
    <div class="auth-page" data-shell-state="auth_login_register" data-auth-surface data-account-popover data-figma-slice="figma_auth_surface_slice">
      <section class="auth-wrap">
        <div class="auth-brand">
          <span data-auth-brand>One Person Lab</span>
          <p data-auth-subtitle>AI 原生科研工作台</p>
        </div>
        <div class="auth-card" data-auth-card>
          <button class="auth-close" type="button" data-auth-close aria-label="返回产品介绍">x</button>
          <div class="auth-tabs" role="tablist" aria-label="登录或注册">
            <button type="button" data-auth-tab="login" aria-selected="${String(!isRegister)}">登录</button>
            <button type="button" data-auth-tab="register" aria-selected="${String(isRegister)}">注册</button>
          </div>
          <form class="auth-form" data-auth-form>
            <label for="auth-email">邮箱</label>
            <div class="field-with-icon"><span aria-hidden="true">@</span><input id="auth-email" name="email" type="email" autocomplete="email" placeholder="researcher@lab.edu" value="${escapeAttr(state.authForm.email)}"></div>
            <label for="auth-password">密码</label>
            <div class="field-with-icon">
              <span aria-hidden="true">#</span>
              <input id="auth-password" name="password" type="${state.showPassword ? 'text' : 'password'}" autocomplete="current-password" placeholder="${isRegister ? '至少 8 位' : '********'}" value="${escapeAttr(state.authForm.password)}">
              <button type="button" data-toggle-password aria-label="${state.showPassword ? '隐藏密码' : '显示密码'}">${state.showPassword ? 'Hide' : 'Show'}</button>
            </div>
            <p class="form-message" data-settings-message role="status"></p>
            <div class="auth-submit-row">
              ${isRegister ? `
                <button class="primary-button full" type="submit" data-auth-submit data-auth-action="register" data-register-button${state.busy ? ' disabled aria-disabled="true"' : ''}>
                  ${state.busy ? '处理中...' : '创建账号'}
                </button>
              ` : `
                <button class="primary-button full" type="submit" data-auth-submit data-auth-action="login" data-login-button${state.busy ? ' disabled aria-disabled="true"' : ''}>
                  ${state.busy ? '处理中...' : '登录'}
                </button>
              `}
            </div>
            <input id="chat-input" type="hidden" value="${escapeAttr(pendingPrompt)}">
            <p class="terms-copy" data-auth-terms>登录即表示同意服务条款与隐私政策。</p>
          </form>
        </div>
        <button class="auth-account-toggle-sentinel" type="button" data-account-toggle tabindex="-1" aria-hidden="true" aria-label="账户入口"></button>
        <button class="auth-account-toggle-sentinel" type="button" data-logout-button tabindex="-1" aria-hidden="true" aria-label="退出登录"></button>
      </section>
    </div>`;
}

function renderAuthenticated() {
  return `
    <div class="app-shell" data-app-shell data-figma-pattern="side_navigation_new_chat_projects_skill_workflow_search_more" data-figma-slice="figma_home_workbench_shell_slice">
      ${renderSidebar()}
      <div class="workspace-frame">
        <main class="workspace-main main-stage">
          ${renderMainSurface()}
        </main>
        ${state.showInspector ? renderInspector(state, domHelpers()) : ''}
      </div>
      ${state.showSearch ? renderSearchSheet(state.view, domHelpers()) : ''}
      ${state.showBilling ? renderBillingSummary() : ''}
      ${renderAPIKeyDialog()}
      <button class="auth-account-toggle-sentinel" type="button" data-logout-button data-authenticated-logout-sentinel tabindex="-1" aria-hidden="true" aria-label="退出登录"></button>
    </div>`;
}

function renderSidebar() {
  const tasks = state.view.taskHistory?.tasks || [];
  return `
    <aside class="sidebar" data-side-navigation aria-label="One Person Lab navigation">
      <div class="sidebar-brand">One Person Lab</div>
      <nav class="top-nav">
        <button type="button" data-shell-action="home"><span aria-hidden="true">+</span><span class="nav-label">新对话</span></button>
        <button type="button" data-shell-action="projects"><span aria-hidden="true">□</span><span class="nav-label">项目 / 窗口</span></button>
        <button type="button" data-shell-action="skills"><span aria-hidden="true">◎</span><span class="nav-label">Skill</span></button>
        <button type="button" data-shell-action="workflows"><span aria-hidden="true">⌘</span><span class="nav-label">工作流</span></button>
        <button type="button" data-search-trigger><span aria-hidden="true">?</span><span class="nav-label">搜索</span></button>
      </nav>
      <div class="sidebar-divider"></div>
      <div class="project-tree" data-project-window-route data-projection-source="GET /api/tasks">
        <div class="tree-heading"><span>项目 / 窗口</span></div>
        <div class="project-window-list" data-project-window-list>
          ${tasks.length === 0 ? '<p data-project-window-empty>还没有窗口。选择一个任务入口后，真实 Go control plane projection 会出现在这里。</p>' : tasks.map((task) => `
            <button type="button" data-project-window-entry data-project-window-item="${escapeAttr(task.taskId)}" data-project-window-status="${escapeAttr(task.status)}" data-projection-source="GET /api/tasks">
              <span>${escapeHTML(projectWindowTitle(task))}</span><small>${escapeHTML(formatShortDate(task.updatedAt))}</small>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="sidebar-bottom">
        <button type="button" data-shell-action="more"><span>...</span>更多</button>
        <div class="account-anchor">
          <button type="button" data-account-toggle aria-expanded="${String(state.showAccount)}" aria-controls="account-popover">
            <span class="account-avatar" aria-hidden="true">研</span>
            <span><strong data-session-label>${escapeHTML(state.view.session.email || 'Researcher')}</strong><small>account capability</small></span>
          </button>
          ${state.showAccount ? renderAccountPopover() : ''}
        </div>
      </div>
    </aside>`;
}

function renderMainSurface() {
  if (state.shellState === 'running_turn') return renderResultView();
  if (state.shellState === 'blocked_turn') return renderBlockedView();
  if (state.shellState === 'quota_exceeded') return renderQuotaView();
  if (state.shellState === 'project_window_continuation_center') return renderProjectWindowCenter(state.view, domHelpers());
  if (state.shellState === 'skill_plaza') return renderSkillPlaza();
  if (state.shellState === 'workflow_plaza') return renderWorkflowPlaza();
  if (state.shellState === 'more') return renderMoreSurface();
  return renderHomeComposer();
}

function renderHomeComposer() {
  return `
    <section class="home-composer" data-shell-state="home_default" data-workbench-surface data-first-view>
      <h1>What should we get done?</h1>
      <form id="composer-form" class="composer-box" data-chat-form data-composer-box>
        <input id="chat-input" class="composer-input" placeholder="随心输入" aria-label="选择一个任务入口或直接输入问题">
      </form>
      <div class="composer-toolbar" data-composer-toolbar>
        <button type="button" class="icon-button" aria-label="添加" tabindex="-1">+</button>
        <button type="button" class="secondary-button" tabindex="-1">完全访问</button>
        <button type="button" class="secondary-button model-selector" data-model-selector tabindex="-1">5.5 超高</button>
        <button type="button" class="secondary-button" data-inspector-open="autonomy">Inspector</button>
        <button type="submit" form="composer-form" class="round-send" data-chat-submit aria-label="发送">↑</button>
      </div>
      <div class="mode-grid" data-research-launcher data-starter-chips>
        ${RESEARCH_TASK_INTENTS.slice(0, 4).map(renderModeButton).join('')}
      </div>
      <div class="mode-grid lower-grid">
        ${RESEARCH_TASK_INTENTS.slice(4).map(renderModeButton).join('')}
      </div>
    </section>`;
}

function renderModeButton(task) {
  return `
    <button type="button" data-research-task data-research-task-intent="${escapeAttr(task.id)}" data-capability-marker="${escapeAttr(task.marker)}" data-capability-mode="${escapeAttr(task.runtimePolicy)}" data-prompt="${escapeAttr(task.prompt)}">
      <span>${escapeHTML(task.marker)}</span>
      <small>${escapeHTML(taskDescription(task))}</small>
    </button>`;
}

function renderResultView() {
  const result = state.lastResult;
  const research = result?.researchResult;
  return `
    <section class="result-view" data-shell-state="running_turn" data-results-surface>
      <div class="result-badge">${escapeHTML(state.activeConversationMeta?.project || 'OPL')}</div>
      <header class="result-topbar">
        <button type="button" data-shell-action="home">‹ 新对话</button>
        <span>${escapeHTML(state.activeConversationMeta?.title || result?.prompt || '@科研')}</span>
        <button type="button" data-inspector-open="autonomy">Inspector</button>
        <button type="button" data-inspector-open="why_next">Why / next</button>
      </header>
      <div class="result-scroll" data-chat-log>
        ${state.messages.map(renderMessage).join('')}
        ${state.firstValueTurn ? renderFirstValueTurn(state.firstValueTurn) : ''}
        ${research ? renderResearchResult(research) : ''}
      </div>
      <form class="pill-input" data-chat-form>
        <button type="button" aria-label="添加">+</button>
        <input id="chat-input" name="message" placeholder="有问题，尽管问">
        <button type="button">API key</button>
        <button type="submit" data-chat-submit aria-label="发送">▮▮▮</button>
      </form>
    </section>`;
}

function renderResearchResult(result) {
  document.body.dataset.lastResearchResultSections = String(result.sections.length);
  return `
    <article class="research-result" data-research-result="${escapeAttr(result.kind)}" data-research-result-marker="${escapeAttr(result.marker)}">
      <div class="status-line">MedOPL continuation ready / refs available</div>
      ${result.sections.map((section) => `
        <section data-research-result-section="${escapeAttr(section.id)}">
          <h3>${escapeHTML(section.title)}</h3>
          <p>${escapeHTML(section.body)}</p>
        </section>
      `).join('')}
      <div class="result-actions" aria-label="结果操作">
        <button type="button" aria-label="复制">Copy</button>
        <button type="button" aria-label="收藏">Save</button>
        <button type="button" aria-label="重新生成">Again</button>
        <button type="button" aria-label="更多">More</button>
      </div>
    </article>`;
}

function renderMessage(message) {
  return `<article class="message ${escapeAttr(message.role)}-message"><p>${escapeHTML(message.content)}</p></article>`;
}

function renderFirstValueTurn(turn) {
  document.body.dataset.lastFirstValueTurnState = turn.state;
  document.body.dataset.lastFirstValueProgressiveBoundary = turn.progressiveBoundary;
  const text = turn.state === 'progressive'
    ? '正在拆解研究问题、证据线索和下一步。'
    : turn.message;
  return `
    <article class="message assistant-message" data-first-value-turn-state data-turn-state="${escapeAttr(turn.state)}" data-progressive-boundary="${escapeAttr(turn.progressiveBoundary)}">
      <p>${escapeHTML(text)}</p>
    </article>`;
}

function renderBlockedView() {
  const taskCard = state.lastRuntimeTaskCard || runtimeTaskCardForPrompt('@论文');
  document.body.dataset.lastRuntimeTaskMarker = taskCard.marker || '';
  return `
    <section class="blocked-view" data-shell-state="blocked_turn">
      <div class="reliability-banner" data-reliability-status data-state="runtime_required">
        <strong data-reliability-title>需要 MedOPL 授权</strong>
        <span data-reliability-action>去 MedOPL</span>
        <small data-reliability-details>该能力需要在 MedOPL 开通后继续。</small>
      </div>
      <article class="runtime-card is-visible" data-runtime-gate data-medopl-handoff="${escapeAttr(taskCard.handoffMode || 'conversion_handoff')}" data-handoff-return-context="${escapeAttr(taskCard.returnContext || 'current_project_window')}" data-handoff-next-action="${escapeAttr(taskCard.nextAction?.id || 'open_medopl')}">
        <div data-runtime-task-card="${escapeAttr(taskCard.kind || 'runtime_task_card')}" data-runtime-task-marker="${escapeAttr(taskCard.marker || '')}" data-runtime-projection-status="${escapeAttr(taskCard.status || '')}" data-runtime-run-ref="${escapeAttr(taskCard.runRef || '')}">
          <span>${escapeHTML(taskCard.capabilityMarker || taskCard.marker || '@论文')} · MedOPL conversion handoff</span>
          <h2>${escapeHTML(taskCard.title || '需要 MedOPL 授权')}</h2>
          <p>${escapeHTML(taskCard.message || 'Web 只显示授权入口和只读投影，不执行真实 OPL 任务。')}</p>
          ${renderRuntimeProjectionRefs(taskCard)}
          <a href="${escapeAttr(taskCard.deepLink || MEDOPL_DEEP_LINK)}">前往 MedOPL 处理</a>
        </div>
      </article>
      <button type="button" data-shell-action="home">返回主界面</button>
      <form class="pill-input" data-chat-form>
        <button type="button" aria-label="添加">+</button>
        <input id="chat-input" name="message" placeholder="继续输入任务">
        <button type="submit" data-chat-submit aria-label="发送">↑</button>
      </form>
    </section>`;
}

function renderRuntimeProjectionRefs(taskCard = {}) {
  const progress = Array.isArray(taskCard.progress) ? taskCard.progress : [];
  const deliverables = Array.isArray(taskCard.deliverables) ? taskCard.deliverables : [];
  const artifacts = Array.isArray(taskCard.artifacts) ? taskCard.artifacts : [];
  if (progress.length === 0 && deliverables.length === 0 && artifacts.length === 0) return '';
  return `
    <div class="runtime-projection" data-runtime-run-projection data-webui-artifact-body="${escapeAttr(taskCard.webuiArtifactBody || 'forbidden')}" data-webui-storage-truth="${escapeAttr(taskCard.webuiStorageTruth || 'forbidden')}">
      <span>refs projection only</span>
      ${progress.length > 0 ? `<ul data-runtime-progress-refs>${progress.map((item) => `<li>${escapeHTML(item.stage || item.title || item.state || 'progress ref')}</li>`).join('')}</ul>` : ''}
      ${deliverables.length > 0 ? `<ul data-runtime-deliverable-refs>${deliverables.map((item) => `<li>${escapeHTML(item.deliverableId || item.ref || item.title || item.kind || 'deliverable ref')}</li>`).join('')}</ul>` : ''}
      ${artifacts.length > 0 ? `<ul data-runtime-artifact-refs>${artifacts.map((item) => `<li>${escapeHTML(item.artifactRef || item.title || item.kind || 'artifact ref')}</li>`).join('')}</ul>` : ''}
    </div>`;
}

function renderQuotaView() {
  return `
    <section class="quota-view" data-shell-state="quota_exceeded">
      <div class="reliability-banner" data-reliability-status data-state="quota_exceeded">
        <strong data-reliability-title>额度已用完</strong>
        <span data-reliability-action>查看额度</span>
        <small data-reliability-details>当前只显示 API key / quota projection，不提供 Web-owned payment。</small>
      </div>
      <a class="primary-button" href="${MEDOPL_DEEP_LINK}/billing">external capability handoff</a>
      <button type="button" data-shell-action="home">返回主界面</button>
    </section>`;
}

function renderSkillPlaza() {
  return `
    <section class="plaza-view" data-shell-state="skill_plaza">
      <header><h1>Skill Plaza</h1><button type="button">导入 Skill</button></header>
      <div class="drop-zone">拖拽 .json / .yaml / .zip 到此处导入，或点击选择文件</div>
      <div class="plaza-grid">
        ${['PubMed 文献检索', '引文网络分析', '实验方案生成', '统计方法推荐', '基金摘要优化', '图表解读'].map((name) => `<article><strong>${name}</strong><small>只作为任务入口；执行权威留在 MedOPL/OPL。</small></article>`).join('')}
      </div>
    </section>`;
}

function renderWorkflowPlaza() {
  return `
    <section class="plaza-view" data-shell-state="workflow_plaza">
      <div class="empty-workflow">
        <span>工作流 · 即将上线</span>
        <p>Agentic 研究工作流作为未来 capability placeholder，当前不新增 runtime sync。</p>
      </div>
    </section>`;
}

function renderMoreSurface() {
  return `
    <section class="more-view" data-more-overflow>
      <h1>暂时没有更多入口</h1>
      <p data-more-empty>More 作为轻量 overflow 保留；账号、登录和 API Key 从左下角头像进入。</p>
    </section>`;
}

function renderAccountPopover() {
  const providerStatus = state.view.provider.apiKeyConfigured ? `已绑定：${state.view.provider.maskedKey}` : '未绑定';
  return `
    <aside class="account-popover" id="account-popover" data-account-popover data-figma-slice="figma_dialog_sheet_projection_slice">
      <header><span>Account</span><button type="button" data-account-popover-close aria-label="关闭账号弹层">x</button></header>
      <dl>
        <div><dt>登录状态</dt><dd data-session-status>${escapeHTML(state.view.session.email || '未登录')}</dd></div>
        <div><dt>API Key 绑定状态</dt><dd data-provider-status>${escapeHTML(providerStatus)}</dd></div>
      </dl>
      <form data-provider-form>
        <label for="api-key">API Key</label>
        <input id="api-key" name="apiKey" type="password" autocomplete="off" placeholder="sk-...">
        <p>只保存到 Go control plane；页面只显示 masked key，不回显 raw API Key。</p>
        <button class="primary-button full" type="submit" data-save-key-button>保存/更新 API Key</button>
        <button class="secondary-button full" type="button" data-billing-summary-open>readonly commercial projection</button>
        <button class="text-button full" type="button" data-logout-button>退出登录</button>
        <p class="form-message" data-settings-message role="status"></p>
      </form>
    </aside>`;
}

function renderBillingSummary() {
  const quota = state.view.billingSummary.quota || {};
  return `
    <div class="sheet-backdrop" data-billing-close></div>
    <aside class="billing-panel" data-surface="billing_summary_projection">
      <header><div><h2>用量概览</h2><p>只读投影 · commercial authority 由 MedOPL 持有</p></div><button type="button" data-billing-close aria-label="关闭用量概览">x</button></header>
      <dl>
        <div><dt>API key / quota projection</dt><dd>${Number(quota.used || 0)} / ${Number(quota.limit || 0)}</dd></div>
        <div><dt>external capability handoff</dt><dd><a href="${MEDOPL_DEEP_LINK}/billing">MedOPL</a></dd></div>
      </dl>
    </aside>`;
}

function renderAPIKeyDialog() {
  const open = document.body.dataset.apiKeyDialogState === 'open';
  return `
    <aside class="api-key-dialog" data-api-key-dialog data-api-key-dialog-state="${open ? 'open' : 'closed'}" role="dialog" aria-modal="true" aria-labelledby="api-key-dialog-title" data-figma-slice="figma_dialog_sheet_projection_slice" ${open ? '' : 'hidden'}>
      <div class="api-key-dialog-panel">
        <span>API Key</span>
        <h2 id="api-key-dialog-title">发送前需要绑定 API Key</h2>
        <p>绑定后即可发送普通聊天；页面不会回显 raw API Key。</p>
        <button class="primary-button full" type="button" data-api-key-dialog-primary>去绑定</button>
        <button class="text-button full" type="button" data-api-key-dialog-close>稍后处理</button>
      </div>
    </aside>`;
}

function bindCurrentDOM() {
  bindClicks();
  bindForms();
  bindSearch();
}

function bindClicks() {
  app?.querySelectorAll('[data-public-start-cta]').forEach((button) => button.addEventListener('click', () => openAnonymousAuth(button.dataset.authMode, '[data-public-start-cta]')));
  app?.querySelectorAll('[data-public-task-entry], [data-research-task]').forEach((button) => button.addEventListener('click', () => applyTaskPrompt(button)));
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
  state.firstValueTurn = firstValueTurnForPrompt(message, 'progressive');
  render();
  await yieldRenderedTurn();
  const result = await sendChatMessage(fetch, message);
  document.body.dataset.chatState = chatStateForResult(result);
  if (!result.ok) {
    state.firstValueTurn = firstValueTurnForPrompt(message, 'error', result.message || result.errorCode || '上游暂时不可用。');
    state.messages.push({ role: 'assistant', content: result.message || result.errorCode || '上游暂时不可用。' });
    render();
    return;
  }
  const researchResult = researchResultForChat({ ...result, prompt: message });
  state.lastResult = { prompt: message, researchResult };
  state.firstValueTurn = firstValueTurnForPrompt(message, researchResult ? 'complete' : 'error');
  if (!researchResult) state.messages.push({ role: 'assistant', content: result.assistantMessage?.content || '已收到。' });
  state.view = await loadOnePersonLabWebState(fetch, { loadSnapshot: false });
  render();
}

function firstValueTurnForPrompt(prompt, stateName, message = '已生成研究计划草案。') {
  if (!String(prompt || '').includes('@科研')) return null;
  return {
    state: stateName,
    progressiveBoundary: 'request_lifecycle_not_token_stream',
    message,
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

function shortTaskLabel(label) {
  return label.replace('开题/', '').replace('/长稿', '');
}

function taskDescription(task) {
  const byId = {
    research_direction: '开题 · 研究设计',
    paper_question: '论文问题 · 引文',
    grant_plan: '基金申报 · 计划书',
    review_map: '文献综述 · 知识图',
    materials_refs: '材料线索 · 分析',
    presentation_foundry: '演示文稿 · 汇报',
    book_foundry: '长稿 · 书稿规划',
  };
  return byId[task.id] || task.label;
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
