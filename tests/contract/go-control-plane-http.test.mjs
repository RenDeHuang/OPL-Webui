import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { startGoServerWithEnv, stopGoServer } from './go-control-plane-server-helper.mjs';

const secureEnv = {
  OPL_WEBUI_ENV: 'development',
  OPL_SESSION_SECRET: 'test-session-secret-32-bytes-minimum',
  OPL_API_KEY_ENCRYPTION_SECRET: 'test-api-key-secret-32-bytes-min',
  OPL_CHAT_MODEL: 'gpt-4o-mini',
};

function readApiContract() {
  return JSON.parse(readFileSync('contracts/web-api.openapi.json', 'utf8'));
}

function responseCodes(api, path, method) {
  return Object.keys(api.paths[path][method].responses).sort();
}

test('OpenAPI contract covers implemented status and error-code surfaces', () => {
  const api = readApiContract();

  assert.deepEqual(responseCodes(api, '/api/auth/register', 'post'), ['201', '400', '405', '409', '500', '503']);
  assert.deepEqual(responseCodes(api, '/api/auth/login', 'post'), ['200', '400', '401', '405', '503']);
  assert.deepEqual(responseCodes(api, '/api/auth/logout', 'post'), ['204', '405']);
  assert.deepEqual(responseCodes(api, '/api/session/current', 'get'), ['200', '401', '405']);
  assert.deepEqual(responseCodes(api, '/api/settings/model-provider', 'get'), ['200', '401', '405']);
  assert.deepEqual(responseCodes(api, '/api/settings/model-provider', 'put'), ['200', '400', '401', '405', '500', '503']);
  assert.deepEqual(responseCodes(api, '/api/chat', 'post'), ['200', '400', '401', '404', '405', '409', '429', '502', '503', '504']);
  assert.deepEqual(responseCodes(api, '/api/chat/conversations', 'get'), ['200', '401', '405']);
  assert.deepEqual(responseCodes(api, '/api/chat/conversations/{conversationId}', 'get'), ['200', '400', '401', '404', '405']);
  assert.deepEqual(responseCodes(api, '/api/account/audit-events', 'get'), ['200', '401', '405']);
  assert.deepEqual(responseCodes(api, '/api/opl/snapshot', 'get'), ['200', '405']);

  const errorCodes = api.components.schemas.ApiErrorCode.enum;
  for (const code of [
    'METHOD_NOT_ALLOWED',
    'AUTH_REQUIRED',
    'INVALID_JSON',
    'INVALID_CREDENTIALS_INPUT',
    'EMAIL_ALREADY_REGISTERED',
    'ACCOUNT_CREATE_FAILED',
    'INVALID_CREDENTIALS',
    'SESSION_SECRET_REQUIRED',
    'API_KEY_SECRET_REQUIRED',
    'INVALID_API_KEY',
    'API_KEY_SAVE_FAILED',
    'INVALID_CHAT_MESSAGE',
    'INVALID_CONVERSATION_ID',
    'CONVERSATION_NOT_FOUND',
    'API_KEY_REQUIRED',
    'API_KEY_DECRYPT_FAILED',
    'RUNTIME_REQUIRED',
    'CHAT_QUOTA_EXCEEDED',
    'UPSTREAM_CHAT_FAILED',
  ]) {
    assert.ok(errorCodes.includes(code), `missing ApiErrorCode: ${code}`);
  }
});

test('one-person-lab-web auth supports register login logout and safe current session', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(secureEnv);
  try {
    const registered = await postJSON(baseUrl, '/api/auth/register', { email: 'user@example.com', password: 'correct horse battery staple' });
    assert.equal(registered.response.status, 201);
    assert.match(registered.cookie, /opl_session=/);
    assert.equal(registered.body.email, 'user@example.com');
    assert.ok(registered.body.tenantId);
    assert.ok(registered.body.workspaceId);
    assertNoSensitiveMaterial(registered.body);

    const duplicate = await postJSON(baseUrl, '/api/auth/register', { email: 'user@example.com', password: 'correct horse battery staple' });
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.body.errorCode, 'EMAIL_ALREADY_REGISTERED');

    const wrong = await postJSON(baseUrl, '/api/auth/login', { email: 'user@example.com', password: 'wrong password' });
    assert.equal(wrong.response.status, 401);
    assert.equal(wrong.body.errorCode, 'INVALID_CREDENTIALS');

    const loggedIn = await postJSON(baseUrl, '/api/auth/login', { email: 'user@example.com', password: 'correct horse battery staple' });
    assert.equal(loggedIn.response.status, 200);
    assert.match(loggedIn.cookie, /opl_session=/);

    const current = await jsonFetch(`${baseUrl}/api/session/current`, {
      headers: { cookie: loggedIn.cookieHeader },
    });
    assert.equal(current.response.status, 200);
    assert.equal(current.body.email, 'user@example.com');
    assert.equal(current.body.authMode, 'public_account');
    assertNoSensitiveMaterial(current.body);

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: loggedIn.cookieHeader },
    });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  } finally {
    await stopGoServer(child);
  }
});

