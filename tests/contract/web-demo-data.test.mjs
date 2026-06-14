import assert from 'node:assert/strict';
import test from 'node:test';

import { getWebDemoData, renderWebDemoData } from '../../apps/web/src/demoData.mjs';

test('web demo data is derived from API demo scenario', async () => {
  const data = await getWebDemoData();

  assert.equal(data.title, '医学研究证据整理');
  assert.equal(data.task.status, 'completed');
  assert.equal(data.artifacts[0].kind, 'analysis_package');
  assert.equal(data.cards[0].label, '任务状态');
  assert.match(data.cards[0].value, /completed/);
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

  await renderWebDemoData(documentLike);

  assert.equal(writes.get('[data-demo-title]'), '医学研究证据整理');
  assert.match(writes.get('[data-demo-summary]'), /已生成/);
  assert.match(writes.get('[data-demo-status]'), /completed/);
});
