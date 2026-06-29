import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assertIncludesAll(actual, expected, label) {
  for (const item of expected) {
    assert.equal(actual.includes(item), true, `missing ${label}: ${item}`);
  }
}

test('commercial product primitives distinguish durable product objects from variable UI expression', () => {
  const product = readJson('contracts/web-product-profile.json');
  const interaction = readJson('contracts/web-interaction-contract.json');
  const pageState = readJson('contracts/web-page-state-matrix.json');

  const primitives = product.commercialProductPrimitives;
  assert.equal(primitives.state, 'active_contract_stabilization_v1');
  assert.equal(primitives.ownerSurface, 'account_based_user_product_layer');
  assert.equal(primitives.consumer, 'research_user');
  assert.equal(primitives.uiSourceTruth, 'contracts/web-product-profile.json#/uiSourceTruth');
  assert.equal(primitives.productJourneyGap, 'contracts/web-gap-phase-registry.json#/gaps/commercial_product_user_journey_depth_v1');

  assert.deepEqual(primitives.durablePrimitives, [
    'Project',
    'Window',
    'Turn',
    'TaskIntent',
    'Skill',
    'ModelProfile',
    'ComposerAction',
    'InspectorSnapshot',
    'MedOPLHandoff',
  ]);
  assertIncludesAll(primitives.variableExpression, ['exact marketing copy', 'visual spacing', 'model inventory', 'pricing labels'], 'variable expression');
  assertIncludesAll(primitives.mustNotFreeze, ['MedOPL payment state machine', 'MedOPL runtime implementation', 'artifact body schema'], 'must-not-freeze');

  assert.equal(interaction.productPrimitiveTruth?.contract, 'contracts/web-product-profile.json#/commercialProductPrimitives');
  assert.equal(pageState.productPrimitiveTruth?.contract, 'contracts/web-product-profile.json#/commercialProductPrimitives');
});

test('project window and search primitives retire task-history as the primary business object without fake data', () => {
  const product = readJson('contracts/web-product-profile.json');
  const pageState = readJson('contracts/web-page-state-matrix.json');
  const project = product.commercialProductPrimitives.primitives.Project;
  const window = product.commercialProductPrimitives.primitives.Window;
  const search = product.commercialProductPrimitives.searchTruth;

  assert.equal(project.businessName, '项目');
  assert.equal(project.cardinality, 'one_project_has_many_windows');
  assert.equal(project.sourceOfTruth, 'Go control plane projection or contract-backed empty state');
  assert.equal(project.fakeDataAllowed, false);
  assert.equal(window.businessName, '窗口');
  assert.equal(window.contextBoundary, 'window_context_is_isolated_inside_project');
  assertIncludesAll(window.requiredProjection, ['windowId', 'projectId', 'title', 'updatedAt', 'lastTurnPreview', 'status'], 'window projection');
  assert.equal(search.scope, 'project_windows');
  assert.equal(search.mustNotSearch, 'one_off_static_chat_only');
  assert.equal(search.sourceOfTruth, 'Go control plane projection or contract-backed empty state');
  assert.equal(pageState.commercialProductUserJourneyDepth.taskHistoryRetirement.replacementBusinessName, '项目 / 窗口');
  assert.equal(pageState.commercialProductUserJourneyDepth.taskHistoryRetirement.retireWhen, 'project_window_contract_slice lands');
});

