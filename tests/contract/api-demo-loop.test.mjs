import assert from 'node:assert/strict';
import test from 'node:test';

import { createDemoTaskArtifactLoop } from '../../apps/api/src/demoLoop.mjs';

test('API demo loop returns completed task and traceable artifact projection', async () => {
  const result = await createDemoTaskArtifactLoop({
    tenantId: 'tenant_demo',
    workspaceId: 'workspace_demo',
    prompt: '生成一个医学研究项目的证据整理任务',
    intent: 'research',
  });

  assert.equal(result.tenantId, 'tenant_demo');
  assert.equal(result.workspaceId, 'workspace_demo');
  assert.equal(result.task.status, 'completed');
  assert.equal(result.task.intent, 'research');
  assert.equal(result.task.artifactRefs.length, 1);
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.artifacts[0].kind, 'analysis_package');
  assert.ok(result.artifacts[0].sourceRefs.includes(result.adapter.policyId));
  assert.equal(result.adapter.command.join(' '), 'opl contract domains');
});
