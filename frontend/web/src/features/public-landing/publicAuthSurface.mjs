import { RESEARCH_TASK_INTENTS } from '../../product/catalog.mjs';

export function renderAnonymousSurface(state, helpers) {
  if (state.shellState === 'auth_login_register') return renderAuthPage(state, helpers);
  return renderPublicLanding(helpers);
}

function renderPublicLanding({ escapeAttr, escapeHTML }) {
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

function renderAuthPage(state, { escapeAttr }) {
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
            <p class="form-message auth-start-message" data-auth-start-message>请先注册或登录后继续</p>
            <label for="auth-email">邮箱</label>
            <div class="field-with-icon"><span aria-hidden="true">@</span><input id="auth-email" name="email" type="email" autocomplete="email" placeholder="researcher@lab.edu" value="${escapeAttr(state.authForm.email)}"></div>
            <label for="auth-password">密码</label>
            <div class="field-with-icon">
              <span aria-hidden="true">#</span>
              <input id="auth-password" name="password" type="${state.showPassword ? 'text' : 'password'}" autocomplete="current-password" placeholder="${isRegister ? '输入密码' : '********'}" value="${escapeAttr(state.authForm.password)}">
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

function shortTaskLabel(label) {
  return label.replace('开题/', '').replace('/长稿', '');
}
