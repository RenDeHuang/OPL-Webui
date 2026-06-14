import { createTaskArtifactProjection } from '../../../packages/core/src/taskArtifactLoop.mjs';
import { MockOplAdapter } from '../../../packages/opl-adapter/src/mockAdapter.mjs';

const DEMO_DISCOVERY_COMMAND = Object.freeze(['opl', 'contract', 'domains']);

export async function createDemoTaskArtifactLoop(input, adapter = new MockOplAdapter()) {
  const adapterResult = await adapter.run([...DEMO_DISCOVERY_COMMAND]);
  if (!adapterResult.ok) {
    return {
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      task: {
        taskId: `${input.workspaceId}_task_001`,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        intent: input.intent ?? 'general',
        status: 'blocked',
        artifactRefs: [],
      },
      artifacts: [],
      adapter: adapterResult,
    };
  }

  return {
    ...createTaskArtifactProjection(input, adapterResult),
    adapter: {
      command: adapterResult.command,
      policyId: adapterResult.policyId,
      mode: adapterResult.mode,
    },
  };
}
