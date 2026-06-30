import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import test from 'node:test';

const cloudRolloutPath = 'scripts/cloud-rollout.mjs';
const canaryPath = 'scripts/commercial-consumer-canary.mjs';

test('commercial consumer canary is wired as a secret-gated cloud rollout lane', async () => {
  assert.equal(existsSync(canaryPath), true);
  const helper = readFileSync(cloudRolloutPath, 'utf8');
  const canary = readFileSync(canaryPath, 'utf8');
  assert.match(helper, /--commercial-consumer-e2e/);
  assert.match(helper, /runCommercialConsumerE2E/);
  for (const required of [
    'OPL_COMMERCIAL_CONSUMER_E2E',
    'MEDOPL_PUBLIC_BASE_URL',
    'MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256',
    'MEDOPL_WEBHOOK_SECRET',
    '/api/opl/runtime-gate',
    '/api/opl/runs',
    '/api/tasks',
    'commercial consumer evidence summary',
  ]) assert.match(canary, new RegExp(required.replace(/[/-]/g, '\\$&')));

  const medopl = await startFakeMedOPLProduction();
  const webui = await startFakeCommercialWebui();
  try {
    const output = await runHelper({
      env: {
        ...process.env,
        OPL_BASE_URL: webui.baseUrl,
        MEDOPL_PUBLIC_BASE_URL: medopl.baseUrl,
        OPL_COMMERCIAL_CONSUMER_E2E: '1',
        OPL_DOGFOOD_EMAIL: 'commercial-canary@example.test',
        OPL_DOGFOOD_PASSWORD: 'commercial-password',
        OPL_DOGFOOD_API_KEY: 'sk-commercial-consumer-secret',
        MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256: 'a'.repeat(64),
        MEDOPL_WEBHOOK_SECRET: 'medopl-webhook-secret',
      },
    });
    assert.match(output, /commercial consumer evidence summary/);
    assert.match(output, /"mode":"secret_gated_commercial_consumer_ready_path"/);
    assert.match(output, /"medoplReady":true/);
    assert.match(output, /"webuiTaskHistory":true/);
    assert.match(output, /"sessionResume":true/);
    assert.match(output, /"rawLogPolicy":\{"storesRawLogs":false,"storesSecretValues":false\}/);
    assert.doesNotMatch(output, /sk-commercial-consumer-secret|commercial-password|medopl-webhook-secret|opl_session=|medopl_session=|runtimeToken|storageObjectKey|artifactBody|paymentTruth|billingTruth/i);

    assert.deepEqual(medopl.requests.map((request) => request.path), [
      '/api/session/bootstrap',
      '/api/v22/users/prepare',
      '/api/v22/users/approve',
      '/api/v22/billing/payment-orders',
      '/api/v22/billing/payment-paid',
      '/api/v22/provider-key',
      '/api/v22/managed-environment/open',
      '/api/opl/runtime-gate',
      '/api/opl/files?launchId=launch_public_ref',
      '/api/v22/managed-environment/release',
      '/api/v22/storage/destroy',
    ]);
    assert.deepEqual(webui.requests.map((request) => request.path), [
      '/api/auth/register',
      '/api/auth/login',
      '/api/settings/model-provider',
      '/api/opl/runtime-gate',
      '/api/opl/runs',
      '/api/account/billing-summary',
      '/api/tasks',
      '/api/tasks/task_public_ref',
      '/api/auth/logout',
      '/api/auth/login',
      '/api/tasks',
      '/api/tasks/task_public_ref',
    ]);
    assert.equal(webui.requests.find((request) => request.path === '/api/opl/runs').body.gateRefs.launchId, 'launch_public_ref');
    assert.equal(webui.requests.find((request) => request.path === '/api/opl/runs').body.gateRefs.fileRefs[0], 'file_public_ref');
    assert.equal(webui.requests.find((request) => request.path === '/api/settings/model-provider').body.apiKey, 'sk-commercial-consumer-secret');
  } finally {
    await medopl.close();
    await webui.close();
  }
});

function runHelper(options) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cloudRolloutPath, '--commercial-consumer-e2e'], options);
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('commercial consumer canary timed out'));
    }, 5000);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error(output || `commercial consumer canary exited ${code}`));
    });
  });
}

