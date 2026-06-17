import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { startGoServerWithEnv, stopGoServer } from './go-control-plane-server-helper.mjs';

const secret = 'test-secret';

test('SaaS workspace task APIs require auth and membership', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(saasEnv());
  try {
    const unauth = await fetch(`${baseUrl}/api/workspaces/current`);
    assert.equal(unauth.status, 401);
    assert.equal((await unauth.json()).errorCode, 'AUTH_REQUIRED');

    const noMembership = await fetch(`${baseUrl}/api/tasks`, {
      headers: { cookie: sessionCookie({ tenantId: 'tenant_nomember', workspaceId: 'workspace_nomember', userId: 'user_nomember' }) },
    });
    assert.equal(noMembership.status, 403);
    assert.equal((await noMembership.json()).errorCode, 'MEMBERSHIP_REQUIRED');
  } finally {
    await stopGoServer(child);
  }
});

test('SaaS task APIs create, list and read only inside the authenticated workspace', async () => {
  const { child, baseUrl } = await startGoServerWithEnv(saasEnv());
  try {
    const tenantA = await launchSession(baseUrl);
    const create = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: tenantA },
      body: JSON.stringify({ prompt: '生成一个医学研究项目的证据整理任务', intent: 'research' }),
    });
    assert.equal(create.status, 200);
    const created = await create.json();
    assert.equal(created.tenantId, 'tenant_token');
    assert.equal(created.workspaceId, 'workspace_token');
    assert.equal(created.userId, 'user_token');

    const list = await fetch(`${baseUrl}/api/tasks`, { headers: { cookie: tenantA } });
    assert.equal(list.status, 200);
    const listed = await list.json();
    assert.equal(listed.ok, true);
    assert.equal(listed.tasks.length, 1);
    assert.equal(listed.tasks[0].task.taskId, created.task.taskId);

    const read = await fetch(`${baseUrl}/api/tasks/${created.task.taskId}`, { headers: { cookie: tenantA } });
    assert.equal(read.status, 200);
    assert.equal((await read.json()).runId, created.runId);

    const tenantB = await launchSession(baseUrl, { tenantId: 'tenant_other', workspaceId: 'workspace_other', userId: 'user_other' });
    const crossTenant = await fetch(`${baseUrl}/api/tasks/${created.task.taskId}`, { headers: { cookie: tenantB } });
    assert.equal(crossTenant.status, 404);

    const bodyIdentity = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: tenantA },
      body: JSON.stringify({ tenantId: 'tenant_other', prompt: 'body identity must not be trusted' }),
    });
    assert.equal(bodyIdentity.status, 400);
    assert.equal((await bodyIdentity.json()).errorCode, 'INVALID_MVP_TASK_REQUEST');
  } finally {
    await stopGoServer(child);
  }
});

function saasEnv() {
  return {
    OPL_WEBUI_ENV: 'cloud_mvp',
    OPL_TENANT_AUTH_MODE: 'medopl_launch_token',
    OPL_TENANT_AUTH_SECRET: secret,
    OPL_DATABASE_URL: '',
  };
}

function sessionCookie(claims = { tenantId: 'tenant_token', workspaceId: 'workspace_token', userId: 'user_token' }) {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', secret).update(`session_v1.${payload}`).digest('base64url');
  return `opl_session=session_v1.${payload}.${signature}`;
}

async function launchSession(baseUrl, claims = { tenantId: 'tenant_token', workspaceId: 'workspace_token', userId: 'user_token' }) {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', secret).update(`v1.${payload}`).digest('base64url');
  const response = await fetch(`${baseUrl}/api/session/launch`, {
    method: 'POST',
    headers: { authorization: `Bearer v1.${payload}.${signature}` },
  });
  assert.equal(response.status, 204);
  return response.headers.get('set-cookie').split(';')[0];
}
