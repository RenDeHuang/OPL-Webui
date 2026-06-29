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
  OPL_ADMIN_OPERATOR_TOKEN: 'operator-secret-token',
};

test('task history contract fixes refs-only continuation shape and cannot-claim boundary', () => {
  const product = readJson('contracts/web-product-profile.json');
  const pageState = readJson('contracts/web-page-state-matrix.json');
  const api = readJson('contracts/web-api.openapi.json');
  const postgresSchema = readFileSync('backend/control-plane-go/internal/webapp/postgres.go', 'utf8');

  assert.equal(product.taskHistoryContinuationCenter.slice, 'task_history_deliverable_continuation_center_v0');
  assert.equal(product.taskHistoryContinuationCenter.ownerSurface, 'account_based_user_product_layer');
  assert.deepEqual(product.taskHistoryContinuationCenter.apiDataPath, ['GET /api/tasks', 'GET /api/tasks/{taskId}']);
  assert.equal(product.taskHistoryContinuationCenter.storagePolicy.mode, 'refs_status_metadata_only');
  assert.equal(product.taskHistoryContinuationCenter.storagePolicy.postgresPathRequired, true);
  assert.equal(product.taskHistoryContinuationCenter.storagePolicy.tenantUserIsolationRequired, true);
  assert.equal(product.taskHistoryContinuationCenter.storagePolicy.disabledUserDenied, true);
  assert.deepEqual(product.taskHistoryContinuationCenter.doesNotProve, [
    'runtime execution',
    'artifact body authority',
    'storage truth',
    'payment lifecycle',
    'team/RBAC lifecycle',
    'production rollout',
  ]);

  assert.equal(pageState.taskHistoryContinuationCenter.route, 'projects');
  assert.equal(pageState.taskHistoryContinuationCenter.surface, 'project_window_continuation_center_projection');
  assert.equal(pageState.taskHistoryContinuationCenter.visibleBusinessName, '项目 / 窗口');
  assert.equal(pageState.taskHistoryContinuationCenter.legacyBusinessNameRetiredFromPrimaryUi, true);
  assert.equal(pageState.taskHistoryContinuationCenter.disabledUserPolicy, 'deny_with_USER_DISABLED');
  assert.ok(pageState.taskHistoryContinuationCenter.requiredStates.includes('project_window_continue'));
  assert.ok(pageState.taskHistoryContinuationCenter.requiredFields.includes('deliverableRefs'));

  assert.deepEqual(responseCodes(api, '/api/tasks', 'get'), ['200', '401', '405', '423']);
  assert.deepEqual(responseCodes(api, '/api/tasks/{taskId}', 'get'), ['200', '400', '401', '404', '405', '423']);
  assert.equal(api.paths['/api/tasks'].get.responses['200'].content['application/json'].schema.$ref, '#/components/schemas/TaskHistoryList');
  assert.equal(api.paths['/api/tasks/{taskId}'].get.responses['200'].content['application/json'].schema.$ref, '#/components/schemas/TaskHistoryDetail');
  assert.equal(api.components.schemas.TaskHistoryItem.additionalProperties, false);
  for (const forbidden of product.taskHistoryContinuationCenter.forbiddenFields) {
    assert.equal(api.components.schemas.TaskHistoryItem.properties[forbidden], undefined, `forbidden task field must not be in OpenAPI schema: ${forbidden}`);
  }
  assert.match(postgresSchema, /webapp_task_history/);
  assert.doesNotMatch(postgresSchema, retiredStorePattern());
});

