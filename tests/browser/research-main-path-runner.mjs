#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  activate,
  assertPage,
  captureScreenshot,
  connectCDP,
  createPageTarget,
  delay,
  describePageState,
  describeResearchResultState,
  evaluateJSON,
  findBrowserBinary,
  focusElement,
  keyPress,
  normalizeBaseUrl,
  sanitizeBaseUrl,
  startBrowser,
  startControlPlane,
  startMockChatUpstream,
  typeInto,
  userClick,
  waitFor,
  waitForAuthState,
  waitForAuthStateOrMessage,
  waitForBoundOrUnboundAuthState,
  waitUntil,
} from './helpers/browser-cdp-helper.mjs';
import { assertRuntimeAdmissionAuditKinds, exerciseOnboardingPath, exerciseSpecialistNotReadyPath, exerciseSpecialistReadyPath, resolveRuntimeAdmissionScenario } from './runtime-admission-helper.mjs';
const repoRoot = new URL('../../', import.meta.url).pathname;
const commercialCrossRepoCanary = process.argv.includes('--commercial-cross-repo-canary') || process.env.OPL_COMMERCIAL_CROSS_REPO_BROWSER_CANARY === '1';
const state = { cleanup: [] }, mode = process.argv.includes('--production') || commercialCrossRepoCanary ? 'production' : 'local';
const productionChatResultTimeoutMs = 120000;
const productionResearchAttemptLimit = 2, retryableProductionUpstreamKinds = new Set(['network', 'connect_error', 'dns_error', 'request_timeout', 'response_header_timeout']);

