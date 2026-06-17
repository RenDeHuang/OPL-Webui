import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('web demo shell exposes the Figma V3 homepage structure', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');

  assert.match(html, /OPL WebUI/);
  assert.match(html, /首页/);
  assert.match(html, /工作流/);
  assert.match(html, /Drive/);
  assert.match(html, /团队/);
  assert.match(html, /定价/);
  assert.match(html, /登录/);
  assert.match(html, /免费开始/);
  assert.match(html, /你想让 OPL 产出什么/);
  assert.match(html, /附件/);
  assert.match(html, /工作区/);
  assert.match(html, /深度研究/);
  assert.match(html, /交付类型/);
  assert.match(html, /启动/);
  assert.match(html, /综述证据包/);
  assert.match(html, /国自然申请书/);
  assert.match(html, /汇报PPT/);
  assert.match(html, /修回回复/);
  assert.match(html, /论文初稿/);
  assert.match(html, /数据分析/);
  assert.match(html, /最近交付与推荐工作流/);
  assert.match(html, /今天需要你处理/);
  assert.match(html, /NSCLC 综述证据包/);
  assert.match(html, /国自然青年基金申请/);
  assert.match(html, /data-demo-title/);
  assert.match(html, /data-demo-status/);
  assert.match(html, /data-opl-readiness/);
  assert.match(html, /data-opl-modules/);
  assert.doesNotMatch(html, /mock OPL Adapter/);
  assert.doesNotMatch(html, /后台管理|控制台|Dashboard/);
});

test('web demo shell exposes the Figma V3 lightweight project workspace', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');

  assert.match(html, /轻量项目工作区/);
  assert.match(html, /项目/);
  assert.match(html, /任务/);
  assert.match(html, /证据/);
  assert.match(html, /交付物/);
  assert.match(html, /下一步建议/);
  assert.match(html, /交付流程/);
  assert.match(html, /证据与来源/);
  assert.match(html, /活动流/);
  assert.match(html, /交付物预览/);
  assert.match(html, /项目内 Prompt/);
  assert.match(html, /data-v3-project-title/);
  assert.match(html, /data-v3-next-step/);
  assert.match(html, /data-v3-usage-quota/);
  assert.match(html, /data-v3-deliverable-preview/);
});

test('web demo shell keeps CSS and data bridge separate', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');

  assert.match(html, /styles.css/);
  assert.match(html, /styles\/v3.css/);
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
