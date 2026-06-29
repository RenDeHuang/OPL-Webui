import {
  MEDOPL_DEEP_LINK,
} from '../../product/catalog.mjs';
import {
  runtimeTaskCardForPrompt,
} from '../../state/viewModel.mjs';

export function renderResultView(state, helpers) {
  const result = state.lastResult;
  const research = result?.researchResult;
  return `
    <section class="result-view" data-shell-state="running_turn" data-results-surface>
      <div class="result-badge">${helpers.escapeHTML(state.activeConversationMeta?.project || 'OPL')}</div>
      <header class="result-topbar">
        <button type="button" data-shell-action="home">‹ 新对话</button>
        <span>${helpers.escapeHTML(state.activeConversationMeta?.title || result?.prompt || '@科研')}</span>
        <button type="button" data-inspector-open="autonomy">文件</button>
        <button type="button" data-inspector-open="why_next">Why / next</button>
      </header>
      <div class="result-scroll" data-chat-log>
        ${state.messages.map((message) => renderMessage(message, helpers)).join('')}
        ${state.firstValueTurn ? renderFirstValueTurn(state, state.firstValueTurn, helpers) : ''}
        ${research ? renderResearchResult(research, helpers) : ''}
      </div>
      <form class="pill-input" data-chat-form>
        <button type="button" aria-label="上传文件" data-plus-file-trigger>+</button>
        <input id="chat-input" name="message" placeholder="有问题，尽管问">
        <button type="button">API key</button>
        <button type="submit" data-chat-submit aria-label="发送">▮▮▮</button>
      </form>
    </section>`;
}

function renderResearchResult(result, { escapeAttr, escapeHTML }) {
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

function renderMessage(message, { escapeAttr, escapeHTML }) {
  return `<article class="message ${escapeAttr(message.role)}-message"><p>${escapeHTML(message.content)}</p></article>`;
}

function renderFirstValueTurn(state, turn, { escapeAttr, escapeHTML }) {
  document.body.dataset.lastFirstValueTurnState = turn.state;
  document.body.dataset.lastFirstValueProgressiveBoundary = turn.progressiveBoundary;
  document.body.dataset.chatTurnStagesObserved = state.chatTurnStages.join(',');
  document.body.dataset.chatTurnFakeStreaming = 'false';
  return `
    <article class="message assistant-message" data-first-value-turn-state data-turn-state="${escapeAttr(turn.state)}" data-progressive-boundary="${escapeAttr(turn.progressiveBoundary)}">
      <div class="turn-stage-row">${state.chatTurnStages.map((stage) => renderTurnStage(stage, { escapeAttr, escapeHTML })).join('')}</div>
      <p>${escapeHTML(turn.message)}</p>
    </article>`;
}

function renderTurnStage(stage, { escapeAttr, escapeHTML }) {
  const labels = { submitted: '已提交', progressive: '拆解中', waiting_upstream: '等待响应', complete: '已完成', error: '失败' };
  return `<span data-turn-stage="${escapeAttr(stage)}">${escapeHTML(labels[stage] || stage)}</span>`;
}

export function renderBlockedView(state, helpers) {
  const taskCard = state.lastRuntimeTaskCard || runtimeTaskCardForPrompt('@论文');
  document.body.dataset.lastRuntimeTaskMarker = taskCard.marker || '';
  return `
    <section class="blocked-view" data-shell-state="blocked_turn">
      <div class="reliability-banner" data-reliability-status data-state="runtime_required">
        <strong data-reliability-title>需要 MedOPL 授权</strong>
        <span data-reliability-action>去 MedOPL</span>
        <small data-reliability-details>该能力需要在 MedOPL 开通后继续。</small>
      </div>
      <article class="runtime-card is-visible" data-runtime-gate data-medopl-handoff="${helpers.escapeAttr(taskCard.handoffMode || 'conversion_handoff')}" data-handoff-return-context="${helpers.escapeAttr(taskCard.returnContext || 'current_project_window')}" data-handoff-next-action="${helpers.escapeAttr(taskCard.nextAction?.id || 'open_medopl')}">
        <div data-runtime-task-card="${helpers.escapeAttr(taskCard.kind || 'runtime_task_card')}" data-runtime-task-marker="${helpers.escapeAttr(taskCard.marker || '')}" data-runtime-projection-status="${helpers.escapeAttr(taskCard.status || '')}" data-runtime-run-ref="${helpers.escapeAttr(taskCard.runRef || '')}">
          <span>${helpers.escapeHTML(taskCard.capabilityMarker || taskCard.marker || '@论文')} · MedOPL conversion handoff</span>
          <h2>${helpers.escapeHTML(taskCard.title || '需要 MedOPL 授权')}</h2>
          <p>${helpers.escapeHTML(taskCard.message || 'Web 只显示授权入口和只读投影，不执行真实 OPL 任务。')}</p>
          ${renderRuntimeProjectionRefs(taskCard, helpers)}
          <a href="${helpers.escapeAttr(taskCard.deepLink || MEDOPL_DEEP_LINK)}">前往 MedOPL 处理</a>
        </div>
      </article>
      <button type="button" data-shell-action="home">返回主界面</button>
      <form class="pill-input" data-chat-form>
        <button type="button" aria-label="上传文件" data-plus-file-trigger>+</button>
        <input id="chat-input" name="message" placeholder="继续输入任务">
        <button type="submit" data-chat-submit aria-label="发送">↑</button>
      </form>
    </section>`;
}

function renderRuntimeProjectionRefs(taskCard = {}, { escapeAttr, escapeHTML }) {
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

export function renderQuotaView() {
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
