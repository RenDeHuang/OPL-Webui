import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { startGoServer, startGoServerWithEnv, stopGoServer } from './go-control-plane-server-helper.mjs';

test('Go control plane creates a tenant scoped task artifact projection', async () => {
  const { child, baseUrl } = await startGoServer();
  try {
    const response = await fetch(`${baseUrl}/api/mvp/task`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant_cloud_demo',
        workspaceId: 'workspace_cloud_demo',
        userId: 'user_demo',
        prompt: '生成一个医学研究项目的证据整理任务',
        intent: 'research',
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');

    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.tenantId, 'tenant_cloud_demo');
    assert.equal(body.workspaceId, 'workspace_cloud_demo');
    assert.equal(body.userId, 'user_demo');
    assert.match(body.runId, /^run_/);
    assert.equal(body.task.status, 'completed');
    assert.equal(body.task.commandPolicyId, 'opl.cli.readonly.task-route');
    assert.equal(body.artifacts.length, 1);
    assert.equal(body.adapter.command.join(' '), 'opl contract handoff-envelope');
    assert.equal(body.adapter.route.policyId, 'opl.cli.readonly.task-route');
    assert.equal(body.adapter.route.resolution.resolution.domain_id, 'medautoscience');
    assert.equal(body.adapter.route.handoffBundle.handoff_bundle.target_domain_id, 'medautoscience');
    assert.deepEqual(body.adapter.route.commands.map((entry) => entry.args.slice(0, 2).join(' ')), [
      'domain resolve-request',
      'contract handoff-envelope',
    ]);
    assert.equal(body.adapter.route.commands.every((entry) => entry.mutating === false), true);

    const storedResponse = await fetch(
      `${baseUrl}/api/mvp/tasks/${body.tenantId}/${body.workspaceId}/${body.task.taskId}`,
    );
    assert.equal(storedResponse.status, 200);
    const storedBody = await storedResponse.json();
    assert.equal(storedBody.runId, body.runId);
    assert.equal(storedBody.task.taskId, body.task.taskId);
    assert.equal(storedBody.artifacts[0].artifactId, body.artifacts[0].artifactId);
  } finally {
    await stopGoServer(child);
  }
});

test('Go control plane exposes a deployment health check', async () => {
  const { child, baseUrl } = await startGoServer();
  try {
    const response = await fetch(`${baseUrl}/healthz`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');

    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, 'opl-webui-control-plane');
  } finally {
    await stopGoServer(child);
  }
});

test('Go control plane applies preview identity when development body omits it', async () => {
  const { child, baseUrl } = await startGoServer();
  try {
    const response = await fetch(`${baseUrl}/api/mvp/task`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: '生成一个医学研究项目的证据整理任务',
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.tenantId, 'tenant_demo');
    assert.equal(body.workspaceId, 'workspace_demo');
    assert.equal(body.userId, 'user_demo');
  } finally {
    await stopGoServer(child);
  }
});

test('Go control plane rejects MVP task payloads with unknown JSON fields', async () => {
  const { child, baseUrl } = await startGoServer();
  try {
    const response = await fetch(`${baseUrl}/api/mvp/task`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant_cloud_demo',
        workspaceId: 'workspace_cloud_demo',
        userId: 'user_demo',
        prompt: '生成一个医学研究项目的证据整理任务',
        intent: 'research',
        unexpectedField: 'must be rejected',
      }),
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.errorCode, 'INVALID_MVP_TASK_REQUEST');
  } finally {
    await stopGoServer(child);
  }
});

test('Go control plane defaults missing MVP task intent to general', async () => {
  const { child, baseUrl } = await startGoServer();
  try {
    const response = await fetch(`${baseUrl}/api/mvp/task`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant_cloud_demo',
        workspaceId: 'workspace_cloud_demo',
        userId: 'user_demo',
        prompt: '生成一个医学研究项目的证据整理任务',
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.task.intent, 'general');
    assert.deepEqual(body.adapter.route.commands[0].args.slice(0, 2), ['domain', 'resolve-request']);
    assert.equal(body.adapter.route.commands[0].args.includes('--intent'), true);
    assert.equal(body.adapter.route.commands[0].args[body.adapter.route.commands[0].args.indexOf('--intent') + 1], 'general');
  } finally {
    await stopGoServer(child);
  }
});

test('production mode blocks task intake until required runtime dependencies are configured', async () => {
  const { child, baseUrl } = await startGoServerWithEnv({
    OPL_WEBUI_ENV: 'production',
  });
  try {
    const readyResponse = await fetch(`${baseUrl}/readyz`);
    assert.equal(readyResponse.status, 503);
    const readyBody = await readyResponse.json();
    assert.equal(readyBody.ok, false);
    assert.equal(readyBody.environment, 'production');
    assert.deepEqual(readyBody.missing.sort(), [
      'OPL_BILLING_MODE',
      'OPL_DATABASE_URL',
      'OPL_OBJECT_STORE_URL',
      'OPL_QUEUE_URL',
      'OPL_TENANT_AUTH_MODE',
      'OPL_WORKER_MODE',
    ].sort());

    const taskResponse = await fetch(`${baseUrl}/api/mvp/task`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant_cloud_demo',
        workspaceId: 'workspace_cloud_demo',
        userId: 'user_demo',
        prompt: '生成一个医学研究项目的证据整理任务',
      }),
    });

    assert.equal(taskResponse.status, 503);
    const taskBody = await taskResponse.json();
    assert.equal(taskBody.ok, false);
    assert.equal(taskBody.errorCode, 'PRODUCTION_RUNTIME_NOT_READY');
  } finally {
    await stopGoServer(child);
  }
});

test('Go control plane exchanges launch token for browser session cookie', async () => {
  const { child, baseUrl } = await startGoServerWithEnv({
    OPL_WEBUI_ENV: 'cloud_mvp',
    OPL_TENANT_AUTH_MODE: 'medopl_launch_token',
    OPL_TENANT_AUTH_SECRET: 'test-secret',
  });
  try {
    const sessionResponse = await fetch(`${baseUrl}/api/session/launch`, {
      method: 'POST',
      headers: { authorization: `Bearer ${signedToken('test-secret')}` },
    });
    assert.equal(sessionResponse.status, 204);
    const cookie = sessionResponse.headers.get('set-cookie');
    assert.match(cookie, /opl_session=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);

    const currentResponse = await fetch(`${baseUrl}/api/session/current`, {
      headers: { cookie: cookie.split(';')[0] },
    });
    assert.equal(currentResponse.status, 200);
    const current = await currentResponse.json();
    assert.deepEqual(current, {
      ok: true,
      tenantId: 'tenant_token',
      workspaceId: 'workspace_token',
      userId: 'user_token',
      authMode: 'medopl_launch_token',
    });
  } finally {
    await stopGoServer(child);
  }
});

function signedToken(secret) {
  const claims = Buffer.from(JSON.stringify({
    tenantId: 'tenant_token',
    workspaceId: 'workspace_token',
    userId: 'user_token',
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(`v1.${claims}`).digest('base64url');
  return `v1.${claims}.${signature}`;
}
