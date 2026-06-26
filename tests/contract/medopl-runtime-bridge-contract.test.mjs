import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import { startGoServerWithEnv, stopGoServer } from './go-control-plane-server-helper.mjs';

const secureEnv = {
  OPL_WEBUI_ENV: 'development',
  OPL_SESSION_SECRET: 'test-session-secret-32-bytes-minimum',
  OPL_API_KEY_ENCRYPTION_SECRET: 'test-api-key-secret-32-bytes-min',
  OPL_CHAT_MODEL: 'gpt-5.5',
};

test('runtime gate fails closed with typed blocker when MedOPL endpoint is not configured', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(secureEnv);
  try {
    const session = await register(baseUrl, 'gate-endpoint-user@example.com');
    await saveAPIKey(baseUrl, session.cookieHeader, 'sk-gate-endpoint-secret');
    const gate = await jsonFetch(`${baseUrl}/api/opl/runtime-gate`, {
      method: 'POST',
      headers: { cookie: session.cookieHeader },
      body: { taskIntent: 'paper_question', marker: '@论文', prompt: '@论文 生成选题' },
    });

    assert.equal(gate.response.status, 424);
    assert.equal(gate.body.ok, false);
    assert.equal(gate.body.errorCode, 'MEDOPL_ENDPOINT_REQUIRED');
    assert.equal(gate.body.gateState.ready, false);
    assert.equal(gate.body.gateState.blockers[0].kind, 'medopl_endpoint_required');
    assert.match(gate.body.gateState.nextAction.deepLink, /^https:\/\/medopl\.medopl\.cn/);
    assert.equal(gate.body.webuiRuntimeExecution, 'forbidden');
    const audit = await jsonFetch(`${baseUrl}/api/account/audit-events`, {
      headers: { cookie: session.cookieHeader },
    });
    assert.equal(audit.body.events.map((event) => event.eventKind).includes('runtime_gate.blocked'), true);
    assertNoSensitiveMaterial(gate.body);
  } finally {
    await stopGoServer(child);
  }
});

test('runtime gate returns API key blocker before contacting MedOPL', async () => {
  const medopl = await startFakeMedOPL({
    runtimeGate: { ok: true, consumerProjection: { ready: true } },
  });
  const { child, baseUrl } = await startGoServerWithEnv({ ...secureEnv, MEDOPL_API_BASE_URL: medopl.baseUrl });
  try {
    const session = await register(baseUrl, 'gate-api-key-user@example.com');
    const gate = await jsonFetch(`${baseUrl}/api/opl/runtime-gate`, {
      method: 'POST',
      headers: { cookie: session.cookieHeader },
      body: { taskIntent: 'paper_question', marker: '@论文', prompt: '@论文 生成选题' },
    });

    assert.equal(gate.response.status, 424);
    assert.equal(gate.body.ok, false);
    assert.equal(gate.body.errorCode, 'API_KEY_REQUIRED');
    assert.equal(gate.body.gateState.ready, false);
    assert.equal(gate.body.gateState.blockers[0].kind, 'api_key_required');
    assert.equal(medopl.requests.length, 0);
    assertNoSensitiveMaterial(gate.body);
  } finally {
    await stopGoServer(child);
    await medopl.close();
  }
});