try {
  if (mode === 'production' && process.env.OPL_PRODUCTION_BROWSER_E2E !== '1' && process.env.OPL_COMMERCIAL_CROSS_REPO_BROWSER_CANARY !== '1') {
    console.log(JSON.stringify({ ok: true, skipped: true, mode, reason: 'production browser gates are not enabled' }));
    process.exit(0);
  }
  const config = resolveRunConfig(mode);
  const browserBinary = findBrowserBinary();
  const upstream = mode === 'local' ? await startMockChatUpstream() : undefined;
  if (upstream) state.cleanup.push(() => upstream.close());
  const app = mode === 'local'
    ? await startControlPlane(upstream.baseUrl, state.cleanup, repoRoot)
    : { baseUrl: config.baseUrl };
  const browser = await startBrowser(browserBinary, state.cleanup);

  const pageWebSocketDebuggerUrl = await createPageTarget(browser.devtoolsBaseUrl);
  const cdp = await connectCDP(pageWebSocketDebuggerUrl);
  state.cleanup.push(() => cdp.close());
  await cdp.send('DOM.enable');
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: app.baseUrl });
  await waitFor(cdp, 'document.readyState === "complete"');
  await waitFor(cdp, 'document.body.dataset.authState && performance.getEntriesByName(new URL("/api/session/current", location.href).href).some((entry) => entry.responseEnd > 0)');
  await waitFor(cdp, 'document.querySelector("[data-account-toggle]")?.offsetParent !== null || document.querySelector("[data-auth-surface]")?.offsetParent !== null');

  if (mode === 'production') await resetSessionIfAuthenticated(cdp);
  await authenticate(cdp, config);
  const accessibilityCloseout = await captureAccessibilityCloseout(cdp);

  await openAccountPopover(cdp);
  await waitFor(cdp, 'Boolean(document.querySelector("#api-key") && document.querySelector("#api-key").offsetParent !== null)');
  const apiKeySaveCount = await auditKindCount(cdp, 'api_key.saved');
  await typeInto(cdp, '#api-key', config.apiKey);
  await activate(cdp, '[data-save-key-button]');
  await waitForAuditKindCount(cdp, 'api_key.saved', apiKeySaveCount + 1);
  await waitForAuthState(cdp, 'authenticated_bound', 'api key binding');
  await openChatRoute(cdp);
  const ordinaryChatOutcome = await submitResearchPromptWithRetry(cdp);
  await cdp.send('Runtime.evaluate', { expression: `document.body.dataset.lastResearchArtifactCardCount = document.querySelectorAll('[data-research-result]').length; document.body.dataset.lastResearchArtifactSectionCount = document.querySelector('[data-research-result]')?.querySelectorAll('[data-research-result-section]').length || 0; document.body.dataset.lastRawAssistantTranscriptCount = Array.from(document.querySelectorAll('.assistant-message p')).filter((node) => node.textContent.includes('mock upstream response')).length; document.body.dataset.lastFirstValueTurnState = document.querySelector('[data-first-value-turn-state]')?.dataset.turnState || ''; document.body.dataset.lastFirstValueProgressiveBoundary = document.querySelector('[data-first-value-turn-state]')?.dataset.progressiveBoundary || '';` });

  const runtimeAdmission = await resolveRuntimeAdmissionScenario(cdp, '@论文 生成研究选题和证据计划', runtimeAdmissionTools());
  if (runtimeAdmission.scenario === 'specialist_ready_path') {
    await exerciseSpecialistReadyPath(cdp, '@论文 生成研究选题和证据计划', runtimeAdmissionTools());
  } else if (runtimeAdmission.scenario === 'onboarding_path') {
    await exerciseOnboardingPath(cdp, '@论文 生成研究选题和证据计划', runtimeAdmission, runtimeAdmissionTools());
  } else {
    await exerciseSpecialistNotReadyPath(cdp, '@论文 生成研究选题和证据计划', runtimeAdmissionTools());
    await exerciseSpecialistNotReadyPath(cdp, '@基金 帮我拆解标书结构', runtimeAdmissionTools());
  }
  await cdp.send('Runtime.evaluate', { expression: `const handoff = document.querySelector('[data-medopl-handoff]'); document.body.dataset.lastSpecialistHandoffVisible = String(Boolean(handoff)); document.body.dataset.lastSpecialistHandoffMode = handoff?.dataset.medoplHandoff || ''; document.body.dataset.lastSpecialistHandoffText = handoff?.textContent || '';` }); await activate(cdp, '[data-shell-action="projects"]');
  await waitFor(cdp, 'document.querySelectorAll("[data-project-window-item]").length >= 1', () => describePageState(cdp, 'project/window center missing recent windows'));
  await assertPage(cdp, 'document.querySelector("[data-project-window-continue]")?.href.startsWith("https://medopl.medopl.cn")', 'project/window continue deeplink');
  await cdp.send('Runtime.evaluate', { expression: `document.body.dataset.lastProjectWindowCount = document.querySelectorAll('[data-project-window-item]').length; document.body.dataset.lastProjectWindowStatus = document.querySelector('[data-project-window-item]')?.dataset.projectWindowStatus || ''; document.body.dataset.lastProjectWindowContinueHref = document.querySelector('[data-project-window-continue]')?.href || '';` });
  await activate(cdp, '[data-shell-action="home"]');
  const audit = await readAuditEvents(cdp);
  const kinds = (audit.events ?? []).map((event) => event.eventKind);
  assertRuntimeAdmissionAuditKinds(runtimeAdmission.scenario, kinds);
  if (ordinaryChatOutcome.state === 'structured_result' && !kinds.includes('chat.completed')) {
    throw new Error(`missing chat.completed audit evidence: ${kinds.join(',')}`);
  }
  if (ordinaryChatOutcome.state === 'upstream_service_unavailable_fail_closed' && !kinds.includes('chat.upstream_failed')) {
    throw new Error(`missing chat.upstream_failed audit evidence: ${kinds.join(',')}`);
  }
  const pageStates = await evaluateJSON(cdp, `({
    authState: document.body.dataset.authState,
    chatState: document.body.dataset.chatState,
    providerStatus: document.querySelector('[data-provider-status]')?.textContent,
    selectedTaskIntent: document.body.dataset.researchTaskIntent,
    runtimeGateVisible: document.querySelector('[data-runtime-gate]')?.classList.contains('is-visible'),
    researchResultSections: Number(document.body.dataset.lastResearchResultSections || document.querySelector('[data-research-result]')?.querySelectorAll('[data-research-result-section]').length),
    runtimeTaskMarker: document.body.dataset.lastRuntimeTaskMarker || document.querySelector('[data-runtime-task-card]')?.dataset.runtimeTaskMarker,
    runtimeAdmissionScenario: ${JSON.stringify(runtimeAdmission.scenario)},
    runtimeProjectionStatus: document.querySelector('[data-runtime-task-card]')?.dataset.runtimeProjectionStatus || '',
    runtimeRunProjectionVisible: Boolean(document.querySelector('[data-runtime-run-projection]')),
    runtimeProgressRefCount: document.querySelectorAll('[data-runtime-progress-refs] li').length,
    runtimeDeliverableRefCount: document.querySelectorAll('[data-runtime-deliverable-refs] li').length,
    runtimeWebuiArtifactBody: document.querySelector('[data-runtime-run-projection]')?.dataset.webuiArtifactBody || '',
    specialistHandoffVisible: document.body.dataset.lastSpecialistHandoffVisible === 'true' || Boolean(document.querySelector('[data-medopl-handoff]')),
    specialistHandoffMode: document.body.dataset.lastSpecialistHandoffMode || document.querySelector('[data-medopl-handoff]')?.dataset.medoplHandoff || '',
    specialistHandoffText: document.body.dataset.lastSpecialistHandoffText || document.querySelector('[data-medopl-handoff]')?.textContent || '',
    firstValueProgressiveTurnObserved: document.body.dataset.firstValueProgressiveTurnObserved === 'true',
    firstValueProgressiveTurnState: document.body.dataset.lastFirstValueTurnState || document.querySelector('[data-first-value-turn-state]')?.dataset.turnState || '',
    firstValueProgressiveBoundary: document.body.dataset.lastFirstValueProgressiveBoundary || document.querySelector('[data-first-value-turn-state]')?.dataset.progressiveBoundary || '',
    chatTurnStagesObserved: (document.body.dataset.chatTurnStagesObserved || '').split(',').filter(Boolean),
    chatTurnFakeStreaming: document.body.dataset.chatTurnFakeStreaming === 'true',
    projectWindowCount: Number(document.body.dataset.lastProjectWindowCount || document.querySelectorAll('[data-project-window-item]').length),
    projectWindowStatus: document.body.dataset.lastProjectWindowStatus || document.querySelector('[data-project-window-item]')?.dataset.projectWindowStatus,
    projectWindowContinueHref: document.body.dataset.lastProjectWindowContinueHref || document.querySelector('[data-project-window-continue]')?.href,
    chatLogText: document.querySelector('[data-chat-log]')?.textContent,
  })`);
  const relevantAuditKinds = [...new Set(kinds)].filter((kind) => ['chat.completed', 'chat.upstream_failed', 'runtime_gate.blocked', 'runtime_gate.ready', 'run_intent.accepted', 'runtime_run.projected', 'runtime_admission.onboarding_required'].includes(kind));
  const visualQuality = commercialCrossRepoCanary
    ? { state: 'not_collected_for_commercial_cross_repo_canary', cannotClaim: ['production visual polish complete', 'strict production browser e2e'] }
    : await captureVisualQualityEvidence(cdp, mode, accessibilityCloseout);
  const productAcceptance = commercialCrossRepoCanary ? null : { status: 'repo_browser_done_v1', covers: ['visitor', 'new_user', 'ordinary_first_value', 'specialist_conversion', 'MedOPL_handoff', 'return_continuation', 'project_window_history'], ownerVisualCopyReceipt: 'pending', doesNotProve: ['production rollout', 'owner visual/copy acceptance', 'production-ready SaaS'] };
  console.log(JSON.stringify({ ok: true, mode, path: commercialCrossRepoCanary ? 'commercial-cross-repo-browser-canary' : 'research-main-path', browser: browserBinary, baseUrl: sanitizeBaseUrl(app.baseUrl), commercialCrossRepoCanary, ordinaryChatOutcome, runtimeAdmission, pageStates, auditKinds: relevantAuditKinds, allAuditKinds: [...new Set(kinds)], upstreamRequests: upstream?.requests.length ?? undefined, visualQuality, productAcceptance }));
} catch (error) {
  console.error(error?.stack || error);
  process.exitCode = 1;
} finally {
  for (const cleanup of state.cleanup.reverse()) await cleanup().catch?.(() => {});
}

