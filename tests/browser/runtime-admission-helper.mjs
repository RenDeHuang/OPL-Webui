export async function resolveRuntimeAdmissionScenario(cdp, prompt, tools) {
  const gate = await browserRuntimeGate(cdp, prompt, tools.evaluateJSON);
  if (gate.ok === true && gate.gateState?.ready === true) {
    return {
      scenario: 'specialist_ready_path',
      source: 'MedOPL runtime gate projection',
      gate,
      requiredAuditKinds: ['runtime_gate.ready', 'run_intent.accepted', 'runtime_run.projected'],
      doesNotProve: ['runtime execution completed', 'artifact body authority', 'storage truth ownership'],
    };
  }
  const blockers = gate.gateState?.blockers ?? [];
  const operatorBlocked = gate.errorCode === 'MEDOPL_ENDPOINT_REQUIRED' || blockers.some((blocker) => blocker.kind === 'medopl_endpoint_required');
  if (operatorBlocked) {
    return {
      scenario: 'onboarding_path',
      source: 'OPL-Webui operator deployment projection',
      gate,
      requiredAuditKinds: ['runtime_admission.onboarding_required'],
      doesNotProve: ['MedOPL user account ready', 'runtime execution readiness', 'storage truth ownership'],
    };
  }
  return {
    scenario: 'specialist_not_ready_path',
    source: 'MedOPL account/resource-state projection',
    gate,
    requiredAuditKinds: ['runtime_gate.blocked'],
    doesNotProve: ['runtime execution completed', 'artifact body authority', 'storage truth ownership'],
  };
}

async function browserRuntimeGate(cdp, prompt, evaluateJSON) {
  return evaluateJSON(cdp, `fetch('/api/opl/runtime-gate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(${JSON.stringify(runtimeTaskPayloadForPromptLiteral(prompt))})
  }).then(async (response) => ({ status: response.status, ...(await response.json().catch(() => ({}))) }))`);
}

export function runtimeTaskPayloadForPromptLiteral(prompt) {
  const marker = prompt.includes('@基金') ? '@基金' : '@论文';
  return {
    taskIntent: marker === '@基金' ? 'grant_plan' : 'paper_question',
    marker,
    prompt,
  };
}

export async function exerciseSpecialistNotReadyPath(cdp, prompt, tools) {
  const blockedCount = await tools.auditKindCount(cdp, 'runtime_gate.blocked');
  await tools.submitPrompt(cdp, prompt);
  await tools.waitForAuditKindCount(cdp, 'runtime_gate.blocked', blockedCount + 1);
  await tools.assertPage(cdp, 'document.querySelector("[data-runtime-gate]")?.classList.contains("is-visible")', 'specialist blocked runtime gate');
  await tools.assertPage(cdp, `document.querySelector("[data-runtime-task-card]")?.dataset.runtimeTaskMarker === ${JSON.stringify(runtimeTaskPayloadForPromptLiteral(prompt).marker)}`, 'specialist blocked runtime task card');
  await tools.assertPage(cdp, 'document.querySelector("[data-runtime-task-card] a")?.href.startsWith("https://medopl.medopl.cn")', 'specialist blocked MedOPL deeplink');
}

export async function exerciseSpecialistReadyPath(cdp, prompt, tools) {
  const readyCount = await tools.auditKindCount(cdp, 'runtime_gate.ready');
  const acceptedCount = await tools.auditKindCount(cdp, 'run_intent.accepted');
  const projectedCount = await tools.auditKindCount(cdp, 'runtime_run.projected');
  await tools.submitPrompt(cdp, prompt);
  await tools.waitForAuditKindCount(cdp, 'runtime_gate.ready', readyCount + 1);
  await tools.waitForAuditKindCount(cdp, 'run_intent.accepted', acceptedCount + 1);
  await tools.waitForAuditKindCount(cdp, 'runtime_run.projected', projectedCount + 1);
  await tools.assertPage(cdp, 'document.querySelector("[data-runtime-run-projection]")?.dataset.webuiArtifactBody === "forbidden"', 'ready path refs-only runtime projection');
  await tools.assertPage(cdp, 'document.querySelector("[data-runtime-task-card]")?.dataset.runtimeProjectionStatus.length > 0', 'ready path runtime projection status');
  await tools.assertPage(cdp, 'document.querySelector("[data-runtime-task-card] a")?.href.startsWith("https://medopl.medopl.cn")', 'ready path MedOPL deeplink');
}

export async function exerciseOnboardingPath(cdp, prompt, runtimeAdmission, tools) {
  await tools.submitPrompt(cdp, prompt);
  await tools.waitFor(cdp, 'document.querySelector("[data-runtime-gate]")?.classList.contains("is-visible")', () => tools.describePageState(cdp, 'onboarding path did not show runtime admission gate'));
  await tools.assertPage(cdp, 'document.querySelector("[data-runtime-task-card] a")?.href.startsWith("https://medopl.medopl.cn")', 'onboarding path MedOPL deeplink');
  await cdp.send('Runtime.evaluate', { expression: `document.body.dataset.runtimeAdmissionScenario = ${JSON.stringify(runtimeAdmission.scenario)}` });
}

export function assertRuntimeAdmissionAuditKinds(scenario, kinds) {
  if (scenario === 'specialist_ready_path') {
    for (const kind of ['runtime_gate.ready', 'run_intent.accepted', 'runtime_run.projected']) {
      if (!kinds.includes(kind)) throw new Error(`missing ${kind} audit evidence for ready path: ${kinds.join(',')}`);
    }
    return;
  }
  if (scenario === 'onboarding_path') {
    if (!kinds.includes('runtime_gate.blocked') && !kinds.includes('runtime_admission.onboarding_required')) {
      throw new Error(`missing onboarding runtime admission audit evidence: ${kinds.join(',')}`);
    }
    return;
  }
  if (!kinds.includes('runtime_gate.blocked')) {
    throw new Error(`missing runtime_gate.blocked audit evidence: ${kinds.join(',')}`);
  }
}
