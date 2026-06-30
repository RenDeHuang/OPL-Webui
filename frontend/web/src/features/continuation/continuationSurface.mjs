import { MEDOPL_DEEP_LINK } from '../../product/catalog.mjs';

export const INSPECTOR_TABS = Object.freeze(['autonomy', 'inputs', 'outputs', 'why_next']);

export function renderProjectWindowCenter(view, helpers) {
  const tasks = view.taskHistory?.tasks || [];
  const conversations = view.conversations || [];
  return `
    <section class="file-library" data-shell-state="project_window_continuation_center" data-project-window-center data-projection-source="GET /api/tasks">
      <header><h1>项目</h1><button type="button" data-shell-action="home">新建项目</button></header>
      <div class="file-tabs"><button type="button" aria-selected="true">全部</button><button type="button">进行中</button><button type="button">需处理</button></div>
      <div class="file-list" data-project-window-list>
        ${conversations.length === 0 && tasks.length === 0 ? '<p data-project-window-empty>还没有项目。新建项目会先创建一个聊天草稿；专业任务投影返回后会显示进度和下一步。</p>' : ''}
        ${conversations.map((conversation) => renderConversationCard(conversation, helpers)).join('')}
        ${tasks.map((task) => renderProjectWindowCard(task, helpers)).join('')}
      </div>
    </section>`;
}

export function renderConversationCard(conversation, helpers) {
  return `
    <article data-conversation-entry data-conversation-id="${helpers.escapeAttr(conversation.conversationId)}" data-conversation-status="${helpers.escapeAttr(conversation.status || 'draft')}">
      <strong>${helpers.escapeHTML(conversation.title || '新聊天')}</strong>
      <small>${helpers.escapeHTML(conversationStatusLabel(conversation.status))} · ${helpers.escapeHTML(helpers.formatShortDate(conversation.updatedAt))}</small>
      <div class="project-window-signals" data-project-window-continuation-signals>
        <span data-project-window-current-objective>${helpers.escapeHTML(conversation.title || '新聊天')}</span>
        <span data-project-window-input-refs>等待消息或材料引用</span>
        <span data-project-window-output-refs>暂无输出</span>
        <span data-project-window-blocker-why>暂无阻塞</span>
        <span data-project-window-next-action>继续聊天</span>
      </div>
      <button type="button" data-shell-action="home">继续聊天</button>
    </article>`;
}

export function renderProjectWindowCard(task, helpers) {
  const snapshot = continuationSnapshot(task);
  return `
    <article data-project-window-item="${helpers.escapeAttr(task.taskId)}" data-project-window-status="${helpers.escapeAttr(task.status)}" data-projection-source="GET /api/tasks">
      <strong>${helpers.escapeHTML(snapshot.currentObjective)}</strong>
      <small>${helpers.escapeHTML(task.status || 'projection')} · ${helpers.escapeHTML(helpers.formatShortDate(task.updatedAt))} · ${snapshot.refCount} refs</small>
      <div class="project-window-signals" data-project-window-continuation-signals>
        <span data-project-window-current-objective>${helpers.escapeHTML(snapshot.currentObjective)}</span>
        <span data-project-window-input-refs>${helpers.escapeHTML(snapshot.inputsSummary)}</span>
        <span data-project-window-output-refs>${helpers.escapeHTML(snapshot.outputsSummary)}</span>
        <span data-project-window-blocker-why>${helpers.escapeHTML(snapshot.blockerWhy)}</span>
        <span data-project-window-next-action>${helpers.escapeHTML(snapshot.nextAction)}</span>
      </div>
      <a data-project-window-continue href="${helpers.escapeAttr(task.deeplink || MEDOPL_DEEP_LINK)}">继续任务</a>
    </article>`;
}