test('model provider binding stores user API key without returning raw secret', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(secureEnv);
  try {
    const session = await register(baseUrl, 'key-user@example.com');

    const putWithBaseURL = await putJSON(baseUrl, '/api/settings/model-provider', session.cookieHeader, { apiKey: 'sk-user-secret', base_url: 'https://evil.example/v1' });
    assert.equal(putWithBaseURL.response.status, 400);

    const saved = await putJSON(baseUrl, '/api/settings/model-provider', session.cookieHeader, { apiKey: 'sk-user-secret' });
    assert.equal(saved.response.status, 200);
    assert.equal(saved.body.provider, 'gflabtoken');
    assert.equal(saved.body.baseUrl, 'https://gflabtoken.cn/v1');
    assert.equal(saved.body.apiKeyConfigured, true);
    assert.match(saved.body.maskedKey, /^sk-\*\*\*/);
    assertNoSensitiveMaterial(saved.body);

    const loaded = await jsonFetch(`${baseUrl}/api/settings/model-provider`, {
      headers: { cookie: session.cookieHeader },
    });
    assert.equal(loaded.response.status, 200);
    assert.equal(loaded.body.baseUrl, 'https://gflabtoken.cn/v1');
    assert.equal(loaded.body.maskedKey, saved.body.maskedKey);
    assertNoSensitiveMaterial(loaded.body);
  } finally {
    await stopGoServer(child);
  }
});

test('chat API requires auth and user API key, rejects client base_url override, and gates OPL runtime abilities', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(secureEnv);
  try {
    const unauth = await postJSON(baseUrl, '/api/chat', { message: 'hello' });
    assert.equal(unauth.response.status, 401);
    assert.equal(unauth.body.errorCode, 'AUTH_REQUIRED');

    const session = await register(baseUrl, 'chat-user@example.com');
    const noKey = await authedPost(baseUrl, '/api/chat', session.cookieHeader, { message: 'hello' });
    assert.equal(noKey.response.status, 400);
    assert.equal(noKey.body.errorCode, 'API_KEY_REQUIRED');

    const baseOverride = await authedPost(baseUrl, '/api/chat', session.cookieHeader, { message: 'hello', base_url: 'https://evil.example/v1' });
    assert.equal(baseOverride.response.status, 400);

    await putJSON(baseUrl, '/api/settings/model-provider', session.cookieHeader, { apiKey: 'sk-runtime-gate-secret' });

    const gated = await authedPost(baseUrl, '/api/chat', session.cookieHeader, { message: '@基金 帮我写标书' });
    assert.equal(gated.response.status, 409);
    assert.equal(gated.body.errorCode, 'RUNTIME_REQUIRED');
    assert.match(gated.body.medoplDeepLink, /^https:\/\/medopl\.medopl\.cn/);
    assertNoSensitiveMaterial(gated.body);
  } finally {
    await stopGoServer(child);
  }
});

test('chat conversations are isolated by public account session', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(secureEnv);
  try {
    const userA = await register(baseUrl, 'a@example.com');
    const userB = await register(baseUrl, 'b@example.com');

    await putJSON(baseUrl, '/api/settings/model-provider', userA.cookieHeader, { apiKey: 'sk-user-a-secret' });
    const gated = await authedPost(baseUrl, '/api/chat', userA.cookieHeader, { message: '@论文 生成选题' });
    assert.equal(gated.response.status, 409);
    const conversationId = gated.body.conversationId;

    const listA = await jsonFetch(`${baseUrl}/api/chat/conversations`, {
      headers: { cookie: userA.cookieHeader },
    });
    assert.equal(listA.response.status, 200);
    assert.equal(listA.body.conversations.length, 1);

    const listB = await jsonFetch(`${baseUrl}/api/chat/conversations`, {
      headers: { cookie: userB.cookieHeader },
    });
    assert.equal(listB.response.status, 200);
    assert.deepEqual(listB.body.conversations, []);

    const readB = await jsonFetch(`${baseUrl}/api/chat/conversations/${conversationId}`, {
      headers: { cookie: userB.cookieHeader },
    });
    assert.equal(readB.response.status, 404);
  } finally {
    await stopGoServer(child);
  }
});

test('retired MVP task endpoints are not public routes', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(secureEnv);
  try {
    const task = await fetch(`${baseUrl}/api/mvp/task`, { method: 'POST' });
    assert.equal(task.status, 404);

    const stored = await fetch(`${baseUrl}/api/mvp/tasks/tenant/workspace/task`);
    assert.equal(stored.status, 404);
  } finally {
    await stopGoServer(child);
  }
});

async function register(baseUrl, email) {
  const result = await postJSON(baseUrl, '/api/auth/register', { email, password: 'correct horse battery staple' });
  assert.equal(result.response.status, 201);
  return result;
}

async function authedPost(baseUrl, path, cookie, body) {
  return jsonFetch(`${baseUrl}${path}`, { method: 'POST', headers: { cookie }, body });
}

async function postJSON(baseUrl, path, body) {
  return jsonFetch(`${baseUrl}${path}`, { method: 'POST', body });
}

async function putJSON(baseUrl, path, cookie, body) {
  return jsonFetch(`${baseUrl}${path}`, { method: 'PUT', headers: { cookie }, body });
}

async function jsonFetch(url, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.body) headers['content-type'] = 'application/json';
  const response = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  const cookie = response.headers.get('set-cookie') ?? '';
  return { response, body, cookie, cookieHeader: cookie.split(';')[0] };
}

function assertNoSensitiveMaterial(value) {
  const encoded = JSON.stringify(value);
  assert.doesNotMatch(encoded, /correct horse|sk-user-secret|sk-runtime-gate-secret|passwordHash|encryptedApiKey|rawApiKey/i);
}
