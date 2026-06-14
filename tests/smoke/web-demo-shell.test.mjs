import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('web demo shell is a Chinese AI workspace surface', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');

  assert.match(html, /OPL WebUI/);
  assert.match(html, /今天想推进什么正式交付/);
  assert.match(html, /医学研究证据整理/);
  assert.match(html, /任务进度/);
  assert.match(html, /OPL 连接/);
  assert.match(html, /data-demo-title/);
  assert.match(html, /data-demo-status/);
  assert.match(html, /data-opl-readiness/);
  assert.match(html, /data-opl-modules/);
  assert.match(html, /medautoscience \/ routed/);
  assert.doesNotMatch(html, /mock OPL Adapter/);
  assert.doesNotMatch(html, /后台管理|控制台|Dashboard/);
});

test('web demo shell keeps CSS and data bridge separate', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');

  assert.match(html, /styles.css/);
	assert.match(html, /src\/demoData.mjs/);
});

test('web app does not keep a duplicate local README', () => {
	assert.equal(existsSync('apps/web/README.md'), false);
});

test('web demo shell is wired to the MVP API endpoint', () => {
  const dataBridge = readFileSync('apps/web/src/demoData.mjs', 'utf8');

  assert.match(dataBridge, /\/api\/mvp\/task/);
  assert.match(dataBridge, /\/api\/opl\/snapshot/);
  assert.doesNotMatch(dataBridge, /from '..\/..\/api\/src\/demoScenario\.mjs'/);
});
