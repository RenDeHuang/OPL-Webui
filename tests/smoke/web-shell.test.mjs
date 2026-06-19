import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('one-person-lab-web shell exposes serious AI workbench product surface', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');

  assert.match(html, /One Person Lab Web/);
  assert.match(html, /figma-make-webui-alignment/);
  assert.match(html, /app-shell/);
  assert.match(html, /sidebar-shell/);
  assert.match(html, /New Chat/);
  assert.match(html, /Skills/);
  assert.match(html, /Foundry/);
  assert.match(html, /工作流/);
  assert.match(html, /account-dock/);
  assert.match(html, /account-popover/);
  assert.match(html, /prompt-command-center/);
  assert.match(html, /skill-launcher/);
  assert.match(html, /MedOPL/);
  assert.match(html, /hero-shell/);
  assert.match(html, /prompt-console/);
  assert.match(html, /问一个问题，启动一个 OPL 工作流/);
  assert.match(html, /OPL WebUI 应承接的五件事/);
  assert.match(html, /选择专业工作/);
  assert.match(html, /绑定真实材料/);
  assert.match(html, /推进长任务/);
  assert.match(html, /沉淀交付物/);
  assert.match(html, /管理运行时/);
  assert.match(html, /Foundry 启动中心/);
  assert.match(html, /账号与凭据状态/);
  assert.match(html, /OPL/);
  assert.match(html, /办公套件/);
  assert.match(html, /设计与代码/);
  assert.match(html, /内容创作/);
  assert.match(html, /工具/);
  assert.match(html, /MAS 论文/);
  assert.match(html, /MAG 基金/);
  assert.match(html, /RCA 可视化/);
  assert.match(html, /AI 幻灯片/);
  assert.match(html, /AI 表格/);
  assert.match(html, /AI 文档/);
  assert.match(html, /仪表盘与 CRM/);
  assert.match(html, /注册/);
  assert.match(html, /登录/);
  assert.match(html, /API Key/);
  assert.match(html, /Model gateway: https:\/\/gflabtoken\.cn\/v1/);
  assert.match(html, /https:\/\/gflabtoken\.cn\/v1/);
  assert.match(html, /普通聊天/);
  assert.match(html, /从普通聊天进入 Research、Grant、Presentation 等专业工作流/);
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
  assert.doesNotMatch(html, /styles\/v3\.css/);
  assert.doesNotMatch(html, /轻量项目工作区|Workspace memory|demoData|demo:\/\/|Drive|云盘|无限计算资源|创始人计划|团队|定价|\/api\/mvp\/task|fake storage|fake billing|fake runtime execution/);
});

test('one-person-lab-web shell keeps internal workspace concepts hidden', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');
  const webSource = [
    'apps/web/src/onePersonLabWeb.mjs',
    'apps/web/src/onePersonLabWebState.mjs',
    'apps/web/src/onePersonLabWebDom.mjs',
  ].map((path) => readFileSync(path, 'utf8')).join('\n');

  assert.doesNotMatch(html, /workspace|runtime tab|Drive|云盘|无限计算资源|创始人计划|fake storage|fake billing|fake runtime execution/i);
  assert.doesNotMatch(webSource, /\/api\/mvp\/task|demoData|demo:\/\/|fake storage|fake billing|fake runtime execution/i);
  assert.ok((webSource.match(/loadOnePersonLabWebState\(fetch, \{ loadSnapshot: false \}\)/g) ?? []).length >= 3);
  assert.match(webSource, /dataset\.chatState/);
  assert.match(webSource, /chatStateForResult/);
  assert.match(webSource, /\/api\/chat/);
  assert.match(webSource, /\/api\/settings\/model-provider/);
});

test('settings hash has a dedicated productized settings surface', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');

  assert.match(html, /href="#settings"/);
  assert.match(html, /id="settings"/);
  assert.match(html, /data-settings-panel/);
  assert.match(html, /data-account-settings-link/);
  assert.match(html, /data-account-popover/);
  assert.match(html, /登录状态/);
  assert.match(html, /API Key 绑定状态/);
  assert.match(html, /不可编辑/);
  assert.match(html, /保存\/更新 API Key/);
  assert.match(html, /退出登录/);
});

test('retired demo bridge is removed', () => {
  assert.equal(existsSync('apps/web/src/demoData.mjs'), false);
});
