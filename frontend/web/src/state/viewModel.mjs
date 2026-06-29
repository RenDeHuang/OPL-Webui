import {
  CAPABILITY_MARKER_SEMANTICS,
  FIGMA_MAKE_SOURCE,
  FIXED_BASE_URL,
  MEDOPL_DEEP_LINK,
  OPL_CAPABILITY_MANIFEST,
  RESEARCH_RESULT_SECTIONS,
  RESEARCH_TASK_INTENTS,
  RUNTIME_REQUIRED_MARKERS,
} from '../product/catalog.mjs';

const CHAT_STATE_BY_ERROR_CODE = Object.freeze({
  RUNTIME_REQUIRED: 'runtime_required',
  RUNTIME_GATE_BLOCKED: 'runtime_required',
  MEDOPL_ENDPOINT_REQUIRED: 'runtime_required',
  CHAT_QUOTA_EXCEEDED: 'quota_exceeded',
  UPSTREAM_CHAT_FAILED: 'upstream_failed',
  AUTH_REQUIRED: 'auth_required',
  API_KEY_REQUIRED: 'api_key_required',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  NETWORK_UNREACHABLE: 'network_unreachable',
});

export function viewFromHash(hash) {
  const normalized = String(hash || '').replace(/^#/, '');
  if (!normalized) return 'home';
  return ['home', 'skills', 'workflows', 'projects', 'more'].includes(normalized) ? normalized : 'home';
}

export function accountState(session, provider) {
  if (!session?.ok) return 'anonymous';
  if (!provider?.apiKeyConfigured) return 'authenticated_unbound';
  return 'authenticated_bound';
}

export function chatStateForResult(result, pending = false) {
  if (pending) return 'sending';
  if (!result) return 'idle';
  const mappedState = CHAT_STATE_BY_ERROR_CODE[result.errorCode];
  if (mappedState) return mappedState;
  if (result.ok === false) return 'upstream_failed';
  return 'idle';
}

export function reliabilityStatusForResult(result) {
  const state = chatStateForResult(result);
  const byState = {
    idle: { title: '系统就绪', action: '继续输入', retryable: false },
    sending: { title: '正在发送', action: '等待结果', retryable: false },
    auth_required: { title: '需要登录', action: '去登录', retryable: false },
    api_key_required: { title: '需要绑定 API Key', action: '绑定 API Key', retryable: false },
    quota_exceeded: { title: '额度已用完', action: '查看额度', retryable: false },
    runtime_required: { title: runtimeStatusTitle(result), action: runtimeStatusAction(result), retryable: false },
    upstream_failed: { title: '上游暂时不可用', action: '稍后重试', retryable: true },
    service_unavailable: { title: '服务暂时不可用', action: '稍后重试', retryable: true },
    network_unreachable: { title: '网络暂时不可达', action: '稍后重试', retryable: true },
  };
  const base = byState[state] || byState.upstream_failed;
  return {
    state,
    title: base.title,
    action: base.action,
    retryable: base.retryable,
    details: state === 'upstream_failed' ? '' : sanitizedDetails(result?.message || result?.errorCode || ''),
  };
}

export function accountLifecycleSummary(commercialStatus = {}, billingSummary = {}) {
  const accountType = commercialStatus.accountType || 'personal';
  const lifecycleState = commercialStatus.lifecycleState || 'active';
  const tenantRole = commercialStatus.tenantRole || 'owner';
  const quota = billingSummary.quota || { limit: 0, used: 0, remaining: 0 };
  const audit = billingSummary.audit || { eventCount: 0, latestEventKind: '' };
  return {
    lifecycleLabel: `${capitalize(accountType)} / ${lifecycleState}`,
    tenantRoleLabel: `tenant role: ${tenantRole}`,
    teamReadinessLabel: `team readiness: ${commercialStatus.teamReadiness?.state || 'single_user_owner'}`,
    quotaLabel: `quota ${Number(quota.used || 0)}/${Number(quota.limit || 0)} used, ${Number(quota.remaining || 0)} remaining`,
    auditLabel: `audit events: ${Number(audit.eventCount || 0)}, latest ${audit.latestEventKind || 'none'}`,
  };
}

export function chatStateForPrompt(message) {
  const text = String(message || '');
  if (text.includes('@科研')) return 'research_entry_selected';
  if (text.includes('@论文')) return 'paper_entry_selected';
  if (text.includes('@基金')) return 'grant_entry_selected';
  if (text.includes('@PPT')) return 'presentation_entry_selected';
  if (text.includes('@书')) return 'book_entry_selected';
  if (text.includes('@文件') || text.includes('@综述')) return 'materials_refs_pending';
  return 'idle';
}

export function requiresRuntimeGate(message) {
  return RUNTIME_REQUIRED_MARKERS.some((marker) => String(message || '').includes(marker));
}

export function researchResultForChat(result = {}) {
  const prompt = String(result.prompt || result.message || '');
  if (!prompt.includes('@科研')) return null;
  const content = String(result.assistantMessage?.content || result.content || result.message || '').trim();
  const summary = content || RESEARCH_RESULT_SECTIONS[0].fallback;
  return {
    kind: 'structured_research_result',
    marker: '@科研',
    title: '@科研 研究计划草案',
    mode: 'ui_view_model_only',
    sections: RESEARCH_RESULT_SECTIONS.map((section) => ({
      id: section.id,
      title: section.title,
      body: researchResultSectionBody(section.id, summary),
    })),
  };
}

export function runtimeTaskCardForPrompt(prompt = '') {
  const text = String(prompt || '');
  const semantic = CAPABILITY_MARKER_SEMANTICS.find((item) => RUNTIME_REQUIRED_MARKERS.includes(item.marker) && text.includes(item.marker));
  if (!semantic) return null;
  return {
    kind: 'runtime_task_card',
    marker: semantic.marker,
    requiredCapability: semantic.workflow,
    title: `${semantic.marker} 进入 MedOPL 专业能力`,
    message: '继续到 MedOPL 开通或确认运行资源；回到 Web 后保留当前窗口上下文和 refs 投影。',
    handoffMode: 'conversion_handoff',
    capabilityMarker: semantic.marker,
    reason: 'specialist_capability_requires_medopl_runtime_or_resource_binding',
    returnContext: 'current_project_window',
    deepLink: MEDOPL_DEEP_LINK,
    webuiRuntimeExecution: 'forbidden',
  };
}

export function runtimeTaskCardForGate(prompt = '', gate = {}) {
  const base = runtimeTaskCardForPrompt(prompt);
  if (!base) return null;
  const gateState = gate.gateState || {};
  const nextAction = normalizeNextAction(gateState.nextAction || {});
  return {
    ...base,
    message: runtimeGateMessage(gateState),
    deepLink: nextAction.deepLink || base.deepLink,
    blockers: Array.isArray(gateState.blockers) ? gateState.blockers.map(normalizeRuntimeBlocker) : [],
    nextAction,
    reason: gateState.ready ? 'medopl_runtime_projection_ready' : base.reason,
  };
}

export function runtimeTaskCardForRun(prompt = '', run = {}) {
  const base = runtimeTaskCardForPrompt(prompt);
  if (!base) return null;
  const status = String(run.status || 'projected');
  const runRef = run.run?.runId || run.run?.runRef || run.artifactRef || '';
  return {
    ...base,
    title: `${base.marker} MedOPL continuation ready`,
    message: 'MedOPL 已接受运行意图；Web 只显示 refs、progress 和 deliverables projection。',
    status,
    runRef,
    progress: Array.isArray(run.progress) ? run.progress : [],
    deliverables: Array.isArray(run.deliverables) ? run.deliverables : [],
    artifacts: Array.isArray(run.artifacts) ? run.artifacts : [],
    deepLink: safeMedoplDeepLink(run.statusUrl),
    reason: 'medopl_run_intent_accepted',
    webuiArtifactBody: 'forbidden',
    webuiStorageTruth: 'forbidden',
  };
}

export function createOnePersonLabViewModel(state) {
  const provider = state.provider?.ok ? state.provider : providerFallback();
  const session = state.session ?? { ok: false };
  const currentAccountState = accountState(session, provider);
  return {
    title: '科研人员的 One Person Lab Web',
    subtitle: '面向科研工作人员、硕博、PI 与科研团队；从研究问题、项目和 Skill 进入多租户 SaaS 版 One Person Lab。',
    figmaMakeSource: FIGMA_MAKE_SOURCE,
    shell: { sideNavigation: true, accountDock: true, promptCommandCenter: true },
    navItems: [
      { id: 'home', label: '新聊天', href: '#home' },
      { id: 'search', label: '搜索聊天', href: '#home' },
      { id: 'files', label: '文件库', href: '#home' },
      { id: 'workflows', label: '已安排/任务', href: '#workflows' },
      { id: 'skills', label: '应用 / Skills', href: '#skills' },
      { id: 'more', label: '更多', href: '#more' },
    ],
    accountEntry: 'bottom_avatar_popover',
    session,
    accountState: currentAccountState,
    primaryCTA: ctaForState(currentAccountState),
    provider: {
      baseUrlEditable: false,
      apiKeyConfigured: Boolean(provider.apiKeyConfigured),
      maskedKey: provider.maskedKey ?? '',
    },
    modelSelector: {
      label: `模型：${modelDisplayName(provider)}`,
      value: 'auto',
      optional: true,
      baseUrlVisible: false,
      configSource: 'config.toml / OPL_CHAT_MODEL',
      model: modelDisplayName(provider),
    },
    conversations: state.conversations?.conversations ?? [],
    taskHistory: taskHistoryFallback(state.taskHistory),
    commercialStatus: commercialStatusFallback(state.commercialStatus),
    billingSummary: billingSummaryFallback(state.billingSummary),
    accountLifecycle: accountLifecycleSummary(
      commercialStatusFallback(state.commercialStatus),
      billingSummaryFallback(state.billingSummary),
    ),
    reliabilityStatus: reliabilityStatusForResult(null),
    capabilitySource: OPL_CAPABILITY_MANIFEST.source,
    researchTaskIntents: RESEARCH_TASK_INTENTS,
    researchResultSections: RESEARCH_RESULT_SECTIONS,
    capabilities: OPL_CAPABILITY_MANIFEST.capabilities.map(([label, prompt, runtimeRequired, sourceAssistant]) => ({
      label, prompt, runtimeRequired, sourceAssistant,
    })),
    workflowCards: [
      { title: '论文工作流', description: '从选题、问题和证据计划进入，先过 MedOPL gate。' },
      { title: '基金工作流', description: '拆解标书结构、研究目标和执行路径。' },
      { title: '综述工作流', description: '整理综述结构、证据线索和引用计划。' },
      { title: '材料线索', description: '围绕材料、引用和交付物 refs 组织输入。' },
      { title: '演示工作流', description: '规划研究演示结构、证据线和交付物 refs。' },
      { title: '写书工作流', description: '规划书稿结构、章节路线和资料 refs。' },
    ],
    runtimeGate: {
      title: '需要 MedOPL 授权',
      message: '该能力需要在 MedOPL 开通后继续',
      deepLink: MEDOPL_DEEP_LINK,
    },
    runtimeStatus: runtimeStatusFallback(state.runtimeStatus),
    materialsDeliverables: materialsDeliverablesFallback(state.materialsDeliverables),
    readonly: {
      mode: state.oplSnapshot?.mode ?? 'readonly',
      ok: Boolean(state.oplSnapshot?.ok),
    },
  };
}

export function createInitialOnePersonLabViewModel() {
  return createOnePersonLabViewModel({
    session: { ok: false },
    provider: providerFallback(),
    conversations: { conversations: [] },
    taskHistory: taskHistoryFallback(),
    commercialStatus: commercialStatusFallback(),
    billingSummary: billingSummaryFallback(),
    runtimeStatus: runtimeStatusFallback(),
    materialsDeliverables: materialsDeliverablesFallback(),
    oplSnapshot: { ok: false },
  });
}

export function runtimeTaskPayload(task = {}) {
  return {
    taskIntent: String(task.taskIntent || '').trim(),
    marker: String(task.marker || '').trim(),
    prompt: String(task.prompt || '').trim(),
    conversationId: String(task.conversationId || '').trim(),
    gateRefs: task.gateRefs && typeof task.gateRefs === 'object' ? task.gateRefs : undefined,
  };
}

export function sanitizedDetails(value) {
  return String(value || '')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted-api-key]')
    .replace(/api[_-]?key\s*=\s*[^\s]+/gi, '[redacted-field]')
    .replace(/password\s*=\s*[^\s]+/gi, 'password=[redacted]')
    .replace(/\/home\/dev\/\.opl\/[^\s"'`]+/gi, '[redacted-private-state-path]')
    .replace(/rawUpstreamBody|rawProviderError|rawApiKey|encryptedApiKey|privateState|private_state_path/gi, '[redacted-field]');
}

export function safeMedoplDeepLink(value) {
  const text = String(value || '');
  return text.startsWith(MEDOPL_DEEP_LINK) ? text : MEDOPL_DEEP_LINK;
}

export function sanitizeRuntimeRunResult(result = {}) {
  if (!result || typeof result !== 'object') return { ok: false, errorCode: 'SERVICE_UNAVAILABLE' };
  const sanitized = {
    ok: Boolean(result.ok),
    owner: 'MedOPL',
    status: String(result.status || ''),
    run: sanitizeRuntimeMap(result.run, ['runId', 'runtimeBindingId', 'workspaceBindingId']),
    artifactRef: String(result.artifactRef || ''),
    artifacts: sanitizeRuntimeList(result.artifacts, ['artifactRef', 'kind', 'title', 'status']),
    progress: sanitizeRuntimeList(result.progress, ['stage', 'state', 'title']),
    deliverables: sanitizeRuntimeList(result.deliverables, ['deliverableId', 'artifactRef', 'status', 'title', 'kind', 'ref']),
    webuiArtifactBody: 'forbidden',
    webuiDomainTruth: 'forbidden',
  };
  if (result.ok === false) {
    sanitized.errorCode = result.errorCode || 'RUNTIME_GATE_BLOCKED';
    sanitized.blocker = normalizeRuntimeBlocker(result.blocker || {});
  }
  return sanitized;
}

export function sanitizeGateState(gateState = {}) {
  return {
    ready: Boolean(gateState.ready),
    blockers: Array.isArray(gateState.blockers) ? gateState.blockers.map(normalizeRuntimeBlocker) : [],
    nextAction: normalizeNextAction(gateState.nextAction || {}),
    refs: sanitizeRuntimeMap(gateState.refs, ['workspaceRef', 'runtimeRef', 'storageRef']),
  };
}

export function normalizeRuntimeBlocker(blocker = {}) {
  return {
    kind: String(blocker.kind || 'runtime_blocked'),
    title: String(blocker.title || 'MedOPL runtime gate blocked'),
    nextAction: String(blocker.nextAction || ''),
    deepLink: safeMedoplDeepLink(blocker.deepLink),
  };
}

export function normalizeNextAction(action = {}) {
  return {
    id: String(action.id || 'open_medopl'),
    label: String(action.label || '去 MedOPL'),
    deepLink: safeMedoplDeepLink(action.deepLink),
  };
}

function researchResultSectionBody(sectionID, summary) {
  if (sectionID === 'research_plan') return summary;
  if (sectionID === 'evidence_refs') return '把关键材料、引用和数据来源作为 refs 继续补充；当前不返回文件正文。';
  return '下一步可继续 @科研 细化计划，或用 @论文、@基金 进入 MedOPL gate。';
}

function ctaForState(state) {
  if (state === 'anonymous') return '登录/注册';
  if (state === 'authenticated_unbound') return '绑定 API Key';
  return '发送';
}

function runtimeStatusTitle(result = {}) {
  const safeResult = result && typeof result === 'object' ? result : {};
  const firstBlocker = safeResult.gateState?.blockers?.[0];
  if (firstBlocker?.kind === 'medopl_endpoint_required') return '需要 MedOPL 配置';
  if (firstBlocker?.kind) return '需要 MedOPL 开通';
  return '需要 MedOPL 授权';
}

function runtimeStatusAction(result = {}) {
  const safeResult = result && typeof result === 'object' ? result : {};
  return safeResult.gateState?.nextAction?.label || '去 MedOPL';
}

function runtimeGateMessage(gateState = {}) {
  const blockers = Array.isArray(gateState.blockers) ? gateState.blockers.map(normalizeRuntimeBlocker) : [];
  if (blockers.length === 0) return 'Web 只显示授权入口和只读投影，不执行真实 OPL 任务。';
  return blockers.map((blocker) => blocker.title).join(' / ');
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text.slice(0, 1).toUpperCase() + text.slice(1) : '';
}

function providerFallback() {
  return { ok: false, provider: 'gflabtoken', baseUrl: FIXED_BASE_URL, apiKeyConfigured: false, maskedKey: '', model: 'gpt-5.5', modelConfigSource: 'OPL_CHAT_MODEL' };
}

function modelDisplayName(provider = {}) {
  return String(provider.model || 'gpt-5.5').trim() || 'gpt-5.5';
}

function runtimeStatusFallback(status = {}) {
  return {
    ok: Boolean(status.ok),
    owner: status.owner || 'MedOPL',
    state: status.state || 'required',
    deepLink: status.deepLink || `${MEDOPL_DEEP_LINK}/runtime`,
    refs: status.refs || {},
    counts: status.counts || { activeRuns: 0 },
    webuiRuntimeExecution: 'forbidden',
  };
}

function billingSummaryFallback(summary = {}) {
  return {
    ok: Boolean(summary.ok),
    owner: summary.owner || 'MedOPL',
    deepLink: summary.deepLink || `${MEDOPL_DEEP_LINK}/billing`,
    quota: summary.quota || { limit: 0, used: 0, remaining: 0 },
    audit: summary.audit || { eventCount: 0, latestEventKind: '' },
    webuiBillingSourceOfTruth: 'forbidden',
    webuiPaymentMutation: 'forbidden',
  };
}

function commercialStatusFallback(status = {}) {
  const teamReadiness = status.teamReadiness || {};
  return {
    ok: Boolean(status.ok),
    owner: status.owner || 'OnePersonLabWeb',
    productId: status.productId || 'one-person-lab-web',
    accountType: status.accountType || 'personal',
    lifecycleState: status.lifecycleState || 'active',
    tenantId: status.tenantId || '',
    tenantRole: status.tenantRole || 'owner',
    teamReadiness: {
      state: teamReadiness.state || 'single_user_owner',
      owner: teamReadiness.owner || 'OnePersonLabWeb',
      consumer: teamReadiness.consumer || 'settings_lifecycle_summary',
      allowedNextActions: Array.isArray(teamReadiness.allowedNextActions) ? teamReadiness.allowedNextActions : ['view_medopl_billing'],
    },
    webuiTeamMutation: 'forbidden',
    webuiInviteMutation: 'forbidden',
    webuiRBACMutation: 'forbidden',
    webuiPaymentMutation: 'forbidden',
    webuiBillingSourceOfTruth: 'forbidden',
  };
}

function materialsDeliverablesFallback(projection = {}) {
  return {
    ok: Boolean(projection.ok),
    owner: projection.owner || 'MedOPL',
    deepLink: projection.deepLink || `${MEDOPL_DEEP_LINK}/materials`,
    materials: Array.isArray(projection.materials) ? projection.materials : [],
    deliverables: Array.isArray(projection.deliverables) ? projection.deliverables : [],
    webuiStorageMutation: 'forbidden',
    webuiArtifactBody: 'forbidden',
  };
}

function taskHistoryFallback(history = {}) {
  return {
    ok: Boolean(history.ok),
    owner: history.owner || 'OnePersonLabWeb',
    projection: history.projection || 'refs_status_metadata_only',
    tasks: Array.isArray(history.tasks) ? history.tasks.map(sanitizeTaskHistoryItem) : [],
    webuiArtifactBody: 'forbidden',
    webuiStorageTruth: 'forbidden',
    doesNotProve: Array.isArray(history.doesNotProve) ? history.doesNotProve : [
      'runtime execution',
      'artifact body authority',
      'storage truth',
      'payment lifecycle',
      'team/RBAC lifecycle',
      'production rollout',
    ],
  };
}

function sanitizeTaskHistoryItem(task = {}) {
  return {
    taskId: String(task.taskId || ''),
    taskType: String(task.taskType || task.taskIntent || ''),
    taskIntent: String(task.taskIntent || task.taskType || ''),
    marker: String(task.marker || ''),
    conversationId: String(task.conversationId || ''),
    status: String(task.status || 'blocked'),
    updatedAt: String(task.updatedAt || ''),
    progressRefs: sanitizeTaskRefs(task.progressRefs),
    deliverableRefs: sanitizeTaskRefs(task.deliverableRefs),
    materialRefs: sanitizeTaskRefs(task.materialRefs),
    blocker: task.blocker && typeof task.blocker === 'object' ? normalizeRuntimeBlocker(task.blocker) : null,
    nextStep: String(task.nextStep || ''),
    allowedNextActions: Array.isArray(task.allowedNextActions) ? task.allowedNextActions.map(normalizeNextAction) : [],
    deeplink: safeMedoplDeepLink(task.deeplink),
    webuiArtifactBody: 'forbidden',
    webuiStorageTruth: 'forbidden',
  };
}

function sanitizeRuntimeMap(source = {}, allowedFields = []) {
  const result = {};
  if (!source || typeof source !== 'object') return result;
  for (const field of allowedFields) {
    if (Object.hasOwn(source, field)) result[field] = source[field];
  }
  return result;
}

function sanitizeRuntimeList(value, allowedFields) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => sanitizeRuntimeMap(item, allowedFields));
}

function sanitizeTaskRefs(refs) {
  if (!Array.isArray(refs)) return [];
  return refs.map((ref) => ({
    ref: String(ref.ref || ''),
    label: String(ref.label || ''),
    status: String(ref.status || ''),
    kind: String(ref.kind || ''),
    source: String(ref.source || ''),
  })).filter((ref) => ref.ref);
}