test('runtime gate proxies MedOPL typed not-ready blockers without fake ready', async () => {
  const medopl = await startFakeMedOPL({
    runtimeGate: {
      ok: false,
      productOwner: 'medopl',
      primaryConsumer: 'opl-webui',
      consumerRole: 'entry_and_chat_surface',
      workspaceBindingId: '',
      invocationMode: 'runtime_required',
      medoplRuntimeRequired: true,
      providerKeyStatus: 'bound',
      providerKeyRef: 'provider_key_ref_public',
      runtimeBindingId: '',
      runtimeState: 'missing_compute',
      storageBindingId: '',
      storageState: 'missing_storage',
      nodePoolProjection: { state: 'missing_compute' },
      billing: { state: 'package_required', deepLink: 'https://medopl.medopl.cn/packages' },
      release: { state: 'audit_required', deepLink: 'https://medopl.medopl.cn/release' },
      consumerProjection: {
        ready: false,
        blockers: [
          { kind: 'package_required', title: '需要购买套餐', nextAction: 'purchase_package', deepLink: 'https://medopl.medopl.cn/packages' },
          { kind: 'compute_required', title: '需要开通 compute resource', nextAction: 'open_compute', deepLink: 'https://medopl.medopl.cn/runtime' },
          { kind: 'storage_required', title: '需要开通 storage space', nextAction: 'open_storage', deepLink: 'https://medopl.medopl.cn/storage' },
          { kind: 'workspace_runtime_binding_required', title: '需要绑定 workspace/runtime/storage', nextAction: 'bind_workspace_runtime_storage', deepLink: 'https://medopl.medopl.cn/workspaces' },
          { kind: 'billing_blocked', title: 'Billing blocked', nextAction: 'view_billing', deepLink: 'https://medopl.medopl.cn/billing' },
          { kind: 'release_required', title: '需要 release / audit', nextAction: 'review_release', deepLink: 'https://medopl.medopl.cn/release' },
        ],
        nextAction: { id: 'purchase_package', label: '去 MedOPL 开通', deepLink: 'https://medopl.medopl.cn/packages' },
      },
      canaryAdmission: { enabled: false, allowed: false, decision: 'disabled' },
      nextAction: 'purchase_package',
    },
  });
  const { child, baseUrl } = await startGoServerWithEnv({ ...secureEnv, MEDOPL_API_BASE_URL: medopl.baseUrl });
  try {
    const session = await register(baseUrl, 'gate-blocked-user@example.com');
    await saveAPIKey(baseUrl, session.cookieHeader, 'sk-gate-blocked-secret');
    const gate = await jsonFetch(`${baseUrl}/api/opl/runtime-gate`, {
      method: 'POST',
      headers: { cookie: session.cookieHeader },
      body: { taskIntent: 'paper_question', marker: '@论文', prompt: '@论文 生成选题' },
    });

    assert.equal(gate.response.status, 424);
    assert.equal(gate.body.ok, false);
    assert.equal(gate.body.errorCode, 'RUNTIME_GATE_BLOCKED');
    assert.equal(gate.body.gateState.ready, false);
    assert.deepEqual(gate.body.gateState.blockers.map((blocker) => blocker.kind), [
      'package_required',
      'compute_required',
      'storage_required',
      'workspace_runtime_binding_required',
      'billing_blocked',
      'release_required',
    ]);
    assert.equal(gate.body.gateState.nextAction.deepLink, 'https://medopl.medopl.cn/packages');
    assert.equal(medopl.requests[0].path, '/api/opl/runtime-gate');
    assert.equal(medopl.requests[0].body.taskIntent, 'paper_question');
    assert.equal(medopl.requests[0].body.user.email, 'gate-blocked-user@example.com');
    assert.ok(medopl.requests[0].body.workspace.workspaceId);
    assertNoSensitiveMaterial(gate.body);
  } finally {
    await stopGoServer(child);
    await medopl.close();
  }
});

test('runtime gate treats real MedOPL blocked shape as not ready even when upstream ok is true', async () => {
  const medopl = await startFakeMedOPL({
    runtimeGate: {
      ok: true,
      productOwner: 'medopl',
      primaryConsumer: 'opl-webui',
      consumerRole: 'entry_and_chat_surface',
      workspaceId: 'workspace_real_shape',
      invocationMode: 'runtime_required',
      providerKeyStatus: 'missing',
      runtimeState: 'blocked',
      storageState: 'blocked',
      billing: { freezeStatus: 'pending', currency: 'CNY' },
      release: { canReleaseRuntime: false, destroyStorage: 'requires_runtime_binding', stopBilling: 'not_started' },
      consumerProjection: {
        chatSurface: 'opl-webui',
        runSurface: 'blocked_until_medopl_runtime_ready',
        uploadEnabled: false,
        runEnabled: false,
        artifactEnabled: false,
        releaseAction: 'not_started',
        storageAction: 'requires_runtime_binding',
      },
      actionContract: {
        primaryAction: {
          action: 'open_medopl_purchase',
          reason: 'provider_key_required',
          medoplDeeplink: '/packages?workspaceId=workspace_real_shape&taskIntent=paper_question',
          returnToOplDeeplink: '/opl?workspaceId=workspace_real_shape&taskIntent=paper_question',
        },
      },
      nextAction: 'bind_provider_key',
    },
  });
  const { child, baseUrl } = await startGoServerWithEnv({ ...secureEnv, MEDOPL_API_BASE_URL: medopl.baseUrl });
  try {
    const session = await register(baseUrl, 'gate-real-shape-user@example.com');
    await saveAPIKey(baseUrl, session.cookieHeader, 'sk-gate-real-shape-secret');
    const gate = await jsonFetch(`${baseUrl}/api/opl/runtime-gate`, {
      method: 'POST',
      headers: { cookie: session.cookieHeader },
      body: { taskIntent: 'paper_question', marker: '@论文', prompt: '@论文 生成选题' },
    });

    assert.equal(gate.response.status, 424);
    assert.equal(gate.body.ok, false);
    assert.equal(gate.body.errorCode, 'RUNTIME_GATE_BLOCKED');
    assert.equal(gate.body.gateState.ready, false);
    assert.equal(gate.body.gateState.runtimeState, 'blocked');
    assert.equal(gate.body.gateState.storageState, 'blocked');
    assert.equal(gate.body.gateState.providerKeyStatus, 'missing');
    assert.equal(gate.body.gateState.blockers[0].kind, 'provider_key_required');
    assert.equal(gate.body.gateState.blockers[0].nextAction, 'open_medopl_purchase');
    assert.match(gate.body.gateState.blockers[0].deepLink, /^https:\/\/medopl\.medopl\.cn\/packages\?/);
    assert.equal(gate.body.gateState.nextAction.id, 'open_medopl_purchase');
    assert.match(gate.body.gateState.nextAction.deepLink, /^https:\/\/medopl\.medopl\.cn\/packages\?/);
    assert.equal(medopl.requests[0].body.workspaceId.startsWith('workspace_'), true);
    assert.equal(medopl.requests[0].body.tenantId.startsWith('tenant_'), true);
    assert.equal(medopl.requests[0].body.userId.startsWith('user_'), true);
    assert.equal(medopl.requests[0].body.invocationMode, 'runtime_required');
    assertNoSensitiveMaterial(gate.body);
  } finally {
    await stopGoServer(child);
    await medopl.close();
  }
});

