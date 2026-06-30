import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { startGoServerWithEnv, stopGoServer } from './go-control-plane-server-helper.mjs';

const secureEnv = {
  OPL_WEBUI_ENV: 'development',
  OPL_SESSION_SECRET: 'test-session-secret-32-bytes-minimum',
  OPL_API_KEY_ENCRYPTION_SECRET: 'test-api-key-secret-32-bytes-min',
  OPL_CHAT_MODEL: 'gpt-5.5',
};

function readApiContract() {
  return JSON.parse(readFileSync('contracts/web-api.openapi.json', 'utf8'));
}

function readRuntimeBridgeContract() {
  return JSON.parse(readFileSync('contracts/web-runtime-bridge.json', 'utf8'));
}

function responseCodes(api, path, method) {
  return Object.keys(api.paths[path][method].responses).sort();
}

test('OpenAPI contract covers implemented status and error-code surfaces', () => {
  const api = readApiContract();

  assert.deepEqual(responseCodes(api, '/api/auth/register', 'post'), ['201', '400', '405', '409', '423', '500', '503']);
  assert.deepEqual(responseCodes(api, '/api/auth/login', 'post'), ['200', '400', '401', '405', '423', '503']);
  assert.deepEqual(responseCodes(api, '/api/auth/logout', 'post'), ['204', '405']);
  assert.deepEqual(responseCodes(api, '/api/session/current', 'get'), ['200', '401', '405', '423']);
  assert.deepEqual(responseCodes(api, '/api/settings/model-provider', 'get'), ['200', '401', '405', '423']);
  assert.deepEqual(responseCodes(api, '/api/settings/model-provider', 'put'), ['200', '400', '401', '405', '423', '500', '503']);
  assert.deepEqual(responseCodes(api, '/api/chat', 'post'), ['200', '400', '401', '404', '405', '409', '423', '429', '502', '503', '504']);
  assert.deepEqual(responseCodes(api, '/api/opl/runtime-gate', 'post'), ['200', '400', '401', '405', '423', '424', '502', '504']);
  assert.deepEqual(responseCodes(api, '/api/opl/runs', 'post'), ['200', '400', '401', '405', '423', '424', '502', '504']);
  assert.deepEqual(responseCodes(api, '/api/chat/conversations', 'get'), ['200', '401', '405', '423']);
  assert.deepEqual(responseCodes(api, '/api/chat/conversations', 'post'), ['201', '400', '401', '405', '423']);
  assert.deepEqual(responseCodes(api, '/api/chat/conversations/{conversationId}', 'get'), ['200', '400', '401', '404', '405', '423']);
  assert.deepEqual(responseCodes(api, '/api/account/audit-events', 'get'), ['200', '401', '405', '423']);
  assert.deepEqual(responseCodes(api, '/api/account/billing-summary', 'get'), ['200', '401', '405', '423']);
  assert.deepEqual(responseCodes(api, '/api/account/commercial-status', 'get'), ['200', '401', '405', '423']);
  assert.deepEqual(responseCodes(api, '/api/ops/registration-policy', 'get'), ['200', '401', '405']);
  assert.deepEqual(responseCodes(api, '/api/ops/registration-policy', 'put'), ['200', '400', '401', '405']);
  assert.deepEqual(responseCodes(api, '/api/ops/users', 'get'), ['200', '401', '405']);
  assert.deepEqual(responseCodes(api, '/api/ops/users/{userId}/status', 'post'), ['200', '400', '401', '404', '405']);
  assert.deepEqual(responseCodes(api, '/api/medopl/runtime/status', 'get'), ['200', '405']);
  assert.deepEqual(responseCodes(api, '/api/medopl/materials-deliverables/projection', 'get'), ['200', '405']);
  assert.deepEqual(responseCodes(api, '/api/opl/snapshot', 'get'), ['200', '405']);
  assert.equal(
    api.paths['/api/account/commercial-status'].get.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/CommercialAccountStatus',
  );
  const commercialSchema = api.components.schemas.CommercialAccountStatus;
  assert.equal(commercialSchema.additionalProperties, false);
  assert.equal(commercialSchema.required.includes('teamReadiness'), true);
  assert.equal(commercialSchema.required.includes('webuiRBACMutation'), true);
  assert.deepEqual(commercialSchema.properties.teamReadiness.properties.state.enum, ['single_user_owner']);
  assert.deepEqual(commercialSchema.properties.teamReadiness.properties.allowedNextActions.items.enum, ['view_medopl_billing']);
  assert.equal(commercialSchema.properties.webuiTeamMutation.const, 'forbidden');
  assert.equal(commercialSchema.properties.webuiInviteMutation.const, 'forbidden');
  assert.equal(commercialSchema.properties.webuiRBACMutation.const, 'forbidden');
  assert.equal(commercialSchema.properties.webuiPaymentMutation.const, 'forbidden');
  assert.equal(commercialSchema.properties.webuiBillingSourceOfTruth.const, 'forbidden');

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
    'REGISTRATION_CLOSED',
    'USER_DISABLED',
    'OPERATOR_AUTH_REQUIRED',
    'INVALID_REGISTRATION_MODE',
    'INVALID_USER_STATUS',
    'USER_NOT_FOUND',
    'API_KEY_SECRET_REQUIRED',
    'INVALID_API_KEY',
    'API_KEY_SAVE_FAILED',
    'INVALID_CHAT_MESSAGE',
    'INVALID_CONVERSATION_ID',
    'CONVERSATION_NOT_FOUND',
    'API_KEY_REQUIRED',
    'API_KEY_DECRYPT_FAILED',
    'RUNTIME_REQUIRED',
    'RUNTIME_GATE_BLOCKED',
    'MEDOPL_ENDPOINT_REQUIRED',
    'MEDOPL_UPSTREAM_FAILED',
    'CHAT_QUOTA_EXCEEDED',
    'UPSTREAM_CHAT_FAILED',
  ]) {
    assert.ok(errorCodes.includes(code), `missing ApiErrorCode: ${code}`);
  }
});