export function renderSearchSheet(view, helpers) {
  const tasks = view.taskHistory?.tasks || [];
  const conversations = view.conversations || [];
  const hasResults = tasks.length > 0 || conversations.length > 0;
  return `
    <div class="sheet-backdrop" data-overlay-close="search"></div>
    <aside class="search-sheet" data-search-sheet data-overlay-state="open" data-figma-slice="figma_dialog_sheet_projection_slice">
      <header><span>搜索聊天</span><button type="button" data-overlay-close="search" aria-label="关闭搜索">x</button></header>
      <input id="project-window-search" type="search" data-window-search data-window-search-scope="project_conversation_file_refs" data-window-search-source="GET /api/chat/conversations + GET /api/tasks" placeholder="搜索聊天、项目、文件..." aria-label="搜索聊天、项目、文件">
      <div class="project-window-search-results" data-project-window-search-results>
        ${conversations.map((conversation) => `<button type="button" data-project-window-search-result data-conversation-id="${helpers.escapeAttr(conversation.conversationId)}"><strong>${helpers.escapeHTML(conversation.title || '新聊天')}</strong><small>${helpers.escapeHTML(conversationStatusLabel(conversation.status))} · ${helpers.escapeHTML(helpers.formatShortDate(conversation.updatedAt))}</small></button>`).join('')}
        ${tasks.length === 0 ? '' : tasks.map((task) => {
          const snapshot = continuationSnapshot(task);
          return `<button type="button" data-project-window-search-result><strong>${helpers.escapeHTML(snapshot.currentObjective)}</strong><small>${helpers.escapeHTML(helpers.formatShortDate(task.updatedAt))} · ${helpers.escapeHTML(snapshot.nextAction)}</small></button>`;
        }).join('')}
      </div>
      <p class="empty-state" data-project-window-search-empty ${hasResults ? 'hidden' : ''}>暂无聊天、项目或文件。开始新聊天后会出现在这里。</p>
    </aside>`;
}

export function renderInspector(state, helpers) {
  const snapshot = activeInspectorSnapshot(state);
  return `
    <aside class="inspector-sheet" data-inspector-sheet data-inspector-state="${helpers.escapeAttr(state.inspectorTab)}" data-responsive-placement="bottom_sheet" data-figma-slice="figma_dialog_sheet_projection_slice">
      <header><span>文件 / 上下文</span><button type="button" data-inspector-close aria-label="关闭文件面板">x</button></header>
      <div class="inspector-tabs" role="tablist">
        ${INSPECTOR_TABS.map((tab) => `<button type="button" data-inspector-tab="${tab}" aria-selected="${String(state.inspectorTab === tab)}">${tabLabel(tab)}</button>`).join('')}
      </div>
      <section data-inspector-panel="autonomy" ${state.inspectorTab === 'autonomy' ? '' : 'hidden'}>
        <h3>进度</h3>
        <p data-inspector-autonomy-empty>显示当前任务正在做什么、引用了什么，以及下一步。</p>
        <dl>
          <div><dt>目标</dt><dd data-inspector-autonomy-current-objective>${helpers.escapeHTML(snapshot.currentObjective)}</dd></div>
          <div><dt>正在做</dt><dd data-inspector-autonomy-timeline>${helpers.escapeHTML(snapshot.activityTimeline)}</dd></div>
        </dl>
      </section>
      <section data-inspector-panel="inputs" ${state.inspectorTab === 'inputs' ? '' : 'hidden'}>
        <h3>引用</h3>
        ${renderRefs(snapshot.inputs, 'data-inspector-input-refs', helpers, '等待材料或引用')}
      </section>
      <section data-inspector-panel="outputs" ${state.inspectorTab === 'outputs' ? '' : 'hidden'}>
        <h3>结果</h3>
        ${renderRefs(snapshot.outputs, 'data-inspector-output-refs', helpers, '暂无结果')}
      </section>
      <section data-inspector-panel="why_next" ${state.inspectorTab === 'why_next' ? '' : 'hidden'}>
        <h3>下一步</h3>
        <dl>
          <div><dt>为什么</dt><dd data-inspector-blocker-why>${helpers.escapeHTML(snapshot.blockerWhy)}</dd></div>
          <div><dt>下一步</dt><dd data-inspector-next-action>${helpers.escapeHTML(snapshot.nextAction)}</dd></div>
        </dl>
      </section>
    </aside>`;
}

export function renderModelMenu(state, helpers) {
  const configuredModel = state.view?.modelSelector?.model || 'gpt-5.5';
  const profiles = [
    ['auto', `当前配置：${configuredModel}`, '由 config.toml / OPL_CHAT_MODEL 决定'],
    ['fast', '快速', '适合轻量问答和草稿'],
    ['deep', '深度', '适合复杂科研推理，实际可用性由账号能力决定'],
  ];
  return `
    <aside class="account-popover" data-model-menu data-figma-slice="figma_dialog_sheet_projection_slice">
      <header><span>模型</span><button type="button" data-model-menu-close aria-label="关闭模型选择">x</button></header>
      <div class="plaza-grid" role="listbox" aria-label="选择模型配置">
        ${profiles.map(([id, label, description]) => `
          <button type="button" class="secondary-button full" role="option" data-model-option="${id}" aria-selected="${String(state.selectedModelProfile === id)}">
            ${helpers.escapeHTML(label)}<small>${helpers.escapeHTML(description)}</small>
          </button>
        `).join('')}
      </div>
    </aside>`;
}

