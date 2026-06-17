import assert from 'node:assert/strict';
import test from 'node:test';

import * as demoData from '../../apps/web/src/demoData.mjs';

const { getWebDemoData, renderWebDemoData } = demoData;

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
    command: ['opl', 'contract', 'handoff-envelope'],
    policyId: 'opl.cli.readonly.task-route',
    mode: 'readonly',
    route: {
      ok: true,
      mode: 'readonly',
      policyId: 'opl.cli.readonly.task-route',
      commands: [
        { args: ['domain', 'resolve-request', '--intent', 'research'], policyId: 'opl.cli.readonly.task-route', mutating: false, ok: true },
        { args: ['contract', 'handoff-envelope', '生成一个医学研究项目的证据整理任务'], policyId: 'opl.cli.readonly.task-route', mutating: false, ok: true },
      ],
      resolution: {
        resolution: {
          status: 'routed',
          domain_id: 'medautoscience',
          entry_surface: 'domain_gateway',
        },
      },
      handoffBundle: {
        handoff_bundle: {
          target_domain_id: 'medautoscience',
          routing_status: 'routed',
        },
      },
    },
  },
});

const oplSnapshot = Object.freeze({
  ok: true,
  mode: 'readonly',
  policyId: 'opl.cli.readonly.snapshot',
  systemInitialize: {
    system_initialize: {
      overall_state: 'attention_needed',
      readiness: {
        core_ready: true,
        domain_ready: false,
        full_ready: false,
      },
      setup_flow: {
        blocking_items: ['domain_modules'],
      },
    },
  },
  modules: {
    modules: {
      summary: {
        default_modules_count: 3,
        healthy_default_modules_count: 1,
      },
    },
  },
  domains: {
    domains: [
      { domain_id: 'medautoscience', single_app_skill: 'mas' },
      { domain_id: 'medautogrant', single_app_skill: 'mag' },
    ],
  },
  commands: [
    { args: ['system', 'initialize', '--json'], policyId: 'opl.cli.readonly.snapshot', mutating: false, ok: true },
  ],
});

const workspaceProjection = Object.freeze({
  ok: true,
  tenantId: 'tenant_demo',
  workspaceId: 'workspace_demo',
  userId: 'user_demo',
  tenantRole: 'owner',
  workspaceRole: 'owner',
  workspace: { id: 'workspace_demo', name: 'workspace_demo' },
  usageQuota: { plan: 'mvp', taskQuota: 2, usagePeriod: 'monthly', usedCount: 1, remainingCount: 1 },
});

const taskListProjection = Object.freeze({
  ok: true,
  tenantId: 'tenant_demo',
  workspaceId: 'workspace_demo',
  userId: 'user_demo',
  tasks: [apiProjection],
});

test('web demo data is derived from the MVP API endpoint', async () => {
  const calls = [];
  const fetchRef = async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/workspaces/current') return { ok: false, status: 401, async json() { return { ok: false }; } };
    return createFetchResponse(url === '/api/opl/snapshot' ? oplSnapshot : apiProjection);
  };

  const data = await getWebDemoData(fetchRef);

  assert.equal(data.title, '医学研究证据整理');
  assert.equal(data.task.status, 'completed');
  assert.equal(data.artifacts[0].kind, 'analysis_package');
  assert.equal(data.cards[0].label, '任务状态');
  assert.match(data.cards[0].value, /completed/);
  assert.equal(data.cards[2].label, 'OPL 路由');
  assert.match(data.cards[2].value, /medautoscience/);
  assert.equal(data.oplSnapshot.mode, 'readonly');
  assert.equal(data.oplCards[0].label, 'OPL 连接');
  assert.match(data.oplCards[1].value, /1\/3/);
  assert.equal(calls[0].url, '/api/workspaces/current');
  assert.equal(calls[1].url, '/api/mvp/task');
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[2].url, '/api/opl/snapshot');
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    prompt: '生成一个医学研究项目的证据整理任务',
    intent: 'research',
  });
});

