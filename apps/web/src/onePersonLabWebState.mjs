export const FIXED_BASE_URL = 'https://gflabtoken.cn/v1';
export const MEDOPL_DEEP_LINK = 'https://medopl.medopl.cn';
export const FIGMA_MAKE_SOURCE = '1MNO5l7PQYKZVNqQgw6DGS';
export const LIGHTWEIGHT_MARKERS = ['@科研'];
export const RUNTIME_REQUIRED_MARKERS = ['@论文', '@基金', '@综述', '@文件', '@PPT', '@书'];
export const CAPABILITY_MARKER_SEMANTICS = [
  { marker: '@科研', workflow: 'research_planning', runtimePolicy: 'ordinary_chat_fallback' },
  { marker: '@论文', workflow: 'paper_review_workflow', runtimePolicy: 'runtime_gate' },
  { marker: '@基金', workflow: 'grant_workflow', runtimePolicy: 'runtime_gate' },
  { marker: '@综述', workflow: 'review_workflow', runtimePolicy: 'runtime_gate' },
  { marker: '@文件', workflow: 'materials_refs_workflow', runtimePolicy: 'runtime_gate' },
  { marker: '@PPT', workflow: 'presentation_foundry_workflow', runtimePolicy: 'runtime_gate' },
  { marker: '@书', workflow: 'book_foundry_workflow', runtimePolicy: 'runtime_gate' },
];
export const RESEARCH_TASK_INTENTS = [
  {
    id: 'research_direction',
    label: '开题/研究方向',
    marker: '@科研',
    prompt: '@科研 帮我拆解研究方向、问题和下一步计划',
    runtimePolicy: 'ordinary_chat_fallback',
    expectedChatState: 'research_entry_selected',
    consumer: 'research_user_prompt',
  },
  {
    id: 'paper_question',
    label: '论文问题',
    marker: '@论文',
    prompt: '@论文 生成研究选题、问题拆解和证据计划',
    runtimePolicy: 'runtime_gate',
    expectedChatState: 'paper_entry_selected',
    consumer: 'research_user_prompt',
  },
  {
    id: 'grant_plan',
    label: '基金计划',
    marker: '@基金',
    prompt: '@基金 帮我拆解标书结构、研究目标和执行路径',
    runtimePolicy: 'runtime_gate',
    expectedChatState: 'grant_entry_selected',
    consumer: 'research_user_prompt',
  },
  {
    id: 'review_map',
    label: '综述地图',
    marker: '@综述',
    prompt: '@综述 帮我整理综述结构、证据线索和引用计划',
    runtimePolicy: 'runtime_gate',
    expectedChatState: 'materials_refs_pending',
    consumer: 'research_user_prompt',
  },
  {
    id: 'materials_refs',
    label: '材料线索',
    marker: '@文件',
    prompt: '@文件 整理材料引用和交付物 refs',
    runtimePolicy: 'runtime_gate',
    expectedChatState: 'materials_refs_pending',
    consumer: 'research_user_prompt',
  },
  {
    id: 'presentation_foundry',
    label: '演示/PPT',
    marker: '@PPT',
    prompt: '@PPT 规划研究演示结构、证据线和交付物 refs',
    runtimePolicy: 'runtime_gate',
    expectedChatState: 'presentation_entry_selected',
    consumer: 'research_user_prompt',
  },
  {
    id: 'book_foundry',
    label: '写书/长稿',
    marker: '@书',
    prompt: '@书 规划书稿结构、章节路线和资料 refs',
    runtimePolicy: 'runtime_gate',
    expectedChatState: 'book_entry_selected',
    consumer: 'research_user_prompt',
  },
];
export const RESEARCH_RESULT_SECTIONS = [
  {
    id: 'research_plan',
    title: '研究计划',
    fallback: '先把研究方向拆成问题、假设和可执行步骤。',
  },
  {
    id: 'evidence_refs',
    title: '证据线索',
    fallback: '继续补充材料、引用和可核查来源。',
  },
  {
    id: 'next_steps',
    title: '下一步',
    fallback: '选择一个问题进入论文、基金或综述工作流。',
  },
];
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
const RELIABILITY_ERROR_CODE_BY_CODE = Object.freeze({
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  API_KEY_REQUIRED: 'API_KEY_REQUIRED',
  CHAT_QUOTA_EXCEEDED: 'CHAT_QUOTA_EXCEEDED',
  RUNTIME_REQUIRED: 'RUNTIME_REQUIRED',
  RUNTIME_GATE_BLOCKED: 'RUNTIME_GATE_BLOCKED',
  MEDOPL_ENDPOINT_REQUIRED: 'MEDOPL_ENDPOINT_REQUIRED',
  UPSTREAM_CHAT_FAILED: 'UPSTREAM_CHAT_FAILED',
  NETWORK_UNREACHABLE: 'NETWORK_UNREACHABLE',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
});
const RELIABILITY_ERROR_CODE_BY_STATUS = new Map([
  [401, 'AUTH_REQUIRED'],
  [429, 'CHAT_QUOTA_EXCEEDED'],
  [502, 'UPSTREAM_CHAT_FAILED'],
  [504, 'UPSTREAM_CHAT_FAILED'],
]);
export const OPL_CAPABILITY_MANIFEST = {
  source: { syncMode: 'source_path_pinned_manifest', dynamicSync: false, commitPin: 'blocked_by_github_tls_timeout',
    appContract: 'github.com/gaofeng21cn/one-person-lab-app/contracts/app-product-profile.json',
    frameworkContract: 'github.com/gaofeng21cn/one-person-lab/contracts/opl-framework/domains.json' },
  capabilities: [
    ['科研规划', '@科研 帮我拆解研究方向、问题和下一步计划', false, 'chat'],
    ['论文/综述', '@论文 生成研究选题和证据计划', true, 'mas'],
    ['基金', '@基金 帮我拆解标书结构', true, 'mag'],
    ['材料/文件', '@文件 整理材料引用和交付物 refs', true, 'medopl'],
    ['演示/PPT', '@PPT 规划研究演示结构、证据线和交付物 refs', true, 'rca'],
    ['写书/长稿', '@书 规划书稿结构、章节路线和资料 refs', true, 'bookforge'],
    ['普通问答', '解释 OPL 如何帮助复杂知识工作', false, 'chat'],
  ],
};

