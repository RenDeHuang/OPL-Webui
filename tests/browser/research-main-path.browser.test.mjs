import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runnerPath = 'tests/browser/research-main-path-runner.mjs';
const runtimeAdmissionHelperPath = 'tests/browser/runtime-admission-helper.mjs';
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
  assert.equal(evidence.productAcceptance.status, 'repo_browser_done_v1');
  assert.deepEqual(evidence.productAcceptance.covers, ['visitor', 'new_user', 'ordinary_first_value', 'specialist_conversion', 'MedOPL_handoff', 'return_continuation', 'project_window_history']);
  assert.equal(evidence.productAcceptance.ownerVisualCopyReceipt, 'pending');
  assert.deepEqual(evidence.productAcceptance.doesNotProve, ['production rollout', 'owner visual/copy acceptance', 'production-ready SaaS']);
  assert.equal(evidence.pageStates.chatState, 'runtime_required');
  assert.equal(evidence.pageStates.researchResultSections, 3);
  assert.equal(evidence.pageStates.firstValueProgressiveTurnObserved, true);
  assert.equal(evidence.pageStates.firstValueProgressiveTurnState, 'complete');
  assert.equal(evidence.pageStates.firstValueProgressiveBoundary, 'request_lifecycle_not_token_stream');
  assert.deepEqual(evidence.pageStates.chatTurnStagesObserved, ['submitted', 'progressive', 'waiting_upstream', 'complete']);
  assert.equal(evidence.pageStates.chatTurnFakeStreaming, false);
  assert.ok(
    ['specialist_not_ready_path', 'specialist_ready_path', 'onboarding_path'].includes(evidence.pageStates.runtimeAdmissionScenario),
    `unexpected runtime admission scenario: ${evidence.pageStates.runtimeAdmissionScenario}`,
  );
  if (evidence.pageStates.runtimeAdmissionScenario === 'specialist_not_ready_path') {
    assert.equal(evidence.pageStates.runtimeTaskMarker, '@基金');
    assert.ok(evidence.auditKinds.includes('runtime_gate.blocked'));
  } else if (evidence.pageStates.runtimeAdmissionScenario === 'specialist_ready_path') {
    assert.equal(evidence.pageStates.runtimeTaskMarker, '@论文');
    assert.ok(evidence.auditKinds.includes('runtime_gate.ready'));
    assert.ok(evidence.auditKinds.includes('run_intent.accepted'));
    assert.ok(evidence.auditKinds.includes('runtime_run.projected'));
    assert.equal(evidence.pageStates.runtimeRunProjectionVisible, true);
    assert.equal(evidence.pageStates.runtimeWebuiArtifactBody, 'forbidden');
  } else {
    assert.equal(evidence.pageStates.runtimeTaskMarker, '@论文');
    assert.ok(evidence.auditKinds.includes('runtime_admission.onboarding_required'));
  }
  assert.equal(evidence.pageStates.projectWindowCount >= 2, true);
  assert.equal(evidence.pageStates.projectWindowStatus, 'blocked');
  assert.match(evidence.pageStates.projectWindowContinueHref, /^https:\/\/medopl\.medopl\.cn/);
  assert.equal(evidence.pageStates.specialistHandoffVisible, true);
  assert.equal(evidence.pageStates.specialistHandoffMode, 'conversion_handoff');
  assert.match(evidence.pageStates.specialistHandoffText, /MedOPL/);
  assert.doesNotMatch(evidence.pageStates.specialistHandoffText, /error|错误|WebUI owns|node pool|无限计算资源/i);
  assert.ok(evidence.auditKinds.includes('chat.completed'));
  assert.ok(evidence.upstreamRequests >= 1);
  assert.equal(evidence.visualQuality.state, 'repo_local_visual_baseline_captured');
  assert.deepEqual(evidence.visualQuality.figmaSource, {
    fileKey: '1MNO5l7PQYKZVNqQgw6DGS',
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
    assert.equal(visual.layout.inspector.visible, true);
    assert.equal(visual.layout.inspector.withinViewport, true);
    if (['mobile', 'compact'].includes(viewport)) assert.equal(visual.layout.inspector.mobileBottomSheet, true);
    assert.equal(visual.layout.activeInspectorPanel.visible, true);
    assert.equal(visual.layout.hiddenOverlayInterceptsInput, false);
    assert.equal(visual.layout.chatInputHitTarget, true);
    assert.equal(visual.layout.textOverflowCount, 0, JSON.stringify({ viewport, samples: visual.layout.textOverflowSamples }));
    assert.equal(visual.layout.interactiveTargetFailures.length, 0, JSON.stringify({ viewport, failures: visual.layout.interactiveTargetFailures }));
    assert.equal(visual.layout.focusableWithoutName.length, 0);
    assert.equal(visual.layout.focusRingProbe.visible, true);
  }
  assert.equal(evidence.visualQuality.accessibilityChecks.keyboardFocusVisible, true);
  assert.equal(evidence.visualQuality.accessibilityChecks.keyboardPathPass, true);
  assert.equal(evidence.visualQuality.accessibilityChecks.modalFocusTrapPass, true);
  assert.deepEqual(evidence.visualQuality.accessibilityCloseout.modalFocusTrap, {
    initial: 'primary',
    forwardFocus: 'close',
    forwardWrap: 'primary',
    backwardWrap: 'close',
    pass: true,
  });
  assert.equal(evidence.visualQuality.accessibilityChecks.touchTargetsPass, true);
  assert.equal(evidence.visualQuality.accessibilityChecks.namedControlsPass, true);
  assert.equal(evidence.visualQuality.accessibilityChecks.contrastPass, true);
  assert.equal(evidence.visualQuality.visualFitChecks.noTextOverflow, true);
  assert.equal(evidence.visualQuality.visualFitChecks.noHorizontalOverflow, true);
  assert.deepEqual(evidence.visualQuality.artifactChecks, {
    researchArtifactDensityPass: true,
    rawAssistantTranscriptCount: 0,
    researchArtifactCardCount: 1,
  });
  assert.deepEqual(evidence.visualQuality.visualQualityRubric, {
    hierarchyClarityPass: true,
    copyDensityPass: true,
    spacingRhythmPass: true,
    mobileComfortPass: true,
    focusPathPass: true,
    emptyErrorLoadingClarityPass: true,
    surfaceOwnershipPass: true,
    scientificArtifactDensityPass: true,
  });
  assert.equal(evidence.visualQuality.inspectorChecks.desktopStablePanelPass, true);
  assert.equal(evidence.visualQuality.inspectorChecks.mobileSheetPressurePass, true);
});

