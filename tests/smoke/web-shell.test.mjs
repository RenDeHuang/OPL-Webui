import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

function visibleTextFromHTML(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test('one-person-lab-web shell exposes AI-native research homepage product surface', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');
  const visibleText = visibleTextFromHTML(html);

  assert.match(html, /One Person Lab Web/);
  assert.match(html, /Controlled Knowledge Delivery/);
  assert.match(html, /为研究者而建的 AI 工作台/);
  assert.match(html, /从科研任务场景开始/);
  assert.match(html, /figma-parity-ui-replacement/);
  assert.match(html, /data-figma-source="E8nYfNFc2D9P01FYZ8UwBW"/);
  assert.match(html, /data-replacement-target="figma_make_ui_ux_for_commercial_launch"/);
  assert.match(html, /data-figma-pattern="public_landing_auth_workbench_sidebar_composer_inspector"/);
  assert.match(html, /data-figma-pattern="centered_composer_research_mode_pills"/);
  assert.match(html, /data-figma-pattern="research_mode_pills"/);
  assert.match(html, /data-figma-pattern="account_popover_status"/);
  assert.match(html, /data-figma-pattern="workbench_result_refs_inspector"/);
  assert.match(html, /data-figma-pattern="task_history_continuation_tree"/);
  assert.match(html, /data-figma-pattern="blocked_runtime_gate"/);
  assert.match(html, /data-figma-pattern="inspector_tabs_files_progress_output"/);
  assert.match(html, /data-visual-quality-gate="ui_ux_v1_production_accepted_current_head"/);
  assert.match(html, /data-ui-variant="figma_parity_replacement_v0"/);
  assert.match(html, /data-visual-density="low_stimulus_command_home"/);
  assert.match(html, /data-view="home"/);
  assert.match(html, /data-shell-state="home_default"/);
  assert.match(html, /data-side-navigation/);
  assert.match(html, /data-nav-item="home"[^>]*data-shell-action="home"[^>]*>新建对话/);
  assert.match(html, /data-nav-item="projects"[^>]*data-shell-action="projects"[^>]*>任务历史/);
  assert.match(html, /data-nav-item="skills"[^>]*data-shell-action="skills"[^>]*>Skill/);
  assert.match(html, /data-nav-item="workflows"[^>]*data-shell-action="workflows"[^>]*>工作流/);
  assert.match(html, /data-nav-item="projects"[^>]*data-shell-action="projects"[^>]*>任务历史/);
  assert.match(html, /data-nav-item="search"[^>]*data-shell-action="search"[^>]*>搜索/);
  assert.match(html, /data-nav-item="more"[^>]*data-shell-action="more"[^>]*>More/);
  assert.match(html, /data-search-trigger/);
  assert.match(html, /data-first-view/);
  assert.match(html, /data-public-growth-layer/);
  assert.match(html, /data-public-landing-surface/);
  assert.match(html, /data-auth-surface/);
  assert.match(html, /data-workbench-surface/);
  assert.match(html, /data-results-surface/);
  assert.match(html, /data-task-history-surface/);
  assert.match(html, /data-public-hero/);
  assert.match(html, /data-public-task-section/);
  assert.match(html, /data-public-output-section/);
  assert.match(html, /data-public-audience-section/);
  assert.match(html, /data-public-trust-section/);
  assert.match(html, /data-public-start-path/);
  assert.match(html, /data-public-start-cta/);
  assert.equal((html.match(/data-public-task-entry(?=[\s>])/g) ?? []).length, 7);
  for (const marker of ['@科研', '@论文', '@基金', '@综述', '@文件', '@PPT', '@书']) {
    assert.match(html, new RegExp(`data-public-task-entry[\\s\\S]{0,240}${marker}`));
  }
  for (const required of ['progress refs', 'deliverable refs', 'materials refs', 'blocker/next step', 'MedOPL/OPL deeplink']) {
    assert.match(html, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const audience of ['个人研究者', '博士/硕士', 'PI', '课题组/单位']) {
    assert.match(html, new RegExp(audience.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(html, /fail-closed/);
  assert.match(html, /不伪造结果/);
  assert.match(html, /专业执行和 artifact\/storage truth 在 MedOPL\/OPL/);
  assert.match(html, /data-first-view-contract="side_nav_brand_composer_chips_right_inspector_rail"/);
  assert.match(html, /composer-card/);
  assert.match(html, /data-starter-chips/);
  assert.equal((html.match(/data-starter-chip(?=[\s>])/g) ?? []).length, 7);
  assert.match(html, /随心输入/);
  assert.match(html, /deliverable refs/);
  assert.doesNotMatch(visibleText, /Public Growth Layer|Account-based User Product Layer|Minimal Admin\/Ops Layer|operator controls|Web execution: forbidden/);
  assert.doesNotMatch(html, /hero-shell/);
  assert.match(html, /figma-parity-shell/);
  assert.doesNotMatch(html, /app-shell|home-first-view|prompt-console|public-proof-grid|foundry-section|workflow-section|project-section|turn-state-strip|chat-panel|right-inspector-rail/);
  assert.doesNotMatch(html, /sidebar-shell|left-rail-toggle|data-left-rail|conversation-list|data-local-sidebar|workspace-sidebar|workbench-summary-strip|clean_workbench_v1/);
  assert.doesNotMatch(html, /<nav[^>]*data-side-navigation[\s\S]*?(科研能力|论文|基金|账号|Settings|API Key|文件|进度|输出)[\s\S]*?<\/nav>/);
  assert.doesNotMatch(html, /data-projects-sheet/);
  assert.match(html, /data-task-history-route/);
  assert.match(html, /data-task-history-center/);
  assert.match(html, /data-task-history-list/);
  assert.match(html, /data-task-history-empty/);
  assert.match(html, /refs_status_metadata_only/);
  assert.match(html, /data-search-sheet/);
  assert.match(html, /data-overlay-close="search"/);
  assert.match(html, /data-conversation-search/);
  assert.match(html, /data-conversation-history/);
  assert.match(html, /data-conversation-empty/);
  assert.doesNotMatch(html, /data-local-search/);
  assert.match(html, /account-dock/);
  assert.match(html, /account-popover/);
  assert.match(html, /data-account-popover-close/);
  assert.doesNotMatch(html, /<\/dl>\s*<\/dl>/);
  assert.match(html, /prompt-composer/);
  assert.match(html, /mode-grid/);
  assert.match(html, /data-inspector-sheet/);
  assert.match(html, /data-inspector-open="files"/);
  assert.match(html, /data-inspector-resize-handle/);
  assert.match(html, /data-inspector-state="hidden"/);
  assert.match(html, /data-inspector-tab="files"/);
  assert.match(html, /data-inspector-tab="progress"/);
  assert.match(html, /data-inspector-tab="output"/);
  assert.match(html, /data-inspector-files-refs/);
  assert.match(html, /data-inspector-progress-projection/);
  assert.match(html, /data-inspector-output-refs/);
  assert.doesNotMatch(html, /input_ref: protocol\.pdf/);
  assert.doesNotMatch(html, /progress_ref: research_plan/);
  assert.doesNotMatch(html, /output_ref: research-plan-draft/);
  assert.doesNotMatch(html, /视觉 QA gate/);
  assert.doesNotMatch(html, /desktop screenshot reviewed/);
  assert.doesNotMatch(html, /mobile screenshot reviewed/);
  assert.match(html, /data-api-key-dialog/);
  assert.match(html, /data-api-key-dialog-state="closed"/);
  assert.match(html, /data-research-launcher/);
  assert.match(html, /data-research-task/);
  assert.match(html, /data-research-task-intent/);
  assert.match(html, /data-capability-marker/);
  assert.match(html, /data-capability-mode/);
  assert.match(html, /MedOPL/);
  assert.match(html, /@科研、@论文、@基金、@综述、@文件、@PPT、@书/);
  assert.match(html, /选择一个任务入口或直接输入问题/);
  assert.match(html, /导入 Skill/);
  assert.match(html, /我的 Skill/);
  assert.match(html, /OPL Skill/);
  assert.match(html, /制定工作流/);
  assert.match(html, /导入工作流/);
  assert.match(html, /我的工作流/);
  assert.match(html, /OPL 工作流/);
  assert.match(html, /最近任务 \/ 历史任务/);
  assert.match(html, /暂无历史任务/);
  assert.match(html, /新建任务/);
  assert.match(html, /data-more-overflow/);
  assert.match(html, /暂时没有更多入口/);
  assert.match(html, /OPL/);
  assert.match(html, /科研任务入口/);
  assert.match(html, /@科研/);
  assert.match(html, /@论文/);
  assert.match(html, /@基金/);
  assert.match(html, /@综述/);
  assert.match(html, /@PPT/);
  assert.match(html, /@书/);
  assert.match(html, /注册/);
  assert.match(html, /登录/);
  assert.match(html, /API Key/);
  assert.match(html, /data-model-selector/);
  assert.match(html, /模型/);
  assert.doesNotMatch(html, /Model gateway: https:\/\/gflabtoken\.cn\/v1/);
  assert.doesNotMatch(html, /https:\/\/gflabtoken\.cn\/v1/);
  assert.match(html, /普通聊天/);
  assert.doesNotMatch(visibleText, /\b(fallback|artifact body|runtime truth)\b/i);
  assert.match(html, /普通问答/);
  assert.match(html, /开题\/研究方向/);
  assert.match(html, /论文问题/);
  assert.match(html, /基金计划/);
  assert.match(html, /综述地图/);
  assert.match(html, /材料线索/);
  assert.match(html, /演示\/PPT/);
  assert.match(html, /写书\/长稿/);
  assert.match(html, /论文/);
  assert.match(html, /基金/);
  assert.match(html, /综述/);
  assert.match(html, /材料/);
  assert.match(html, /演示工作流/);
  assert.match(html, /写书工作流/);
  assert.match(html, /@基金/);
  assert.match(html, /@文件/);
  assert.doesNotMatch(html, /@RCA/);
  assert.match(html, /需要 MedOPL 授权/);
  assert.match(html, /该能力需要在 MedOPL 开通后继续/);
  assert.match(html, /medopl\.medopl\.cn/);
  assert.match(html, /chat-log/);
  assert.match(html, /data-result-stream-contract="artifact_first_not_test_log"/);
  assert.match(html, /data-research-artifact-policy="no_raw_assistant_transcript"/);
  assert.doesNotMatch(html, /settings-panel/);
  assert.doesNotMatch(html, /data-account-lifecycle-status/);
  assert.doesNotMatch(html, /data-team-readiness-status/);
  assert.doesNotMatch(html, /data-quota-status/);
  assert.doesNotMatch(html, /data-account-audit-status/);
  assert.match(html, /data-reliability-status/);
  assert.match(html, /data-reliability-title/);
  assert.match(html, /data-reliability-action/);
  assert.match(html, /data-reliability-details/);
  assert.match(html, /data-running-turn/);
  assert.match(html, /data-blocked-turn/);
  assert.match(html, /class="landing-panel[\s\S]*data-route-surface="home"/);
  assert.match(html, /class="workbench-panel[\s\S]*data-route-surface="home"/);
  assert.match(html, /class="result-panel[\s\S]*data-route-surface="home"/);
  assert.match(html, /class="more-panel[\s\S]*data-route-surface="more"/);
  assert.match(html, /class="library-panel skill-panel"[\s\S]*data-route-surface="skills"/);
  assert.match(html, /class="library-panel workflow-panel"[\s\S]*data-route-surface="workflows"/);
  assert.match(html, /class="history-panel"[\s\S]*data-route-surface="projects"/);
  assert.match(html, /class="runtime-gate"[\s\S]*data-route-surface="home"/);
  assert.match(html, /src\/onePersonLabWeb\.mjs/);
  assert.doesNotMatch(html, /styles\/v3\.css/);
  assert.doesNotMatch(html, /\/api\/search|\/api\/projects|MedOPL Runtime|node pool|托管运行环境|轻量项目工作区|Workspace memory|demoData|demo:\/\/|Drive|云盘|无限计算资源|创始人计划|定价|支付|充值|Pro 套餐|积分余额|\/api\/mvp\/task|fake storage|fake billing|fake runtime execution|设计与代码|内容创作|仪表盘与 CRM|#(?:capabilities|chat|settings|medopl)(?=["'\s<>]|$)/);
});

test('one-person-lab-web shell keeps internal workspace concepts hidden', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');
  const webSource = [
    'apps/web/src/onePersonLabWeb.mjs',
    'apps/web/src/onePersonLabWebState.mjs',
    'apps/web/src/onePersonLabWebDom.mjs',
  ].map((path) => readFileSync(path, 'utf8')).join('\n');

  assert.doesNotMatch(html, /workspace|runtime tab|MedOPL Runtime|node pool|托管运行环境|Drive|云盘|无限计算资源|创始人计划|Pro 套餐|积分余额|fake storage|fake billing|fake runtime execution|left rail/i);
  assert.doesNotMatch(webSource, /\/api\/mvp\/task|demoData|demo:\/\/|fake storage|fake billing|fake runtime execution/i);
  assert.ok((webSource.match(/loadOnePersonLabWebState\(fetch, \{ loadSnapshot: false \}\)/g) ?? []).length >= 3);
  assert.match(webSource, /dataset\.chatState/);
  assert.match(webSource, /dataset\.shellState/);
  assert.match(webSource, /dataset\.inspectorState/);
  assert.match(webSource, /dataset\.apiKeyDialogState/);
  assert.match(webSource, /function handleGlobalKeydown\(event\)[\s\S]*closeOverlay\(name, true\)[\s\S]*closeAccountPopover\(true\)/);
  assert.doesNotMatch(webSource, /leftRailState|data-left-rail|left_sidebar_expanded/);
  assert.match(webSource, /chatStateForResult/);
  assert.match(webSource, /chatStateForPrompt/);
  assert.match(webSource, /checkRuntimeGate\(fetch, task\)/);
  assert.match(webSource, /runRuntimeTask\(fetch, \{ \.\.\.task, gateRefs/);
  assert.doesNotMatch(webSource, /if \(requiresRuntimeGate\(message\)\)[\s\S]{0,800}sendChatMessage\(fetch, message\)/);
  assert.doesNotMatch(webSource, /if \(requiresRuntimeGate\(message\)\) \{\n\s+document\.body\.dataset\.chatState = chatStateForResult/);
  assert.match(webSource, /\/api\/chat/);
  assert.match(webSource, /\/api\/opl\/runtime-gate/);
  assert.match(webSource, /\/api\/opl\/runs/);
  assert.match(webSource, /\/api\/settings\/model-provider/);
});

test('hidden shell overlays cannot intercept browser input', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');
  const css = readFileSync('apps/web/styles.css', 'utf8');

  assert.match(html, /class="api-key-dialog"[\s\S]*hidden/);
  assert.match(html, /class="inspector-sheet"[\s\S]*hidden/);
  assert.match(html, /class="overlay-sheet"[\s\S]*hidden/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
});

test('shell css carries responsive low-stimulus homepage constraints', () => {
  const css = readFileSync('apps/web/styles.css', 'utf8');

  assert.match(css, /--inspector-min:\s*320px/);
  assert.match(css, /--inspector-max:\s*520px/);
  assert.match(css, /--primary:\s*#2f6b4f/);
  assert.match(css, /--focus-ring:\s*rgba\(47,\s*107,\s*79,\s*0\.28\)/);
  assert.doesNotMatch(css, /#2563eb|#6366f1|#8b5cf6/);
  assert.match(css, /data-visual-density="low_stimulus_command_home"/);
  assert.match(css, /figma-parity-shell/);
  assert.match(css, /landing-panel/);
  assert.match(css, /workbench-panel/);
  assert.match(css, /result-panel/);
  assert.match(css, /history-panel/);
  assert.match(css, /data-figma-pattern="inspector_tabs_files_progress_output"/);
  assert.match(css, /body\[data-view="home"\]\s+\[data-route-surface\]:not\(\[data-route-surface~="home"\]\)/);
  assert.match(css, /body\[data-view="skills"\]\s+\[data-route-surface\]:not\(\[data-route-surface~="skills"\]\)/);
  assert.match(css, /body\[data-view="workflows"\]\s+\[data-route-surface\]:not\(\[data-route-surface~="workflows"\]\)/);
  assert.match(css, /body\[data-view="projects"\]\s+\[data-route-surface\]:not\(\[data-route-surface~="projects"\]\)/);
  assert.match(css, /body\[data-view="more"\]\s+\[data-route-surface\]:not\(\[data-route-surface~="more"\]\)/);
  assert.match(css, /\.side-navigation/);
  assert.match(css, /\.inspector-trigger-stack/);
  assert.match(css, /body\[data-inspector-state="files"\]\s+\.figma-parity-shell/);
  assert.match(css, /body\[data-inspector-state="progress"\]\s+\.figma-parity-shell/);
  assert.match(css, /body\[data-inspector-state="output"\]\s+\.figma-parity-shell/);
  assert.match(css, /\.mode-grid/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*no-preference\)/);
  assert.match(css, /:active/);
  assert.match(css, /:disabled/);
  assert.match(css, /\[aria-disabled="true"\]/);
  assert.match(css, /\[data-loading="true"\]/);
  assert.match(css, /\.inspector-sheet\[data-responsive-placement="bottom_sheet"\]/);
  assert.match(css, /max-height:\s*64vh/);
  assert.doesNotMatch(css, /max-height:\s*78vh/);
  assert.doesNotMatch(css, /home-first-view|prompt-console|public-proof-grid|foundry-section|workflow-section|project-section|right-inspector-rail|left-rail|sidebar-shell|conversation-list|quiet_dense_workbench|clean_workbench_v1/);
  assert.match(css, /@media \(max-width:\s*1040px\)/);
  assert.match(css, /@media \(max-width:\s*760px\)/);
});

test('active UI truth no longer narrates the retired workbench shell as current', () => {
  const activeTruth = [
    'TASTE.md',
    'docs/status.md',
    'docs/active/README.md',
    'scripts/test-classification.mjs',
  ].map((path) => readFileSync(path, 'utf8')).join('\n');

  assert.match(activeTruth, /ai_native_research_home_v1/);
  assert.match(activeTruth, /subject-first|subject first|Subject-first/);
  assert.match(activeTruth, /components follow surface ownership|component behavior law|组件按行为/i);
  assert.match(activeTruth, /visual identity|visualIdentity|视觉人格/i);
  assert.match(activeTruth, /visual quality rubric|visualQualityRubric|视觉质量/i);
  assert.match(activeTruth, /owner receipt protocol|ownerReceiptProtocol|owner receipt/i);
  assert.match(activeTruth, /OPL green|OPL Green|opl_green/);
  assert.doesNotMatch(activeTruth, /current repo-local UI variant is `clean_workbench_v1`|clean workbench UI variant|workbench command band|summary strip|current subject: dashboard|current subject: CRM|current subject: settings center|current subject: runtime console|current subject: card grid/i);
  for (const path of ['DESIGN.md', 'UI_GOVERNANCE.md', 'docs/ui_governance.md', 'docs/design_system.md']) {
    assert.equal(existsSync(path), false, `UI governance must stay in existing truth surfaces, not ${path}`);
  }
});

test('more surface stays empty overflow and account actions stay in avatar flow', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');

  assert.match(html, /href="#more"/);
  assert.match(html, /id="more"/);
  assert.match(html, /data-more-overflow/);
  assert.match(html, /data-more-empty/);
  assert.match(html, /暂时没有更多入口/);
  assert.doesNotMatch(html, /data-account-settings-link/);
  assert.match(html, /data-account-popover/);
  assert.match(html, /登录状态/);
  assert.match(html, /API Key 绑定状态/);
  assert.doesNotMatch(html, /账号生命周期/);
  assert.doesNotMatch(html, /团队状态/);
  assert.doesNotMatch(html, /额度状态/);
  assert.doesNotMatch(html, /最近审计/);
  assert.doesNotMatch(html, /不可编辑|fixed base_url|Model gateway/);
  assert.match(html, /保存\/更新 API Key/);
  assert.match(html, /退出登录/);
  assert.doesNotMatch(html, /<span class="account-avatar" aria-hidden="true">人<\/span>/);
});

test('retired demo bridge is removed', () => {
  assert.equal(existsSync('apps/web/src/demoData.mjs'), false);
});
