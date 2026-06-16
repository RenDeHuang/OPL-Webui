const DEFAULT_DEMO_REQUEST = Object.freeze({
  tenantId: 'tenant_demo',
  workspaceId: 'workspace_demo',
  userId: 'user_demo',
  prompt: '生成一个医学研究项目的证据整理任务',
  intent: 'research',
});

export function createDemoCards(scenario) {
  const route = scenario.adapter.route ?? {};
  const routeValue = route.ok === false
    ? 'OPL route degraded'
    : `${route.resolution?.resolution?.domain_id
      ?? route.handoffBundle?.handoff_bundle?.target_domain_id
      ?? 'unknown_domain'} / ${route.resolution?.resolution?.status
      ?? route.handoffBundle?.handoff_bundle?.routing_status
      ?? scenario.adapter.mode}`;

  return [
    {
      label: '任务状态',
      value: `${scenario.task.status} / ${scenario.task.intent}`,
    },
    {
      label: '交付物',
      value: `${scenario.artifacts.length} 个正式产物`,
    },
    {
      label: 'OPL 路由',
      value: routeValue,
    },
  ];
}

export function createOplCards(snapshot) {
  const readiness = snapshot.systemInitialize?.system_initialize?.readiness ?? {};
  const moduleSummary = snapshot.modules?.modules?.summary ?? {};
  const domains = snapshot.domains?.domains ?? [];
  const healthyDefault = moduleSummary.healthy_default_modules_count ?? 0;
  const defaultTotal = moduleSummary.default_modules_count ?? 0;

  return [
    {
      label: 'OPL 连接',
      value: snapshot.ok ? `${snapshot.mode} / ${snapshot.policyId}` : 'degraded / readonly',
    },
    {
      label: '模块状态',
      value: `${healthyDefault}/${defaultTotal} default modules ready`,
    },
    {
      label: 'Domain agents',
      value: domains.map((domain) => domain.domain_id).join(' / ') || 'none',
    },
    {
      label: 'Readiness',
      value: `core ${readiness.core_ready ? 'ready' : 'blocked'} / full ${readiness.full_ready ? 'ready' : 'degraded'}`,
    },
  ];
}

function firstArtifact(scenario) {
  return scenario.artifacts[0] ?? {
    artifactId: 'pending_artifact',
    kind: 'analysis_package',
    version: 1,
    sourceRefs: [],
    downloadRef: 'pending',
  };
}

function routeDomain(route, fallback = 'medautoscience') {
  return route?.resolution?.resolution?.domain_id
    ?? route?.handoffBundle?.handoff_bundle?.target_domain_id
    ?? fallback;
}

