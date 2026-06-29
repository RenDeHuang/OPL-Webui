#!/usr/bin/env node
import {
  activate,
  assertPage,
  connectCDP,
  createPageTarget,
  describePageState,
  describeResearchResultState,
  evaluateJSON,
  findBrowserBinary,
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
import { captureAccessibilityCloseout, captureVisualQualityEvidence } from './visual-quality-helper.mjs';
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
    : await captureVisualQualityEvidence(cdp, mode, accessibilityCloseout, repoRoot);
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
