const ARTIFACT_KIND_BY_INTENT = Object.freeze({
  research: 'analysis_package',
  grant: 'grant_package',
  presentation: 'slide_deck',
  general: 'document',
});

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

export function createTaskArtifactProjection(input, adapterResult) {
  const tenantId = requireText(input.tenantId, 'tenantId');
  const workspaceId = requireText(input.workspaceId, 'workspaceId');
  const prompt = requireText(input.prompt, 'prompt');
  const intent = input.intent ?? 'general';
  const taskId = `${workspaceId}_task_001`;
  const artifactId = `${taskId}_artifact_001`;
  const policyId = requireText(adapterResult.policyId, 'policyId');

  return {
    tenantId,
    workspaceId,
    prompt,
    task: {
      taskId,
      tenantId,
      workspaceId,
      intent,
      status: 'completed',
      commandPolicyId: policyId,
      artifactRefs: [artifactId],
    },
    artifacts: [
      {
        artifactId,
        tenantId,
        workspaceId,
        kind: ARTIFACT_KIND_BY_INTENT[intent] ?? ARTIFACT_KIND_BY_INTENT.general,
        version: 1,
        sourceRefs: [policyId, taskId],
        downloadRef: `demo://${workspaceId}/${artifactId}`,
      },
    ],
  };
}
