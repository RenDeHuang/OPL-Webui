const DEFAULT_DEMO_REQUEST = Object.freeze({
  tenantId: 'tenant_demo',
  workspaceId: 'workspace_demo',
  userId: 'user_demo',
  prompt: '生成一个医学研究项目的证据整理任务',
  intent: 'research',
});

export function createDemoCards(scenario) {
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
      label: 'OPL 边界',
      value: scenario.adapter.command.join(' '),
    },
  ];
}

export async function getWebDemoData(fetchRef = globalThis.fetch) {
  if (typeof fetchRef !== 'function') {
    throw new Error('fetch is required');
  }

  const response = await fetchRef('/api/mvp/task', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(DEFAULT_DEMO_REQUEST),
  });

  if (!response.ok) {
    throw new Error(`MVP API request failed: ${response.status}`);
  }

  const scenario = await response.json();
  return {
    title: '医学研究证据整理',
    summary: `已生成 ${scenario.artifacts.length} 个交付物`,
    ...scenario,
    cards: createDemoCards(scenario),
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
}

if (globalThis.document) {
  renderWebDemoData();
}
