const DEFAULT_DEMO_REQUEST = Object.freeze({
  tenantId: 'tenant_demo',
  workspaceId: 'workspace_demo',
  userId: 'user_demo',
  prompt: '生成一个医学研究项目的证据整理任务',
  intent: 'research',
});

export function createDemoCards(scenario) {
  const route = scenario.adapter.route ?? {};
  const routedDomain = route.resolution?.resolution?.domain_id
    ?? route.handoffBundle?.handoff_bundle?.target_domain_id
    ?? 'unknown_domain';
  const routingStatus = route.resolution?.resolution?.status
    ?? route.handoffBundle?.handoff_bundle?.routing_status
    ?? scenario.adapter.mode;

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
      value: `${routedDomain} / ${routingStatus}`,
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
  return {
    title: '医学研究证据整理',
    summary: `已生成 ${scenario.artifacts.length} 个交付物`,
    ...scenario,
    oplSnapshot,
    cards: createDemoCards(scenario),
    oplCards: createOplCards(oplSnapshot),
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

  writeText(documentRef, '[data-demo-title]', data.title);
  writeText(documentRef, '[data-demo-summary]', data.summary);
  writeText(documentRef, '[data-demo-status]', data.cards[0].value);
  writeText(documentRef, '[data-demo-artifact]', data.cards[1].value);
  writeText(documentRef, '[data-demo-boundary]', data.cards[2].value);
  writeText(documentRef, '[data-opl-readiness]', data.oplCards[3].value);
  writeText(documentRef, '[data-opl-modules]', data.oplCards[1].value);
  writeText(documentRef, '[data-opl-domains]', data.oplCards[2].value);
  writeText(documentRef, '[data-opl-bridge]', data.oplCards[0].value);
}

if (globalThis.document) {
  renderWebDemoData();
}