test('one-person-lab-web auth supports register login logout and safe current session', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(secureEnv);
  try {
    const registered = await postJSON(baseUrl, '/api/auth/register', { email: 'user@example.com', password: 'x' });
    assert.equal(registered.response.status, 201);
    assert.match(registered.cookie, /opl_session=/);
    assert.equal(registered.body.email, 'user@example.com');
    assert.ok(registered.body.tenantId);
    assert.ok(registered.body.workspaceId);
    assertNoSensitiveMaterial(registered.body);

    const duplicate = await postJSON(baseUrl, '/api/auth/register', { email: 'user@example.com', password: 'x' });
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.body.errorCode, 'EMAIL_ALREADY_REGISTERED');

    const wrong = await postJSON(baseUrl, '/api/auth/login', { email: 'user@example.com', password: 'wrong password' });
    assert.equal(wrong.response.status, 401);
    assert.equal(wrong.body.errorCode, 'INVALID_CREDENTIALS');

    const loggedIn = await postJSON(baseUrl, '/api/auth/login', { email: 'user@example.com', password: 'x' });
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

test('registration accepts any non-empty password and rejects invalid email shape', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(secureEnv);
  try {
    for (const [email, password] of [
      ['short-password@example.com', 'x'],
      ['symbol-password@example.com', '!'],
      ['space-password@example.com', ' pass phrase '],
    ]) {
      const registered = await postJSON(baseUrl, '/api/auth/register', { email, password });
      assert.equal(registered.response.status, 201);
      assert.equal(registered.body.email, email);

      const loggedIn = await postJSON(baseUrl, '/api/auth/login', { email, password });
      assert.equal(loggedIn.response.status, 200);
      assert.match(loggedIn.cookie, /opl_session=/);
      assertNoSensitiveMaterial(loggedIn.body);
    }

    for (const email of ['plain', '@example.com', 'user@', 'user@example', 'user@@example.com']) {
      const invalid = await postJSON(baseUrl, '/api/auth/register', { email, password: 'x' });
      assert.equal(invalid.response.status, 400);
      assert.equal(invalid.body.errorCode, 'INVALID_CREDENTIALS_INPUT');
      assertNoSensitiveMaterial(invalid.body);
    }

    const emptyPassword = await postJSON(baseUrl, '/api/auth/register', { email: 'empty-password@example.com', password: '' });
    assert.equal(emptyPassword.response.status, 400);
    assert.equal(emptyPassword.body.errorCode, 'INVALID_CREDENTIALS_INPUT');
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
    assert.equal(saved.body.model, 'gpt-5.5');
    assert.equal(saved.body.modelConfigSource, 'OPL_CHAT_MODEL');
    assert.equal(saved.body.apiKeyConfigured, true);
    assert.match(saved.body.maskedKey, /^sk-\*\*\*/);
    assertNoSensitiveMaterial(saved.body);

    const loaded = await jsonFetch(`${baseUrl}/api/settings/model-provider`, {
      headers: { cookie: session.cookieHeader },
    });
    assert.equal(loaded.response.status, 200);
    assert.equal(loaded.body.baseUrl, 'https://gflabtoken.cn/v1');
    assert.equal(loaded.body.model, 'gpt-5.5');
    assert.equal(loaded.body.modelConfigSource, 'OPL_CHAT_MODEL');
    assert.equal(loaded.body.maskedKey, saved.body.maskedKey);
    assertNoSensitiveMaterial(loaded.body);
  } finally {
    await stopGoServer(child);
  }
});