async function startFakeMedOPLProduction() {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    requests.push({ path: request.url, body, headers: request.headers });
    const send = (status, payload, cookies = false) => {
      const headers = { 'content-type': 'application/json' };
      if (cookies) {
        headers['set-cookie'] = [
          'medopl_session=medopl-secret-session; HttpOnly',
          'medopl_csrf=medopl-csrf-secret; HttpOnly',
        ];
      }
      response.writeHead(status, headers);
      response.end(JSON.stringify(payload));
    };
    if (request.url === '/api/session/bootstrap') return send(200, { session: 'issued' }, true);
    if (request.url === '/api/v22/users/prepare') return send(200, { ok: true, workspaceId: body.workspaceId, accountStatus: 'prepared' });
    if (request.url === '/api/v22/users/approve') return send(200, { ok: true, workspaceId: body.workspaceId, accountStatus: 'approved' });
    if (request.url === '/api/v22/billing/payment-orders') return send(200, { ok: true, workspaceId: body.workspaceId, orderId: 'order_public_ref', status: 'created' });
    if (request.url === '/api/v22/billing/payment-paid') return send(200, { ok: true, workspaceId: body.workspaceId, credited: true });
    if (request.url === '/api/v22/provider-key') return send(200, { ok: true, providerKeyRef: 'provider_public_ref', boundStatus: 'bound' });
    if (request.url === '/api/v22/managed-environment/open') return send(200, { ok: true, launchId: 'launch_public_ref', resourceBindingId: 'resource_public_ref' });
    if (request.url === '/api/opl/runtime-gate') {
      return send(200, {
        ok: true,
        workspaceId: body.workspaceId,
        runtimeState: 'ready',
        storageState: 'ready',
        storageBindingId: 'storage_public_ref',
        nodePoolProjection: { state: 'ready' },
        consumerProjection: { ready: true, runEnabled: true },
      });
    }
    if (request.url === '/api/opl/files?launchId=launch_public_ref') {
      return send(200, { ok: true, fileRef: 'file_public_ref', storageBindingId: 'storage_public_ref' });
    }
    if (request.url === '/api/v22/managed-environment/release') return send(200, { ok: true, billingStopped: true, auditEventId: 'audit_public_ref' });
    if (request.url === '/api/v22/storage/destroy') return send(200, { ok: true, storageDestroyed: true, storageState: 'destroyed' });
    send(404, { errorCode: 'NOT_FOUND' });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { baseUrl: `http://127.0.0.1:${port}`, requests, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function startFakeCommercialWebui() {
  const requests = [];
  let registered = false;
  const server = http.createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    requests.push({ path: request.url, body, headers: request.headers });
    const send = (status, payload, cookie = false) => {
      const headers = { 'content-type': 'application/json' };
      if (cookie) headers['set-cookie'] = 'opl_session=webui-secret-session; HttpOnly';
      response.writeHead(status, headers);
      response.end(JSON.stringify(payload));
    };
    const identity = {
      email: body.email || 'commercial-canary@example.test',
      tenantId: 'tenant_public_ref',
      userId: 'user_public_ref',
      workspaceId: 'workspace_public_ref',
    };
    if (request.url === '/api/auth/register') {
      if (registered) return send(409, { errorCode: 'EMAIL_ALREADY_REGISTERED' });
      registered = true;
      return send(201, identity, true);
    }
    if (request.url === '/api/auth/login') return send(200, identity, true);
    if (request.url === '/api/settings/model-provider') return send(200, { ok: true, apiKeyConfigured: true, baseUrl: 'https://gflabtoken.cn/v1', maskedKey: 'sk-***cret' });
    if (request.url === '/api/opl/runtime-gate') {
      return send(200, {
        ok: true,
        owner: 'MedOPL',
        gateState: { ready: true, runtimeState: 'ready', storageState: 'ready' },
        webuiRuntimeExecution: 'forbidden',
      });
    }
    if (request.url === '/api/opl/runs') {
      return send(200, {
        ok: true,
        owner: 'MedOPL',
        status: 'succeeded',
        statusUrl: 'https://medopl.medopl.cn/runs/run_public_ref',
        artifactRef: 'artifact_public_ref',
        progress: [{ stage: 'run_started', state: 'done' }, { stage: 'artifact_available', state: 'done' }],
        deliverables: [{ deliverableId: 'deliverable_public_ref', artifactRef: 'artifact_public_ref', status: 'available', ref: 'artifact_public_ref' }],
        webuiArtifactBody: 'forbidden',
        webuiDomainTruth: 'forbidden',
        webuiStorageMutation: 'forbidden',
      });
    }
    if (request.url === '/api/account/billing-summary') {
      return send(200, {
        ok: true,
        owner: 'MedOPL',
        ledgerRefs: [{ ledgerEntryId: 'ledger_public_ref', entryType: 'run_charge', amount: 1, currency: 'CNY' }],
        webuiBillingSourceOfTruth: 'forbidden',
        webuiPaymentMutation: 'forbidden',
      });
    }
    if (request.url === '/api/tasks') return send(200, { ok: true, tasks: [taskProjection()], webuiArtifactBody: 'forbidden', webuiStorageTruth: 'forbidden' });
    if (request.url === '/api/tasks/task_public_ref') return send(200, { ok: true, task: taskProjection(), webuiArtifactBody: 'forbidden', webuiStorageTruth: 'forbidden' });
    if (request.url === '/api/auth/logout') return send(204, {});
    send(404, { errorCode: 'NOT_FOUND' });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { baseUrl: `http://127.0.0.1:${port}`, requests, close: () => new Promise((resolve) => server.close(resolve)) };
}

function taskProjection() {
  return {
    taskId: 'task_public_ref',
    taskType: 'paper_question',
    taskIntent: 'paper_question',
    marker: '@论文',
    status: 'succeeded',
    conversationId: 'commercial-consumer-canary',
    progressRefs: [{ ref: 'run_started' }, { ref: 'artifact_available' }],
    deliverableRefs: [{ ref: 'deliverable_public_ref', status: 'available' }],
    materialRefs: [{ ref: 'file_public_ref' }],
    allowedNextActions: [{ id: 'continue_in_medopl', deepLink: 'https://medopl.medopl.cn/runs/run_public_ref' }],
    webuiArtifactBody: 'forbidden',
    webuiStorageTruth: 'forbidden',
  };
}
