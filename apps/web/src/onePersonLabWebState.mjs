export const FIXED_BASE_URL = 'https://gflabtoken.cn/v1';
export const MEDOPL_DEEP_LINK = 'https://medopl.medopl.cn';
export const FIGMA_MAKE_SOURCE = 'E8nYfNFc2D9P01FYZ8UwBW';
export const OPL_CAPABILITY_MANIFEST = {
  source: { syncMode: 'source_path_pinned_manifest', dynamicSync: false, commitPin: 'blocked_by_github_tls_timeout',
    appContract: 'github.com/gaofeng21cn/one-person-lab-app/contracts/app-product-profile.json',
    frameworkContract: 'github.com/gaofeng21cn/one-person-lab/contracts/opl-framework/domains.json' },
  capabilities: [
    ['普通问答', '解释 OPL 如何帮助复杂知识工作', false, 'chat'],
    ['论文/综述', '@论文 生成研究选题和证据计划', true, 'mas'],
    ['基金', '@基金 帮我拆解标书结构', true, 'mag'],
    ['PPT', '生成一页汇报 PPT 大纲', false, 'rca'],
    ['数据分析', '解释这组数据可以如何分析', false, 'chat'],
    ['长任务', '@长任务 规划一项复杂任务', true, 'mas'],
  ],
};

export async function loadOnePersonLabWebState(fetchRef = fetch, options = {}) {
  const shouldProbeSession = options.probeSession !== false;
  const shouldLoadSnapshot = options.loadSnapshot !== false;
  const session = shouldProbeSession ? await readJSON(fetchRef, '/api/session/current') : { ok: false };
  const provider = session.ok ? await readJSON(fetchRef, '/api/settings/model-provider') : providerFallback();
  const conversations = session.ok ? await readJSON(fetchRef, '/api/chat/conversations') : { conversations: [] };
  const oplSnapshot = shouldLoadSnapshot ? await readJSON(fetchRef, '/api/opl/snapshot') : { ok: false };
  return createOnePersonLabViewModel({ session, provider, conversations, oplSnapshot });
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

export function createOnePersonLabViewModel(state) {
  const provider = state.provider?.ok ? state.provider : providerFallback();
  const session = state.session ?? { ok: false };
  const currentAccountState = accountState(session, provider);
  return {
    title: '严肃工作的 AI 工作台',
    subtitle: '从普通聊天进入 Research、Grant、Presentation 等专业工作流',
    figmaMakeSource: FIGMA_MAKE_SOURCE,
    shell: { leftSidebar: true, accountDock: true, promptCommandCenter: true },
    navItems: [
      { label: '首页', href: '#home' },
      { label: 'Skills', href: '#capabilities' },
      { label: 'Foundry', href: '#capabilities' },
      { label: '工作流', href: '#chat' },
      { label: 'MedOPL', href: MEDOPL_DEEP_LINK },
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
    capabilitySource: OPL_CAPABILITY_MANIFEST.source,
    capabilities: OPL_CAPABILITY_MANIFEST.capabilities.map(([label, prompt, runtimeRequired, sourceAssistant]) => ({
      label, prompt, runtimeRequired, sourceAssistant,
    })),
    skillGroups: [
      { title: 'OPL', skills: [{ label: 'MAS 论文' }, { label: 'MAG 基金' }, { label: 'RCA 可视化' }] },
      { title: '办公套件', skills: [{ label: 'AI 幻灯片' }, { label: 'AI 表格' }, { label: 'AI 文档' }] },
      { title: '设计与代码', skills: [{ label: '设计' }, { label: '代码' }, { label: '仪表盘与 CRM' }] },
      { title: '内容创作', skills: [{ label: 'AI 聊天' }, { label: 'AI 图片' }, { label: 'AI 视频' }] },
      { title: '工具', skills: [{ label: '会议纪要' }, { label: '所有 Skills' }] },
    ],
    workbenchSteps: [
      { title: '选择专业工作', description: 'Foundry 启动中心，不是泛 Agent 列表。' },
      { title: '绑定真实材料', description: '围绕材料、引用和版本组织输入，不伪造文件能力。' },
      { title: '推进长任务', description: '展示阶段、进度和人工确认，不假装后台已经执行。' },
      { title: '沉淀交付物', description: '面向证据包、申请书、PPT 和修回材料的交付闭环。' },
      { title: '管理运行时', description: '只展示 readiness 与 MedOPL 开通入口。' },
    ],
    runtimeGate: {
      title: '需要 MedOPL Runtime',
      message: '该能力需要托管运行环境、存储或 node pool',
      deepLink: MEDOPL_DEEP_LINK,
    },
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