test('MedOPL runtime status endpoint is readonly and sanitized', async () => {
  const { child, baseUrl } = await startGoServerWithEnv({
    ...secureEnv,
    MEDOPL_RUNTIME_STATE: 'ready',
    MEDOPL_RUNTIME_REF: 'runtime_public_ref_123',
    MEDOPL_RUNTIME_ACTIVE_RUNS: '2',
  });
  try {
    const status = await jsonFetch(`${baseUrl}/api/medopl/runtime/status`);
    assert.equal(status.response.status, 200);
    assert.equal(status.body.ok, true);
    assert.equal(status.body.owner, 'MedOPL');
    assert.equal(status.body.state, 'ready');
    assert.equal(status.body.deepLink, 'https://medopl.medopl.cn/runtime');
    assert.equal(status.body.refs.runtimeRef, 'runtime_public_ref_123');
    assert.equal(status.body.counts.activeRuns, 2);
    assert.equal(status.body.webuiRuntimeExecution, 'forbidden');
    assertNoSensitiveMaterial(status.body);

    const post = await fetch(`${baseUrl}/api/medopl/runtime/status`, { method: 'POST' });
    assert.equal(post.status, 405);
  } finally {
    await stopGoServer(child);
  }
});

test('materials deliverables endpoint is readonly and sanitized', async () => {
  const { child, baseUrl } = await startGoServerWithEnv({
    ...secureEnv,
    MEDOPL_MATERIAL_REF: 'material_public_ref_123',
    MEDOPL_DELIVERABLE_REF: 'deliverable_public_ref_456',
  });
  try {
    const projection = await jsonFetch(`${baseUrl}/api/medopl/materials-deliverables/projection`);
    assert.equal(projection.response.status, 200);
    assert.equal(projection.body.ok, true);
    assert.equal(projection.body.owner, 'MedOPL');
    assert.equal(projection.body.deepLink, 'https://medopl.medopl.cn/materials');
    assert.deepEqual(projection.body.materials, [{
      materialId: 'material_public_ref_123',
      title: 'Linked material',
      kind: 'reference',
      status: 'ready',
    }]);
    assert.deepEqual(projection.body.deliverables, [{
      deliverableId: 'deliverable_public_ref_456',
      title: 'Linked deliverable',
      kind: 'artifact_ref',
      status: 'draft',
      ref: 'deliverable_public_ref_456',
    }]);
    assert.equal(projection.body.webuiStorageMutation, 'forbidden');
    assert.equal(projection.body.webuiArtifactBody, 'forbidden');
    assertNoSensitiveMaterial(projection.body);
    assert.doesNotMatch(JSON.stringify(projection.body), /artifact_body|blob|private_state_path|raw_path|secret|token|password/i);

    const post = await fetch(`${baseUrl}/api/medopl/materials-deliverables/projection`, { method: 'POST' });
    assert.equal(post.status, 405);
  } finally {
    await stopGoServer(child);
  }
});

