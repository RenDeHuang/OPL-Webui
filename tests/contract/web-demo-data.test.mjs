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

test('web demo data is derived from the MVP API endpoint', async () => {
  const calls = [];
  const fetchRef = async (url, options) => {
    calls.push({ url, options });
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
  assert.equal(calls[0].url, '/api/mvp/task');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[1].url, '/api/opl/snapshot');
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

  await renderWebDemoData(documentLike, async (url) => createFetchResponse(url === '/api/opl/snapshot' ? oplSnapshot : apiProjection));

  assert.equal(writes.get('[data-demo-title]'), '医学研究证据整理');
  assert.match(writes.get('[data-demo-summary]'), /已生成/);
  assert.match(writes.get('[data-demo-status]'), /completed/);
  assert.match(writes.get('[data-demo-boundary]'), /medautoscience/);
  assert.match(writes.get('[data-opl-readiness]'), /core ready/);
  assert.match(writes.get('[data-opl-modules]'), /1\/3/);
  assert.match(writes.get('[data-opl-domains]'), /medautoscience/);
});
