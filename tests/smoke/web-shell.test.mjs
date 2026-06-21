import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('one-person-lab-web shell exposes research SaaS workbench product surface', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');

  assert.match(html, /One Person Lab Web/);
  assert.match(html, /多租户 SaaS 版 One Person Lab/);
  assert.match(html, /科研工作人员、硕博、PI 与科研团队/);
  assert.match(html, /figma-make-webui-alignment/);
  assert.match(html, /data-figma-source="E8nYfNFc2D9P01FYZ8UwBW"/);
  assert.match(html, /data-figma-pattern="collapsed_expanded_left_rail"/);
  assert.match(html, /data-figma-pattern="account_popover_status"/);
  assert.match(html, /data-figma-pattern="prompt_command_center"/);
  assert.match(html, /data-figma-pattern="research_skill_launcher"/);
  assert.match(html, /data-figma-pattern="right_inspector_tabs_files_progress_output"/);
  assert.match(html, /data-figma-pattern="running_blocked_turn_state"/);
  assert.match(html, /data-visual-quality-gate="repo_local_visual_baseline_captured_pending_responsive_visual_qa"/);
  assert.match(html, /app-shell/);
  assert.match(html, /data-shell-state="app_default_chat"/);
  assert.match(html, /sidebar-shell/);
  assert.match(html, /data-left-rail-state="collapsed"/);
  assert.match(html, /data-left-rail-toggle/);
  assert.match(html, /New Chat/);
  assert.match(html, /科研能力/);
  assert.match(html, /论文/);
  assert.match(html, /基金/);
  assert.match(html, /账号/);
  assert.match(html, /account-dock/);
  assert.match(html, /account-popover/);
  assert.match(html, /prompt-command-center/);
  assert.match(html, /skill-launcher/);
  assert.match(html, /data-right-inspector/);
  assert.match(html, /data-right-inspector-state="hidden"/);
  assert.match(html, /data-right-inspector-tab="files"/);
  assert.match(html, /data-right-inspector-tab="progress"/);
  assert.match(html, /data-right-inspector-tab="output"/);
  assert.match(html, /data-inspector-files-refs/);
  assert.match(html, /data-inspector-progress-projection/);
  assert.match(html, /data-inspector-output-refs/);
  assert.match(html, /input_ref: protocol\.pdf/);
  assert.match(html, /progress_ref: research_plan/);
  assert.match(html, /output_ref: research-plan-draft/);
  assert.match(html, /视觉 QA gate/);
  assert.match(html, /desktop screenshot reviewed/);
  assert.match(html, /mobile screenshot reviewed/);
  assert.match(html, /data-api-key-dialog/);
  assert.match(html, /data-api-key-dialog-state="closed"/);
  assert.match(html, /data-research-launcher/);
  assert.match(html, /data-research-task/);
  assert.match(html, /data-research-task-intent/);
  assert.match(html, /data-capability-marker/);
  assert.match(html, /data-capability-mode/);
  assert.match(html, /MedOPL/);
  assert.match(html, /hero-shell/);
  assert.match(html, /prompt-console/);
  assert.match(html, /@科研、@论文、@基金/);
  assert.match(html, /输入科研问题或 @能力入口/);
  assert.match(html, /OPL WebUI 应承接的五件事/);
  assert.match(html, /选择专业工作/);
  assert.match(html, /绑定真实材料/);
  assert.match(html, /进入科研工作流/);
  assert.match(html, /沉淀交付物/);
  assert.match(html, /保留普通聊天/);
  assert.match(html, /科研能力入口/);
  assert.match(html, /账号与凭据状态/);
  assert.match(html, /OPL/);
  assert.match(html, /科研任务入口/);
  assert.match(html, /@科研/);
  assert.match(html, /@论文/);
  assert.match(html, /@基金/);
  assert.match(html, /@综述/);
  assert.match(html, /注册/);
  assert.match(html, /登录/);
  assert.match(html, /API Key/);
  assert.match(html, /Model gateway: https:\/\/gflabtoken\.cn\/v1/);
  assert.match(html, /https:\/\/gflabtoken\.cn\/v1/);
  assert.match(html, /普通聊天/);
  assert.match(html, /普通聊天是 fallback/);
  assert.match(html, /普通问答/);
  assert.match(html, /开题\/研究方向/);
  assert.match(html, /论文问题/);
  assert.match(html, /基金计划/);
  assert.match(html, /综述地图/);
  assert.match(html, /材料线索/);
  assert.match(html, /论文/);
  assert.match(html, /基金/);
  assert.match(html, /综述/);
  assert.match(html, /材料/);
  assert.match(html, /@基金/);
  assert.match(html, /@文件/);
  assert.doesNotMatch(html, /@RCA/);
  assert.match(html, /需要 MedOPL 授权/);
  assert.match(html, /该能力需要在 MedOPL 开通后继续/);
  assert.match(html, /medopl\.medopl\.cn/);
  assert.match(html, /chat-log/);
  assert.match(html, /settings-panel/);
  assert.match(html, /data-account-lifecycle-status/);
  assert.match(html, /data-team-readiness-status/);
  assert.match(html, /data-quota-status/);
  assert.match(html, /data-account-audit-status/);
  assert.match(html, /data-reliability-status/);
  assert.match(html, /data-reliability-title/);
  assert.match(html, /data-reliability-action/);
  assert.match(html, /data-reliability-details/);
  assert.match(html, /data-running-turn/);
  assert.match(html, /data-blocked-turn/);
  assert.match(html, /src\/onePersonLabWeb\.mjs/);
  assert.doesNotMatch(html, /styles\/v3\.css/);
  assert.doesNotMatch(html, /MedOPL Runtime|node pool|托管运行环境|轻量项目工作区|Workspace memory|demoData|demo:\/\/|Drive|云盘|无限计算资源|创始人计划|定价|\/api\/mvp\/task|fake storage|fake billing|fake runtime execution|设计与代码|内容创作|仪表盘与 CRM/);
});