test('billing summary endpoint is authenticated readonly projection', async () => {
  const upstream = await startFakeUpstream();
  const { child, baseUrl } = await startGoServerWithEnv({
    ...secureEnv,
    OPL_CHAT_TEST_UPSTREAM_BASE_URL: upstream.baseUrl,
    OPL_CHAT_MONTHLY_QUOTA: '3',
  });
  try {
    const unauth = await jsonFetch(`${baseUrl}/api/account/billing-summary`);
    assert.equal(unauth.response.status, 401);
    assert.equal(unauth.body.errorCode, 'AUTH_REQUIRED');

    const session = await register(baseUrl, 'billing-user@example.com');
    await putJSON(baseUrl, '/api/settings/model-provider', session.cookieHeader, { apiKey: 'sk-billing-secret' });
    const gated = await authedPost(baseUrl, '/api/chat', session.cookieHeader, { message: '@基金 写申请书' });
    assert.equal(gated.response.status, 409);
    const ordinary = await authedPost(baseUrl, '/api/chat', session.cookieHeader, { message: '普通 billing usage check' });
    assert.equal(ordinary.response.status, 200);
    assert.equal(upstream.requests.length, 1);

    const summary = await jsonFetch(`${baseUrl}/api/account/billing-summary`, {
      headers: { cookie: session.cookieHeader },
    });
    assert.equal(summary.response.status, 200);
    assert.equal(summary.body.ok, true);
    assert.equal(summary.body.owner, 'MedOPL');
    assert.equal(summary.body.deepLink, 'https://medopl.medopl.cn/billing');
    assert.equal(summary.body.quota.limit, 3);
    assert.equal(summary.body.quota.used, 1);
    assert.equal(summary.body.quota.remaining, 2);
    assert.equal(summary.body.audit.eventCount >= 2, true);
    assert.equal(typeof summary.body.audit.latestEventKind, 'string');
    assert.equal(summary.body.webuiBillingSourceOfTruth, 'forbidden');
    assert.equal(summary.body.webuiPaymentMutation, 'forbidden');
    assertNoSensitiveMaterial(summary.body);
    assert.doesNotMatch(JSON.stringify(summary.body), /rawApiKey|encryptedApiKey|paymentToken|ledger|invoiceBody|rawMetadata|private_state_path/i);

    const post = await fetch(`${baseUrl}/api/account/billing-summary`, { method: 'POST', headers: { cookie: session.cookieHeader } });
    assert.equal(post.status, 405);
  } finally {
    await stopGoServer(child);
    await upstream.close();
  }
});

test('commercial account lifecycle endpoint is authenticated readonly projection', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(secureEnv);
  try {
    const unauth = await jsonFetch(`${baseUrl}/api/account/commercial-status`);
    assert.equal(unauth.response.status, 401);
    assert.equal(unauth.body.errorCode, 'AUTH_REQUIRED');

    const session = await register(baseUrl, 'commercial-user@example.com');
    const status = await jsonFetch(`${baseUrl}/api/account/commercial-status`, {
      headers: { cookie: session.cookieHeader },
    });
    assert.equal(status.response.status, 200);
    assert.equal(status.body.ok, true);
    assert.equal(status.body.owner, 'OnePersonLabWeb');
    assert.equal(status.body.productId, 'one-person-lab-web');
    assert.equal(status.body.accountType, 'personal');
    assert.equal(status.body.lifecycleState, 'active');
    assert.equal(status.body.tenantId, session.body.tenantId);
    assert.equal(status.body.tenantRole, 'owner');
    assert.equal(status.body.teamReadiness.state, 'single_user_owner');
    assert.equal(status.body.teamReadiness.owner, 'OnePersonLabWeb');
    assert.equal(status.body.teamReadiness.consumer, 'settings_lifecycle_summary');
    assert.deepEqual(status.body.teamReadiness.allowedNextActions, ['view_medopl_billing']);
    assert.equal(status.body.webuiTeamMutation, 'forbidden');
    assert.equal(status.body.webuiInviteMutation, 'forbidden');
    assert.equal(status.body.webuiRBACMutation, 'forbidden');
    assert.equal(status.body.webuiPaymentMutation, 'forbidden');
    assert.equal(status.body.webuiBillingSourceOfTruth, 'forbidden');
    assertNoSensitiveMaterial(status.body);
    assert.doesNotMatch(JSON.stringify(status.body), /workspaceId|passwordHash|rawApiKey|encryptedApiKey|nodePool|storage|runtimeRef|paymentToken|invoiceBody|subscription|price/i);

    const post = await fetch(`${baseUrl}/api/account/commercial-status`, { method: 'POST', headers: { cookie: session.cookieHeader } });
    assert.equal(post.status, 405);
  } finally {
    await stopGoServer(child);
  }
});

