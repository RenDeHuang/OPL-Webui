import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import { startGoServerWithEnv, stopGoServer } from './go-control-plane-server-helper.mjs';

const secureEnv = {
  OPL_WEBUI_ENV: 'development',
  OPL_SESSION_SECRET: 'test-session-secret-32-bytes-minimum',
  OPL_API_KEY_ENCRYPTION_SECRET: 'test-api-key-secret-32-bytes-min',
  OPL_CHAT_MODEL: 'gpt-4o-mini',
};

test('dogfood e2e readiness covers auth key binding chat quota audit and runtime gate', async () => {
  const upstream = await startFakeUpstream();
  const { child, baseUrl } = await startGoServerWithEnv({
    ...secureEnv,
    OPL_CHAT_TEST_UPSTREAM_BASE_URL: upstream.baseUrl,
    OPL_CHAT_MONTHLY_QUOTA: '1',
  });
  try {
    const registered = await register(baseUrl, 'dogfood-user@example.com');
    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: registered.cookieHeader },
    });
    assert.equal(logout.status, 204);

    const loggedIn = await jsonFetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: { email: 'dogfood-user@example.com', password: 'correct horse battery staple' },
    });
    assert.equal(loggedIn.response.status, 200);
    assert.match(loggedIn.cookieHeader, /^opl_session=/);

    const current = await jsonFetch(`${baseUrl}/api/session/current`, {
      headers: { cookie: loggedIn.cookieHeader },
    });
    assert.equal(current.response.status, 200);
    assert.equal(current.body.email, 'dogfood-user@example.com');

    const saved = await jsonFetch(`${baseUrl}/api/settings/model-provider`, {
      method: 'PUT',
      headers: { cookie: loggedIn.cookieHeader },
      body: { apiKey: 'sk-dogfood-secret' },
    });
    assert.equal(saved.response.status, 200);
    assert.equal(saved.body.baseUrl, 'https://gflabtoken.cn/v1');
    assert.equal(saved.body.apiKeyConfigured, true);
    assert.doesNotMatch(JSON.stringify(saved.body), /sk-dogfood-secret/);

    const firstChat = await jsonFetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { cookie: loggedIn.cookieHeader },
      body: { message: '@科研 普通 dogfood 聊天' },
    });
    assert.equal(firstChat.response.status, 200);
    assert.equal(firstChat.body.assistantMessage.content, '上游响应');
    assert.equal(upstream.requests.length, 1);
    assert.equal(upstream.requests[0].authorization, 'Bearer sk-dogfood-secret');

    const overQuota = await jsonFetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { cookie: loggedIn.cookieHeader },
      body: { message: '第二次普通 dogfood 聊天' },
    });
    assert.equal(overQuota.response.status, 429);
    assert.equal(overQuota.body.errorCode, 'CHAT_QUOTA_EXCEEDED');
    assert.equal(upstream.requests.length, 1);

    const gated = await jsonFetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { cookie: loggedIn.cookieHeader },
      body: { message: '@基金 检查 MedOPL runtime gate' },
    });
    assert.equal(gated.response.status, 409);
    assert.equal(gated.body.errorCode, 'RUNTIME_REQUIRED');
    assert.match(gated.body.medoplDeepLink, /^https:\/\/medopl\.medopl\.cn/);
    assert.equal(upstream.requests.length, 1);

    const audit = await jsonFetch(`${baseUrl}/api/account/audit-events`, {
      headers: { cookie: loggedIn.cookieHeader },
    });
    assert.equal(audit.response.status, 200);
    assert.deepEqual(new Set(audit.body.events.map((event) => event.eventKind)), new Set([
      'account.registered', 'account.login', 'api_key.saved',
      'chat.completed', 'chat.quota_exceeded', 'runtime_gate.required',
    ]));
    assertNoSensitiveMaterial(audit.body);
  } finally {
    await stopGoServer(child);
    await upstream.close();
  }
});

test('upstream chat failures return sanitized diagnostics for production dogfood', async () => {
  const upstream = await startFakeUpstream({ status: 401, body: { error: { type: 'invalid_api_key', message: 'bad key' } } });
  const { child, baseUrl } = await startGoServerWithEnv({
    ...secureEnv,
    OPL_CHAT_TEST_UPSTREAM_BASE_URL: upstream.baseUrl,
  });
  try {
    const session = await register(baseUrl, 'upstream-failure-user@example.com');
    await jsonFetch(`${baseUrl}/api/settings/model-provider`, {
      method: 'PUT',
      headers: { cookie: session.cookieHeader },
      body: { apiKey: 'sk-user-upstream-secret' },
    });

    const chat = await jsonFetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { cookie: session.cookieHeader },
      body: { message: '@科研 触发上游错误诊断' },
    });

    assert.equal(chat.response.status, 502);
    assert.equal(chat.body.errorCode, 'UPSTREAM_CHAT_FAILED');
    assert.equal(chat.body.upstream.status, 401);
    assert.equal(chat.body.upstream.host, '127.0.0.1');
    assert.equal(chat.body.upstream.model, 'gpt-4o-mini');
    assert.equal(chat.body.upstream.kind, 'http_status');
    assertNoSensitiveMaterial(chat.body);
    assert.doesNotMatch(JSON.stringify(chat.body), /invalid_api_key|bad key|sk-user-upstream-secret/i);

    const audit = await jsonFetch(`${baseUrl}/api/account/audit-events`, {
      headers: { cookie: session.cookieHeader },
    });
    const failed = audit.body.events.find((event) => event.eventKind === 'chat.upstream_failed');
    assert.equal(failed.metadata.upstreamStatus, '401');
    assert.equal(failed.metadata.upstreamHost, '127.0.0.1');
    assert.equal(failed.metadata.upstreamModel, 'gpt-4o-mini');
    assert.equal(failed.metadata.upstreamKind, 'http_status');
    assertNoSensitiveMaterial(audit.body);
    assert.doesNotMatch(JSON.stringify(audit.body), /invalid_api_key|bad key|sk-user-upstream-secret/i);
  } finally {
    await stopGoServer(child);
    await upstream.close();
  }
});

