import {
  RESEARCH_TASK_INTENTS,
} from '../../product/catalog.mjs';
import {
  modelProfileLabel,
  projectWindowTitle,
  renderInspector,
  renderModelMenu,
  renderPlusMenu,
  renderProjectWindowCenter,
  renderSearchSheet,
  renderSkillImportDialog,
} from '../continuation/continuationSurface.mjs';
import {
  renderAPIKeyDialog,
  renderAccountPopover,
  renderBillingSummary,
} from '../dialogs/dialogSurface.mjs';
import {
  renderBlockedView,
  renderQuotaView,
  renderResultView,
} from '../results/resultRuntimeSurface.mjs';

export function renderAuthenticatedSurface(state, helpers) {
  return `
    <div class="app-shell" data-app-shell data-figma-pattern="side_navigation_new_chat_projects_skill_workflow_search_more" data-figma-slice="figma_home_workbench_shell_slice">
      ${renderSidebar(state, helpers)}
      <div class="workspace-frame">
        <main class="workspace-main main-stage">
          ${renderMainSurface(state, helpers)}
        </main>
        ${state.showInspector ? renderInspector(state, helpers) : ''}
      </div>
      ${state.showSearch ? renderSearchSheet(state.view, helpers) : ''}
      ${state.showBilling ? renderBillingSummary(state) : ''}
      ${state.showSkillImport ? renderSkillImportDialog(state, helpers) : ''}
      ${renderAPIKeyDialog()}
      <button class="auth-account-toggle-sentinel" type="button" data-logout-button data-authenticated-logout-sentinel tabindex="-1" aria-hidden="true" aria-label="退出登录"></button>
    </div>`;
}

function renderSidebar(state, { escapeAttr, escapeHTML, formatShortDate }) {
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
          ${state.showAccount ? renderAccountPopover(state, { escapeHTML }) : ''}
        </div>
      </div>
    </aside>`;
}

function renderMainSurface(state, helpers) {
  if (state.shellState === 'running_turn') return renderResultView(state, helpers);
  if (state.shellState === 'blocked_turn') return renderBlockedView(state, helpers);
  if (state.shellState === 'quota_exceeded') return renderQuotaView();
  if (state.shellState === 'project_window_continuation_center') return renderProjectWindowCenter(state.view, helpers);
  if (state.shellState === 'skill_plaza') return renderSkillPlaza(state, helpers);
  if (state.shellState === 'workflow_plaza') return renderWorkflowPlaza();
  if (state.shellState === 'more') return renderMoreSurface();
  return renderHomeComposer(state, helpers);
}

function renderHomeComposer(state, helpers) {
  return `
    <section class="home-composer" data-shell-state="home_default" data-workbench-surface data-first-view>
      <h1>What should we get done?</h1>
      <form id="composer-form" class="composer-box" data-chat-form data-composer-box>
        <input id="chat-input" class="composer-input" placeholder="随心输入" aria-label="选择一个任务入口或直接输入问题">
      </form>
      <div class="composer-toolbar" data-composer-toolbar>
        <button type="button" class="icon-button" aria-label="添加" data-plus-menu-trigger aria-expanded="${String(state.showPlusMenu)}">+</button>
        ${state.showPlusMenu ? renderPlusMenu(helpers) : ''}
        <button type="button" class="secondary-button" tabindex="-1">完全访问</button>
        <button type="button" class="secondary-button model-selector" data-model-selector aria-expanded="${String(state.showModelMenu)}">${helpers.escapeHTML(modelProfileLabel(state.selectedModelProfile))}</button>
        ${state.showModelMenu ? renderModelMenu(state, helpers) : ''}
        <button type="button" class="secondary-button" data-inspector-open="autonomy">Inspector</button>
        <button type="submit" form="composer-form" class="round-send" data-chat-submit aria-label="发送">↑</button>
      </div>
      <div class="mode-grid" data-research-launcher data-starter-chips>
        ${RESEARCH_TASK_INTENTS.slice(0, 4).map((task) => renderModeButton(task, helpers)).join('')}
      </div>
      <div class="mode-grid lower-grid">
        ${RESEARCH_TASK_INTENTS.slice(4).map((task) => renderModeButton(task, helpers)).join('')}
      </div>
    </section>`;
}

function renderModeButton(task, { escapeAttr, escapeHTML }) {
  return `
    <button type="button" data-research-task data-research-task-intent="${escapeAttr(task.id)}" data-capability-marker="${escapeAttr(task.marker)}" data-capability-mode="${escapeAttr(task.runtimePolicy)}" data-prompt="${escapeAttr(task.prompt)}">
      <span>${escapeHTML(task.marker)}</span>
      <small>${escapeHTML(taskDescription(task))}</small>
    </button>`;
}

function renderSkillPlaza(state, { escapeAttr }) {
  return `
    <section class="plaza-view" data-shell-state="skill_plaza">
      <header><h1>Skill Plaza</h1><button type="button" data-skill-import-open>导入 Skill</button></header>
      <div class="drop-zone" data-skill-import-state="${escapeAttr(state.skillImportState)}">选择 OPL Skill 或个人 Skill manifest；未校验前不会显示导入成功。</div>
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
