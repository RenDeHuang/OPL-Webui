import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runnerPath = 'tests/browser/research-main-path-runner.mjs';
const cloudRolloutWorkflowPath = '.github/workflows/cloud-rollout.yml';

test('research main path runs in a real browser and records page-state evidence', { timeout: 180000 }, () => {
  const result = spawnSync(process.execPath, [runnerPath], {
    encoding: 'utf8',
    timeout: 170000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const evidence = JSON.parse(result.stdout.trim().split('\n').at(-1));

  assert.equal(evidence.ok, true);
  assert.equal(evidence.path, 'research-main-path');
  assert.match(evidence.browser, /chrome|chromium/i);
  assert.equal(evidence.pageStates.authState, 'authenticated_bound');
  assert.equal(evidence.pageStates.chatState, 'runtime_required');
  assert.equal(evidence.pageStates.researchResultSections, 3);
  assert.equal(evidence.pageStates.runtimeTaskMarker, '@基金');
  assert.deepEqual(evidence.auditKinds.sort(), ['chat.completed', 'runtime_gate.required']);
  assert.ok(evidence.upstreamRequests >= 1);
  assert.equal(evidence.visualQuality.state, 'repo_local_visual_baseline_captured');
  assert.deepEqual(evidence.visualQuality.figmaSource, {
    fileKey: 'E8nYfNFc2D9P01FYZ8UwBW',
    nodeId: '0:1',
  });
  assert.equal(evidence.visualQuality.currentPhase, 'responsive_visual_qa');
  assert.equal(evidence.visualQuality.ownerReceipt.required, true);
  assert.equal(evidence.visualQuality.ownerReceipt.status, 'pending');
  assert.deepEqual(evidence.visualQuality.responsiveBreakpoints, ['desktop', 'tablet', 'mobile', 'compact']);
  for (const viewport of evidence.visualQuality.responsiveBreakpoints) {
    const visual = evidence.visualQuality.viewports[viewport];
    assert.equal(visual.screenshot.captured, true);
    assert.match(visual.screenshot.path, /^\.runtime\/browser-visual\/research-main-path-local-/);
    assert.equal(visual.layout.horizontalOverflowPx, 0);
    assert.equal(visual.layout.rightInspector.visible, true);
    assert.equal(visual.layout.rightInspector.withinViewport, true);
    assert.equal(visual.layout.activeInspectorPanel.visible, true);
    assert.equal(visual.layout.hiddenOverlayInterceptsInput, false);
    assert.equal(visual.layout.chatInputHitTarget, true);
    assert.equal(visual.layout.textOverflowCount, 0);
    assert.equal(visual.layout.interactiveTargetFailures.length, 0);
    assert.equal(visual.layout.focusableWithoutName.length, 0);
    assert.equal(visual.layout.focusRingProbe.visible, true);
  }
  assert.equal(evidence.visualQuality.accessibilityChecks.keyboardFocusVisible, true);
  assert.equal(evidence.visualQuality.accessibilityChecks.touchTargetsPass, true);
  assert.equal(evidence.visualQuality.accessibilityChecks.namedControlsPass, true);
  assert.equal(evidence.visualQuality.visualFitChecks.noTextOverflow, true);
  assert.equal(evidence.visualQuality.visualFitChecks.noHorizontalOverflow, true);
});

test('browser runner uses user-like browser input instead of direct DOM mutation', () => {
  const runner = readFileSync(runnerPath, 'utf8');

  for (const required of [
    '--production',
    'OPL_PRODUCTION_BROWSER_E2E',
    'OPL_DOGFOOD_EMAIL',
    'OPL_DOGFOOD_PASSWORD',
    'OPL_DOGFOOD_API_KEY',
    'https://opl.medopl.cn',
    'Input.dispatchMouseEvent',
    'Input.dispatchKeyEvent',
    'Input.insertText',
    'getBoundingClientRect',
    'Page.navigate',
    'Page.captureScreenshot',
    'Emulation.setDeviceMetricsOverride',
    'webSocketDebuggerUrl',
    'document.readyState === "complete"',
    'openSettingsRoute',
    '[data-shell-action="more"]',
    'openChatRoute',
    '[data-shell-action="new_chat"]',
  ]) {
    assert.match(runner, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.doesNotMatch(runner, /\.value\s*=(?!=)/);
  assert.doesNotMatch(runner, /\.click\(\)/);
  assert.doesNotMatch(runner, /requestSubmit\(\)/);
  assert.doesNotMatch(runner, /KUBECONFIG|kubectl|postgres:\/\//i);
  assert.doesNotMatch(runner, /console\.log[^\n]*(OPL_DOGFOOD_API_KEY|OPL_DOGFOOD_PASSWORD|config\.apiKey|config\.password)/);
});

test('production browser e2e prepares a browser without sudo and reports startup diagnostics', () => {
  const runner = readFileSync(runnerPath, 'utf8');
  const workflow = readFileSync(cloudRolloutWorkflowPath, 'utf8');

  assert.match(workflow, /production-browser-e2e:[\s\S]*?runs-on:\s*ubuntu-latest/);
  assert.match(workflow, /production-browser-e2e:[\s\S]*?actions\/setup-node@v4/);
  assert.match(workflow, /playwright install chromium/);
  assert.match(workflow, /OPL_BROWSER_BINARY/);
  assert.match(workflow, /GITHUB_ENV/);
  assert.match(workflow, /chrome-linux\*\/chrome/);
  assert.doesNotMatch(workflow, /--with-deps|sudo|apt-get|apt install/);
  assert.match(runner, /browser exited before DevTools became available/);
  assert.match(runner, /binary:/);
  assert.match(runner, /exitCode:/);
  assert.match(runner, /stderr:/);
  assert.match(runner, /stdout:/);
  assert.match(runner, /OPL_BROWSER_BINARY/);
  assert.match(runner, /preinstall Chrome\/Chromium/);
  assert.match(runner, /chrome-linux64/);
  assert.match(runner, /chrome-linux/);
});

test('production browser e2e accepts reusable dogfood accounts that are already key-bound', () => {
  const runner = readFileSync(runnerPath, 'utf8');

  assert.match(runner, /waitForBoundOrUnboundAuthState/);
  assert.doesNotMatch(runner, /waitForAuthState\(cdp,\s*'authenticated_unbound',\s*'login'\)/);
  assert.match(runner, /authenticated_unbound/);
  assert.match(runner, /authenticated_bound/);
});

test('production browser e2e waits for async research results and reports page evidence', () => {
  const runner = readFileSync(runnerPath, 'utf8');
  const markerExpression = '\'document.querySelector("[data-research-result]")?.dataset.researchResultMarker === "@科研"\'';

  assert.match(runner, /describeResearchResultState/);
  assert.doesNotMatch(runner, new RegExp(`assertPage\\(cdp,\\s*${markerExpression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(runner, new RegExp(`waitFor\\([\\s\\S]*?cdp,[\\s\\S]*?${markerExpression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?60000`));
  assert.match(runner, /structured research result marker missing/);
  assert.match(runner, /chatLogText/);
  assert.match(runner, /researchResultMarker/);
  assert.match(runner, /\/api\/account\/audit-events/);
});

test('production browser e2e preserves sanitized upstream failure audit metadata', () => {
  const runner = readFileSync(runnerPath, 'utf8');

  assert.match(runner, /eventMetadata/);
  assert.match(runner, /upstreamStatus/);
  assert.match(runner, /upstreamHost/);
  assert.match(runner, /upstreamModel/);
  assert.match(runner, /upstreamKind/);
});

test('production browser e2e reports latest upstream failure before verbose audit history', () => {
  const runner = readFileSync(runnerPath, 'utf8');

  assert.match(runner, /latestUpstreamFailure/);
  assert.match(runner, /chat\.upstream_failed/);
  assert.match(runner, /slice\(-20\)/);
  assert.match(runner, /slice\(-12\)/);
  assert.match(runner, /upstreamStatus/);
});
