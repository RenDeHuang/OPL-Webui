export const FIXED_BASE_URL = 'https://gflabtoken.cn/v1';
export const MEDOPL_DEEP_LINK = 'https://medopl.medopl.cn';

export async function loadOnePersonLabWebState(fetchRef = fetch) {
  const session = await readJSON(fetchRef, '/api/session/current');
  const provider = session.ok ? await readJSON(fetchRef, '/api/settings/model-provider') : providerFallback();
  const conversations = session.ok ? await readJSON(fetchRef, '/api/chat/conversations') : { conversations: [] };
  const oplSnapshot = await readJSON(fetchRef, '/api/opl/snapshot');
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

export async function saveAPIKey(fetchRef, apiKey) {
  return writeJSON(fetchRef, '/api/settings/model-provider', { apiKey }, 'PUT');
}

export async function sendChatMessage(fetchRef, message, conversationId = '') {
  return writeJSON(fetchRef, '/api/chat', { message, conversationId });
}

export function createOnePersonLabViewModel(state) {
  const provider = state.provider?.ok ? state.provider : providerFallback();
  return {
    title: 'One Person Lab Web',
    subtitle: 'Genspark-like one-person-lab-web with ChatGPT-like base chatbot',
    session: state.session ?? { ok: false },
    provider: {
      baseUrl: provider.baseUrl ?? FIXED_BASE_URL,
      baseUrlEditable: false,
      apiKeyConfigured: Boolean(provider.apiKeyConfigured),
      maskedKey: provider.maskedKey ?? '',
    },
    conversations: state.conversations?.conversations ?? [],
    capabilities: [
      { label: '普通问答', prompt: '普通聊天：解释 OPL 如何帮助复杂知识工作' },
      { label: '论文', prompt: '@论文 生成研究选题和证据计划' },
      { label: '基金', prompt: '@基金 帮我拆解标书结构' },
      { label: '综述', prompt: '@综述 规划文献综述证据包' },
      { label: 'PPT', prompt: '生成一页汇报 PPT 大纲' },
      { label: '数据分析', prompt: '解释这组数据可以如何分析' },
    ],
    runtimeGate: {
      title: '@OPL 能力需要资源开通',
      message: 'MedOPL Runtime / Storage / Node Pool',
      deepLink: MEDOPL_DEEP_LINK,
    },
    readonly: {
      mode: state.oplSnapshot?.mode ?? 'readonly',
      ok: Boolean(state.oplSnapshot?.ok),
    },
  };
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
