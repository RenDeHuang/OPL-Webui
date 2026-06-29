import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import * as web from '../../frontend/web/src/onePersonLabWeb.mjs';
import { readWebSource, WEB_SOURCE_FILES } from './helpers/web-source-reader.mjs';

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });
const retiredDemoScheme = ['demo', '://'].join('');
const retiredMvpTaskPathPattern = new RegExp(`/api/${'mv'}${'p'}/task|base_url|${retiredDemoScheme}`);
const retiredProductDebtPattern = new RegExp([
  'workspace',
  ['demo', 'Data'].join(''),
  retiredDemoScheme,
  '轻量项目工作区',
  '真实执行',
  '已完成执行',
  ['fake ', 'storage'].join(''),
  ['fake ', 'billing'].join(''),
  ['fake ', 'runtime execution'].join(''),
].join('|'), 'i');

test('web data module calls session provider and chat APIs only', async () => {
  const calls = [];
  const fetchRef = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === '/api/session/current') return response({ ok: true, email: 'user@example.com' });
    if (url === '/api/settings/model-provider') return response({
      ok: true,
      provider: 'gflabtoken',
      baseUrl: 'https://gflabtoken.cn/v1',
      apiKeyConfigured: true,
      maskedKey: 'sk-***1234',
    });
    if (url === '/api/chat/conversations') return response({ ok: true, conversations: [] });
    if (url === '/api/tasks') return response({
      ok: true,
      owner: 'OnePersonLabWeb',
      projection: 'refs_status_metadata_only',
      tasks: [],
      webuiArtifactBody: 'forbidden',
      webuiStorageTruth: 'forbidden',
    });
    if (url === '/api/account/commercial-status') return response({
      ok: true,
      owner: 'OnePersonLabWeb',
      productId: 'one-person-lab-web',
      accountType: 'personal',
      lifecycleState: 'active',
      tenantId: 'tenant_123',
      tenantRole: 'owner',
      teamReadiness: {
        state: 'single_user_owner',
        owner: 'OnePersonLabWeb',
        consumer: 'settings_lifecycle_summary',
        allowedNextActions: ['view_medopl_billing'],
      },
      webuiTeamMutation: 'forbidden',
      webuiInviteMutation: 'forbidden',
      webuiRBACMutation: 'forbidden',
      webuiPaymentMutation: 'forbidden',
      webuiBillingSourceOfTruth: 'forbidden',
    });
    if (url === '/api/account/billing-summary') return response({
      ok: true,
      owner: 'MedOPL',
      deepLink: 'https://medopl.medopl.cn/billing',
      quota: { limit: 100, used: 1, remaining: 99 },
      audit: { eventCount: 2, latestEventKind: 'chat.completed' },
      webuiBillingSourceOfTruth: 'forbidden',
      webuiPaymentMutation: 'forbidden',
    });
    if (url === '/api/medopl/runtime/status') return response({
      ok: true,
      owner: 'MedOPL',
      state: 'ready',
      deepLink: 'https://medopl.medopl.cn/runtime',
      counts: { activeRuns: 1 },
      webuiRuntimeExecution: 'forbidden',
    });
    if (url === '/api/medopl/materials-deliverables/projection') return response({
      ok: true,
      owner: 'MedOPL',
      deepLink: 'https://medopl.medopl.cn/materials',
      materials: [],
      deliverables: [],
      webuiStorageMutation: 'forbidden',
      webuiArtifactBody: 'forbidden',
    });
    if (url === '/api/chat') return response({ ok: true, conversationId: 'conv_1', assistantMessage: { content: '你好' } });
    if (url === '/api/opl/snapshot') return response({ ok: true, mode: 'readonly' });
    return response({ ok: false }, 404);
  };

  const state = await web.loadOnePersonLabWebState(fetchRef);
  assert.equal(state.session.email, 'user@example.com');
  assert.equal(state.provider.baseUrl, undefined);
  assert.equal(state.provider.apiKeyConfigured, true);
  assert.equal(state.commercialStatus.accountType, 'personal');
  assert.equal(state.commercialStatus.lifecycleState, 'active');
  assert.equal(state.taskHistory.projection, 'refs_status_metadata_only');
  assert.equal(state.taskHistory.webuiArtifactBody, 'forbidden');
  assert.deepEqual(state.taskHistory.tasks, []);
  assert.equal(state.commercialStatus.teamReadiness.state, 'single_user_owner');
  assert.deepEqual(state.commercialStatus.teamReadiness.allowedNextActions, ['view_medopl_billing']);
  assert.equal(state.commercialStatus.webuiTeamMutation, 'forbidden');
  assert.equal(state.commercialStatus.webuiRBACMutation, 'forbidden');

  const chat = await web.sendChatMessage(fetchRef, '普通问题');
  assert.equal(chat.assistantMessage.content, '你好');
  assert.deepEqual(calls.map((call) => call.url), [
    '/api/session/current',
    '/api/settings/model-provider',
    '/api/chat/conversations',
    '/api/tasks',
    '/api/account/commercial-status',
    '/api/account/billing-summary',
    '/api/medopl/runtime/status',
    '/api/medopl/materials-deliverables/projection',
    '/api/opl/snapshot',
    '/api/chat',
  ]);
  assert.doesNotMatch(JSON.stringify(calls), retiredMvpTaskPathPattern);
});

