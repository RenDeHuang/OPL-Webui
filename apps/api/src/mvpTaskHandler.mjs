import { createDemoTaskArtifactLoop } from './demoLoop.mjs';

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function buildRunId(input) {
  return `run_${input.workspaceId}_${input.userId}_001`;
}

export async function createMvpTaskResponse(input) {
  const request = {
    tenantId: requireText(input?.tenantId, 'tenantId'),
    workspaceId: requireText(input?.workspaceId, 'workspaceId'),
    userId: requireText(input?.userId, 'userId'),
    prompt: requireText(input?.prompt, 'prompt'),
    intent: input?.intent ?? 'general',
  };

  const projection = await createDemoTaskArtifactLoop(request);

  return {
    ok: projection.task.status === 'completed',
    runId: buildRunId(request),
    userId: request.userId,
    ...projection,
  };
}
