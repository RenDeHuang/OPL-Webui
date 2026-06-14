import { createDemoTaskArtifactLoop } from './demoLoop.mjs';

export async function runDemoTaskArtifactScenario() {
  const projection = await createDemoTaskArtifactLoop({
    tenantId: 'tenant_demo',
    workspaceId: 'workspace_demo',
    prompt: '生成一个医学研究项目的证据整理任务',
    intent: 'research',
  });

  return {
    title: '医学研究证据整理',
    summary: `已生成 ${projection.artifacts.length} 个交付物`,
    ...projection,
  };
}
