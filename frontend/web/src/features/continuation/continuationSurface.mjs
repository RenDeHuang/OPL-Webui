import { MEDOPL_DEEP_LINK } from '../../product/catalog.mjs';

export const INSPECTOR_TABS = Object.freeze(['autonomy', 'inputs', 'outputs', 'why_next']);

export function renderProjectWindowCenter(view, helpers) {
  const tasks = view.taskHistory?.tasks || [];
  return `
    <section class="file-library" data-shell-state="project_window_continuation_center" data-project-window-center data-projection-source="GET /api/tasks">
      <header><h1>项目 / 窗口</h1><button type="button" data-shell-action="home">新建窗口</button></header>
      <div class="file-tabs"><button type="button" aria-selected="true">全部</button><button type="button">running</button><button type="button">blocked</button></div>
      <div class="file-list" data-project-window-list>
        ${tasks.length === 0 ? '<p data-project-window-empty>还没有窗口。选择一个任务入口后，真实 Go control plane projection 会出现在这里。</p>' : tasks.map((task) => renderProjectWindowCard(task, helpers)).join('')}
      </div>
    </section>`;
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
      <a data-project-window-continue href="${helpers.escapeAttr(task.deeplink || MEDOPL_DEEP_LINK)}">继续窗口</a>
    </article>`;
}

export function renderSearchSheet(view, helpers) {
  const tasks = view.taskHistory?.tasks || [];
  return `
    <div class="sheet-backdrop" data-overlay-close="search"></div>
    <aside class="search-sheet" data-search-sheet data-overlay-state="open" data-figma-slice="figma_dialog_sheet_projection_slice">
      <header><span>搜索窗口</span><button type="button" data-overlay-close="search" aria-label="关闭搜索">x</button></header>
      <input id="project-window-search" type="search" data-window-search data-window-search-scope="project_windows" data-window-search-source="GET /api/tasks" placeholder="搜索项目窗口..." aria-label="搜索项目窗口">
      <div class="project-window-search-results" data-project-window-search-results>
        ${tasks.length === 0 ? '' : tasks.map((task) => {
          const snapshot = continuationSnapshot(task);
          return `<button type="button" data-project-window-search-result><strong>${helpers.escapeHTML(snapshot.currentObjective)}</strong><small>${helpers.escapeHTML(helpers.formatShortDate(task.updatedAt))} · ${helpers.escapeHTML(snapshot.nextAction)}</small></button>`;
        }).join('')}
      </div>
      <p class="empty-state" data-project-window-search-empty ${tasks.length > 0 ? 'hidden' : ''}>暂无窗口</p>
    </aside>`;
}

export function renderInspector(state, helpers) {
  const snapshot = activeInspectorSnapshot(state);
  return `
    <aside class="inspector-sheet" data-inspector-sheet data-inspector-state="${helpers.escapeAttr(state.inspectorTab)}" data-responsive-placement="bottom_sheet" data-figma-slice="figma_dialog_sheet_projection_slice">
      <header><span>Inspector</span><button type="button" data-inspector-close aria-label="关闭检查器">x</button></header>
      <div class="inspector-tabs" role="tablist">
        ${INSPECTOR_TABS.map((tab) => `<button type="button" data-inspector-tab="${tab}" aria-selected="${String(state.inspectorTab === tab)}">${tabLabel(tab)}</button>`).join('')}
      </div>
      <section data-inspector-panel="autonomy" ${state.inspectorTab === 'autonomy' ? '' : 'hidden'}>
        <h3>自治状态</h3>
        <p data-inspector-autonomy-empty>显示当前窗口的自治目标、输入输出引用和下一步。</p>
        <dl>
          <div><dt>目标</dt><dd data-inspector-autonomy-current-objective>${helpers.escapeHTML(snapshot.currentObjective)}</dd></div>
          <div><dt>正在做</dt><dd data-inspector-autonomy-timeline>${helpers.escapeHTML(snapshot.activityTimeline)}</dd></div>
        </dl>
      </section>
      <section data-inspector-panel="inputs" ${state.inspectorTab === 'inputs' ? '' : 'hidden'}>
        <h3>输入 refs</h3>
        ${renderRefs(snapshot.inputs, 'data-inspector-input-refs', helpers, '等待输入引用')}
      </section>
      <section data-inspector-panel="outputs" ${state.inspectorTab === 'outputs' ? '' : 'hidden'}>
        <h3>输出 refs</h3>
        ${renderRefs(snapshot.outputs, 'data-inspector-output-refs', helpers, '等待输出引用')}
      </section>
      <section data-inspector-panel="why_next" ${state.inspectorTab === 'why_next' ? '' : 'hidden'}>
        <h3>原因 / 下一步</h3>
        <dl>
          <div><dt>为什么</dt><dd data-inspector-blocker-why>${helpers.escapeHTML(snapshot.blockerWhy)}</dd></div>
          <div><dt>下一步</dt><dd data-inspector-next-action>${helpers.escapeHTML(snapshot.nextAction)}</dd></div>
        </dl>
      </section>
    </aside>`;
}

export function renderModelMenu(state, helpers) {
  const profiles = [
    ['auto', '自动', '根据任务和账号能力选择可用模型'],
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

export function renderPlusMenu(helpers) {
  const actions = [
    ['new_window', '新窗口', '创建新的本地对话窗口'],
    ['attach_file', '上传/文件', '需要 MedOPL 资源路径'],
    ['import_skill', '导入 Skill', '校验 OPL 或个人 Skill manifest'],
    ['bind_api_key', 'API Key', '打开账号能力绑定'],
    ['select_model', '选择模型', '切换可用模型配置'],
  ];
  return `
    <aside class="account-popover" data-plus-menu data-figma-slice="figma_dialog_sheet_projection_slice">
      <header><span>添加</span><button type="button" data-plus-menu-close aria-label="关闭添加菜单">x</button></header>
      <div class="plaza-grid">
        ${actions.map(([id, label, description]) => `
          <button type="button" class="secondary-button full" data-plus-action="${id}">
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
    currentObjective: '选择任务入口后开始窗口',
    activityTimeline: 'idle',
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
  const action = task.allowedNextActions?.[0]?.label || task.nextStep || '继续窗口';
  const currentObjective = projectWindowTitle(task);
  return {
    currentObjective,
    activityTimeline: task.status || 'projection',
    inputs,
    outputs,
    inputsSummary: inputs.length ? `${inputs.length} input refs` : 'no input refs',
    outputsSummary: outputs.length ? `${outputs.length} output refs` : 'no output refs',
    blockerWhy: blockerTitle || (task.status === 'blocked' ? 'waiting for MedOPL readiness' : 'no active blocker'),
    nextAction: action,
    refCount: inputs.length + outputs.length,
  };
}

export function projectWindowTitle(task = {}) {
  return `${task.marker || ''} ${task.taskType || task.taskIntent || '窗口'}`.trim();
}

export function modelProfileLabel(selectedModelProfile) {
  const labels = { auto: '模型：自动', fast: '模型：快速', deep: '模型：深度' };
  return labels[selectedModelProfile] || labels.auto;
}

function tabLabel(tab) {
  return {
    autonomy: '自治',
    inputs: '输入',
    outputs: '输出',
    why_next: '原因/下一步',
  }[tab] || tab;
}
