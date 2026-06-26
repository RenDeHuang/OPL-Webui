import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { startGoServerWithEnv, stopGoServer } from '../contract/go-control-plane-server-helper.mjs';

const defaultMedOPLDir = '/home/dev/projects/platform-v22/services/medopl-go-backend';
const rawProviderKey = 'real-local-medopl-provider-key-material-that-must-stay-private';
const webuiSecureEnv = {
  OPL_WEBUI_ENV: 'development',
  OPL_SESSION_SECRET: 'test-session-secret-32-bytes-minimum',
  OPL_API_KEY_ENCRYPTION_SECRET: 'test-api-key-secret-32-bytes-min',
  OPL_CHAT_MODEL: 'gpt-5.5',
};

test('OPL-Webui bridges a runtime-required task through a real MedOPL local business flow', { timeout: 180_000 }, async () => {
  const medoplDir = process.env.MEDOPL_GO_BACKEND_DIR || defaultMedOPLDir;
  if (!existsSync(join(medoplDir, 'cmd/server/main.go'))) {
    typedBlocker('medopl_go_backend_missing', { medoplDir });
  }

  const medoplRuntime = mkdtempSync(join(tmpdir(), 'opl-webui-real-medopl-'));
  const medopl = await startRealMedOPL(medoplDir, medoplRuntime);
  const webui = await startGoServerWithEnv({ ...webuiSecureEnv, MEDOPL_API_BASE_URL: medopl.baseUrl });
  try {
    const session = await register(webui.baseUrl, 'real-medopl-e2e-user@example.com');
    await saveAPIKey(webui.baseUrl, session.cookieHeader, 'sk-webui-real-medopl-secret');
    const context = {
      tenantId: session.body.tenantId,
      portalUserId: session.body.userId,
      userId: session.body.userId,
      workspaceId: session.body.workspaceId,
      taskIntent: 'paper_question',
    };

    const blockedGate = await webuiRuntimeGate(webui.baseUrl, session.cookieHeader, context);
    assert.equal(blockedGate.response.status, 424);
    assert.equal(blockedGate.body.ok, false);
    assert.equal(blockedGate.body.owner, 'MedOPL');
    assert.equal(blockedGate.body.gateState.ready, false);
    assert.equal(blockedGate.body.gateState.blockers[0].kind, 'provider_key_required');
    assert.equal(blockedGate.body.gateState.nextAction.id, 'open_medopl_purchase');
    assert.match(blockedGate.body.gateState.nextAction.deepLink, /^https:\/\/medopl\.medopl\.cn\//);
    assertNoSensitiveMaterial(blockedGate.body);

    await medoplPost(medopl.baseUrl, '/api/v22/users/prepare', {
      tenantId: context.tenantId,
      portalUserId: context.portalUserId,
      workspaceId: context.workspaceId,
    });
    const binding = await medoplPost(medopl.baseUrl, '/api/v22/provider-key', {
      tenantId: context.tenantId,
      portalUserId: context.portalUserId,
      workspaceId: context.workspaceId,
      apiKey: rawProviderKey,
      idempotencyKey: `real-medopl-provider-${context.workspaceId}`,
    });
    assert.equal(typeof binding.body.providerKeyRef, 'string');
    assertNoSensitiveMaterial(binding.body);

    const creditBlockedGate = await webuiRuntimeGate(webui.baseUrl, session.cookieHeader, context);
    assert.equal(creditBlockedGate.response.status, 424);
    assert.equal(creditBlockedGate.body.gateState.blockers[0].kind, 'package_required');
    assert.equal(creditBlockedGate.body.gateState.nextAction.id, 'recharge_or_credit_required');
    assert.match(creditBlockedGate.body.gateState.nextAction.deepLink, /^https:\/\/medopl\.medopl\.cn\/usage/);
    assertNoSensitiveMaterial(creditBlockedGate.body);

    await medoplPost(medopl.baseUrl, '/api/v22/users/credit', {
      tenantId: context.tenantId,
      portalUserId: context.portalUserId,
      workspaceId: context.workspaceId,
      amount: 200,
      currency: 'CNY',
      idempotencyKey: `real-medopl-credit-${context.workspaceId}`,
    });

    const preOpenGate = await webuiRuntimeGate(webui.baseUrl, session.cookieHeader, context);
    assert.equal(preOpenGate.response.status, 424);
    assert.equal(preOpenGate.body.gateState.blockers[0].kind, 'compute_required');
    assert.equal(preOpenGate.body.gateState.nextAction.id, 'open_runtime_storage');
    assertNoSensitiveMaterial(preOpenGate.body);

    const opened = await medoplPost(medopl.baseUrl, '/api/v22/managed-environment/open', {
      tenantId: context.tenantId,
      portalUserId: context.portalUserId,
      workspaceId: context.workspaceId,
      idempotencyKey: `real-medopl-open-${context.workspaceId}`,
    });
    const launchId = requiredString(opened.body, 'launchId');
    const resourceBindingId = requiredString(opened.body, 'resourceBindingId');

    const readyGate = await webuiRuntimeGate(webui.baseUrl, session.cookieHeader, context);
    assert.equal(readyGate.response.status, 200);
    assert.equal(readyGate.body.ok, true);
    assert.equal(readyGate.body.gateState.ready, true);
    assert.equal(readyGate.body.gateState.runtimeState, 'ready');
    assert.equal(readyGate.body.gateState.storageState, 'ready');
    assert.equal(readyGate.body.gateState.providerKeyStatus, 'bound');
    assert.equal(readyGate.body.gateState.release.canReleaseRuntime, true);
    assert.equal(readyGate.body.gateState.nextAction.id, 'return_to_opl_task');
    assert.equal(readyGate.body.webuiRuntimeExecution, 'forbidden');
    assertNoSensitiveMaterial(readyGate.body);

    const medoplReadyGate = await medoplPost(medopl.baseUrl, '/api/opl/runtime-gate', {
      tenantId: context.tenantId,
      portalUserId: context.portalUserId,
      workspaceId: context.workspaceId,
      invocationMode: 'runtime_required',
      taskIntent: context.taskIntent,
    });
    const storageBindingId = requiredString(medoplReadyGate.body, 'storageBindingId');
    assert.equal(medoplReadyGate.body.consumerProjection.runEnabled, true);
    assertNoSensitiveMaterial(medoplReadyGate.body);

    const uploaded = await medoplPost(medopl.baseUrl, `/api/opl/files?launchId=${encodeURIComponent(launchId)}`, {
      fileName: 'measurements.csv',
      relativePath: 'inputs/measurements.csv',
      contentType: 'text/csv',
      sizeBytes: 128,
    });
    const fileRef = requiredString(uploaded.body, 'fileRef');

    const run = await jsonFetch(`${webui.baseUrl}/api/opl/runs`, {
      method: 'POST',
      headers: { cookie: session.cookieHeader },
      body: {
        taskIntent: context.taskIntent,
        marker: '@论文',
        prompt: '@论文 生成选题',
        gateRefs: { launchId, fileRefs: [fileRef] },
      },
    });
    assert.equal(run.response.status, 200);
    assert.equal(run.body.ok, true);
    assert.equal(run.body.owner, 'MedOPL');
    assert.equal(run.body.webuiArtifactBody, 'forbidden');
    assert.equal(run.body.webuiDomainTruth, 'forbidden');
    assert.equal(run.body.webuiStorageMutation, 'forbidden');
    assert.equal(typeof run.body.artifactRef, 'string');
    assert.ok(run.body.artifactRef.length > 0);
    assert.ok(run.body.artifacts.length > 0);
    assert.deepEqual(run.body.progress, [
      { stage: 'run_started', state: 'done', title: 'Run started' },
      { stage: 'artifact_available', state: 'done', title: 'Artifact ref ready' },
    ]);
    assert.equal(run.body.deliverables.length, 1);
    assert.equal(typeof run.body.deliverables[0].deliverableId, 'string');
    assert.ok(run.body.deliverables[0].deliverableId.length > 0);
    assert.equal(run.body.deliverables[0].artifactRef, run.body.artifactRef);
    assert.equal(run.body.deliverables[0].ref, run.body.artifactRef);
    assert.equal(run.body.deliverables[0].status, 'available');
    assert.equal(run.body.deliverables[0].title, 'result.md');
    assert.equal(run.body.deliverables[0].kind, 'outputs');
    assertNoSensitiveMaterial(run.body);
    assert.doesNotMatch(JSON.stringify(run.body), /"artifactBody"|signedUrl|objectKey|domainVerdict|relativePath|contentType/i);

    const billing = await jsonFetch(`${webui.baseUrl}/api/account/billing-summary`, {
      headers: { cookie: session.cookieHeader },
    });
    assert.equal(billing.response.status, 200);
    assert.equal(billing.body.ok, true);
    assert.equal(billing.body.owner, 'MedOPL');
    assert.equal(billing.body.webuiBillingSourceOfTruth, 'forbidden');
    assert.equal(billing.body.webuiPaymentMutation, 'forbidden');
    assert.equal(billing.body.runCount, 1);
    assert.ok(billing.body.ledgerCount >= 1);
    assert.ok(billing.body.ledgerRefs.length >= 1);
    assert.equal(typeof billing.body.ledgerRefs[0].ledgerEntryId, 'string');
    assert.equal(typeof billing.body.ledgerRefs[0].entryType, 'string');
    assertNoSensitiveMaterial(billing.body);

    const released = await medoplPost(medopl.baseUrl, '/api/v22/managed-environment/release', {
      workspaceId: context.workspaceId,
      resourceBindingId,
      stopBilling: true,
      idempotencyKey: `real-medopl-release-${context.workspaceId}`,
    });
    assert.equal(released.body.billingStopped, true);
    assert.equal(typeof released.body.auditEventId, 'string');

    const releaseGate = await webuiRuntimeGate(webui.baseUrl, session.cookieHeader, context);
    assert.equal(releaseGate.response.status, 424);
    assert.equal(releaseGate.body.gateState.ready, false);
    assert.equal(releaseGate.body.gateState.runtimeState, 'released');
    assert.equal(releaseGate.body.gateState.release.stopBilling, 'stopped');
    assertNoSensitiveMaterial(releaseGate.body);

    await medoplPost(medopl.baseUrl, '/api/v22/storage/destroy', {
      workspaceId: context.workspaceId,
      resourceBindingId,
      storageBindingId,
      idempotencyKey: `real-medopl-destroy-${context.workspaceId}`,
    });

    const destroyedGate = await webuiRuntimeGate(webui.baseUrl, session.cookieHeader, context);
    assert.equal(destroyedGate.response.status, 424);
    assert.equal(destroyedGate.body.gateState.storageState, 'destroyed');
    assert.equal(destroyedGate.body.gateState.release.destroyStorage, 'completed');
    assertNoSensitiveMaterial(destroyedGate.body);
  } finally {
    await stopGoServer(webui.child);
    await stopRealMedOPL(medopl.child);
    rmSync(medoplRuntime, { recursive: true, force: true });
  }
});

async function startRealMedOPL(medoplDir, runtimeRoot) {
  const port = await availablePort();
  const child = spawn('go', ['run', './cmd/server'], {
    cwd: medoplDir,
    detached: true,
    env: {
      ...process.env,
      MEDOPL_BACKEND_MODE: 'local',
      MEDOPL_BACKEND_PORT: String(port),
      MEDOPL_PORTAL_STATE_ROOT: join(runtimeRoot, 'portal-state'),
      PORTAL_OPL_PROVIDER_SECRET_ROOT: join(runtimeRoot, 'provider-secrets'),
      DATABASE_URL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-4000);
  });
  child.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-4000);
  });

  for (let attempt = 0; attempt < 600; attempt += 1) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.status === 200) return { child, baseUrl };
    } catch {
      await wait(100);
    }
  }

  await stopRealMedOPL(child);
  typedBlocker('medopl_local_process_unavailable', {
    medoplDir,
    exitCode: child.exitCode,
    signal: child.signalCode,
    stdout,
    stderr,
  });
}