test('runtime run bridge only returns refs progress deliverables and rejects artifact bodies', async () => {
  const medopl = await startFakeMedOPL({
    runtimeGate: {
      ok: true,
      productOwner: 'medopl',
      primaryConsumer: 'opl-webui',
      consumerRole: 'entry_and_chat_surface',
      workspaceBindingId: 'workspace_binding_public',
      invocationMode: 'runtime_required',
      medoplRuntimeRequired: true,
      providerKeyStatus: 'bound',
      providerKeyRef: 'provider_key_ref_public',
      runtimeBindingId: 'runtime_binding_public',
      runtimeState: 'ready',
      storageBindingId: 'storage_binding_public',
      storageState: 'ready',
      nodePoolProjection: { state: 'ready' },
      billing: { state: 'ready' },
      release: { state: 'ready' },
      consumerProjection: {
        ready: true,
        refs: { workspaceRef: 'workspace_ref_public', runtimeRef: 'runtime_ref_public', storageRef: 'storage_ref_public' },
        nextAction: { id: 'start_run', label: '开始运行', deepLink: 'https://medopl.medopl.cn/runs/new' },
      },
      canaryAdmission: { enabled: true, allowed: true, decision: 'allow' },
      nextAction: 'start_run',
    },
    runResult: {
      ok: true,
      status: 'running',
      statusUrl: 'https://medopl.medopl.cn/runs/run_public_123',
      run: { runId: 'run_public_123', runtimeBindingId: 'runtime_binding_public', workspaceBindingId: 'workspace_binding_public' },
      artifactRef: 'artifact_public_ref_1',
      artifacts: [{ artifactRef: 'artifact_public_ref_1', kind: 'paper_plan', title: 'Paper plan ref' }],
      progress: [{ stage: 'queued', state: 'done' }, { stage: 'running', state: 'active' }],
      deliverables: [{ deliverableId: 'deliverable_public_ref_1', artifactRef: 'artifact_public_ref_1', status: 'draft' }],
      artifactBody: 'must not be returned',
      signedUrl: 'https://object-store.invalid/signed',
      objectKey: 'private/object/key',
      domainVerdict: 'must not be owned by WebUI',
    },
  });
  const { child, baseUrl } = await startGoServerWithEnv({ ...secureEnv, MEDOPL_API_BASE_URL: medopl.baseUrl });
  try {
    const session = await register(baseUrl, 'run-ready-user@example.com');
    await saveAPIKey(baseUrl, session.cookieHeader, 'sk-run-ready-secret');
    const run = await jsonFetch(`${baseUrl}/api/opl/runs`, {
      method: 'POST',
      headers: { cookie: session.cookieHeader },
      body: { taskIntent: 'paper_question', marker: '@论文', prompt: '@论文 生成选题', gateRefs: { runtimeRef: 'runtime_ref_public' } },
    });

    assert.equal(run.response.status, 200);
    assert.equal(run.body.ok, true);
    assert.equal(run.body.owner, 'MedOPL');
    assert.equal(run.body.status, 'running');
    assert.equal(run.body.run.runId, 'run_public_123');
    assert.equal(run.body.artifactRef, 'artifact_public_ref_1');
    assert.equal(run.body.artifacts[0].artifactRef, 'artifact_public_ref_1');
    assert.equal(run.body.progress[1].stage, 'running');
    assert.equal(run.body.deliverables[0].deliverableId, 'deliverable_public_ref_1');
    assert.equal(run.body.webuiArtifactBody, 'forbidden');
    assert.equal(run.body.webuiDomainTruth, 'forbidden');
    assert.equal(medopl.requests.at(-1).path, '/api/opl/runs');
    assert.equal(medopl.requests.at(-1).body.taskIntent, 'paper_question');
    assertNoSensitiveMaterial(run.body);
    assert.doesNotMatch(JSON.stringify(run.body), /"artifactBody"|"signedUrl"|"objectKey"|"domainVerdict"|must not be returned|object-store/i);
  } finally {
    await stopGoServer(child);
    await medopl.close();
  }
});