export async function loadOnePersonLabWebState(fetchRef = fetch, options = {}) {
  const shouldProbeSession = options.probeSession !== false;
  const shouldLoadSnapshot = options.loadSnapshot !== false;
  const session = shouldProbeSession ? await readJSON(fetchRef, '/api/session/current') : { ok: false };
  const provider = session.ok ? await readJSON(fetchRef, '/api/settings/model-provider') : providerFallback();
  const conversations = session.ok ? await readJSON(fetchRef, '/api/chat/conversations') : { conversations: [] };
  const taskHistory = session.ok ? await readJSON(fetchRef, '/api/tasks') : taskHistoryFallback();
  const commercialStatus = session.ok ? await readJSON(fetchRef, '/api/account/commercial-status') : commercialStatusFallback();
  const billingSummary = session.ok ? await readJSON(fetchRef, '/api/account/billing-summary') : billingSummaryFallback();
  const runtimeStatus = await readJSON(fetchRef, '/api/medopl/runtime/status');
  const materialsDeliverables = await readJSON(fetchRef, '/api/medopl/materials-deliverables/projection');
  const oplSnapshot = shouldLoadSnapshot ? await readJSON(fetchRef, '/api/opl/snapshot') : { ok: false };
  return createOnePersonLabViewModel({ session, provider, conversations, taskHistory, commercialStatus, billingSummary, runtimeStatus, materialsDeliverables, oplSnapshot });
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

export async function checkRuntimeGate(fetchRef, task) {
  return writeJSON(fetchRef, '/api/opl/runtime-gate', runtimeTaskPayload(task));
}

export async function runRuntimeTask(fetchRef, task) {
  const result = await writeJSON(fetchRef, '/api/opl/runs', runtimeTaskPayload(task));
  return sanitizeRuntimeRunResult(result);
}

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
    title: `${semantic.marker} 需要 MedOPL 授权`,
    message: 'Web 只显示授权入口和只读投影，不执行真实 OPL 任务。',
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
      { id: 'home', label: '新建对话', href: '#home' },
      { id: 'projects', label: '项目 / 窗口', href: '#projects' },
      { id: 'skills', label: 'Skill', href: '#skills' },
      { id: 'workflows', label: '工作流', href: '#workflows' },
      { id: 'search', label: '搜索', href: '#home' },
      { id: 'more', label: 'More', href: '#more' },
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
      label: '模型：自动',
      value: 'auto',
      optional: true,
      baseUrlVisible: false,
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

function researchResultSectionBody(sectionID, summary) {
  if (sectionID === 'research_plan') return summary;
  if (sectionID === 'evidence_refs') return '把关键材料、引用和数据来源作为 refs 继续补充；当前不返回文件正文。';
  return '下一步可继续 @科研 细化计划，或用 @论文、@基金 进入 MedOPL gate。';
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

function ctaForState(state) {
  if (state === 'anonymous') return '登录/注册';
  if (state === 'authenticated_unbound') return '绑定 API Key';
  return '发送';
}

function runtimeTaskPayload(task = {}) {
  return {
    taskIntent: String(task.taskIntent || '').trim(),
    marker: String(task.marker || '').trim(),
    prompt: String(task.prompt || '').trim(),
    conversationId: String(task.conversationId || '').trim(),
    gateRefs: task.gateRefs && typeof task.gateRefs === 'object' ? task.gateRefs : undefined,
  };
}

async function writeJSON(fetchRef, url, body, method = 'POST') {
  try {
    const response = await fetchRef(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return readResponse(response);
  } catch (error) {
    return sanitizedError('NETWORK_UNREACHABLE', error);
  }
}

async function readJSON(fetchRef, url) {
  try {
    return readResponse(await fetchRef(url));
  } catch {
    return { ok: false };
  }
}

async function readResponse(response) {
  let body;
  try {
    body = await response.json();
  } catch (error) {
    return sanitizedError('SERVICE_UNAVAILABLE', error, response?.status);
  }
  if (!response.ok && body && !body.ok) return sanitizeReliabilityError(body, response?.status);
  return body;
}

function sanitizedError(errorCode, error, status = 0) {
  return {
    ok: false,
    errorCode,
    status,
    message: errorCode === 'NETWORK_UNREACHABLE' ? '网络暂时不可达，请稍后重试。' : '服务暂时不可用，请稍后重试。',
    diagnostics: sanitizedDetails(error?.name || ''),
  };
}

function sanitizeReliabilityError(body = {}, status = 0) {
  const errorCode = normalizeReliabilityErrorCode(body.errorCode, status);
  const diagnostics = safeDiagnosticsFrom(body);
  const sanitized = {
    ok: false,
    errorCode,
    status,
    message: messageForReliabilityError(errorCode, body.message),
    diagnostics,
  };
  if (errorCode === 'RUNTIME_REQUIRED') {
    sanitized.medoplDeepLink = safeMedoplDeepLink(body.medoplDeepLink);
  }
  if (errorCode === 'RUNTIME_GATE_BLOCKED' || errorCode === 'MEDOPL_ENDPOINT_REQUIRED') {
    sanitized.gateState = sanitizeGateState(body.gateState || {});
  }
  return sanitized;
}

function normalizeReliabilityErrorCode(errorCode, status = 0) {
  const knownErrorCode = RELIABILITY_ERROR_CODE_BY_CODE[errorCode];
  if (knownErrorCode) return knownErrorCode;
  const statusErrorCode = RELIABILITY_ERROR_CODE_BY_STATUS.get(status);
  if (statusErrorCode) return statusErrorCode;
  if (status >= 500) return 'SERVICE_UNAVAILABLE';
  return errorCode || 'SERVICE_UNAVAILABLE';
}

function messageForReliabilityError(errorCode, message = '') {
  const byCode = {
    AUTH_REQUIRED: '请先登录后继续。',
    API_KEY_REQUIRED: '请先绑定 API Key 后继续。',
    CHAT_QUOTA_EXCEEDED: '当前额度已用完。',
    RUNTIME_REQUIRED: '该能力需要在 MedOPL 开通后继续。',
    RUNTIME_GATE_BLOCKED: 'MedOPL runtime gate 尚未 ready。',
    MEDOPL_ENDPOINT_REQUIRED: 'MedOPL bridge 未配置，无法执行 runtime-required 任务。',
    UPSTREAM_CHAT_FAILED: '上游暂时不可用，请稍后重试。',
    SERVICE_UNAVAILABLE: '服务暂时不可用，请稍后重试。',
    NETWORK_UNREACHABLE: '网络暂时不可达，请稍后重试。',
  };
  return byCode[errorCode] || sanitizedDetails(message || '请求暂时无法完成。');
}

function safeDiagnosticsFrom(body = {}) {
  const diagnostics = body.upstreamDiagnostics || body.metadata || body.diagnostics || {};
  const kind = diagnostics.upstreamKind || diagnostics.kind;
  return sanitizedDetails(kind ? `原因：${kind}` : '');
}

function safeMedoplDeepLink(value) {
  const text = String(value || '');
  return text.startsWith(MEDOPL_DEEP_LINK) ? text : MEDOPL_DEEP_LINK;
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

function sanitizeRuntimeRunResult(result = {}) {
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

function sanitizeGateState(gateState = {}) {
  return {
    ready: Boolean(gateState.ready),
    blockers: Array.isArray(gateState.blockers) ? gateState.blockers.map(normalizeRuntimeBlocker) : [],
    nextAction: normalizeNextAction(gateState.nextAction || {}),
    refs: sanitizeRuntimeMap(gateState.refs, ['workspaceRef', 'runtimeRef', 'storageRef']),
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

function normalizeRuntimeBlocker(blocker = {}) {
  return {
    kind: String(blocker.kind || 'runtime_blocked'),
    title: String(blocker.title || 'MedOPL runtime gate blocked'),
    nextAction: String(blocker.nextAction || ''),
    deepLink: safeMedoplDeepLink(blocker.deepLink),
  };
}

function normalizeNextAction(action = {}) {
  return {
    id: String(action.id || 'open_medopl'),
    label: String(action.label || '去 MedOPL'),
    deepLink: safeMedoplDeepLink(action.deepLink),
  };
}

function runtimeGateMessage(gateState = {}) {
  const blockers = Array.isArray(gateState.blockers) ? gateState.blockers.map(normalizeRuntimeBlocker) : [];
  if (blockers.length === 0) return 'Web 只显示授权入口和只读投影，不执行真实 OPL 任务。';
  return blockers.map((blocker) => blocker.title).join(' / ');
}

function sanitizedDetails(value) {
  return String(value || '')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted-api-key]')
    .replace(/api[_-]?key\s*=\s*[^\s]+/gi, '[redacted-field]')
    .replace(/password\s*=\s*[^\s]+/gi, 'password=[redacted]')
    .replace(/\/home\/dev\/\.opl\/[^\s"'`]+/gi, '[redacted-private-state-path]')
    .replace(/rawUpstreamBody|rawProviderError|rawApiKey|encryptedApiKey|privateState|private_state_path/gi, '[redacted-field]');
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text.slice(0, 1).toUpperCase() + text.slice(1) : '';
}

function providerFallback() {
  return { ok: false, provider: 'gflabtoken', baseUrl: FIXED_BASE_URL, apiKeyConfigured: false, maskedKey: '' };
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