async function stopRealMedOPL(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      killProcessGroup(child, 'SIGKILL');
      finish();
    }, 3000);
    child.once('exit', finish);
    if (!killProcessGroup(child, 'SIGTERM')) finish();
  });
}

function killProcessGroup(child, signal) {
  try {
    process.kill(-child.pid, signal);
    return true;
  } catch {
    return child.kill(signal);
  }
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  return port;
}

async function webuiRuntimeGate(baseUrl, cookie, context) {
  return jsonFetch(`${baseUrl}/api/opl/runtime-gate`, {
    method: 'POST',
    headers: { cookie },
    body: {
      taskIntent: context.taskIntent,
      marker: '@论文',
      prompt: '@论文 生成选题',
      conversationId: `real-medopl-${context.workspaceId}`,
    },
  });
}

async function medoplPost(baseUrl, path, body) {
  const result = await jsonFetch(`${baseUrl}${path}`, { method: 'POST', body });
  if (!result.response.ok) {
    typedBlocker('medopl_owner_action_failed', {
      path,
      httpStatus: result.response.status,
      body: result.body,
    });
  }
  assertNoSensitiveMaterial(result.body);
  return result;
}

async function register(baseUrl, email) {
  const result = await jsonFetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    body: { email, password: 'correct horse battery staple' },
  });
  assert.equal(result.response.status, 201);
  assert.equal(typeof result.body.tenantId, 'string');
  assert.equal(typeof result.body.userId, 'string');
  assert.equal(typeof result.body.workspaceId, 'string');
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

function requiredString(source, field) {
  assert.equal(typeof source[field], 'string', `${field} must be a string`);
  assert.ok(source[field].length > 0, `${field} must be non-empty`);
  return source[field];
}

function typedBlocker(type, detail) {
  throw new Error(`REAL_MEDOPL_E2E_BLOCKED ${JSON.stringify(redacted({ type, detail }))}`);
}

function redacted(value) {
  const text = JSON.stringify(value);
  return JSON.parse(text.replaceAll(rawProviderKey, '[redacted-provider-key]'));
}

function assertNoSensitiveMaterial(value) {
  assert.doesNotMatch(JSON.stringify(value), /correct horse|password|sk-|rawProviderKey|apiKey|providerApiKey|bearerToken|launchToken|runtimeToken|kubeconfig|signedUrl|objectKey|storageKey|localPath|rawObjectStoreSecret|real-local-medopl-provider-key-material/i);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
