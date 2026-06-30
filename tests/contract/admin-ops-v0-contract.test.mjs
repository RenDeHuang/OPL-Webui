import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { startGoServerWithEnv, stopGoServer } from './go-control-plane-server-helper.mjs';

const secureEnv = {
  OPL_WEBUI_ENV: 'development',
  OPL_SESSION_SECRET: 'test-session-secret-32-bytes-minimum',
  OPL_API_KEY_ENCRYPTION_SECRET: 'test-api-key-secret-32-bytes-min',
  OPL_CHAT_MODEL: 'gpt-5.5',
  OPL_ADMIN_OPERATOR_TOKEN: 'operator-secret-token',
};

test('Admin/Ops v0 contract fixes registration policy and user status boundaries without full SaaS expansion', () => {
  const product = readJson('contracts/web-product-profile.json');
  const pageState = readJson('contracts/web-page-state-matrix.json');
  const release = readJson('contracts/web-release-profile.json');
  const api = readJson('contracts/web-api.openapi.json');

  const adminLayer = product.productLayers.find((layer) => layer.id === 'minimal_admin_ops_layer');
  assert.equal(adminLayer.status, 'partial');
  assert.equal(adminLayer.completedSlices.includes('registration_policy_user_status_v0'), true);
  assert.equal(adminLayer.activeSlice, undefined);
  assert.equal(product.minimalAdminOpsLayerContract.status, 'partial');
  assert.equal(product.minimalAdminOpsLayerContract.completedSlices.includes('registration_policy_user_status_v0'), true);
  assert.equal(product.minimalAdminOpsLayerContract.nextGaps.dogfoodReleaseEvidenceSummary, 'not_started');
  assert.equal(product.minimalAdminOpsLayerContract.uiSurface.hiddenRouteStatus, 'optional_reserved_not_implemented');
  assert.equal(product.minimalAdminOpsLayerContract.opsDiagnosticsPlan.status, 'planned_contract_only');
  assert.deepEqual(product.minimalAdminOpsLayerContract.opsDiagnosticsPlan.surfaces, [
    'health_ready',
    'config_check',
    'medopl_bridge_status',
    'runtime_admission_diagnostic',
    'audit_task_projection_diagnostic',
    'release_evidence_summary',
  ]);
  assert.deepEqual(product.minimalAdminOpsLayerContract.opsDiagnosticsPlan.forbiddenCapabilities, [
    'payment_admin',
    'runtime_resource_admin',
    'storage_admin',
    'artifact_body_viewer',
    'production_mutation_installer',
  ]);
  assert.deepEqual(product.minimalAdminOpsLayerContract.registrationMode.allowed, ['open']);
  assert.deepEqual(product.minimalAdminOpsLayerContract.userStatus.disabledDenies, ['login', 'session_current', 'chat', 'api_key_binding', 'user_product_path']);
  assert.equal(product.minimalAdminOpsLayerContract.operatorAuth.mode, 'operator_token_required');
  assert.equal(product.minimalAdminOpsLayerContract.audit.requiredFor.includes('user_disabled'), true);
  assert.deepEqual(product.minimalAdminOpsLayerContract.doesNotProve, [
    'full SaaS',
    'payment lifecycle',
    'team/RBAC lifecycle',
    'support impersonation',
    'HA',
    'runtime sync',
    'runtime execution',
  ]);

  assert.equal(pageState.minimalAdminOpsLayer.operatorAuth, 'operator_token_required');
  assert.deepEqual(pageState.minimalAdminOpsLayer.apiRoutes, [
    'GET /api/ops/registration-policy',
    'PUT /api/ops/registration-policy',
    'GET /api/ops/users',
    'POST /api/ops/users/{userId}/status',
  ]);
  assert.equal(release.productLayerReadiness.minimalAdminOpsLayer, 'partial');
  assert.equal(release.productLayerReadiness.minimalAdminOpsLayerCompletedSlice, 'registration_policy_user_status_v0');
  assert.equal(release.productLayerReadiness.minimalAdminOpsLayerNextGap, 'dogfood_release_evidence_summary_not_started');
  assert.equal(api['x-product-layers'].minimalAdminOpsLayer.status, 'partial');
  for (const path of ['/api/ops/registration-policy', '/api/ops/users', '/api/ops/users/{userId}/status']) {
    assert.ok(api.paths[path], `missing ${path}`);
  }
});