function resolveRunConfig(runMode) {
  if (runMode === 'local') return { baseUrl: '', email: `browser-${Date.now()}@example.test`, password: 'browser-e2e-password', apiKey: 'sk-browser-e2e-secret' };
  const config = {
    baseUrl: normalizeBaseUrl(process.env.OPL_BASE_URL || 'https://opl.medopl.cn'),
    email: process.env.OPL_DOGFOOD_EMAIL || '',
    password: process.env.OPL_DOGFOOD_PASSWORD || '',
    apiKey: process.env.OPL_DOGFOOD_API_KEY || '',
  };
  const missing = [];
  if (!config.email.includes('@')) missing.push('OPL_DOGFOOD_EMAIL');
  if (config.password.length < 12) missing.push('OPL_DOGFOOD_PASSWORD');
  if (!config.apiKey) missing.push('OPL_DOGFOOD_API_KEY');
  if (missing.length > 0) {
    throw new Error(`production browser e2e missing valid secret inputs: ${missing.join(', ')}`);
  }
  return config;
}

async function authenticate(cdp, config) {
  await openAnonymousAuthForm(cdp);
  await activate(cdp, '[data-auth-tab="register"]');
  await typeInto(cdp, '#auth-email', config.email);
  await typeInto(cdp, '#auth-password', config.password);
  await activate(cdp, '[data-register-button]');
  const registered = await waitForAuthStateOrMessage(cdp, 'authenticated_unbound', /EMAIL_ALREADY_REGISTERED|already registered|已存在|已注册/i, 'register');
  if (registered) {
    await activate(cdp, '[data-logout-button]');
    await waitForAuthState(cdp, 'anonymous', 'logout');
  }
  await activate(cdp, '[data-auth-tab="login"]');
  await typeInto(cdp, '#auth-email', config.email);
  await typeInto(cdp, '#auth-password', config.password);
  await activate(cdp, '[data-login-button]');
  await waitForBoundOrUnboundAuthState(cdp, 'login');
}