test('turn skill model composer inspector and MedOPL handoff primitives keep Webui decoupled from runtime payment storage truth', () => {
  const product = readJson('contracts/web-product-profile.json');
  const primitives = product.commercialProductPrimitives.primitives;

  assertIncludesAll(primitives.Turn.states, ['composing', 'submitted', 'progressive', 'blocked', 'complete', 'error'], 'turn state');
  assert.equal(primitives.Turn.fakeStreamingAllowed, false);
  assert.equal(primitives.Turn.progressiveFeelRequired, true);
  assert.equal(primitives.Turn.progressiveBoundary, 'request_lifecycle_not_token_stream');

  assert.deepEqual(primitives.Skill.kinds, ['opl_skill', 'user_skill']);
  assert.equal(primitives.Skill.importTruth, 'validated_user_skill_manifest_or_opl_skill_reference');
  assert.equal(primitives.Skill.failedImportPolicy, 'typed_error_no_fake_import_success');

  assert.equal(primitives.ModelProfile.userSelectable, true);
  assert.equal(primitives.ModelProfile.mustNotHardcodeVisibleModel, '5.5 超高');
  assert.equal(primitives.ModelProfile.assistantIdentityPolicy, 'do_not_self_claim_model_identity_from_tests');

  assertIncludesAll(primitives.ComposerAction.plusMenuActions, ['attach_file', 'import_skill', 'bind_api_key', 'select_model'], 'plus menu action');
  assert.equal(primitives.ComposerAction.unimplementedActionPolicy, 'disabled_or_typed_placeholder_not_dead_click');

  assert.deepEqual(primitives.InspectorSnapshot.tabs, ['autonomy', 'inputs', 'outputs', 'why_next']);
  assertIncludesAll(primitives.InspectorSnapshot.requiredFields, ['currentObjective', 'why', 'inputs', 'outputRefs', 'blocker', 'nextStep'], 'inspector field');
  assert.equal(primitives.InspectorSnapshot.artifactBodyAllowed, false);

  assertIncludesAll(primitives.MedOPLHandoff.triggers, ['specialist_run_intent', 'file_upload', 'runtime_required', 'storage_required'], 'MedOPL handoff trigger');
  assert.equal(primitives.MedOPLHandoff.webRole, 'readonly_projection_and_deeplink_consumer');
  assert.deepEqual(primitives.MedOPLHandoff.requiredProjection, ['capabilityMarker', 'reason', 'nextAction', 'deepLink', 'returnContext']);
  assert.equal(primitives.MedOPLHandoff.fakeReadyAllowed, false);
  assertIncludesAll(product.commercialProductPrimitives.cannotClaim, ['Web-owned runtime execution', 'Web-owned storage truth', 'Web-owned payment truth', 'artifact body authority'], 'product primitive cannot claim');
});

test('returning continuation UI follows project window autonomy truth without reviving old inspector labels', () => {
  const product = readJson('contracts/web-product-profile.json');
  const pageState = readJson('contracts/web-page-state-matrix.json');
  const dom = readFileSync('apps/web/src/onePersonLabWebDom.mjs', 'utf8');
  const continuation = readFileSync('apps/web/src/onePersonLabWebContinuation.mjs', 'utf8');
  const implementation = `${dom}\n${continuation}`;

  const taskContinuation = product.commercialProductUserJourneyDepth.taskContinuationHistory;
  assert.equal(taskContinuation.status, 'repo_browser_done_v1');
  assert.equal(taskContinuation.sourceOfTruth, 'Go control plane /api/tasks projection or contract-backed empty state');
  assertIncludesAll(taskContinuation.requiredSignals, ['current_objective', 'activity_timeline', 'input_refs', 'output_refs', 'blocker_why', 'next_action'], 'task continuation signal');
  assertIncludesAll(taskContinuation.doesNotProve, ['dedicated project/window persistence API', 'token streaming implemented', 'artifact body authority', 'storage truth', 'runtime execution'], 'task continuation boundary');
  assert.deepEqual(pageState.commercialProductUserJourneyDepth.inspectorTabsTarget, ['autonomy', 'inputs', 'outputs', 'why_next']);

  assert.match(implementation, /data-inspector-open="autonomy"/);
  assert.match(implementation, /data-inspector-tab="\$\{tab\}"/);
  assert.match(implementation, /data-inspector-autonomy-current-objective/);
  assert.match(implementation, /data-inspector-input-refs/);
  assert.match(implementation, /data-inspector-output-refs/);
  assert.match(implementation, /data-inspector-blocker-why/);
  assert.match(implementation, /data-inspector-next-action/);
  assert.match(implementation, /data-project-window-current-objective/);
  assert.match(implementation, /data-project-window-input-refs/);
  assert.match(implementation, /data-project-window-output-refs/);
  assert.match(implementation, /data-project-window-blocker-why/);
  assert.match(implementation, /data-project-window-next-action/);
  assert.match(implementation, /data-window-search-source="GET \/api\/tasks"/);
  assert.doesNotMatch(implementation, /\['files', 'progress', 'output'\]/);
  assert.doesNotMatch(implementation, /data-inspector-open="files"/);
});