test('one-person-lab-web shell keeps internal workspace concepts hidden', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');
  const webSource = [
    'apps/web/src/onePersonLabWeb.mjs',
    'apps/web/src/onePersonLabWebState.mjs',
    'apps/web/src/onePersonLabWebDom.mjs',
  ].map((path) => readFileSync(path, 'utf8')).join('\n');

  assert.doesNotMatch(html, /workspace|runtime tab|MedOPL Runtime|node pool|托管运行环境|Drive|云盘|无限计算资源|创始人计划|fake storage|fake billing|fake runtime execution/i);
  assert.doesNotMatch(webSource, /\/api\/mvp\/task|demoData|demo:\/\/|fake storage|fake billing|fake runtime execution/i);
  assert.ok((webSource.match(/loadOnePersonLabWebState\(fetch, \{ loadSnapshot: false \}\)/g) ?? []).length >= 3);
  assert.match(webSource, /dataset\.chatState/);
  assert.match(webSource, /dataset\.shellState/);
  assert.match(webSource, /dataset\.leftRailState/);
  assert.match(webSource, /dataset\.rightInspectorState/);
  assert.match(webSource, /dataset\.apiKeyDialogState/);
  assert.match(webSource, /chatStateForResult/);
  assert.match(webSource, /chatStateForPrompt/);
  assert.doesNotMatch(webSource, /if \(requiresRuntimeGate\(message\)\) \{\n\s+document\.body\.dataset\.chatState = chatStateForResult/);
  assert.match(webSource, /\/api\/chat/);
  assert.match(webSource, /\/api\/settings\/model-provider/);
});

test('hidden shell overlays cannot intercept browser input', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');
  const css = readFileSync('apps/web/styles.css', 'utf8');

  assert.match(html, /class="api-key-dialog"[\s\S]*hidden/);
  assert.match(html, /class="right-inspector"[\s\S]*hidden/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
});

test('shell css carries responsive Figma workspace constraints', () => {
  const css = readFileSync('apps/web/styles.css', 'utf8');

  assert.match(css, /--left-rail-collapsed:\s*82px/);
  assert.match(css, /--left-rail-expanded:\s*260px/);
  assert.match(css, /--inspector-min:\s*320px/);
  assert.match(css, /--inspector-max:\s*520px/);
  assert.match(css, /data-visual-density="quiet_dense_workbench"/);
  assert.match(css, /data-figma-pattern="right_inspector_tabs_files_progress_output"/);
  assert.match(css, /@media \(max-width:1040px\)/);
  assert.match(css, /@media \(max-width:760px\)/);
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
  assert.match(html, /账号生命周期/);
  assert.match(html, /团队状态/);
  assert.match(html, /额度状态/);
  assert.match(html, /最近审计/);
  assert.match(html, /不可编辑/);
  assert.match(html, /保存\/更新 API Key/);
  assert.match(html, /退出登录/);
});

test('retired demo bridge is removed', () => {
  assert.equal(existsSync('apps/web/src/demoData.mjs'), false);
});