test('chat API requires auth and user API key, rejects client base_url override, and gates OPL runtime abilities', async () => {
  const upstream = await startFakeUpstream();
  const { child, baseUrl } = await startGoServerWithEnv({
    ...secureEnv,
    OPL_CHAT_TEST_UPSTREAM_BASE_URL: upstream.baseUrl,
  });
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

    const runtimeBridge = readRuntimeBridgeContract();
    for (const marker of runtimeBridge.runtimeRequiredMarkers) {
      const gated = await authedPost(baseUrl, '/api/chat', session.cookieHeader, { message: `${marker} 帮我推进研究任务` });
      assert.equal(gated.response.status, 409, `${marker} must stop at MedOPL runtime gate`);
      assert.equal(gated.body.errorCode, 'RUNTIME_REQUIRED');
      assert.match(gated.body.medoplDeepLink, /^https:\/\/medopl\.medopl\.cn/);
      assertNoSensitiveMaterial(gated.body);
    }

    const uncontractedAtMention = await authedPost(baseUrl, '/api/chat', session.cookieHeader, { message: '@RCA 规划可视化交付方案' });
    assert.equal(uncontractedAtMention.response.status, 200);
    assert.equal(upstream.requests.length, 1);
    assert.equal(upstream.requests[0].url, '/v1/responses');
    assert.equal(upstream.requests[0].body.input, '@RCA 规划可视化交付方案');

    const retiredRuntimeMarker = await authedPost(baseUrl, '/api/chat', session.cookieHeader, { message: '@长任务 规划一个普通研究排期' });
    assert.equal(retiredRuntimeMarker.response.status, 200);
    assert.equal(upstream.requests.length, 2);
    assert.equal(upstream.requests[1].body.input, '@长任务 规划一个普通研究排期');
  } finally {
    await stopGoServer(child);
    await upstream.close();
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

test('new chat creates a durable draft conversation before the first message', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(secureEnv);
  try {
    const session = await register(baseUrl, 'draft-chat@example.com');

    const created = await authedPost(baseUrl, '/api/chat/conversations', session.cookieHeader, { title: '' });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.ok, true);
    assert.match(created.body.conversation.conversationId, /^conv_/);
    assert.equal(created.body.conversation.title, '新聊天');
    assert.equal(created.body.conversation.status, 'draft');
    assertNoSensitiveMaterial(created.body);

    const list = await jsonFetch(`${baseUrl}/api/chat/conversations`, {
      headers: { cookie: session.cookieHeader },
    });
    assert.equal(list.response.status, 200);
    assert.equal(list.body.conversations.length, 1);
    assert.equal(list.body.conversations[0].conversationId, created.body.conversation.conversationId);
    assert.equal(list.body.conversations[0].status, 'draft');

    const read = await jsonFetch(`${baseUrl}/api/chat/conversations/${created.body.conversation.conversationId}`, {
      headers: { cookie: session.cookieHeader },
    });
    assert.equal(read.response.status, 200);
    assert.equal(read.body.conversation.status, 'draft');
    assert.deepEqual(read.body.messages, []);
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

async function startFakeUpstream() {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    requests.push({
      url: request.url,
      authorization: request.headers.authorization,
      body: raw ? JSON.parse(raw) : {},
    });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ output_text: '上游响应' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
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
  assert.doesNotMatch(encoded, /correct horse|sk-user-secret|sk-runtime-gate-secret|sk-billing-secret|passwordHash|encryptedApiKey|rawApiKey/i);
}
