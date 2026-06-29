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

test('web shell mounts the Figma Make direct-copy replacement target', () => {
  const html = readFileSync('apps/web/index.html', 'utf8');
  const dom = readFileSync('apps/web/src/onePersonLabWebDom.mjs', 'utf8');
  const continuation = readFileSync('apps/web/src/onePersonLabWebContinuation.mjs', 'utf8');
  const shellSource = `${dom}\n${continuation}`;
  const state = readFileSync('apps/web/src/onePersonLabWebState.mjs', 'utf8');
  const visibleText = visibleTextFromHTML(html);

  assert.match(html, /<div\s+id="app"/);
  assert.match(html, /data-replacement-target="figma_make_ui_ux_for_commercial_launch"/);
  assert.match(html, /data-figma-source="1MNO5l7PQYKZVNqQgw6DGS"/);
  assert.match(state, /FIGMA_MAKE_SOURCE = '1MNO5l7PQYKZVNqQgw6DGS'/);
  assert.match(dom, /public_landing/);
  assert.match(dom, /auth_login_register/);
  assert.match(dom, /home_default/);
  assert.match(dom, /running_turn/);
  assert.match(dom, /blocked_turn/);
  assert.match(dom, /quota_exceeded/);
  assert.match(dom, /side_navigation_new_chat_projects_skill_workflow_search_more/);
  assert.match(dom, /data-shell-action="home"/);
  assert.match(dom, /data-account-toggle/);
  assert.match(dom, /data-account-popover/);
  assert.match(dom, /data-public-growth-layer/);
  assert.match(dom, /data-public-start-cta/);
  assert.match(dom, /data-workbench-surface/);
  assert.match(dom, /data-chat-form/);
  assert.match(dom, /data-research-task-intent/);
  assert.match(dom, /data-results-surface/);
  assert.match(dom, /data-project-window-list/);
  assert.match(shellSource, /data-inspector-sheet/);
  assert.match(shellSource, /data-inspector-open="autonomy"/);
  assert.match(dom, /data-api-key-dialog/);
  assert.doesNotMatch(html, /figma-parity-shell|landing-panel|workbench-panel|result-panel|history-panel|runtime-gate/);
  assert.doesNotMatch(visibleText, /Public Growth Layer|Account-based User Product Layer|Minimal Admin\/Ops Layer|operator controls/);
});

test('web shell copy grammar blocks mock truth from the zip prototype', () => {
  const source = [
    readFileSync('apps/web/index.html', 'utf8'),
    readFileSync('apps/web/src/onePersonLabWebDom.mjs', 'utf8'),
  ].join('\n');

  for (const marker of ['@科研', '@论文', '@基金', '@综述', '@文件', '@PPT', '@书']) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const required of ['progress refs', 'deliverable refs', 'materials refs', 'blocker/next step', 'MedOPL/OPL deeplink']) {
    assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(source, /Go control plane/);
  assert.match(source, /MedOPL continuation ready \/ refs available/);
  assert.match(source, /readonly commercial projection/);
  assert.doesNotMatch(source, /initProjects|mockResult|fileItems|demoData|demo:\/\/|fake storage|fake billing|fake runtime execution/i);
  assert.doesNotMatch(source, /Pro 套餐|积分余额|充值|无限计算资源|Drive|云盘|runtime · 已完成|制品内容|artifact body authority/i);
  assert.doesNotMatch(source, /\/_ops|operator controls|admin ops/i);
});

test('web shell css follows the Figma Make layout and responsive inspector shape', () => {
  const css = readFileSync('apps/web/styles.css', 'utf8');

  assert.match(css, /--background:\s*#f5f2ec/);
  assert.match(css, /--primary:\s*#2f6b4f/);
  assert.match(css, /--sidebar:\s*#ede9e0/);
  assert.match(css, /font-family:\s*"DM Sans"/);
  assert.match(css, /\.public-landing/);
  assert.match(css, /\.auth-page/);
  assert.match(css, /\.app-shell/);
  assert.match(css, /\.sidebar/);
  assert.match(css, /\.sidebar \* \{ min-width: 0; max-width: 100%; \}/);
  assert.match(css, /\.home-composer/);
  assert.match(css, /\.result-view/);
  assert.match(css, /\.inspector-sheet/);
  assert.match(css, /max-height:\s*64vh/);
  assert.match(css, /@media \(max-width:\s*760px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(css, /figma-parity-shell|landing-panel|workbench-panel|result-panel|history-panel|right-inspector-rail|clean_workbench_v1/);
  assert.doesNotMatch(css, /#2563eb|#6366f1|#8b5cf6/);
});

test('go control plane serves real SPA routes such as /home without asset fallback', () => {
  const main = readFileSync('services/control-plane-go/cmd/opl-webui-control-plane/main.go', 'utf8');
  const testSource = readFileSync('services/control-plane-go/cmd/opl-webui-control-plane/main_test.go', 'utf8');

  assert.match(main, /mux\.HandleFunc\("\/", handleWebApp\)/);
  assert.match(main, /filepath\.Ext\(cleanPath\) != ""[\s\S]*http\.NotFound/);
  assert.match(testSource, /TestHandleWebAppServesSPAHomeRoute/);
  assert.match(testSource, /TestHandleWebAppDoesNotFallbackMissingAssets/);
});

test('retired demo bridge is removed', () => {
  assert.equal(existsSync('apps/web/src/demoData.mjs'), false);
});
