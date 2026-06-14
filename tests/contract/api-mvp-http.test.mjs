import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

import { createMvpHttpServer } from '../../apps/api/src/server.mjs';

async function startServer() {
  const server = createMvpHttpServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

test('MVP API creates a tenant scoped task artifact projection', async () => {
  const { server, baseUrl } = await startServer();
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
    assert.equal(body.artifacts.length, 1);
    assert.equal(body.adapter.command.join(' '), 'opl contract domains');
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('MVP API rejects requests without tenant boundary', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/mvp/task`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'workspace_cloud_demo',
        userId: 'user_demo',
        prompt: '生成一个医学研究项目的证据整理任务',
      }),
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.errorCode, 'INVALID_MVP_TASK_REQUEST');
  } finally {
    server.close();
    await once(server, 'close');
  }
});