test('runtime run bridge forwards MedOPL launch and file refs without owning artifact body', async () => {
  const medopl = await startFakeMedOPL({
    runResult: {
      ok: true,
      status: 'succeeded',
      statusUrl: '/api/opl/runs/run_public_456/status',
      run: { runRef: 'run_public_456', status: 'succeeded' },
      artifactRef: 'artifact_public_ref_456',
      artifacts: [{
        artifactRef: 'artifact_public_ref_456',
        kind: 'outputs',
        name: 'result.md',
        relativePath: 'outputs/result.md',
        contentType: 'text/markdown',
      }],
      artifactBody: 'must not be returned',
    },
  });
  const { child, baseUrl } = await startGoServerWithEnv({ ...secureEnv, MEDOPL_API_BASE_URL: medopl.baseUrl });
  try {
    const session = await register(baseUrl, 'run-real-refs-user@example.com');
    await saveAPIKey(baseUrl, session.cookieHeader, 'sk-run-real-refs-secret');
    const run = await jsonFetch(`${baseUrl}/api/opl/runs`, {
      method: 'POST',
      headers: { cookie: session.cookieHeader },
      body: {
        taskIntent: 'paper_question',
        marker: '@论文',
        prompt: '@论文 生成选题',
        gateRefs: {
          launchId: 'launch_public_456',
          fileRefs: ['file_public_456'],
        },
      },
    });

    assert.equal(run.response.status, 200);
    assert.equal(run.body.ok, true);
    assert.equal(run.body.artifactRef, 'artifact_public_ref_456');
    assert.equal(run.body.run.runRef, 'run_public_456');
    assert.equal(medopl.requests.at(-1).path, '/api/opl/runs?launchId=launch_public_456');
    assert.equal(medopl.requests.at(-1).body.message, '@论文 生成选题');
    assert.deepEqual(medopl.requests.at(-1).body.fileRefs, ['file_public_456']);
    assert.equal(medopl.requests.at(-1).body.toolName, 'paper_question');
    assertNoSensitiveMaterial(run.body);
    assert.doesNotMatch(JSON.stringify(run.body), /"artifactBody"|must not be returned/i);
  } finally {
    await stopGoServer(child);
    await medopl.close();
  }
});

test('runtime run bridge returns typed blocker when MedOPL blocks the run', async () => {
  const medopl = await startFakeMedOPL({
    runtimeGate: {
      ok: true,
      consumerProjection: {
        ready: true,
        refs: { runtimeRef: 'runtime_ref_public' },
        nextAction: { id: 'start_run', label: '开始运行', deepLink: 'https://medopl.medopl.cn/runs/new' },
      },
    },
    runStatus: 424,
    runResult: {
      ok: false,
      status: 'blocked',
      blocker: { kind: 'billing_blocked', title: 'Billing blocked', nextAction: 'view_billing', deepLink: 'https://medopl.medopl.cn/billing' },
      progress: [{ stage: 'billing_check', state: 'blocked' }],
      artifacts: [],
    },
  });
  const { child, baseUrl } = await startGoServerWithEnv({ ...secureEnv, MEDOPL_API_BASE_URL: medopl.baseUrl });
  try {
    const session = await register(baseUrl, 'run-blocked-user@example.com');
    await saveAPIKey(baseUrl, session.cookieHeader, 'sk-run-blocked-secret');
    const run = await jsonFetch(`${baseUrl}/api/opl/runs`, {
      method: 'POST',
      headers: { cookie: session.cookieHeader },
      body: { taskIntent: 'paper_question', marker: '@论文', prompt: '@论文 生成选题' },
    });

    assert.equal(run.response.status, 424);
    assert.equal(run.body.ok, false);
    assert.equal(run.body.errorCode, 'RUNTIME_GATE_BLOCKED');
    assert.equal(run.body.blocker.kind, 'billing_blocked');
    assert.equal(run.body.blocker.deepLink, 'https://medopl.medopl.cn/billing');
    assert.equal(run.body.progress[0].state, 'blocked');
    assertNoSensitiveMaterial(run.body);
  } finally {
    await stopGoServer(child);
    await medopl.close();
  }
});