async function openAnonymousAuthForm(cdp) {
  await openAccountPopover(cdp);
  await waitFor(cdp, 'document.querySelector("[data-account-popover]")?.hidden === false && Boolean(document.querySelector("#auth-email") && document.querySelector("#auth-email").offsetParent !== null)', () => describePageState(cdp, 'account popover did not expose auth form'));
}

async function openAccountPopover(cdp) {
  await activate(cdp, '[data-account-toggle]');
  await waitFor(cdp, 'document.querySelector("[data-account-popover]")?.hidden === false', () => describePageState(cdp, 'account popover did not expose account panel'));
}

async function openChatRoute(cdp) {
  await activate(cdp, '[data-shell-action="home"]');
  await waitFor(cdp, 'document.body.dataset.view === "home" && document.querySelector("[data-research-task][data-research-task-intent=\\"research_direction\\"]")?.offsetParent !== null', () => describePageState(cdp, 'chat route did not expose research launcher'));
}
async function submitResearchPromptWithRetry(cdp) {
  for (let attempt = 1; attempt <= (mode === 'production' ? productionResearchAttemptLimit : 1); attempt += 1) {
    await closeBlockingOverlays(cdp);
    await userClick(cdp, '[data-research-task][data-research-task-intent="research_direction"]');
    await assertPage(cdp, 'document.body.dataset.chatState === "research_entry_selected"', 'research task template selected');
    await assertPage(cdp, 'document.querySelector("#chat-input")?.value.includes("@科研")', 'research task template prompt');
    await cdp.send('Runtime.evaluate', { expression: `window.__firstValueProgressiveSeen = false; new MutationObserver(() => { const node = document.querySelector('[data-first-value-turn-state]'); if (node?.dataset.turnState === 'progressive' && node?.dataset.progressiveBoundary === 'request_lifecycle_not_token_stream') window.__firstValueProgressiveSeen = true; }).observe(document.body, { childList: true, subtree: true, attributes: true });` });
    await activate(cdp, '[data-chat-submit]');
    await waitFor(cdp, 'window.__firstValueProgressiveSeen === true || (document.querySelector("[data-first-value-turn-state]")?.dataset.turnState === "progressive" && document.querySelector("[data-first-value-turn-state]")?.dataset.progressiveBoundary === "request_lifecycle_not_token_stream")');
    await cdp.send('Runtime.evaluate', { expression: 'document.body.dataset.firstValueProgressiveTurnObserved = "true";' });
    if (mode === 'local') await waitFor(cdp, 'document.querySelector("[data-chat-log]")?.textContent.includes("mock upstream response")');
    try {
      const ordinaryOutcome = await waitForOrdinaryResearchOutcome(cdp);
      if (ordinaryOutcome.state === 'upstream_service_unavailable_fail_closed' && commercialCrossRepoCanary) {
        await assertPage(cdp, 'document.querySelector("[data-runtime-gate]")?.classList.contains("is-visible") !== true', 'ordinary upstream failure must not show runtime gate');
        return ordinaryOutcome;
      }
      if (ordinaryOutcome.state !== 'structured_result') {
        throw new Error(JSON.stringify(ordinaryOutcome));
      }
      await waitForAuditKind(cdp, 'chat.completed');
      return ordinaryOutcome;
    } catch (error) {
      if (attempt >= productionResearchAttemptLimit || !await retryableProductionUpstreamFailure(cdp)) throw error;
      await activate(cdp, '[data-shell-action="home"]');
      await waitFor(cdp, 'document.body.dataset.view === "home" && document.querySelector("[data-research-task][data-research-task-intent=\\"research_direction\\"]")?.offsetParent !== null');
    }
  }
}

async function waitForOrdinaryResearchOutcome(cdp) {
  return waitUntil(async () => {
    const state = await describeResearchResultState(cdp, 'ordinary research outcome probe').then(JSON.parse);
    if (state.researchResultMarker === '@科研' && state.researchResultSections === 3) {
      return { state: 'structured_result', researchResultMarker: state.researchResultMarker, researchResultSections: state.researchResultSections };
    }
    const failure = state.audit?.latestUpstreamFailure;
    if (state.chatState === 'service_unavailable' && failure?.eventKind === 'chat.upstream_failed' && retryableProductionUpstreamKinds.has(failure.metadata?.upstreamKind || '')) return { state: 'upstream_service_unavailable_fail_closed', failureClass: 'chat.upstream_failed', upstreamKind: failure.metadata?.upstreamKind || '', upstreamHost: failure.metadata?.upstreamHost || '', canClaim: ['ordinary path reached authenticated WebUI and failed closed without runtime/storage gate'], cannotClaim: ['ordinary chat completion', 'upstream provider availability'] };
    if (state.runtimeGateVisible) return { state: 'ordinary_runtime_gate_violation', message: 'ordinary research path showed runtime gate' };
    return false;
  }, mode === 'production' ? productionChatResultTimeoutMs : 60000, () => describeResearchResultState(cdp, 'structured research result marker missing'));
}
async function closeBlockingOverlays(cdp) { for (const selector of ['[data-api-key-dialog-close]', '[data-account-popover-close]']) if (await evaluateJSON(cdp, `(() => { const element = document.querySelector(${JSON.stringify(selector)}); return Boolean(element && element.offsetParent !== null && !element.closest('[hidden]')); })()`)) await activate(cdp, selector); await waitFor(cdp, 'document.querySelector("[data-api-key-dialog]")?.hidden !== false && document.querySelector("[data-account-popover]") === null'); }
async function retryableProductionUpstreamFailure(cdp) {
  if (mode !== 'production') return false;
  const state = await describeResearchResultState(cdp, 'production research retry probe').then(JSON.parse);
  return state.chatState === 'service_unavailable' && retryableProductionUpstreamKinds.has(state.audit?.latestUpstreamFailure?.metadata?.upstreamKind || '');
}