export function renderSkillImportDialog(state, helpers) {
  const messageByState = {
    select: '选择 OPL Skill 或个人 Skill manifest。',
    validate: '正在校验 manifest 边界。',
    error: '导入失败：缺少有效 Skill manifest。没有写入假成功。',
    imported: '已导入。',
  };
  return `
    <aside class="api-key-dialog" data-skill-import-dialog data-figma-slice="figma_dialog_sheet_projection_slice" role="dialog" aria-modal="true">
      <div class="api-key-dialog-panel">
        <span>Skill import</span>
        <h2>导入 Skill</h2>
        <p data-skill-import-source>支持 OPL Skill reference 或个人 Skill manifest；当前不执行 runtime、不上传到 MedOPL storage。</p>
        <p data-skill-import-message role="status">${helpers.escapeHTML(messageByState[state.skillImportState] || messageByState.select)}</p>
        <button class="primary-button full" type="button" data-skill-import-trigger>校验并导入</button>
        <button class="text-button full" type="button" data-skill-import-close>关闭</button>
      </div>
    </aside>`;
}

function renderRefs(refs, attr, helpers, emptyLabel) {
  if (!refs.length) return `<p ${attr}>${helpers.escapeHTML(emptyLabel)}</p>`;
  return `<ul ${attr}>${refs.map((ref) => `<li>${helpers.escapeHTML(ref.label || ref.ref || ref.kind || 'ref')}</li>`).join('')}</ul>`;
}

function activeInspectorSnapshot(state) {
  const activeTask = state.activeConversationMeta || state.view.taskHistory?.tasks?.[0] || null;
  if (activeTask) return continuationSnapshot(activeTask);
  const result = state.lastResult?.researchResult;
  if (result) {
    return {
      currentObjective: result.title || '@科研 研究计划',
      activityTimeline: '已生成研究计划草案',
      inputs: [],
      outputs: result.sections.map((section) => ({ label: section.title, ref: section.id })),
      blockerWhy: 'ordinary path does not require runtime/storage',
      nextAction: '继续追问，或选择专业任务进入 MedOPL handoff',
    };
  }
  return {
    currentObjective: '选择任务入口后开始任务',
    activityTimeline: '等待任务开始',
    inputs: [],
    outputs: [],
    blockerWhy: 'no active blocker',
    nextAction: '从 @科研 或专业任务入口开始',
  };
}

function continuationSnapshot(task = {}) {
  const inputs = Array.isArray(task.materialRefs) ? task.materialRefs : [];
  const outputs = [...(Array.isArray(task.deliverableRefs) ? task.deliverableRefs : []), ...(Array.isArray(task.progressRefs) ? task.progressRefs : [])];
  const blockerTitle = task.blocker?.title || task.blocker?.kind || '';
  const action = task.allowedNextActions?.[0]?.label || task.nextStep || '继续任务';
  const currentObjective = projectWindowTitle(task);
  return {
    currentObjective,
    activityTimeline: task.status || 'projection',
    inputs,
    outputs,
    inputsSummary: inputs.length ? `${inputs.length} 个输入引用` : '暂无输入引用',
    outputsSummary: outputs.length ? `${outputs.length} 个输出引用` : '暂无输出引用',
    blockerWhy: blockerTitle || (task.status === 'blocked' ? '等待 MedOPL 开通' : '暂无阻塞'),
    nextAction: action,
    refCount: inputs.length + outputs.length,
  };
}

export function projectWindowTitle(task = {}) {
  return `${task.marker || ''} ${task.taskType || task.taskIntent || '任务'}`.trim();
}

export function modelProfileLabel(stateOrProfile) {
  const selected = typeof stateOrProfile === 'string' ? stateOrProfile : stateOrProfile?.selectedModelProfile;
  const configuredModel = typeof stateOrProfile === 'object' ? stateOrProfile.view?.modelSelector?.model : '';
  const labels = {
    auto: `模型：${configuredModel || 'gpt-5.5'}`,
    fast: '模型：快速配置',
    deep: '模型：深度配置',
  };
  return labels[selected] || labels.auto;
}

function tabLabel(tab) {
  return {
    autonomy: '进度',
    inputs: '引用',
    outputs: '结果',
    why_next: '下一步',
  }[tab] || tab;
}

function conversationStatusLabel(status) {
  const labels = { draft: '草稿', running: '运行中', completed: '已完成', failed: '失败' };
  return labels[status] || '聊天';
}