test('task list and detail are isolated refs-only projections for the current user', async () => {
  const medopl = await startMedOPLContractFixture({
    runResult: {
      ok: true,
      status: 'running',
      statusUrl: 'https://medopl.medopl.cn/runs/run_history_1',
      run: { runId: 'run_history_1', runtimeBindingId: 'runtime_binding_history', workspaceBindingId: 'workspace_binding_history' },
      artifactRef: 'artifact_history_ref_1',
      artifacts: [{ artifactRef: 'artifact_history_ref_1', kind: 'paper_plan', title: 'Paper plan ref', status: 'draft' }],
      progress: [{ stage: 'queued', state: 'done', title: 'Queued' }, { stage: 'running', state: 'active', title: 'Running' }],
      deliverables: [{ deliverableId: 'deliverable_history_ref_1', artifactRef: 'artifact_history_ref_1', status: 'draft', title: 'Plan ref' }],
      artifactBody: 'must not leak',
      signedUrl: 'https://object-store.invalid/signed',
      objectKey: 'private/object/key',
      domainVerdict: 'must remain outside Web',
    },
  });
  const { child, baseUrl } = await startGoServerWithEnv({ ...secureEnv, MEDOPL_API_BASE_URL: medopl.baseUrl });
  try {
    const userA = await register(baseUrl, 'task-history-a@example.com');
    const userB = await register(baseUrl, 'task-history-b@example.com');
    await saveAPIKey(baseUrl, userA.cookieHeader, 'sk-task-history-a-secret');

    const run = await jsonFetch(`${baseUrl}/api/opl/runs`, {
      method: 'POST',
      headers: { cookie: userA.cookieHeader },
      body: {
        taskIntent: 'paper_question',
        marker: '@论文',
        prompt: '@论文 生成选题',
        conversationId: 'conv_history_1',
        gateRefs: {
          runtimeRef: 'runtime_ref_history',
          storageRef: 'storage_ref_history',
          fileRefs: ['material_ref_history_1'],
        },
      },
    });
    assert.equal(run.response.status, 200);

    const listA = await jsonFetch(`${baseUrl}/api/tasks`, { headers: { cookie: userA.cookieHeader } });
    assert.equal(listA.response.status, 200);
    assert.equal(listA.body.ok, true);
    assert.equal(listA.body.owner, 'OnePersonLabWeb');
    assert.equal(listA.body.projection, 'refs_status_metadata_only');
    assert.equal(listA.body.tasks.length, 1);
    assert.equal(listA.body.tasks[0].taskType, 'paper_question');
    assert.equal(listA.body.tasks[0].marker, '@论文');
    assert.equal(listA.body.tasks[0].status, 'running');
    assert.equal(listA.body.tasks[0].progressRefs[1].ref, 'running');
    assert.equal(listA.body.tasks[0].deliverableRefs[0].ref, 'deliverable_history_ref_1');
    assert.equal(listA.body.tasks[0].materialRefs[0].ref, 'material_ref_history_1');
    assert.equal(listA.body.tasks[0].allowedNextActions[0].id, 'continue_in_medopl');
    assert.match(listA.body.tasks[0].deeplink, /^https:\/\/medopl\.medopl\.cn\/runs\/run_history_1/);
    assert.equal(listA.body.webuiArtifactBody, 'forbidden');
    assert.equal(listA.body.webuiStorageTruth, 'forbidden');
    assertNoSensitiveMaterial(listA.body);
    assertNoArtifactBody(listA.body);

    const taskId = listA.body.tasks[0].taskId;
    const detailA = await jsonFetch(`${baseUrl}/api/tasks/${taskId}`, { headers: { cookie: userA.cookieHeader } });
    assert.equal(detailA.response.status, 200);
    assert.equal(detailA.body.task.taskId, taskId);
    assert.equal(detailA.body.task.deliverableRefs[0].ref, 'deliverable_history_ref_1');
    assertNoArtifactBody(detailA.body);

    const listB = await jsonFetch(`${baseUrl}/api/tasks`, { headers: { cookie: userB.cookieHeader } });
    assert.equal(listB.response.status, 200);
    assert.deepEqual(listB.body.tasks, []);

    const detailB = await jsonFetch(`${baseUrl}/api/tasks/${taskId}`, { headers: { cookie: userB.cookieHeader } });
    assert.equal(detailB.response.status, 404);
    assert.equal(detailB.body.errorCode, 'TASK_NOT_FOUND');
  } finally {
    await stopGoServer(child);
    await medopl.close();
  }
});

test('blocked runtime gate records blocker next step without treating endpoint or artifact body as product truth', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(secureEnv);
  try {
    const session = await register(baseUrl, 'task-history-blocked@example.com');
    await saveAPIKey(baseUrl, session.cookieHeader, 'sk-task-history-blocked-secret');
    const gate = await jsonFetch(`${baseUrl}/api/opl/runtime-gate`, {
      method: 'POST',
      headers: { cookie: session.cookieHeader },
      body: { taskIntent: 'grant_plan', marker: '@基金', prompt: '@基金 帮我拆解标书结构' },
    });
    assert.equal(gate.response.status, 424);
    assert.equal(gate.body.errorCode, 'MEDOPL_ENDPOINT_REQUIRED');

    const list = await jsonFetch(`${baseUrl}/api/tasks`, { headers: { cookie: session.cookieHeader } });
    assert.equal(list.response.status, 200);
    assert.equal(list.body.tasks.length, 1);
    assert.equal(list.body.tasks[0].status, 'blocked');
    assert.equal(list.body.tasks[0].blocker.kind, 'medopl_endpoint_required');
    assert.equal(list.body.tasks[0].nextStep, 'configure_medopl_endpoint');
    assert.equal(list.body.tasks[0].allowedNextActions[0].id, 'configure_medopl_endpoint');
    assertNoArtifactBody(list.body);
  } finally {
    await stopGoServer(child);
  }
});

