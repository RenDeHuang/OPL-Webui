export const FIXED_BASE_URL = 'https://gflabtoken.cn/v1';
export const MEDOPL_DEEP_LINK = 'https://medopl.medopl.cn';
export const FIGMA_MAKE_SOURCE = 'E8nYfNFc2D9P01FYZ8UwBW';
export const LIGHTWEIGHT_MARKERS = ['@科研'];
export const RUNTIME_REQUIRED_MARKERS = ['@论文', '@基金', '@综述', '@文件'];
export const CAPABILITY_MARKER_SEMANTICS = [
  { marker: '@科研', workflow: 'research_planning', runtimePolicy: 'ordinary_chat_fallback' },
  { marker: '@论文', workflow: 'paper_review_workflow', runtimePolicy: 'runtime_gate' },
  { marker: '@基金', workflow: 'grant_workflow', runtimePolicy: 'runtime_gate' },
  { marker: '@综述', workflow: 'review_workflow', runtimePolicy: 'runtime_gate' },
  { marker: '@文件', workflow: 'materials_refs_workflow', runtimePolicy: 'runtime_gate' },
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
export const OPL_CAPABILITY_MANIFEST = {
  source: { syncMode: 'source_path_pinned_manifest', dynamicSync: false, commitPin: 'blocked_by_github_tls_timeout',
    appContract: 'github.com/gaofeng21cn/one-person-lab-app/contracts/app-product-profile.json',
    frameworkContract: 'github.com/gaofeng21cn/one-person-lab/contracts/opl-framework/domains.json' },
  capabilities: [
    ['科研规划', '@科研 帮我拆解研究方向、问题和下一步计划', false, 'chat'],
    ['论文/综述', '@论文 生成研究选题和证据计划', true, 'mas'],
    ['基金', '@基金 帮我拆解标书结构', true, 'mag'],
    ['材料/文件', '@文件 整理材料引用和交付物 refs', true, 'medopl'],
    ['普通问答', '解释 OPL 如何帮助复杂知识工作', false, 'chat'],
  ],
};

export async function loadOnePersonLabWebState(fetchRef = fetch, options = {}) {
  const shouldProbeSession = options.probeSession !== false;
  const shouldLoadSnapshot = options.loadSnapshot !== false;
  const session = shouldProbeSession ? await readJSON(fetchRef, '/api/session/current') : { ok: false };
  const provider = session.ok ? await readJSON(fetchRef, '/api/settings/model-provider') : providerFallback();
  const conversations = session.ok ? await readJSON(fetchRef, '/api/chat/conversations') : { conversations: [] };
  const commercialStatus = session.ok ? await readJSON(fetchRef, '/api/account/commercial-status') : commercialStatusFallback();
  const billingSummary = session.ok ? await readJSON(fetchRef, '/api/account/billing-summary') : billingSummaryFallback();
  const runtimeStatus = await readJSON(fetchRef, '/api/medopl/runtime/status');
  const materialsDeliverables = await readJSON(fetchRef, '/api/medopl/materials-deliverables/projection');
  const oplSnapshot = shouldLoadSnapshot ? await readJSON(fetchRef, '/api/opl/snapshot') : { ok: false };
  return createOnePersonLabViewModel({ session, provider, conversations, commercialStatus, billingSummary, runtimeStatus, materialsDeliverables, oplSnapshot });
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
  if (result.errorCode === 'RUNTIME_REQUIRED') return 'runtime_required';
  if (result.errorCode === 'CHAT_QUOTA_EXCEEDED') return 'quota_exceeded';
  if (result.errorCode === 'UPSTREAM_CHAT_FAILED') return 'upstream_failed';
  if (result.errorCode === 'AUTH_REQUIRED') return 'auth_required';
  if (result.errorCode === 'API_KEY_REQUIRED') return 'api_key_required';
  if (result.errorCode === 'SERVICE_UNAVAILABLE') return 'service_unavailable';
  if (result.errorCode === 'NETWORK_UNREACHABLE') return 'network_unreachable';
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
    runtime_required: { title: '需要 MedOPL 授权', action: '去 MedOPL', retryable: false },
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
      { id: 'projects', label: 'Projects', href: '#projects' },
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
  return sanitized;
}

function normalizeReliabilityErrorCode(errorCode, status = 0) {
  if (errorCode === 'AUTH_REQUIRED') return 'AUTH_REQUIRED';
  if (errorCode === 'API_KEY_REQUIRED') return 'API_KEY_REQUIRED';
  if (errorCode === 'CHAT_QUOTA_EXCEEDED') return 'CHAT_QUOTA_EXCEEDED';
  if (errorCode === 'RUNTIME_REQUIRED') return 'RUNTIME_REQUIRED';
  if (errorCode === 'UPSTREAM_CHAT_FAILED') return 'UPSTREAM_CHAT_FAILED';
  if (errorCode === 'NETWORK_UNREACHABLE') return 'NETWORK_UNREACHABLE';
  if (errorCode === 'SERVICE_UNAVAILABLE') return 'SERVICE_UNAVAILABLE';
  if (status === 401) return 'AUTH_REQUIRED';
  if (status === 429) return 'CHAT_QUOTA_EXCEEDED';
  if (status === 502 || status === 504) return 'UPSTREAM_CHAT_FAILED';
  if (status >= 500) return 'SERVICE_UNAVAILABLE';
  return errorCode || 'SERVICE_UNAVAILABLE';
}

function messageForReliabilityError(errorCode, message = '') {
  const byCode = {
    AUTH_REQUIRED: '请先登录后继续。',
    API_KEY_REQUIRED: '请先绑定 API Key 后继续。',
    CHAT_QUOTA_EXCEEDED: '当前额度已用完。',
    RUNTIME_REQUIRED: '该能力需要在 MedOPL 开通后继续。',
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