test('web demo data uses SaaS workspace and task list APIs', async () => {
  const calls = [];
  const fetchRef = async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/workspaces/current') return createFetchResponse(workspaceProjection);
    if (url === '/api/tasks') return createFetchResponse(taskListProjection);
    if (url === '/api/opl/snapshot') return createFetchResponse(oplSnapshot);
    return createFetchResponse(apiProjection);
  };

  const data = await getWebDemoData(fetchRef);

  assert.equal(data.workspaceCurrent.workspaceId, 'workspace_demo');
  assert.deepEqual(data.workspaceCurrent.usageQuota, workspaceProjection.usageQuota);
  assert.equal(data.taskList.tasks.length, 1);
  assert.equal(data.task.taskId, apiProjection.task?.taskId);
  const viewModel = demoData.createV3ViewModel(data);
  assert.deepEqual(viewModel.workspace.usageQuota, {
    label: 'mvp',
    value: '1/2 tasks used',
    remaining: 1,
    period: 'monthly',
  });
  assert.doesNotMatch(JSON.stringify(viewModel.workspace.usageQuota), /secret|token|password/i);
  assert.deepEqual(calls.map((call) => call.url), ['/api/workspaces/current', '/api/tasks', '/api/opl/snapshot']);
  assert.equal(calls[1].options?.method, 'GET');
});

test('web demo data derives a Figma V3 view model from current projections', async () => {
  assert.equal(typeof demoData.createV3ViewModel, 'function');

  const data = await getWebDemoData(async (url) => createFetchResponse(url === '/api/opl/snapshot' ? oplSnapshot : apiProjection));
  const viewModel = demoData.createV3ViewModel(data);

  assert.equal(viewModel.home.promptTitle, '你想让 OPL 产出什么');
  assert.deepEqual(viewModel.home.navItems, ['首页', '工作流', 'Drive', '团队', '定价']);
  assert.deepEqual(viewModel.home.promptControls, ['附件', '工作区', '深度研究', '交付类型']);
  assert.deepEqual(viewModel.home.toolCapsules, ['综述证据包', '国自然申请书', '汇报PPT', '修回回复', '论文初稿', '数据分析']);
  assert.equal(viewModel.home.recentCards[0].title, 'NSCLC 综述证据包');
  assert.equal(viewModel.home.recentCards[0].sourceTaskId, apiProjection.task.taskId);
  assert.equal(viewModel.home.reminders[0].label, '今天需要你处理');

  assert.equal(viewModel.workspace.title, '轻量项目工作区');
  assert.equal(viewModel.workspace.project.tenantId, 'tenant_demo');
  assert.equal(viewModel.workspace.project.workspaceId, 'workspace_demo');
  assert.equal(viewModel.workspace.project.runId, 'run_workspace_demo_user_demo_001');
  assert.equal(viewModel.workspace.project.statusTags[0], 'completed');
  assert.equal(viewModel.workspace.nextStep.title, '下一步建议');
  assert.equal(viewModel.workspace.stages[0].label, '接收目标');
  assert.equal(viewModel.workspace.stages.at(-1).label, '交付物预览');
  assert.equal(viewModel.workspace.evidence[0].sourceRef, 'opl.contract.domains.readonly');
  assert.equal(viewModel.workspace.activity[0].policyId, 'opl.cli.readonly.task-route');
  assert.match(viewModel.workspace.deliverablePreview.title, /analysis_package/);
  assert.equal(viewModel.boundaries.canClaimCompleteSaaS, false);
  assert.equal(viewModel.boundaries.canMutateOplRuntime, false);
});

test('web demo data renderer writes cards into DOM-like targets', async () => {
  const writes = new Map();
  const documentLike = { querySelector: (selector) => ({ set textContent(value) { writes.set(selector, value); } }) };

  await renderWebDemoData(documentLike, async (url) => createFetchResponse(url === '/api/opl/snapshot' ? oplSnapshot : apiProjection));

  assert.equal(writes.get('[data-demo-title]'), '医学研究证据整理');
  assert.match(writes.get('[data-demo-summary]'), /已生成/);
  assert.match(writes.get('[data-demo-status]'), /completed/);
  assert.match(writes.get('[data-demo-boundary]'), /medautoscience/);
  assert.match(writes.get('[data-opl-readiness]'), /core ready/);
  assert.match(writes.get('[data-opl-modules]'), /1\/3/);
  assert.match(writes.get('[data-opl-domains]'), /medautoscience/);
});

test('web demo data surfaces degraded OPL route state', async () => {
  const degradedProjection = {
    ...apiProjection,
    adapter: {
      ...apiProjection.adapter,
      route: {
        ok: false,
        mode: 'readonly',
        policyId: 'opl.cli.readonly.task-route',
        commands: [
          { args: ['domain', 'resolve-request'], policyId: 'opl.cli.readonly.task-route', mutating: false, ok: false },
        ],
      },
    },
  };

  const data = await getWebDemoData(async (url) => createFetchResponse(url === '/api/opl/snapshot' ? oplSnapshot : degradedProjection));

  assert.equal(data.cards[2].label, 'OPL 路由');
  assert.equal(data.cards[2].value, 'OPL route degraded');
});