test('browser runner uses user-like browser input instead of direct DOM mutation', () => {
  const runner = readFileSync(runnerPath, 'utf8');
  const domSource = readFileSync('apps/web/src/onePersonLabWebDom.mjs', 'utf8');

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
    'openAccountPopover',
    'openAnonymousAuthForm',
    '[data-account-toggle]',
    '[data-auth-tab="register"]',
    '[data-shell-action="more"]',
    'openChatRoute',
    '[data-shell-action="home"]',
  ]) {
    assert.match(runner, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.doesNotMatch(runner, /\.value\s*=(?!=)/);
  assert.doesNotMatch(runner, /\.click\(\)/);
  assert.doesNotMatch(runner, /requestSubmit\(\)/);
  assert.match(runner, /async function openAnonymousAuthForm/);
  assert.match(runner, /async function openAccountPopover/);
  assert.match(runner, /Boolean\(document\.querySelector\("#auth-email"\) && document\.querySelector\("#auth-email"\)\.offsetParent !== null\)/);
  assert.match(runner, /Boolean\(document\.querySelector\("#api-key"\) && document\.querySelector\("#api-key"\)\.offsetParent !== null\)/);
  assert.match(domSource, /function shouldAutoOpenInspector/);
  assert.match(domSource, /window\.matchMedia\?\.\('\(min-width: 1041px\)'\)\.matches === true/);
  assert.match(domSource, /state\.showInspector = shouldAutoOpenInspector\(\)/);
  assert.doesNotMatch(domSource, /state\.showInspector = true;\s*\n\s*render\(\);\s*\n\s*const result = await sendChatMessage/);
  const accountPopoverHelper = runner.match(/async function openAccountPopover[\s\S]*?\n}\n/)?.[0] || '';
  assert.match(accountPopoverHelper, /\[data-account-toggle\]/);
  assert.doesNotMatch(accountPopoverHelper, /#auth-email|#api-key/);
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

test('commercial cross-repo browser canary is separated from strict ordinary upstream browser e2e', () => {
  const runner = readFileSync(runnerPath, 'utf8');
  const workflow = readFileSync(cloudRolloutWorkflowPath, 'utf8');

  assert.match(workflow, /commercial_cross_repo_browser_canary:/);
  assert.match(workflow, /Commercial Cross-Repo Browser Canary/);
  assert.match(workflow, /OPL_COMMERCIAL_CROSS_REPO_BROWSER_CANARY/);
  assert.match(workflow, /--commercial-cross-repo-canary/);
  assert.match(runner, /commercialCrossRepoCanary/);
  assert.match(runner, /upstream_service_unavailable_fail_closed/);
  assert.match(runner, /ordinary upstream failure must not show runtime gate/);
  assert.match(runner, /ordinaryChatOutcome\.state === 'structured_result'/);
  assert.match(runner, /chat\.upstream_failed/);
  assert.match(runner, /mode === 'production' \? productionChatResultTimeoutMs : 60000/);
  assert.doesNotMatch(runner, /mode === 'production' && !commercialCrossRepoCanary \? productionChatResultTimeoutMs : 60000/);
});

test('production browser e2e accepts reusable dogfood accounts that are already key-bound', () => {
  const runner = readFileSync(runnerPath, 'utf8');

  assert.match(runner, /waitForBoundOrUnboundAuthState/);
  assert.doesNotMatch(runner, /waitForAuthState\(cdp,\s*'authenticated_unbound',\s*'login'\)/);
  assert.match(runner, /authenticated_unbound/);
  assert.match(runner, /authenticated_bound/);
});

test('production browser e2e returns from register to login for reusable dogfood accounts', () => {
  const runner = readFileSync(runnerPath, 'utf8');
  const loginSequence = runner.match(/const registered = await waitForAuthStateOrMessage[\s\S]*?await activate\(cdp, '\[data-login-button\]'\);/)?.[0] || '';

  assert.match(loginSequence, /\[data-auth-tab="login"\][\s\S]*\[data-login-button\]/);
});

test('production accessibility closeout is idempotent when dogfood account is already key-bound', () => {
  const runner = readFileSync(runnerPath, 'utf8');

  assert.match(runner, /isAlreadyKeyBound/);
  assert.match(runner, /api_key_modal_skipped_already_bound/);
  assert.match(runner, /repo_local_unbound_browser_e2e/);
  assert.match(runner, /document\.body\.dataset\.authState === "authenticated_bound"/);
});

test('production browser e2e waits for API key save completion on already-bound accounts', () => {
  const runner = readFileSync(runnerPath, 'utf8');

  assert.match(runner, /const apiKeySaveCount = await auditKindCount\(cdp, 'api_key\.saved'\)/);
  assert.match(runner, /waitForAuditKindCount\(cdp, 'api_key\.saved', apiKeySaveCount \+ 1\)/);
  assert.doesNotMatch(runner, /activate\(cdp, '\[data-save-key-button\]'\);\n\s*await waitForAuthState\(cdp, 'authenticated_bound', 'api key binding'\)/);
});

test('production browser e2e splits ordinary blocked ready and onboarding runtime admission paths', () => {
  const runner = readFileSync(runnerPath, 'utf8');
  const helper = readFileSync(runtimeAdmissionHelperPath, 'utf8');
  const runtime = readFileSync('contracts/web-runtime-bridge.json', 'utf8');

  assert.match(runtime, /"commercialRuntimeAdmission"/);
  assert.match(runtime, /"ordinary_path"/);
  assert.match(runtime, /"specialist_not_ready_path"/);
  assert.match(runtime, /"specialist_ready_path"/);
  assert.match(runtime, /"onboarding_path"/);
  assert.match(runtime, /"dogfoodAccountStrategy"/);
  assert.match(runner, /runtime-admission-helper\.mjs/);
  assert.match(runner, /resolveRuntimeAdmissionScenario/);
  assert.match(helper, /exerciseSpecialistNotReadyPath/);
  assert.match(helper, /exerciseSpecialistReadyPath/);
  assert.match(helper, /exerciseOnboardingPath/);
  assert.match(helper, /runtime_gate\.ready/);
  assert.match(helper, /runtime_run\.projected/);
  assert.match(helper, /runtime_admission\.onboarding_required/);
  assert.doesNotMatch(runner, /waitForAuditKindCount\(cdp, 'runtime_gate\.blocked', runtimeGateBlockedCount \+ 1\)/);
  assert.doesNotMatch(runner, /waitForAuditKindCount\(cdp, 'runtime_gate\.blocked', runtimeGateBlockedCount \+ 2\)/);
});

test('production browser e2e waits for async research results and reports page evidence', () => {
  const runner = readFileSync(runnerPath, 'utf8');

  assert.match(runner, /document\.fonts\.ready/);
  assert.match(runner, /describeResearchResultState/);
  assert.doesNotMatch(runner, /assertPage\(cdp,[\s\S]*?researchResultMarker === "@科研"/);
  assert.match(runner, /waitForOrdinaryResearchOutcome/);
  assert.match(runner, /state\.researchResultMarker === '@科研' && state\.researchResultSections === 3/);
  assert.match(runner, /state: 'structured_result'/);
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

test('production browser e2e retries only audited transient upstream failures', () => {
  const runner = readFileSync(runnerPath, 'utf8');

  assert.match(runner, /const productionResearchAttemptLimit = 2/);
  assert.match(runner, /retryableProductionUpstreamFailure/);
  assert.match(runner, /chat\.upstream_failed/);
  assert.match(runner, /network.*connect_error.*dns_error.*request_timeout.*response_header_timeout/s);
  assert.match(runner, /waitForAuditKind\(cdp, 'chat\.completed'\)/);
  assert.match(runner, /structured research result marker missing/);
  assert.match(runner, /state\.researchResultMarker === '@科研' && state\.researchResultSections === 3/);
  assert.match(runner, /ordinaryOutcome\.state === 'upstream_service_unavailable_fail_closed' && commercialCrossRepoCanary/);
  assert.match(runner, /ordinaryOutcome\.state !== 'structured_result'/);
  assert.match(runner, /throw new Error\(JSON\.stringify\(ordinaryOutcome\)\)/);
  assert.doesNotMatch(runner, /state: 'upstream_service_unavailable_fail_closed'[\s\S]{0,240}ok: true/);
});

test('production browser e2e closes account overlays before clicking workbench task launchers', () => {
  const runner = readFileSync(runnerPath, 'utf8');

  assert.match(runner, /closeBlockingOverlays/);
  assert.match(runner, /data-account-popover-close/);
  assert.match(runner, /data-api-key-dialog-close/);
  assert.match(runner, /document\.querySelector\("\[data-account-popover\]"\) === null/);
  assert.match(runner, /\[data-research-task\]\[data-research-task-intent="research_direction"\]/);
  assert.doesNotMatch(runner, /await userClick\(cdp, '\[data-research-task-intent="research_direction"\]'\)/);
});