test('registration policy is public open only and rejects non-open operator modes', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(secureEnv);
  try {
    for (const mode of ['invite_only', 'allowlist', 'disabled']) {
      const policy = await operatorFetch(baseUrl, '/api/ops/registration-policy', {
        method: 'PUT',
        body: { registrationMode: mode },
      });
      assert.equal(policy.response.status, 400);
      assert.equal(policy.body.errorCode, 'INVALID_REGISTRATION_MODE');
      assertNoSensitiveMaterial(policy.body);

      const registration = await postJSON(baseUrl, '/api/auth/register', {
        email: `${mode}@example.com`,
        password: 'x',
      });
      assert.equal(registration.response.status, 201);
      assert.equal(registration.body.email, `${mode}@example.com`);
      assertNoSensitiveMaterial(registration.body);
    }

    const openPolicy = await operatorFetch(baseUrl, '/api/ops/registration-policy', {
      method: 'PUT',
      body: { registrationMode: 'open' },
    });
    assert.equal(openPolicy.response.status, 200);
    assert.equal(openPolicy.body.registrationMode, 'open');
    const openRegistration = await postJSON(baseUrl, '/api/auth/register', {
      email: 'open-user@example.com',
      password: 'x',
    });
    assert.equal(openRegistration.response.status, 201);
  } finally {
    await stopGoServer(child);
  }
});

test('disabled users cannot login use existing session chat API key binding or user product path', async () => {
  const upstream = await startFakeUpstream();
  const { child, baseUrl } = await startGoServerWithEnv({
    ...secureEnv,
    OPL_CHAT_TEST_UPSTREAM_BASE_URL: upstream.baseUrl,
  });
  try {
    const session = await register(baseUrl, 'disabled-user@example.com');
    await putJSON(baseUrl, '/api/settings/model-provider', session.cookieHeader, { apiKey: 'sk-disabled-secret' });

    const disabled = await operatorFetch(baseUrl, `/api/ops/users/${session.body.userId}/status`, {
      method: 'POST',
      body: { userStatus: 'disabled' },
    });
    assert.equal(disabled.response.status, 200);
    assert.equal(disabled.body.userStatus, 'disabled');

    const login = await postJSON(baseUrl, '/api/auth/login', {
      email: 'disabled-user@example.com',
      password: 'correct horse battery staple',
    });
    assert.equal(login.response.status, 423);
    assert.equal(login.body.errorCode, 'USER_DISABLED');

    const current = await jsonFetch(`${baseUrl}/api/session/current`, { headers: { cookie: session.cookieHeader } });
    assert.equal(current.response.status, 423);
    assert.equal(current.body.errorCode, 'USER_DISABLED');

    const chat = await authedPost(baseUrl, '/api/chat', session.cookieHeader, { message: 'hello' });
    assert.equal(chat.response.status, 423);
    assert.equal(chat.body.errorCode, 'USER_DISABLED');

    const provider = await putJSON(baseUrl, '/api/settings/model-provider', session.cookieHeader, { apiKey: 'sk-disabled-new-secret' });
    assert.equal(provider.response.status, 423);
    assert.equal(provider.body.errorCode, 'USER_DISABLED');

    const conversations = await jsonFetch(`${baseUrl}/api/chat/conversations`, { headers: { cookie: session.cookieHeader } });
    assert.equal(conversations.response.status, 423);
    assert.equal(conversations.body.errorCode, 'USER_DISABLED');
    assert.equal(upstream.requests.length, 0);
  } finally {
    await stopGoServer(child);
    await upstream.close();
  }
});