test('browser bootstrap probes current session without loading OPL snapshot', () => {
  const domSource = readWebSource();

  assert.match(domSource, /loadOnePersonLabWebState\(fetch, \{ loadSnapshot: false \}\)/);
  assert.doesNotMatch(domSource, /loadOnePersonLabWebState\(fetch, \{ probeSession: false, loadSnapshot: false \}\)/);
});

test('web data module exposes hash view and account state machine', () => {
  const pageStates = readJson('contracts/web-page-state-matrix.json');

  assert.deepEqual(['#skills', '#workflows', '#projects', '#more', '#capabilities', ''].map((hash) => web.viewFromHash(hash)), ['skills', 'workflows', 'projects', 'more', 'home', 'home']);
  for (const route of pageStates.routes) {
    assert.equal(web.viewFromHash(route.hash), route.id, `route hash must resolve: ${route.id}`);
  }

  assert.equal(web.accountState({ ok: false }, { apiKeyConfigured: false }), 'anonymous');
  assert.equal(web.accountState({ ok: true }, { apiKeyConfigured: false }), 'authenticated_unbound');
  assert.equal(web.accountState({ ok: true }, { apiKeyConfigured: true }), 'authenticated_bound');
});

test('web data module implements the page-state chat matrix', () => {
  const pageStates = readJson('contracts/web-page-state-matrix.json');
  const chatStates = pageStates.chatStates;
  const reliabilityStates = pageStates.reliabilityModel.statuses.map((status) => status.state);

  for (const state of ['idle', 'sending', 'runtime_required', 'quota_exceeded', 'upstream_failed']) {
    assert.equal(chatStates.includes(state), true, `missing contract chat state: ${state}`);
  }
  for (const state of ['auth_required', 'api_key_required', 'service_unavailable', 'network_unreachable']) {
    assert.equal(chatStates.includes(state), true, `missing reliability contract state: ${state}`);
  }
  assert.deepEqual(reliabilityStates, ['auth_required', 'api_key_required', 'quota_exceeded', 'runtime_required', 'runtime_required', 'runtime_required', 'upstream_failed', 'service_unavailable', 'network_unreachable']);
  for (const state of ['research_entry_selected', 'paper_entry_selected', 'grant_entry_selected', 'materials_refs_pending', 'presentation_entry_selected', 'book_entry_selected']) {
    assert.equal(chatStates.includes(state), true, `missing research contract state: ${state}`);
  }

  assert.equal(web.chatStateForResult(null), 'idle');
  assert.equal(web.chatStateForResult(null, true), 'sending');
  assert.equal(web.chatStateForResult({ ok: false, errorCode: 'RUNTIME_REQUIRED' }), 'runtime_required');
  assert.equal(web.chatStateForResult({ ok: false, errorCode: 'CHAT_QUOTA_EXCEEDED' }), 'quota_exceeded');
  assert.equal(web.chatStateForResult({ ok: false, errorCode: 'UPSTREAM_CHAT_FAILED' }), 'upstream_failed');
  assert.equal(web.chatStateForResult({ ok: false, errorCode: 'AUTH_REQUIRED' }), 'auth_required');
  assert.equal(web.chatStateForResult({ ok: false, errorCode: 'API_KEY_REQUIRED' }), 'api_key_required');
  assert.equal(web.chatStateForResult({ ok: false, errorCode: 'SERVICE_UNAVAILABLE' }), 'service_unavailable');
  assert.equal(web.chatStateForResult({ ok: false, errorCode: 'NETWORK_UNREACHABLE' }), 'network_unreachable');
  assert.equal(web.chatStateForResult({ ok: true, assistantMessage: { content: 'ok' } }), 'idle');
  assert.equal(web.chatStateForPrompt('@科研 帮我拆解研究方向'), 'research_entry_selected');
  assert.equal(web.chatStateForPrompt('@论文 生成研究选题'), 'paper_entry_selected');
  assert.equal(web.chatStateForPrompt('@基金 帮我拆解标书结构'), 'grant_entry_selected');
  assert.equal(web.chatStateForPrompt('@文件 整理材料引用'), 'materials_refs_pending');
  assert.equal(web.chatStateForPrompt('@PPT 规划研究演示'), 'presentation_entry_selected');
  assert.equal(web.chatStateForPrompt('@书 规划书稿结构'), 'book_entry_selected');
  assert.equal(web.chatStateForPrompt('普通问答'), 'idle');
  assert.deepEqual(web.RESEARCH_TASK_INTENTS.map((intent) => [intent.id, intent.marker, intent.expectedChatState]), [
    ['research_direction', '@科研', 'research_entry_selected'],
    ['paper_question', '@论文', 'paper_entry_selected'],
    ['grant_plan', '@基金', 'grant_entry_selected'],
    ['review_map', '@综述', 'materials_refs_pending'],
    ['materials_refs', '@文件', 'materials_refs_pending'],
    ['presentation_foundry', '@PPT', 'presentation_entry_selected'],
    ['book_foundry', '@书', 'book_entry_selected'],
  ]);

  for (const state of ['idle', 'sending', 'runtime_required', 'quota_exceeded', 'upstream_failed', 'auth_required', 'api_key_required', 'service_unavailable', 'network_unreachable', 'research_entry_selected', 'paper_entry_selected', 'grant_entry_selected', 'materials_refs_pending', 'presentation_entry_selected', 'book_entry_selected']) {
    assert.equal(chatStates.includes(state), true, `chat state is outside contract: ${state}`);
  }
});

