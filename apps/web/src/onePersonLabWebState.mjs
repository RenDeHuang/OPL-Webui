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
  const billingSummary = session.ok ? await readJSON(fetchRef, '/api/account/billing-summary') : billingSummaryFallback();
  const runtimeStatus = await readJSON(fetchRef, '/api/medopl/runtime/status');
  const materialsDeliverables = await readJSON(fetchRef, '/api/medopl/materials-deliverables/projection');
  const oplSnapshot = shouldLoadSnapshot ? await readJSON(fetchRef, '/api/opl/snapshot') : { ok: false };
  return createOnePersonLabViewModel({ session, provider, conversations, billingSummary, runtimeStatus, materialsDeliverables, oplSnapshot });
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
  return ['settings', 'capabilities', 'medopl'].includes(normalized) ? normalized : 'chat';
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
  if (result.ok === false) return 'upstream_failed';
  return 'idle';
}

export function requiresRuntimeGate(message) {
  return RUNTIME_REQUIRED_MARKERS.some((marker) => String(message || '').includes(marker));
}

export function createOnePersonLabViewModel(state) {
  const provider = state.provider?.ok ? state.provider : providerFallback();
  const session = state.session ?? { ok: false };
  const currentAccountState = accountState(session, provider);
  return {
    title: '科研人员的 One Person Lab Web',
    subtitle: '面向科研工作人员、硕博、PI 与科研团队；从 @科研、@论文、@基金 进入多租户 SaaS 版 One Person Lab。',
    figmaMakeSource: FIGMA_MAKE_SOURCE,
    shell: { leftSidebar: true, accountDock: true, promptCommandCenter: true },
    navItems: [
      { label: '首页', href: '#home' },
      { label: '科研能力', href: '#capabilities' },
      { label: '论文', href: '#capabilities' },
      { label: '基金', href: '#capabilities' },
      { label: '账号', href: '#settings' },
    ],
    session,
    accountState: currentAccountState,
    primaryCTA: ctaForState(currentAccountState),
    provider: {
      baseUrl: provider.baseUrl ?? FIXED_BASE_URL,
      baseUrlEditable: false,
      apiKeyConfigured: Boolean(provider.apiKeyConfigured),
      maskedKey: provider.maskedKey ?? '',
    },
    conversations: state.conversations?.conversations ?? [],
    billingSummary: billingSummaryFallback(state.billingSummary),
    capabilitySource: OPL_CAPABILITY_MANIFEST.source,
    capabilities: OPL_CAPABILITY_MANIFEST.capabilities.map(([label, prompt, runtimeRequired, sourceAssistant]) => ({
      label, prompt, runtimeRequired, sourceAssistant,
    })),
    skillGroups: [
      { title: '科研入口', skills: [{ label: '@科研' }, { label: '@论文' }, { label: '@基金' }] },
      { title: '产物入口', skills: [{ label: '@综述' }, { label: '@文件' }] },
      { title: '辅助入口', skills: [{ label: '普通问答' }] },
    ],
    workbenchSteps: [
      { title: '选择专业工作', description: '科研能力入口，不是泛 Agent 列表。' },
      { title: '绑定真实材料', description: '围绕材料、引用和版本组织输入，不伪造文件能力。' },
      { title: '进入科研工作流', description: '用 @科研、@论文、@基金、@综述 和 @文件 表达科研意图。' },
      { title: '沉淀交付物', description: '面向证据包、申请书、PPT 和修回材料的交付闭环。' },
      { title: '保留普通聊天', description: '普通聊天是 fallback，用于解释、整理和低风险问答。' },
    ],
    runtimeGate: {
      title: '需要 MedOPL Runtime',
      message: '该能力需要托管运行环境、存储或 node pool',
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
    billingSummary: billingSummaryFallback(),
    runtimeStatus: runtimeStatusFallback(),
    materialsDeliverables: materialsDeliverablesFallback(),
    oplSnapshot: { ok: false },
  });
}

function ctaForState(state) {
  if (state === 'anonymous') return '登录/注册后开始';
  return state === 'authenticated_unbound' ? '绑定 API Key' : '发送';
}

async function writeJSON(fetchRef, url, body, method = 'POST') {
  const response = await fetchRef(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readResponse(response);
}

async function readJSON(fetchRef, url) {
  try {
    return readResponse(await fetchRef(url));
  } catch {
    return { ok: false };
  }
}

async function readResponse(response) {
  const body = await response.json();
  if (!response.ok && body && !body.ok) return body;
  return body;
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