async function resetSessionIfAuthenticated(cdp) {
  const authState = await evaluateJSON(cdp, 'document.body.dataset.authState');
  if (authState === 'anonymous') return;
  await openAccountPopover(cdp);
  await activate(cdp, '[data-logout-button]');
  await waitForAuthState(cdp, 'anonymous', 'initial logout');
}

async function submitPrompt(cdp, prompt) {
  await typeInto(cdp, '#chat-input', prompt);
  await activate(cdp, '[data-chat-submit]');
}

async function readAuditEvents(cdp) {
  return evaluateJSON(cdp, 'fetch("/api/account/audit-events").then((response) => response.json())');
}

async function waitForAuditKind(cdp, eventKind) {
  await waitForAuditKindCount(cdp, eventKind, 1);
}

async function waitForAuditKindCount(cdp, eventKind, count) {
  await waitUntil(async () => await auditKindCount(cdp, eventKind) >= count, 60000);
}

async function auditKindCount(cdp, eventKind) { const audit = await readAuditEvents(cdp); return (audit.events ?? []).filter((event) => event.eventKind === eventKind).length; }

function runtimeAdmissionTools() {
  return { assertPage, auditKindCount, describePageState, evaluateJSON, submitPrompt, waitFor, waitForAuditKindCount };
}

async function captureVisualQualityEvidence(cdp, runMode, accessibilityCloseout) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runtimeDir = join(repoRoot, '.runtime', 'browser-visual');
  mkdirSync(runtimeDir, { recursive: true });

  const viewports = {};
  const viewportSpecs = [{ id: 'desktop', width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false }, { id: 'tablet', width: 834, height: 1200, deviceScaleFactor: 2, mobile: true }, { id: 'mobile', width: 390, height: 1200, deviceScaleFactor: 2, mobile: true }, { id: 'compact', width: 360, height: 1200, deviceScaleFactor: 3, mobile: true }];
  for (const viewport of viewportSpecs) {
    await keyPress(cdp, { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await setViewport(cdp, viewport);
    await waitFor(cdp, 'document.readyState === "complete" && (!document.fonts || document.fonts.ready.then(() => true))');
    await activate(cdp, '[data-inspector-open="autonomy"]'); await keyPress(cdp, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }); await waitFor(cdp, 'document.body.dataset.inspectorState === "autonomy" && document.querySelector("[data-inspector-sheet]")?.hidden === false', () => describePageState(cdp, `inspector did not open for ${viewport.id}`));
    const path = join('.runtime', 'browser-visual', `research-main-path-${runMode}-${viewport.id}-${stamp}.png`);
    await captureScreenshot(cdp, path, repoRoot);
    const layout = await readVisualLayout(cdp);
    viewports[viewport.id] = {
      viewport: { width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.deviceScaleFactor, mobile: viewport.mobile },
      screenshot: { captured: true, path },
      layout,
    };
  }
  const artifactChecks = await evaluateJSON(cdp, `(() => {
    const raw = Number(document.body.dataset.lastRawAssistantTranscriptCount || Array.from(document.querySelectorAll('.assistant-message p')).filter((node) => node.textContent.includes('mock upstream response')).length);
    const cards = Number(document.body.dataset.lastResearchArtifactCardCount || document.querySelectorAll('[data-research-result]').length);
    const sections = Number(document.body.dataset.lastResearchArtifactSectionCount || document.querySelector('[data-research-result]')?.querySelectorAll('[data-research-result-section]').length || 0);
    return { researchArtifactDensityPass: raw === 0 && cards === 1 && sections === 3, rawAssistantTranscriptCount: raw, researchArtifactCardCount: cards };
  })()`);

  return {
    state: 'repo_local_visual_baseline_captured',
    currentPhase: 'responsive_visual_qa',
    source: 'browser_cdp',
    figmaSource: {
      fileKey: '1MNO5l7PQYKZVNqQgw6DGS',
      nodeId: '0:1',
    },
    responsiveBreakpoints: viewportSpecs.map((viewport) => viewport.id),
    accessibilityChecks: summarizeAccessibilityChecks(viewports, accessibilityCloseout),
    accessibilityCloseout,
    visualFitChecks: summarizeVisualFitChecks(viewports),
    artifactChecks,
    visualQualityRubric: summarizeVisualQualityRubric(viewports, accessibilityCloseout, artifactChecks),
    inspectorChecks: {
      desktopStablePanelPass: viewports.desktop.layout.inspector.desktopStablePanel === true,
      mobileSheetPressurePass: ['mobile', 'compact'].every((id) => viewports[id].layout.inspector.mobileSheetHeightRatio <= 0.64),
    },
    ownerReceipt: {
      required: true,
      status: 'pending',
      source: 'human_owner_receipt',
    },
    viewports,
    cannotClaim: ['complete UI/UX design system', 'production visual polish complete'],
  };
}

