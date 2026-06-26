import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkRuntimeGate,
  reliabilityStatusForResult,
  runRuntimeTask,
  runtimeTaskCardForGate,
} from '../../apps/web/src/onePersonLabWeb.mjs';

test('web data checks MedOPL runtime gate before runtime-required task run', async () => {
  const calls = [];
  const gate = await checkRuntimeGate(fakeFetch(calls, {
    '/api/opl/runtime-gate': {
      ok: false,
      errorCode: 'RUNTIME_GATE_BLOCKED',
      gateState: {
        ready: false,
        blockers: [
          { kind: 'package_required', title: '需要购买套餐', deepLink: 'https://medopl.medopl.cn/packages' },
          { kind: 'compute_required', title: '需要开通 compute resource', deepLink: 'https://medopl.medopl.cn/runtime' },
        ],
        nextAction: { id: 'purchase_package', label: '去 MedOPL 开通', deepLink: 'https://medopl.medopl.cn/packages' },
      },
      webuiRuntimeExecution: 'forbidden',
    },
  }), {
    taskIntent: 'paper_question',
    marker: '@论文',
    prompt: '@论文 生成研究选题',
  });

  assert.equal(gate.ok, false);
  assert.equal(gate.errorCode, 'RUNTIME_GATE_BLOCKED');
  assert.deepEqual(gate.gateState.blockers.map((blocker) => blocker.kind), ['package_required', 'compute_required']);
  assert.equal(gate.gateState.nextAction.deepLink, 'https://medopl.medopl.cn/packages');
  assert.deepEqual(calls.map((call) => call.url), ['/api/opl/runtime-gate']);
  assert.equal(calls[0].body.taskIntent, 'paper_question');
  assert.equal(calls[0].body.marker, '@论文');

  const status = reliabilityStatusForResult(gate);
  assert.equal(status.state, 'runtime_required');
  assert.equal(status.title, '需要 MedOPL 开通');
  assert.equal(status.action, '去 MedOPL 开通');
});

test('web data starts runtime run only with refs-only projection', async () => {
  const calls = [];
  const run = await runRuntimeTask(fakeFetch(calls, {
    '/api/opl/runs': {
      ok: true,
      owner: 'MedOPL',
      status: 'running',
      run: { runId: 'run_public_123' },
      artifactRef: 'artifact_public_ref_1',
      artifacts: [{ artifactRef: 'artifact_public_ref_1', kind: 'paper_plan' }],
      progress: [{ stage: 'running', state: 'active' }],
      deliverables: [{ deliverableId: 'deliverable_public_ref_1', artifactRef: 'artifact_public_ref_1' }],
      webuiArtifactBody: 'forbidden',
      webuiDomainTruth: 'forbidden',
      artifactBody: 'must be removed before UI state',
    },
  }), {
    taskIntent: 'paper_question',
    marker: '@论文',
    prompt: '@论文 生成研究选题',
    gateRefs: { runtimeRef: 'runtime_ref_public' },
  });

  assert.equal(run.ok, true);
  assert.equal(run.owner, 'MedOPL');
  assert.equal(run.run.runId, 'run_public_123');
  assert.equal(run.artifactRef, 'artifact_public_ref_1');
  assert.equal(run.progress[0].stage, 'running');
  assert.equal(run.deliverables[0].deliverableId, 'deliverable_public_ref_1');
  assert.equal(run.webuiArtifactBody, 'forbidden');
  assert.equal(run.webuiDomainTruth, 'forbidden');
  assert.equal('artifactBody' in run, false);
  assert.deepEqual(calls.map((call) => call.url), ['/api/opl/runs']);
});

test('web runtime task card renders typed gate blockers and next action', () => {
  const card = runtimeTaskCardForGate('@论文 生成研究选题', {
    ok: false,
    gateState: {
      ready: false,
      blockers: [
        { kind: 'storage_required', title: '需要开通 storage space', deepLink: 'https://medopl.medopl.cn/storage' },
      ],
      nextAction: { id: 'open_storage', label: '去开通 storage', deepLink: 'https://medopl.medopl.cn/storage' },
    },
  });

  assert.equal(card.marker, '@论文');
  assert.equal(card.blockers[0].kind, 'storage_required');
  assert.equal(card.nextAction.label, '去开通 storage');
  assert.equal(card.deepLink, 'https://medopl.medopl.cn/storage');
  assert.equal(card.webuiRuntimeExecution, 'forbidden');
});

function fakeFetch(calls, routes) {
  return async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ url, method: options.method || 'GET', body });
    const payload = routes[url] ?? { ok: false, errorCode: 'SERVICE_UNAVAILABLE' };
    return {
      ok: Boolean(payload.ok),
      status: payload.ok ? 200 : 424,
      json: async () => payload,
    };
  };
}
