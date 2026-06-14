import assert from 'node:assert/strict';
import test from 'node:test';

import { getWebDemoData, renderWebDemoData } from '../../apps/web/src/demoData.mjs';

function createFetchResponse(payload) {
  return {
    ok: true,
    status: 200,
    async json() {
      return payload;
    },
  };
}

const apiProjection = Object.freeze({
  ok: true,
  tenantId: 'tenant_demo',
  workspaceId: 'workspace_demo',
  userId: 'user_demo',
  runId: 'run_workspace_demo_user_demo_001',
  task: {
    taskId: 'workspace_demo_task_001',
    tenantId: 'tenant_demo',
    workspaceId: 'workspace_demo',
    intent: 'research',
    status: 'completed',
    commandPolicyId: 'opl.contract.domains.readonly',
    artifactRefs: ['workspace_demo_task_001_artifact_001'],
  },
  artifacts: [
    {
      artifactId: 'workspace_demo_task_001_artifact_001',
      tenantId: 'tenant_demo',
      workspaceId: 'workspace_demo',
      kind: 'analysis_package',
      version: 1,
      sourceRefs: ['opl.contract.domains.readonly', 'workspace_demo_task_001'],
      downloadRef: 'demo://workspace_demo/workspace_demo_task_001_artifact_001',
    },
  ],
  adapter: {
    command: ['opl', 'contract', 'domains'],
    policyId: 'opl.contract.domains.readonly',
    mode: 'readonly',
  },
});

test('web demo data is derived from the MVP API endpoint', async () => {
  const calls = [];
  const fetchRef = async (url, options) => {
    calls.push({ url, options });
    return createFetchResponse(apiProjection);
  };

  const data = await getWebDemoData(fetchRef);

  assert.equal(data.title, '医学研究证据整理');
  assert.equal(data.task.status, 'completed');
  assert.equal(data.artifacts[0].kind, 'analysis_package');
  assert.equal(data.cards[0].label, '任务状态');
  assert.match(data.cards[0].value, /completed/);
  assert.equal(calls[0].url, '/api/mvp/task');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(JSON.parse(calls[0].options.body).tenantId, 'tenant_demo');
});

test('web demo data renderer writes cards into DOM-like targets', async () => {
  const writes = new Map();
  const documentLike = {
    querySelector(selector) {
      return {
        set textContent(value) {
          writes.set(selector, value);
        },
      };
    },
  };

  await renderWebDemoData(documentLike, async () => createFetchResponse(apiProjection));

  assert.equal(writes.get('[data-demo-title]'), '医学研究证据整理');
  assert.match(writes.get('[data-demo-summary]'), /已生成/);
  assert.match(writes.get('[data-demo-status]'), /completed/);
});