test('disabled users cannot read task history list or detail', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(secureEnv);
  try {
    const session = await register(baseUrl, 'task-history-disabled@example.com');
    await saveAPIKey(baseUrl, session.cookieHeader, 'sk-task-history-disabled-secret');
    await jsonFetch(`${baseUrl}/api/opl/runtime-gate`, {
      method: 'POST',
      headers: { cookie: session.cookieHeader },
      body: { taskIntent: 'grant_plan', marker: '@基金', prompt: '@基金 帮我拆解标书结构' },
    });
    const list = await jsonFetch(`${baseUrl}/api/tasks`, { headers: { cookie: session.cookieHeader } });
    assert.equal(list.response.status, 200);
    const taskId = list.body.tasks[0].taskId;

    const disabled = await operatorFetch(baseUrl, `/api/ops/users/${session.body.userId}/status`, {
      method: 'POST',
      body: { userStatus: 'disabled' },
    });
    assert.equal(disabled.response.status, 200);

    const deniedList = await jsonFetch(`${baseUrl}/api/tasks`, { headers: { cookie: session.cookieHeader } });
    assert.equal(deniedList.response.status, 423);
    assert.equal(deniedList.body.errorCode, 'USER_DISABLED');

    const deniedDetail = await jsonFetch(`${baseUrl}/api/tasks/${taskId}`, { headers: { cookie: session.cookieHeader } });
    assert.equal(deniedDetail.response.status, 423);
    assert.equal(deniedDetail.body.errorCode, 'USER_DISABLED');
  } finally {
    await stopGoServer(child);
  }
});

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function responseCodes(api, path, method) {
  return Object.keys(api.paths[path][method].responses).sort();
}

async function startMedOPLContractFixture(options = {}) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    requests.push({ method: request.method, path: request.url, body: raw ? JSON.parse(raw) : {} });
    if (request.url.startsWith('/api/opl/runs') && request.method === 'POST') {
      response.writeHead(options.runStatus ?? 200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(options.runResult ?? { ok: true, status: 'running', artifacts: [] }));
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: false }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function register(baseUrl, email) {
  const result = await postJSON(baseUrl, '/api/auth/register', { email, password: 'correct horse battery staple' });
  assert.equal(result.response.status, 201);
  return result;
}

async function saveAPIKey(baseUrl, cookie, apiKey) {
  const result = await jsonFetch(`${baseUrl}/api/settings/model-provider`, {
    method: 'PUT',
    headers: { cookie },
    body: { apiKey },
  });
  assert.equal(result.response.status, 200);
  assert.doesNotMatch(JSON.stringify(result.body), new RegExp(apiKey));
}

async function operatorFetch(baseUrl, path, options = {}) {
  return jsonFetch(`${baseUrl}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${secureEnv.OPL_ADMIN_OPERATOR_TOKEN}`, ...(options.headers ?? {}) },
  });
}

async function postJSON(baseUrl, path, body) {
  return jsonFetch(`${baseUrl}${path}`, { method: 'POST', body });
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
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { rawText: text };
    }
  }
  const cookie = response.headers.get('set-cookie') ?? '';
  return { response, body, cookieHeader: cookie.split(';')[0] };
}

function assertNoSensitiveMaterial(value) {
  assert.doesNotMatch(JSON.stringify(value), /correct horse|sk-|rawProviderKey|apiKey|providerApiKey|bearerToken|launchToken|runtimeToken|kubeconfig|signedUrl|objectKey|storageKey|localPath|passwordHash|encryptedApiKey|sessionCookie|secret|token/i);
}

function assertNoArtifactBody(value) {
  const encoded = JSON.stringify(stripAllowedBoundaryFields(value));
  assert.doesNotMatch(encoded, /artifactBody|artifact_body|must not leak|object-store|objectKey|signedUrl|domainVerdict|storageObjectKey|private\/object\/key/i);
}

function retiredStorePattern() {
  return new RegExp(['task_' + 'projections', 'usage_' + 'events', 'tenant_' + 'plans'].join('|'));
}

function stripAllowedBoundaryFields(value) {
  if (Array.isArray(value)) return value.map(stripAllowedBoundaryFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'webuiArtifactBody' && key !== 'doesNotProve')
    .map(([key, item]) => [key, stripAllowedBoundaryFields(item)]));
}
