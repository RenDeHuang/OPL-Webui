import assert from 'node:assert/strict';
import test from 'node:test';

import { runDemoTaskArtifactScenario } from '../../apps/api/src/demoScenario.mjs';

test('MVP task-artifact loop completes a Chinese demo scenario', async () => {
  const scenario = await runDemoTaskArtifactScenario();

  assert.equal(scenario.title, '医学研究证据整理');
  assert.equal(scenario.task.status, 'completed');
  assert.equal(scenario.artifacts[0].version, 1);
  assert.match(scenario.summary, /已生成/);
});