async function captureAccessibilityCloseout(cdp) {
  await activate(cdp, '[data-shell-action="home"]');
  const isAlreadyKeyBound = await evaluateJSON(cdp, 'document.body.dataset.authState === "authenticated_bound"');
  const modalFocusTrap = isAlreadyKeyBound
    ? { pass: true, skipped: true, reason: 'api_key_modal_skipped_already_bound', coverage: 'repo_local_unbound_browser_e2e' }
    : await captureAPIKeyRequiredModalFocusTrap(cdp);
  await activate(cdp, '[data-shell-action="skills"]');
  await waitFor(cdp, 'document.body.dataset.view === "skills"');
  await activate(cdp, '[data-shell-action="home"]');
  await waitFor(cdp, 'document.body.dataset.view === "home"');
  await activate(cdp, '[data-shell-action="more"]');
  await waitFor(cdp, 'document.body.dataset.view === "more"');
  return {
    keyboardPath: { homeToSkills: true, skillsToHome: true, escapeClosesModal: true },
    modalFocusTrap,
    contrast: await readContrastEvidence(cdp),
  };
}

async function captureAPIKeyRequiredModalFocusTrap(cdp) {
  await typeInto(cdp, '#chat-input', '@科研 accessibility closeout');
  await userClick(cdp, '[data-chat-submit]');
  await waitFor(cdp, 'document.body.dataset.shellState === "api_key_required_modal"', () => describePageState(cdp, 'accessibility closeout did not open API key modal'));
  const modalFocusTrap = await readModalFocusTrap(cdp);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await waitFor(cdp, 'document.querySelector("[data-api-key-dialog]")?.hidden === true');
  return modalFocusTrap;
}

async function readModalFocusTrap(cdp) {
  const initial = await readAPIKeyDialogFocus(cdp);
  await keyPress(cdp, { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  const forwardFocus = await readAPIKeyDialogFocus(cdp);
  await keyPress(cdp, { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  const forwardWrap = await readAPIKeyDialogFocus(cdp);
  await keyPress(cdp, { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, modifiers: 8 });
  const backwardWrap = await readAPIKeyDialogFocus(cdp);
  return {
    initial,
    forwardFocus,
    forwardWrap,
    backwardWrap,
    pass: initial === 'primary' && forwardFocus === 'close' && forwardWrap === 'primary' && backwardWrap === 'close',
  };
}

async function readAPIKeyDialogFocus(cdp) {
  return evaluateJSON(cdp, `(() => {
    const dialog = document.querySelector('[data-api-key-dialog]');
    const primary = dialog?.querySelector('[data-api-key-dialog-primary]');
    const close = dialog?.querySelector('[data-api-key-dialog-close]');
    const active = document.activeElement;
    if (active === primary) return 'primary';
    if (active === close) return 'close';
    return active?.tagName || '';
  })()`);
}

async function readContrastEvidence(cdp) {
  return evaluateJSON(cdp, `(() => {
    const parseRGB = (value) => {
      const match = String(value).match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
    };
    const backgroundFor = (element) => {
      let current = element;
      while (current) {
        const value = getComputedStyle(current).backgroundColor;
        if (value && !/rgba\\(\\s*0,\\s*0,\\s*0,\\s*0\\s*\\)/.test(value) && value !== 'transparent') {
          return parseRGB(value);
        }
        current = current.parentElement;
      }
      return parseRGB(getComputedStyle(document.body).backgroundColor) || [255, 255, 255];
    };
    const linear = (channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ([r, g, b]) => (0.2126 * linear(r)) + (0.7152 * linear(g)) + (0.0722 * linear(b));
    const ratio = (fg, bg) => {
      const first = luminance(fg);
      const second = luminance(bg);
      const light = Math.max(first, second);
      const dark = Math.min(first, second);
      return Number(((light + 0.05) / (dark + 0.05)).toFixed(2));
    };
    const samples = Array.from(document.querySelectorAll('body, p, small, button, a, h1, h2, h3, textarea, input'))
      .filter((element) => {
        if (element.hidden || element.closest('[hidden]')) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .slice(0, 80)
      .map((element) => {
        const style = getComputedStyle(element);
        const fg = parseRGB(style.color);
        const bg = backgroundFor(element);
        const text = (element.textContent || element.getAttribute('aria-label') || element.getAttribute('placeholder') || '').trim().slice(0, 48);
        const fontSize = Number.parseFloat(style.fontSize) || 16;
        const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
        const minimum = element.matches('button, a, input, textarea') || fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5;
        const actual = fg && bg ? ratio(fg, bg) : 0;
        return fg && bg ? { tag: element.tagName.toLowerCase(), text, ratio: actual, minimum } : null;
      })
      .filter(Boolean);
    const failures = samples.filter((sample) => sample.ratio < sample.minimum);
    return {
      minRatio: samples.reduce((min, sample) => Math.min(min, sample.ratio), 99),
      sampleCount: samples.length,
      failures,
      pass: failures.length === 0,
    };
  })()`);
}

async function setViewport(cdp, viewport) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: viewport.mobile,
  });
  await cdp.send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)', awaitPromise: true });
  await delay(150);
}