test('operator user reads are token protected and sanitized', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(secureEnv);
  try {
    const session = await register(baseUrl, 'ops-user@example.com');
    await putJSON(baseUrl, '/api/settings/model-provider', session.cookieHeader, { apiKey: 'sk-ops-secret' });

    const unauth = await jsonFetch(`${baseUrl}/api/ops/users`);
    assert.equal(unauth.response.status, 401);
    assert.equal(unauth.body.errorCode, 'OPERATOR_AUTH_REQUIRED');

    const malformedAuth = await jsonFetch(`${baseUrl}/api/ops/users`, { headers: { authorization: secureEnv.OPL_ADMIN_OPERATOR_TOKEN } });
    assert.equal(malformedAuth.response.status, 401);
    assert.equal(malformedAuth.body.errorCode, 'OPERATOR_AUTH_REQUIRED');

    const users = await operatorFetch(baseUrl, '/api/ops/users');
    assert.equal(users.response.status, 200);
    assert.equal(users.body.ok, true);
    assert.equal(users.body.owner, 'OnePersonLabWeb');
    assert.equal(users.body.users.length, 1);
    assert.equal(users.body.users[0].email, 'ops-user@example.com');
    assert.equal(users.body.users[0].userStatus, 'active');
    assert.equal(users.body.users[0].quota.limit, 100);
    assert.equal(users.body.users[0].auditSummary.eventCount >= 2, true);
    assert.deepEqual(users.body.doesNotProve, ['full SaaS', 'payment lifecycle', 'team/RBAC lifecycle', 'HA', 'runtime sync']);
    assertNoSensitiveMaterial(users.body);
  } finally {
    await stopGoServer(child);
  }
});

test('admin enable disable writes sanitized audit events', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(secureEnv);
  try {
    const session = await register(baseUrl, 'audited-user@example.com');
    const disabled = await operatorFetch(baseUrl, `/api/ops/users/${session.body.userId}/status`, {
      method: 'POST',
      body: { userStatus: 'disabled' },
    });
    assert.equal(disabled.response.status, 200);
    assert.deepEqual(Object.keys(disabled.body).sort(), ['auditSummary', 'createdAt', 'email', 'quota', 'tenantId', 'userId', 'userStatus', 'workspaceId']);
    const enabled = await operatorFetch(baseUrl, `/api/ops/users/${session.body.userId}/status`, {
      method: 'POST',
      body: { userStatus: 'active' },
    });
    assert.equal(enabled.response.status, 200);

    const audits = await jsonFetch(`${baseUrl}/api/account/audit-events`, { headers: { cookie: session.cookieHeader } });
    assert.equal(audits.response.status, 200);
    const kinds = audits.body.events.map((event) => event.eventKind);
    assert.equal(kinds.includes('ops.user_disabled'), true);
    assert.equal(kinds.includes('ops.user_enabled'), true);
    assertNoSensitiveMaterial(audits.body);
  } finally {
    await stopGoServer(child);
  }
});

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function register(baseUrl, email) {
  const result = await postJSON(baseUrl, '/api/auth/register', { email, password: 'correct horse battery staple' });
  assert.equal(result.response.status, 201);
  return result;
}

async function operatorFetch(baseUrl, path, options = {}) {
  return jsonFetch(`${baseUrl}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${secureEnv.OPL_ADMIN_OPERATOR_TOKEN}`, ...(options.headers ?? {}) },
  });
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

async function startFakeUpstream() {
  const requests = [];
  const { createServer } = await import('node:http');
  const server = createServer(async (request, response) => {
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

function assertNoSensitiveMaterial(value) {
  const encoded = JSON.stringify(value);
  assert.doesNotMatch(encoded, /correct horse|sk-|passwordHash|encryptedApiKey|rawApiKey|sessionCookie|opl_session|secret|token/i);
}