test('web data module builds sanitized reliability and account lifecycle status view models', () => {
  const reliability = web.reliabilityStatusForResult({
    ok: false,
    errorCode: 'UPSTREAM_CHAT_FAILED',
    message: 'chat upstream returned an error',
    upstreamDiagnostics: {
      upstreamHost: 'gflabtoken.cn',
      upstreamModel: 'gpt-5.5',
      upstreamKind: 'network',
      rawApiKey: 'sk-secret',
    },
  });
  assert.equal(reliability.state, 'upstream_failed');
  assert.equal(reliability.title, '上游暂时不可用');
  assert.equal(reliability.action, '稍后重试');
  assert.equal(reliability.retryable, true);
  assert.equal(reliability.details, '');
  assert.doesNotMatch(JSON.stringify(reliability), /gflabtoken\.cn|gpt-5\.5|sk-secret|rawApiKey|encryptedApiKey|password|postgres:\/\//i);

  const account = web.accountLifecycleSummary({ ok: true, accountType: 'personal', lifecycleState: 'active', tenantRole: 'owner', tenantId: 'tenant_123' }, { ok: true, quota: { limit: 100, used: 7, remaining: 93 }, audit: { eventCount: 12, latestEventKind: 'chat.completed' } });
  assert.equal(account.lifecycleLabel, 'Personal / active');
  assert.equal(account.tenantRoleLabel, 'tenant role: owner');
  assert.equal(account.quotaLabel, 'quota 7/100 used, 93 remaining');
  assert.equal(account.auditLabel, 'audit events: 12, latest chat.completed');
  assert.doesNotMatch(JSON.stringify(account), /tenant_123|workspace|runtimeRef|nodePool|storage|paymentToken|invoiceBody/i);
});

test('web data module converts network and malformed JSON failures into sanitized reliability errors', async () => {
  const leakyPayload = { ok: false, errorCode: 'UPSTREAM_CHAT_FAILED', message: 'api_key=sk-secret-value private_state_path=/home/dev/.opl/private/state.json', rawUpstreamBody: 'sk-secret-value', upstreamDiagnostics: { upstreamHost: 'gflabtoken.cn', upstreamModel: 'gpt-5.5', rawProviderError: 'Bearer sk-secret-value', rawApiKey: 'sk-secret-value', encryptedApiKey: 'ciphertext-secret', databaseUrl: 'postgres://user:secret@example/oplweb' } };
  const upstream = await web.sendChatMessage(async () => response(leakyPayload, 502), '@科研 分析方向');
  assert.deepEqual([upstream.errorCode, upstream.status, web.chatStateForResult(upstream), web.reliabilityStatusForResult(upstream).state], ['UPSTREAM_CHAT_FAILED', 502, 'upstream_failed', 'upstream_failed']);
  assert.doesNotMatch(upstream.diagnostics, /gflabtoken\.cn|gpt-5\.5/);
  assert.doesNotMatch(JSON.stringify(upstream), /rawUpstreamBody|rawProviderError|rawApiKey|encryptedApiKey|sk-secret-value|ciphertext-secret|postgres:\/\/|\/home\/dev\/\.opl\/private/i);

  for (const [status, payload, expectedCode, expectedState, retryable] of [
    [401, { ok: false, errorCode: 'AUTH_REQUIRED', message: 'cookie expired with session_secret=secret' }, 'AUTH_REQUIRED', 'auth_required', false],
    [400, { ok: false, errorCode: 'API_KEY_REQUIRED', rawApiKey: 'sk-secret-value' }, 'API_KEY_REQUIRED', 'api_key_required', false],
    [429, { ok: false, errorCode: 'CHAT_QUOTA_EXCEEDED', rawUpstreamBody: 'quota body with sk-secret-value' }, 'CHAT_QUOTA_EXCEEDED', 'quota_exceeded', false],
    [503, { ok: false, errorCode: 'API_KEY_DECRYPT_FAILED', message: 'postgres://user:secret@example/oplweb unavailable' }, 'SERVICE_UNAVAILABLE', 'service_unavailable', true],
  ]) {
    const result = await web.sendChatMessage(async () => response(payload, status), '普通问题');
    assert.deepEqual([result.errorCode, web.chatStateForResult(result), web.reliabilityStatusForResult(result).state, web.reliabilityStatusForResult(result).retryable], [expectedCode, expectedState, expectedState, retryable]);
    assert.doesNotMatch(JSON.stringify(result), /sk-secret-value|postgres:\/\/|session_secret|rawUpstreamBody|rawApiKey/i);
  }

  const chatNetwork = await web.sendChatMessage(async () => {
    throw new Error('connect ECONNRESET postgres://user:secret@example/oplweb sk-secret');
  }, '普通问题');
  assert.equal(chatNetwork.ok, false);
  assert.equal(chatNetwork.errorCode, 'NETWORK_UNREACHABLE');
  assert.equal(web.chatStateForResult(chatNetwork), 'network_unreachable');
  assert.doesNotMatch(JSON.stringify(chatNetwork), /postgres:\/\//i);
  assert.doesNotMatch(JSON.stringify(chatNetwork), /sk-secret/i);

  const saveMalformed = await web.saveAPIKey(async () => ({
    ok: false,
    status: 502,
    async json() {
      throw new Error('html upstream error with password=secret');
    },
  }), 'sk-secret', { ok: true });
  assert.equal(saveMalformed.ok, false);
  assert.equal(saveMalformed.errorCode, 'SERVICE_UNAVAILABLE');
  assert.equal(web.chatStateForResult(saveMalformed), 'service_unavailable');
  assert.doesNotMatch(JSON.stringify(saveMalformed), /password=secret|sk-secret/i);
});

test('web data module builds structured research result and runtime task card view models', () => {
  const pageStates = readJson('contracts/web-page-state-matrix.json');
  assert.deepEqual(web.RESEARCH_RESULT_SECTIONS.map((section) => section.id), pageStates.structuredResultShape.sections);

  const researchResult = web.researchResultForChat({
    prompt: '@科研 帮我拆解研究方向、问题和下一步计划',
    assistantMessage: { content: 'mock upstream response for research chat' },
  });
  assert.equal(researchResult.kind, 'structured_research_result');
  assert.equal(researchResult.marker, '@科研');
  assert.deepEqual(researchResult.sections.map((section) => section.id), ['research_plan', 'evidence_refs', 'next_steps']);
  assert.match(researchResult.sections.find((section) => section.id === 'research_plan').body, /mock upstream response/);
  assert.doesNotMatch(JSON.stringify(researchResult), /artifact_body|private_state_path|mutation_result|workspace|nodePool|storage/i);
  const ordinaryResult = web.researchResultForChat({
    prompt: '普通问答',
    assistantMessage: { content: 'ok' },
  });
  assert.equal(ordinaryResult, null);

  const runtimeCard = web.runtimeTaskCardForPrompt('@论文 生成研究选题和证据计划');
  assert.equal(runtimeCard.kind, 'runtime_task_card');
  assert.equal(runtimeCard.marker, '@论文');
  assert.equal(runtimeCard.requiredCapability, 'paper_review_workflow');
  assert.equal(runtimeCard.deepLink, 'https://medopl.medopl.cn');
  assert.equal(runtimeCard.webuiRuntimeExecution, 'forbidden');
  assert.doesNotMatch(JSON.stringify(runtimeCard), /artifact_body|private_state_path|mutation_result|workspace|nodePool|storage/i);
  assert.deepEqual(
    ['@PPT 规划研究演示', '@书 规划书稿结构'].map((prompt) => {
      const card = web.runtimeTaskCardForPrompt(prompt);
      return [card.marker, card.requiredCapability, card.webuiRuntimeExecution];
    }),
    [
      ['@PPT', 'presentation_foundry_workflow', 'forbidden'],
      ['@书', 'book_foundry_workflow', 'forbidden'],
    ],
  );
});

test('anonymous users cannot save API keys from the web data module', async () => {
  const calls = [];
  const result = await web.saveAPIKey(async (url, options) => {
    calls.push({ url, options });
    return response({ ok: true });
  }, 'sk-test', { ok: false });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'AUTH_REQUIRED');
  assert.deepEqual(calls, []);
});

test('model provider save never sends base_url or raw key back in view model', async () => {
  const calls = [];
  await web.saveAPIKey(async (url, options) => {
    calls.push({ url, options });
    return response({ ok: true, apiKeyConfigured: true, maskedKey: 'sk-...1234', baseUrl: web.FIXED_BASE_URL });
  }, 'sk-secret-value', { ok: true });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/settings/model-provider');
  assert.equal(calls[0].options.method, 'PUT');
  assert.doesNotMatch(calls[0].options.body, /base_url|baseUrl|https:\/\/gflabtoken\.cn\/v1/);
  assert.doesNotMatch(JSON.stringify(web.createOnePersonLabViewModel({
    session: { ok: true, email: 'user@example.com' },
    provider: { ok: true, baseUrl: web.FIXED_BASE_URL, apiKeyConfigured: true, maskedKey: 'sk-...1234' },
    conversations: { conversations: [] },
    oplSnapshot: { ok: true },
  })), /sk-secret-value/);
});

test('web data module surfaces runtime gate with MedOPL deep link', async () => {
  const gated = await web.sendChatMessage(async () => response({
    ok: false,
    errorCode: 'RUNTIME_REQUIRED',
    message: '该能力需要 MedOPL Runtime / Storage / Node Pool',
    medoplDeepLink: 'https://medopl.medopl.cn/runtime/open',
  }, 409), '@基金 写申请书');

  assert.equal(gated.errorCode, 'RUNTIME_REQUIRED');
  assert.match(gated.medoplDeepLink, /^https:\/\/medopl\.medopl\.cn/);
});

test('runtime marker policy is explicit and does not gate uncontracted at-mentions', () => {
  const runtime = readJson('contracts/web-runtime-bridge.json');
  const domSource = readWebSource();

  assert.deepEqual(web.RUNTIME_REQUIRED_MARKERS, runtime.runtimeRequiredMarkers);
  assert.deepEqual(web.LIGHTWEIGHT_MARKERS, runtime.lightweightMarkers);
  assert.deepEqual(web.CAPABILITY_MARKER_SEMANTICS, runtime.markerSemantics);
  assert.equal(web.requiresRuntimeGate('@科研 帮我拆解研究方向'), false);
  for (const marker of runtime.runtimeRequiredMarkers) {
    assert.equal(web.requiresRuntimeGate(`${marker} 做一个任务`), true, `contract marker must gate: ${marker}`);
  }
  assert.equal(web.requiresRuntimeGate('@RCA 规划可视化交付方案'), false);
  assert.equal(web.requiresRuntimeGate('请 @同事 看一下这个普通问题'), false);
  assert.match(domSource, /requiresRuntimeGate/);
  assert.doesNotMatch(domSource, /\.includes\('@'\)/);
});

test('web data module loads sanitized MedOPL runtime status projection', async () => {
  const view = await web.loadOnePersonLabWebState(async (url) => {
    if (url === '/api/session/current') return response({ ok: true, email: 'runtime@example.com' });
    if (url === '/api/settings/model-provider') return response({ ok: true, baseUrl: web.FIXED_BASE_URL, apiKeyConfigured: true });
    if (url === '/api/chat/conversations') return response({ ok: true, conversations: [] });
    if (url === '/api/account/commercial-status') return response({
      ok: true,
      owner: 'OnePersonLabWeb',
      productId: 'one-person-lab-web',
      accountType: 'personal',
      lifecycleState: 'active',
      tenantId: 'tenant_runtime',
      tenantRole: 'owner',
      webuiTeamMutation: 'forbidden',
      webuiInviteMutation: 'forbidden',
      webuiPaymentMutation: 'forbidden',
      webuiBillingSourceOfTruth: 'forbidden',
    });
    if (url === '/api/medopl/runtime/status') return response({
      ok: true,
      owner: 'MedOPL',
      state: 'required',
      deepLink: 'https://medopl.medopl.cn/runtime',
      refs: { runtimeRef: 'runtime_public_ref_123' },
      counts: { activeRuns: 0 },
      webuiRuntimeExecution: 'forbidden',
    });
    if (url === '/api/opl/snapshot') return response({ ok: true, mode: 'readonly' });
    return response({ ok: false }, 404);
  });

  assert.equal(view.runtimeStatus.owner, 'MedOPL');
  assert.equal(view.runtimeStatus.state, 'required');
  assert.equal(view.runtimeStatus.deepLink, 'https://medopl.medopl.cn/runtime');
  assert.equal(view.runtimeStatus.webuiRuntimeExecution, 'forbidden');
  assert.equal(view.runtimeStatus.refs.runtimeRef, 'runtime_public_ref_123');
  assert.doesNotMatch(JSON.stringify(view.runtimeStatus), /secret|raw_provider_secret|artifact_body|private_state_path|mutation_result/i);
});

test('web data module loads sanitized materials and deliverables projection', async () => {
  const view = await web.loadOnePersonLabWebState(async (url) => {
    if (url === '/api/session/current') return response({ ok: true, email: 'materials@example.com' });
    if (url === '/api/settings/model-provider') return response({ ok: true, baseUrl: web.FIXED_BASE_URL, apiKeyConfigured: true });
    if (url === '/api/chat/conversations') return response({ ok: true, conversations: [] });
    if (url === '/api/account/commercial-status') return response({
      ok: true,
      owner: 'OnePersonLabWeb',
      productId: 'one-person-lab-web',
      accountType: 'personal',
      lifecycleState: 'active',
      tenantId: 'tenant_materials',
      tenantRole: 'owner',
      webuiTeamMutation: 'forbidden',
      webuiInviteMutation: 'forbidden',
      webuiPaymentMutation: 'forbidden',
      webuiBillingSourceOfTruth: 'forbidden',
    });
    if (url === '/api/medopl/runtime/status') return response({ ok: true, owner: 'MedOPL', state: 'ready', webuiRuntimeExecution: 'forbidden' });
    if (url === '/api/medopl/materials-deliverables/projection') return response({
      ok: true,
      owner: 'MedOPL',
      deepLink: 'https://medopl.medopl.cn/materials',
      materials: [{ materialId: 'material_public_ref_123', title: 'Linked material', kind: 'reference', status: 'ready' }],
      deliverables: [{ deliverableId: 'deliverable_public_ref_456', title: 'Linked deliverable', kind: 'artifact_ref', status: 'draft', ref: 'deliverable_public_ref_456' }],
      webuiStorageMutation: 'forbidden',
      webuiArtifactBody: 'forbidden',
    });
    if (url === '/api/opl/snapshot') return response({ ok: true, mode: 'readonly' });
    return response({ ok: false }, 404);
  });
  assert.equal(view.materialsDeliverables.owner, 'MedOPL');
  assert.equal(view.materialsDeliverables.deepLink, 'https://medopl.medopl.cn/materials');
  assert.equal(view.materialsDeliverables.materials[0].materialId, 'material_public_ref_123');
  assert.equal(view.materialsDeliverables.deliverables[0].deliverableId, 'deliverable_public_ref_456');
  assert.equal(view.materialsDeliverables.webuiStorageMutation, 'forbidden');
  assert.equal(view.materialsDeliverables.webuiArtifactBody, 'forbidden');
  assert.doesNotMatch(JSON.stringify(view.materialsDeliverables), /secret|raw_provider_secret|artifact_body|blob|private_state_path|mutation_result/i);
});

test('web data module loads sanitized billing summary projection', async () => {
  const view = await web.loadOnePersonLabWebState(async (url) => {
    if (url === '/api/session/current') return response({ ok: true, email: 'billing@example.com' });
    if (url === '/api/settings/model-provider') return response({ ok: true, baseUrl: web.FIXED_BASE_URL, apiKeyConfigured: true });
    if (url === '/api/chat/conversations') return response({ ok: true, conversations: [] });
    if (url === '/api/account/commercial-status') return response({
      ok: true,
      owner: 'OnePersonLabWeb',
      productId: 'one-person-lab-web',
      accountType: 'personal',
      lifecycleState: 'active',
      tenantId: 'tenant_billing',
      tenantRole: 'owner',
      webuiTeamMutation: 'forbidden',
      webuiInviteMutation: 'forbidden',
      webuiPaymentMutation: 'forbidden',
      webuiBillingSourceOfTruth: 'forbidden',
    });
    if (url === '/api/account/billing-summary') return response({
      ok: true,
      owner: 'MedOPL',
      deepLink: 'https://medopl.medopl.cn/billing',
      quota: { limit: 3, used: 1, remaining: 2 },
      audit: { eventCount: 4, latestEventKind: 'api_key.saved' },
      webuiBillingSourceOfTruth: 'forbidden',
      webuiPaymentMutation: 'forbidden',
    });
    if (url === '/api/medopl/runtime/status') return response({ ok: true, owner: 'MedOPL', state: 'ready', webuiRuntimeExecution: 'forbidden' });
    if (url === '/api/medopl/materials-deliverables/projection') return response({ ok: true, owner: 'MedOPL', materials: [], deliverables: [] });
    if (url === '/api/opl/snapshot') return response({ ok: true, mode: 'readonly' });
    return response({ ok: false }, 404);
  });

  assert.equal(view.billingSummary.owner, 'MedOPL');
  assert.equal(view.billingSummary.deepLink, 'https://medopl.medopl.cn/billing');
  assert.equal(view.billingSummary.quota.remaining, 2);
  assert.equal(view.billingSummary.audit.latestEventKind, 'api_key.saved');
  assert.equal(view.billingSummary.webuiBillingSourceOfTruth, 'forbidden');
  assert.equal(view.billingSummary.webuiPaymentMutation, 'forbidden');
  assert.doesNotMatch(JSON.stringify(view.billingSummary), /secret|raw_provider_secret|paymentToken|ledger|invoiceBody|rawMetadata|private_state_path/i);
});

test('web data module loads commercial account lifecycle without team or billing mutation', async () => {
  const view = await web.loadOnePersonLabWebState(async (url) => {
    if (url === '/api/session/current') return response({ ok: true, email: 'commercial@example.com' });
    if (url === '/api/settings/model-provider') return response({ ok: true, baseUrl: web.FIXED_BASE_URL, apiKeyConfigured: true });
    if (url === '/api/chat/conversations') return response({ ok: true, conversations: [] });
    if (url === '/api/account/commercial-status') return response({
      ok: true,
      owner: 'OnePersonLabWeb',
      productId: 'one-person-lab-web',
      accountType: 'personal',
      lifecycleState: 'active',
      tenantId: 'tenant_commercial',
      tenantRole: 'owner',
      teamReadiness: {
        state: 'single_user_owner',
        owner: 'OnePersonLabWeb',
        consumer: 'settings_lifecycle_summary',
        allowedNextActions: ['view_medopl_billing'],
      },
      webuiTeamMutation: 'forbidden',
      webuiInviteMutation: 'forbidden',
      webuiRBACMutation: 'forbidden',
      webuiPaymentMutation: 'forbidden',
      webuiBillingSourceOfTruth: 'forbidden',
    });
    if (url === '/api/account/billing-summary') return response({ ok: true, owner: 'MedOPL', quota: { limit: 3, used: 1, remaining: 2 } });
    if (url === '/api/medopl/runtime/status') return response({ ok: true, owner: 'MedOPL', state: 'ready', webuiRuntimeExecution: 'forbidden' });
    if (url === '/api/medopl/materials-deliverables/projection') return response({ ok: true, owner: 'MedOPL', materials: [], deliverables: [] });
    if (url === '/api/opl/snapshot') return response({ ok: true, mode: 'readonly' });
    return response({ ok: false }, 404);
  });

  assert.equal(view.commercialStatus.owner, 'OnePersonLabWeb');
  assert.equal(view.commercialStatus.accountType, 'personal');
  assert.equal(view.commercialStatus.lifecycleState, 'active');
  assert.equal(view.commercialStatus.tenantRole, 'owner');
  assert.equal(view.commercialStatus.teamReadiness.state, 'single_user_owner');
  assert.equal(view.commercialStatus.teamReadiness.consumer, 'settings_lifecycle_summary');
  assert.deepEqual(view.commercialStatus.teamReadiness.allowedNextActions, ['view_medopl_billing']);
  assert.equal(view.commercialStatus.webuiTeamMutation, 'forbidden');
  assert.equal(view.commercialStatus.webuiInviteMutation, 'forbidden');
  assert.equal(view.commercialStatus.webuiRBACMutation, 'forbidden');
  assert.equal(view.commercialStatus.webuiPaymentMutation, 'forbidden');
  assert.equal(view.commercialStatus.webuiBillingSourceOfTruth, 'forbidden');
  assert.equal(view.accountLifecycle.lifecycleLabel, 'Personal / active');
  assert.equal(view.accountLifecycle.tenantRoleLabel, 'tenant role: owner');
  assert.equal(view.accountLifecycle.teamReadinessLabel, 'team readiness: single_user_owner');
  assert.equal(view.accountLifecycle.quotaLabel, 'quota 1/3 used, 2 remaining');
  assert.doesNotMatch(JSON.stringify(view.commercialStatus), /workspace|teamInvite|paymentToken|invoiceBody|storage|nodePool|runtimeRef|rawApiKey|encryptedApiKey|subscription|price/i);
});

test('web view model keeps workspace hidden and exposes fixed provider surface', () => {
  const view = web.createOnePersonLabViewModel({
    session: { ok: true, email: 'user@example.com' },
    provider: { ok: true, baseUrl: 'https://gflabtoken.cn/v1', apiKeyConfigured: false, maskedKey: '' },
    conversations: { conversations: [] },
    oplSnapshot: { ok: true, mode: 'readonly' },
  });

  assert.equal(view.title, '科研人员的 One Person Lab Web');
  assert.match(view.subtitle, /研究问题、项目和 Skill/);
  assert.equal(view.figmaMakeSource, '1MNO5l7PQYKZVNqQgw6DGS');
  assert.equal(view.shell.sideNavigation, true);
  assert.equal(view.shell.accountDock, true);
  assert.equal(view.shell.promptCommandCenter, true);
  assert.deepEqual(view.navItems.map(({ id, label, href }) => [id, label, href]), [['home', '新建对话', '#home'], ['projects', '项目 / 窗口', '#projects'], ['skills', 'Skill', '#skills'], ['workflows', '工作流', '#workflows'], ['search', '搜索', '#home'], ['more', 'More', '#more']]);
  assert.equal(view.primaryCTA, '绑定 API Key');
  assert.equal(view.accountEntry, 'bottom_avatar_popover');
  assert.equal(view.navItems.some((item) => ['科研能力', '论文', '基金', '账号'].includes(item.label)), false);
  assert.equal(view.provider.baseUrl, undefined);
  assert.equal(view.provider.baseUrlEditable, false);
  assert.deepEqual(view.modelSelector, { label: '模型：自动', value: 'auto', optional: true, baseUrlVisible: false });
  assert.equal(view.accountState, 'authenticated_unbound');
  assert.deepEqual(['anonymous', 'authenticated_unbound', 'authenticated_bound'].map((state) => web.createOnePersonLabViewModel({ session: { ok: state !== 'anonymous', email: 'user@example.com' }, provider: { ok: true, apiKeyConfigured: state === 'authenticated_bound', maskedKey: 'sk-***1234' }, conversations: { conversations: [] } }).primaryCTA), ['登录/注册', '绑定 API Key', '发送']);
  assert.equal(view.capabilitySource.syncMode, 'source_path_pinned_manifest');
  assert.equal(view.capabilitySource.dynamicSync, false);
  assert.match(view.capabilitySource.appContract, /one-person-lab-app\/contracts\/app-product-profile\.json/);
  assert.match(view.capabilitySource.frameworkContract, /one-person-lab\/contracts\/opl-framework\/domains\.json/);
  assert.deepEqual(view.capabilities.map((item) => item.label), ['科研规划', '论文/综述', '基金', '材料/文件', '演示/PPT', '写书/长稿', '普通问答']);
  assert.deepEqual(view.researchTaskIntents.map((intent) => intent.id), ['research_direction', 'paper_question', 'grant_plan', 'review_map', 'materials_refs', 'presentation_foundry', 'book_foundry']);
  assert.deepEqual(view.researchTaskIntents.map((intent) => intent.consumer), Array.from({ length: 7 }, () => 'research_user_prompt'));
  assert.equal(view.skillGroups, undefined);
  assert.deepEqual(view.capabilities.filter((item) => item.runtimeRequired).map((item) => item.sourceAssistant), ['mas', 'mag', 'medopl', 'rca', 'bookforge']);
  assert.deepEqual([view.runtimeGate.deepLink, view.runtimeGate.title, view.runtimeGate.message], ['https://medopl.medopl.cn', '需要 MedOPL 授权', '该能力需要在 MedOPL 开通后继续']);
  assert.doesNotMatch(JSON.stringify(view.runtimeGate), /MedOPL Runtime|node pool|托管运行环境|存储|无限计算资源|创始人计划|WebUI owns/i);
  assert.deepEqual(view.researchResultSections.map((section) => section.id), ['research_plan', 'evidence_refs', 'next_steps']);
  assert.deepEqual(view.workflowCards.map((item) => item.title), ['论文工作流', '基金工作流', '综述工作流', '材料线索', '演示工作流', '写书工作流']);
  assert.doesNotMatch(JSON.stringify(view), retiredProductDebtPattern);
  assert.doesNotMatch(JSON.stringify(view), /https:\/\/gflabtoken\.cn\/v1|base_url/i);
});

test('web product entry delegates state DOM and surface ownership to focused modules', () => {
  const entry = readFileSync('frontend/web/src/onePersonLabWeb.mjs', 'utf8');
  for (const path of ['frontend/web/src/onePersonLabWebState.mjs', 'frontend/web/src/onePersonLabWebDom.mjs', ...WEB_SOURCE_FILES.filter((path) => path.includes('/surfaces/'))]) assert.equal(existsSync(path), true, `missing owner module: ${path}`);
  assert.match(entry, /onePersonLabWebState\.mjs/);
  assert.match(entry, /onePersonLabWebDom\.mjs/);
  assert.doesNotMatch(entry, /querySelector|addEventListener|appendMessage|writeJSON|readJSON|providerFallback/);
  assert.ok(entry.split('\n').length <= 80, 'product entry should stay thin');
});