async function readVisualLayout(cdp) {
  await focusElement(cdp, '#chat-input');
  await focusToolbarSubmit(cdp);
  return evaluateJSON(cdp, `(async () => {
    const rectJSON = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
      };
    };
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    };
    const inspector = document.querySelector('[data-inspector-sheet]');
    const inspectorRect = inspector?.getBoundingClientRect();
    const inspectorStyle = inspector ? getComputedStyle(inspector) : null;
    const mainRect = document.querySelector('.main-stage')?.getBoundingClientRect();
    const desktopStablePanel = Boolean(inspectorRect && mainRect && viewport.width > 1040 && mainRect.right <= inspectorRect.left);
    const mobileSheetHeightRatio = inspectorRect ? Number((inspectorRect.height / viewport.height).toFixed(2)) : 0;
    const mobileBottomSheet = Boolean(inspectorRect
      && viewport.width <= 760
      && inspectorRect.left <= 1
      && inspectorRect.right >= viewport.width - 1
      && Math.abs(inspectorRect.bottom - viewport.height) <= 1
      && inspectorStyle?.borderTopLeftRadius !== '0px'
      && inspectorStyle?.borderTopRightRadius !== '0px');
    const activeInspectorPanel = document.querySelector('[data-inspector-panel]:not([hidden])');
    const chatInput = document.querySelector('#chat-input');
    const focusProbe = document.querySelector('[data-chat-submit]');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const focusProbeStyle = focusProbe ? getComputedStyle(focusProbe) : null;
    chatInput?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const chatInputRect = chatInput?.getBoundingClientRect();
    const chatInputPoint = chatInputRect
      ? {
        x: chatInputRect.left + Math.min(chatInputRect.width / 2, 40),
        y: chatInputRect.top + Math.min(chatInputRect.height / 2, 24),
      }
      : null;
    const chatInputHit = chatInputPoint
      ? document.elementFromPoint(chatInputPoint.x, chatInputPoint.y)
      : null;
    const blockingOverlay = Array.from(document.querySelectorAll('[data-api-key-dialog], [data-account-popover]'))
      .find((element) => {
        if (element.hidden) return false;
        const rect = element.getBoundingClientRect();
        if (!chatInputPoint) return false;
        return chatInputPoint.x >= rect.left
          && chatInputPoint.x <= rect.right
          && chatInputPoint.y >= rect.top
          && chatInputPoint.y <= rect.bottom;
      });
    const visibleElements = Array.from(document.body.querySelectorAll('body *')).filter((element) => {
      if (element.hidden || element.closest('[hidden]')) return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const textOverflowElements = visibleElements.filter((element) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) return false;
      const style = getComputedStyle(element);
      if (style.overflowX === 'visible' && style.whiteSpace !== 'nowrap') return false;
      return element.scrollWidth > Math.ceil(element.clientWidth) + 1;
    });
    const interactiveTargets = Array.from(document.querySelectorAll('button, a[href], input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !element.disabled && !element.hidden && !element.closest('[hidden]'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.getAttribute('aria-label') || element.textContent || element.getAttribute('placeholder') || '').trim().slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((target) => target.width > 0 && target.height > 0);
    const interactiveTargetFailures = interactiveTargets.filter((target) => target.width < 36 || target.height < 36);
    const focusableWithoutName = interactiveTargets
      .filter((target) => !target.text)
      .map((target) => ({ tag: target.tag, width: target.width, height: target.height }));
    const bodyText = document.body.innerText || '';
    const visibleParagraphs = visibleElements.filter((element) => ['P', 'SMALL', 'DD'].includes(element.tagName) && (element.textContent || '').trim().length > 18).length;
    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).filter((element) => !element.hidden && !element.closest('[hidden]') && element.getBoundingClientRect().width > 0).map((element) => element.tagName.toLowerCase());
    return {
      viewport,
      horizontalOverflowPx: Math.max(0, viewport.scrollWidth - viewport.width),
      chatInputHitTarget: Boolean(chatInputHit && (chatInputHit === chatInput || chatInput.contains(chatInputHit))),
      hiddenOverlayInterceptsInput: Boolean(blockingOverlay),
      textOverflowCount: textOverflowElements.length,
      textOverflowSamples: textOverflowElements.slice(0, 5).map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: (element.textContent || '').trim().slice(0, 120),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      })),
      interactiveTargetFailures,
      focusableWithoutName,
      focusRingProbe: {
        selector: '[data-chat-submit]',
        visible: Boolean(focusProbeStyle && (
          focusProbeStyle.outlineStyle !== 'none'
          || focusProbeStyle.boxShadow !== 'none'
        )),
      },
      visualRubricProbe: { headingSequence: headings, visibleParagraphs, forbiddenVisibleText: /Model gateway|fixed base_url|账号生命周期|额度状态|最近审计|dashboard|runtime console/i.test(bodyText) },
      inspector: {
        visible: Boolean(inspector && !inspector.hidden && inspectorRect && inspectorRect.width > 0 && inspectorRect.height > 0),
        state: inspector?.dataset.inspectorState || '',
        withinViewport: Boolean(inspectorRect
          && inspectorRect.left >= 0
          && inspectorRect.right <= viewport.width
          && inspectorRect.width <= viewport.width),
        desktopStablePanel,
        mobileBottomSheet,
        mobileSheetHeightRatio,
        rect: rectJSON(inspector),
      },
      activeInspectorPanel: {
        visible: Boolean(activeInspectorPanel && !activeInspectorPanel.hidden),
        panel: activeInspectorPanel?.dataset.inspectorPanel || '',
        rect: rectJSON(activeInspectorPanel),
      },
    };
  })()`);
}