export function createV3ViewModel(data) {
  const artifact = firstArtifact(data);
  const route = data.adapter.route ?? {};
  const commands = route.commands ?? [];
  const blockingItems = data.oplSnapshot.systemInitialize?.system_initialize?.setup_flow?.blocking_items ?? [];

  return {
    home: {
      navItems: ['首页', '工作流', 'Drive', '团队', '定价'],
      promptTitle: '你想让 OPL 产出什么',
      promptPlaceholder: data.task.intent === 'research'
        ? '例如：为 NSCLC 综述生成证据包、PPT 和投稿清单'
        : DEFAULT_DEMO_REQUEST.prompt,
      promptControls: ['附件', '工作区', '深度研究', '交付类型'],
      toolCapsules: ['综述证据包', '国自然申请书', '汇报PPT', '修回回复', '论文初稿', '数据分析'],
      recentCards: [
        {
          title: 'NSCLC 综述证据包',
          meta: `${artifact.kind} v${artifact.version}`,
          sourceTaskId: data.task.taskId,
        },
        {
          title: '国自然青年基金申请',
          meta: `${routeDomain(route)} / ${data.task.status}`,
          sourceTaskId: data.task.taskId,
        },
        {
          title: '组会汇报 PPT',
          meta: `${data.artifacts.length} 个正式产物`,
          sourceTaskId: data.task.taskId,
        },
      ],
      reminders: [
        {
          label: '今天需要你处理',
          value: blockingItems.length > 0 ? blockingItems.join(' / ') : '确认交付物范围',
        },
      ],
    },
    workspace: {
      title: '轻量项目工作区',
      tabs: ['项目', '任务', '证据', '交付物', '团队'],
      project: {
        title: 'NSCLC 综述证据包',
        tenantId: data.tenantId,
        workspaceId: data.workspaceId,
        runId: data.runId,
        statusTags: [data.task.status, data.task.intent, routeDomain(route)],
      },
      nextStep: {
        title: '下一步建议',
        body: '先确认证据范围，再进入交付物预览和人工审阅。',
      },
      stages: [
        { label: '接收目标', state: 'done' },
        { label: 'OPL 只读路由', state: route.ok === false ? 'attention' : 'done' },
        { label: '证据与来源', state: artifact.sourceRefs.length > 0 ? 'done' : 'attention' },
        { label: '交付物预览', state: data.task.status === 'completed' ? 'ready' : 'pending' },
      ],
      evidence: artifact.sourceRefs.map((sourceRef) => ({ sourceRef, artifactId: artifact.artifactId })),
      activity: commands.map((command) => ({
        label: command.args.join(' '),
        policyId: command.policyId,
        ok: command.ok,
      })),
      deliverablePreview: {
        title: `${artifact.kind} v${artifact.version}`,
        downloadRef: artifact.downloadRef,
      },
    },
    boundaries: {
      canClaimCompleteSaaS: false,
      canMutateOplRuntime: false,
    },
  };
}

async function readJSON(response, label) {
  if (!response.ok) {
    throw new Error(`${label} request failed: ${response.status}`);
  }

  return response.json();
}

export async function getWebDemoData(fetchRef = globalThis.fetch) {
  if (typeof fetchRef !== 'function') {
    throw new Error('fetch is required');
  }

  const taskResponse = await fetchRef('/api/mvp/task', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(DEFAULT_DEMO_REQUEST),
  });
  const snapshotResponse = await fetchRef('/api/opl/snapshot');

  const scenario = await readJSON(taskResponse, 'MVP API');
  const oplSnapshot = await readJSON(snapshotResponse, 'OPL snapshot');
  const data = {
    title: '医学研究证据整理',
    summary: `已生成 ${scenario.artifacts.length} 个交付物`,
    ...scenario,
    oplSnapshot,
    cards: createDemoCards(scenario),
    oplCards: createOplCards(oplSnapshot),
  };
  return {
    ...data,
    v3: createV3ViewModel(data),
  };
}

function writeText(documentRef, selector, value) {
  const target = documentRef.querySelector(selector);
  if (target) {
    target.textContent = value;
  }
}

export async function renderWebDemoData(documentRef = globalThis.document, fetchRef = globalThis.fetch) {
  if (!documentRef) return;
  const data = await getWebDemoData(fetchRef);
  const viewModel = data.v3;

  writeText(documentRef, '[data-demo-title]', data.title);
  writeText(documentRef, '[data-demo-summary]', data.summary);
  writeText(documentRef, '[data-demo-status]', data.cards[0].value);
  writeText(documentRef, '[data-demo-artifact]', data.cards[1].value);
  writeText(documentRef, '[data-demo-boundary]', data.cards[2].value);
  writeText(documentRef, '[data-opl-readiness]', data.oplCards[3].value);
  writeText(documentRef, '[data-opl-modules]', data.oplCards[1].value);
  writeText(documentRef, '[data-opl-domains]', data.oplCards[2].value);
  writeText(documentRef, '[data-opl-bridge]', data.oplCards[0].value);
  writeText(documentRef, '[data-v3-project-title]', viewModel.workspace.project.title);
  writeText(documentRef, '[data-v3-next-step]', viewModel.workspace.nextStep.body);
  writeText(documentRef, '[data-v3-deliverable-preview]', viewModel.workspace.deliverablePreview.title);
}

if (globalThis.document) {
  renderWebDemoData();
}