test('ordinary chat calls OpenAI-compatible upstream with the user API key', async () => {
  const upstream = await startFakeUpstream();
  const { child, baseUrl } = await startGoServerWithEnv({
    ...secureEnv,
    OPL_CHAT_TEST_UPSTREAM_BASE_URL: upstream.baseUrl,
  });
  try {
    const session = await register(baseUrl);
    await jsonFetch(`${baseUrl}/api/settings/model-provider`, {
      method: 'PUT',
      headers: { cookie: session.cookieHeader },
      body: { apiKey: 'sk-user-upstream-secret' },
    });

    const chat = await jsonFetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { cookie: session.cookieHeader },
      body: { message: '你好，帮我总结 OPL 是什么' },
    });

    assert.equal(chat.response.status, 200);
    assert.equal(chat.body.assistantMessage.content, '上游响应');
    assert.equal(upstream.requests.length, 1);
    assert.equal(upstream.requests[0].url, '/v1/chat/completions');
    assert.equal(upstream.requests[0].authorization, 'Bearer sk-user-upstream-secret');
    assert.equal(upstream.requests[0].body.model, 'gpt-4o-mini');
    assert.equal(upstream.requests[0].body.messages[0].content, '你好，帮我总结 OPL 是什么');
    assert.doesNotMatch(JSON.stringify(chat.body), /sk-user-upstream-secret|base_url/i);
  } finally {
    await stopGoServer(child);
    await upstream.close();
  }
});

test('ordinary chat quota guard fails closed and writes sanitized audit events', async () => {
  const upstream = await startFakeUpstream();
  const { child, baseUrl } = await startGoServerWithEnv({
    ...secureEnv,
    OPL_CHAT_TEST_UPSTREAM_BASE_URL: upstream.baseUrl,
    OPL_CHAT_MONTHLY_QUOTA: '1',
  });
  try {
    const session = await register(baseUrl, 'guard-user@example.com');
    await jsonFetch(`${baseUrl}/api/settings/model-provider`, {
      method: 'PUT',
      headers: { cookie: session.cookieHeader },
      body: { apiKey: 'sk-user-upstream-secret' },
    });

    const gated = await jsonFetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { cookie: session.cookieHeader },
      body: { message: '@基金 先检查运行时' },
    });
    assert.equal(gated.response.status, 409);
    assert.equal(gated.body.errorCode, 'RUNTIME_REQUIRED');

    const firstChat = await jsonFetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { cookie: session.cookieHeader },
      body: { message: '普通聊天应该还能发送' },
    });
    assert.equal(firstChat.response.status, 200);

    const overQuota = await jsonFetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { cookie: session.cookieHeader },
      body: { message: '第二次普通聊天应被最小 abuse guard 拦截' },
    });
    assert.equal(overQuota.response.status, 429);
    assert.equal(overQuota.body.errorCode, 'CHAT_QUOTA_EXCEEDED');
    assert.equal(upstream.requests.length, 1);

    const audit = await jsonFetch(`${baseUrl}/api/account/audit-events`, {
      headers: { cookie: session.cookieHeader },
    });
    assert.equal(audit.response.status, 200);
    const eventKinds = audit.body.events.map((event) => event.eventKind);
    for (const eventKind of [
      'account.registered',
      'api_key.saved',
      'runtime_gate.required',
      'chat.completed',
      'chat.quota_exceeded',
    ]) {
      assert.ok(eventKinds.includes(eventKind), `missing audit event ${eventKind}: ${eventKinds.join(',')}`);
    }
    assert.doesNotMatch(JSON.stringify(audit.body), /sk-user-upstream-secret|correct horse|password|secret|postgres:\/\//i);
  } finally {
    await stopGoServer(child);
    await upstream.close();
  }
});

async function startFakeUpstream(options = {}) {
  const status = options.status ?? 200;
  const body = options.body ?? { choices: [{ message: { content: '上游响应' } }] };
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    requests.push({
      url: request.url,
      authorization: request.headers.authorization,
      body: raw ? JSON.parse(raw) : {},
    });
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function register(baseUrl, email = 'upstream-user@example.com') {
  const result = await jsonFetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    body: { email, password: 'correct horse battery staple' },
  });
  assert.equal(result.response.status, 201);
  return result;
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
  return { response, body, cookieHeader: cookie.split(';')[0] };
}

function assertNoSensitiveMaterial(value) {
  assert.doesNotMatch(JSON.stringify(value), /sk-dogfood-secret|correct horse|password|secret|postgres:\/\//i);
}
