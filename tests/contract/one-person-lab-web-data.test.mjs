import assert from 'node:assert/strict';
import test from 'node:test';

import * as web from '../../apps/web/src/onePersonLabWeb.mjs';

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
    if (url === '/api/chat') return response({ ok: true, conversationId: 'conv_1', assistantMessage: { content: '你好' } });
    if (url === '/api/opl/snapshot') return response({ ok: true, mode: 'readonly' });
    return response({ ok: false }, 404);
  };

  const state = await web.loadOnePersonLabWebState(fetchRef);
  assert.equal(state.session.email, 'user@example.com');
  assert.equal(state.provider.baseUrl, 'https://gflabtoken.cn/v1');
  assert.equal(state.provider.apiKeyConfigured, true);

  const chat = await web.sendChatMessage(fetchRef, '普通问题');
  assert.equal(chat.assistantMessage.content, '你好');
  assert.deepEqual(calls.map((call) => call.url), [
    '/api/session/current',
    '/api/settings/model-provider',
    '/api/chat/conversations',
    '/api/opl/snapshot',
    '/api/chat',
  ]);
  assert.doesNotMatch(JSON.stringify(calls), /\/api\/mvp\/task|base_url|demo:\/\//);
});

test('web data module exposes hash view and account state machine', () => {
  assert.equal(web.viewFromHash('#settings'), 'settings');
  assert.equal(web.viewFromHash('#capabilities'), 'capabilities');
  assert.equal(web.viewFromHash(''), 'chat');

  assert.equal(web.accountState({ ok: false }, { apiKeyConfigured: false }), 'anonymous');
  assert.equal(web.accountState({ ok: true }, { apiKeyConfigured: false }), 'authenticated_unbound');
  assert.equal(web.accountState({ ok: true }, { apiKeyConfigured: true }), 'authenticated_bound');
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

test('web view model keeps workspace hidden and exposes fixed provider surface', () => {
  const view = web.createOnePersonLabViewModel({
    session: { ok: true, email: 'user@example.com' },
    provider: {
      ok: true,
      baseUrl: 'https://gflabtoken.cn/v1',
      apiKeyConfigured: false,
      maskedKey: '',
    },
    conversations: { conversations: [] },
    oplSnapshot: { ok: true, mode: 'readonly' },
  });

  assert.equal(view.title, '严肃工作的 AI 工作台');
  assert.match(view.subtitle, /Research、Grant、Presentation/);
  assert.equal(view.provider.baseUrl, 'https://gflabtoken.cn/v1');
  assert.equal(view.provider.baseUrlEditable, false);
  assert.equal(view.accountState, 'authenticated_unbound');
  assert.deepEqual(view.capabilities.map((item) => item.label), ['普通问答', '论文/综述', '基金', 'PPT', '数据分析', '长任务']);
  assert.equal(view.runtimeGate.deepLink, 'https://medopl.medopl.cn');
  assert.deepEqual(view.workbenchSteps.map((item) => item.title), [
    '选择专业工作',
    '绑定真实材料',
    '推进长任务',
    '沉淀交付物',
    '管理运行时',
  ]);
  assert.doesNotMatch(JSON.stringify(view), /workspace|demoData|demo:\/\/|轻量项目工作区|真实执行|已完成执行|fake storage|fake billing|fake runtime execution/i);
});

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}