test('billing summary projection can consume MedOPL ledger refs without becoming billing truth', async () => {
  const medopl = await startFakeMedOPL({
    billingSummary: {
      ok: true,
      source: 'medopl',
      runCount: 2,
      ledgerCount: 2,
      summary: { runCount: 2, balanceState: 'active', releaseStatus: 'pending_audit' },
      ledger: [
        { ledgerEntryId: 'ledger_public_ref_1', entryType: 'hold', amount: 10, currency: 'CNY', sourceEventId: 'run_public_1' },
        { ledgerEntryId: 'ledger_public_ref_2', entryType: 'release', amount: -2, currency: 'CNY', sourceEventId: 'release_public_1' },
      ],
      rawObjectStoreSecret: 'must not leak',
      runtimeToken: 'must not leak',
    },
  });
  const { child, baseUrl } = await startGoServerWithEnv({ ...secureEnv, MEDOPL_API_BASE_URL: medopl.baseUrl });
  try {
    const session = await register(baseUrl, 'billing-bridge-user@example.com');
    const billing = await jsonFetch(`${baseUrl}/api/account/billing-summary`, {
      headers: { cookie: session.cookieHeader },
    });

    assert.equal(billing.response.status, 200);
    assert.equal(billing.body.ok, true);
    assert.equal(billing.body.owner, 'MedOPL');
    assert.equal(billing.body.billingSource, 'medopl');
    assert.equal(billing.body.runCount, 2);
    assert.equal(billing.body.ledgerCount, 2);
    assert.equal(billing.body.ledgerRefs[0].ledgerEntryId, 'ledger_public_ref_1');
    assert.equal(billing.body.releaseStatus, 'pending_audit');
    assert.equal(billing.body.webuiBillingSourceOfTruth, 'forbidden');
    assert.equal(billing.body.webuiPaymentMutation, 'forbidden');
    assert.equal(medopl.requests.at(-1).path.startsWith('/api/billing/summary?workspaceId=workspace_'), true);
    assertNoSensitiveMaterial(billing.body);
    assert.doesNotMatch(JSON.stringify(billing.body), /rawObjectStoreSecret|runtimeToken|must not leak/i);
  } finally {
    await stopGoServer(child);
    await medopl.close();
  }
});

async function startFakeMedOPL(options = {}) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const parsedUrl = new URL(request.url, 'http://127.0.0.1');
    let raw = '';
    for await (const chunk of request) raw += chunk;
    requests.push({
      method: request.method,
      path: request.url,
      body: raw ? JSON.parse(raw) : {},
    });

    if (parsedUrl.pathname === '/api/opl/runtime-gate' && request.method === 'POST') {
      response.writeHead(options.gateStatus ?? (options.runtimeGate?.ok === false ? 424 : 200), { 'content-type': 'application/json' });
      response.end(JSON.stringify(options.runtimeGate ?? { ok: true, consumerProjection: { ready: true } }));
      return;
    }

    if (parsedUrl.pathname === '/api/opl/runs' && request.method === 'POST') {
      response.writeHead(options.runStatus ?? (options.runResult?.ok === false ? 424 : 200), { 'content-type': 'application/json' });
      response.end(JSON.stringify(options.runResult ?? { ok: true, status: 'running', artifacts: [] }));
      return;
    }

    if (parsedUrl.pathname === '/api/billing/summary' && request.method === 'GET') {
      response.writeHead(options.billingStatus ?? 200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(options.billingSummary ?? { ok: true, source: 'medopl', runCount: 0, ledgerCount: 0, summary: {}, ledger: [] }));
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: false, error: 'not found' }));
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
  const result = await jsonFetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    body: { email, password: 'correct horse battery staple' },
  });
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
  assert.doesNotMatch(JSON.stringify(value), /correct horse|password|sk-|rawProviderKey|apiKey|providerApiKey|bearerToken|launchToken|runtimeToken|kubeconfig|signedUrl|objectKey|storageKey|localPath|rawObjectStoreSecret/i);
}