async function focusToolbarSubmit(cdp) {
  for (let attempt = 0; attempt < 8 && !(await evaluateJSON(cdp, 'document.activeElement?.matches("[data-chat-submit]") === true')); attempt += 1) {
    await keyPress(cdp, { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  }
  if (!(await evaluateJSON(cdp, 'document.activeElement?.matches("[data-chat-submit]") === true'))) throw new Error(await describePageState(cdp, 'toolbar submit did not receive keyboard focus'));
}

function summarizeAccessibilityChecks(viewports, closeout) {
  const results = Object.values(viewports);
  return {
    keyboardFocusVisible: results.every((result) => result.layout.focusRingProbe.visible === true),
    keyboardPathPass: closeout.keyboardPath.homeToSkills === true && closeout.keyboardPath.skillsToHome === true && closeout.keyboardPath.escapeClosesModal === true,
    modalFocusTrapPass: closeout.modalFocusTrap.pass === true,
    touchTargetsPass: results.every((result) => result.layout.interactiveTargetFailures.length === 0),
    namedControlsPass: results.every((result) => result.layout.focusableWithoutName.length === 0),
    contrastPass: closeout.contrast.pass === true,
  };
}

function summarizeVisualFitChecks(viewports) {
  const results = Object.values(viewports);
  return {
    noTextOverflow: results.every((result) => result.layout.textOverflowCount === 0),
    noHorizontalOverflow: results.every((result) => result.layout.horizontalOverflowPx === 0),
  };
}

function summarizeVisualQualityRubric(viewports, closeout, artifactChecks) {
  const results = Object.values(viewports);
  const cleanLayout = results.every((result) => result.layout.horizontalOverflowPx === 0 && result.layout.textOverflowCount === 0);
  return { hierarchyClarityPass: results.every((result) => result.layout.visualRubricProbe.headingSequence.includes('h1')), copyDensityPass: results.every((result) => result.layout.visualRubricProbe.visibleParagraphs <= 24), spacingRhythmPass: cleanLayout, mobileComfortPass: ['mobile', 'compact'].every((id) => viewports[id].layout.inspector.mobileBottomSheet === true && viewports[id].layout.inspector.mobileSheetHeightRatio <= 0.64), focusPathPass: closeout.keyboardPath.homeToSkills === true && closeout.keyboardPath.skillsToHome === true && closeout.keyboardPath.escapeClosesModal === true, emptyErrorLoadingClarityPass: results.every((result) => result.layout.visualRubricProbe.visibleParagraphs > 0), surfaceOwnershipPass: results.every((result) => result.layout.visualRubricProbe.forbiddenVisibleText === false), scientificArtifactDensityPass: artifactChecks.researchArtifactDensityPass === true };
}
