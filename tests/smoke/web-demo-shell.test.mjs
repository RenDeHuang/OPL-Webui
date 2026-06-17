import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('one-person-lab-web shell exposes Genspark-like chat-first product surface', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');

  assert.match(html, /One Person Lab Web/);
  assert.match(html, /Chat/);
  assert.match(html, /Capabilities/);
  assert.match(html, /Settings/);
  assert.match(html, /MedOPL/);
  assert.match(html, /hero-shell/);
  assert.match(html, /prompt-console/);
  assert.match(html, /注册/);
  assert.match(html, /登录/);
  assert.match(html, /API Key/);
  assert.match(html, /Model gateway: https:\/\/gflabtoken\.cn\/v1/);
  assert.match(html, /https:\/\/gflabtoken\.cn\/v1/);
  assert.match(html, /普通聊天/);
  assert.match(html, /用普通聊天进入复杂知识工作/);
  assert.match(html, /普通问答/);
  assert.match(html, /论文/);
  assert.match(html, /基金/);
  assert.match(html, /综述/);
  assert.match(html, /PPT/);
  assert.match(html, /数据分析/);
  assert.match(html, /长任务/);
  assert.match(html, /@基金/);
  assert.match(html, /需要 MedOPL Runtime/);
  assert.match(html, /该能力需要托管运行环境、存储或 node pool/);
  assert.match(html, /medopl\.medopl\.cn/);
  assert.match(html, /chat-log/);
  assert.match(html, /settings-panel/);
  assert.match(html, /src\/onePersonLabWeb\.mjs/);
  assert.doesNotMatch(html, /轻量项目工作区|Workspace memory|demo:\/\/|Drive|团队|定价|\/api\/mvp\/task/);
});

test('one-person-lab-web shell keeps internal workspace concepts hidden', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');
  const dataBridge = readFileSync('apps/web/src/onePersonLabWeb.mjs', 'utf8');

  assert.doesNotMatch(html, /工作区|workspace|runtime tab/i);
  assert.doesNotMatch(dataBridge, /\/api\/mvp\/task|demoData|demo:\/\//);
  assert.match(dataBridge, /\/api\/chat/);
  assert.match(dataBridge, /\/api\/settings\/model-provider/);
});

test('settings hash has a dedicated productized settings surface', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');

  assert.match(html, /href="#settings"/);
  assert.match(html, /id="settings"/);
  assert.match(html, /data-settings-panel/);
  assert.match(html, /登录状态/);
  assert.match(html, /API Key 绑定状态/);
  assert.match(html, /不可编辑/);
  assert.match(html, /保存\/更新 API Key/);
  assert.match(html, /退出登录/);
});

test('retired demo bridge is removed', () => {
  assert.equal(existsSync('apps/web/src/demoData.mjs'), false);
});
