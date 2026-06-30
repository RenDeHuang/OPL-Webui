import {
  runtimeTaskPayload,
  safeMedoplDeepLink,
  sanitizeGateState,
  sanitizeRuntimeRunResult,
  sanitizedDetails,
} from '../state/viewModel.mjs';

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

export async function readJSON(fetchRef, url) {
  try {
    return readResponse(await fetchRef(url));
  } catch {
    return { ok: false };
  }
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
  if (!session?.ok) return { ok: false, errorCode: 'AUTH_REQUIRED', message: '请先注册或登录后再绑定 API Key。' };
  return writeJSON(fetchRef, '/api/settings/model-provider', { apiKey }, 'PUT');
}

export async function createConversation(fetchRef, title = '') {
  return writeJSON(fetchRef, '/api/chat/conversations', { title });
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
    AUTH_REQUIRED: '请先注册或登录后继续。',
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
