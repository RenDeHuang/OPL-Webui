import { runDemoTaskArtifactScenario } from '../../api/src/demoScenario.mjs';

export async function getWebDemoData() {
  const scenario = await runDemoTaskArtifactScenario();

  return {
    ...scenario,
    cards: [
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
    ],
  };
}

function writeText(documentRef, selector, value) {
  const target = documentRef.querySelector(selector);
  if (target) {
    target.textContent = value;
  }
}

export async function renderWebDemoData(documentRef = globalThis.document) {
  if (!documentRef) return;
  const data = await getWebDemoData();

  writeText(documentRef, '[data-demo-title]', data.title);
  writeText(documentRef, '[data-demo-summary]', data.summary);
  writeText(documentRef, '[data-demo-status]', data.cards[0].value);
  writeText(documentRef, '[data-demo-artifact]', data.cards[1].value);
  writeText(documentRef, '[data-demo-boundary]', data.cards[2].value);
}

if (globalThis.document) {
  renderWebDemoData();
}
