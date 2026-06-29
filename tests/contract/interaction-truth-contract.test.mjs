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

function collectViolations(checks) {
  return checks.flatMap(({ label, pass }) => (pass ? [] : [label]));
}

function assertNoViolations(violations, label) {
  assert.deepEqual(violations, [], `${label}: ${violations.join('; ')}`);
}

test('formal launch interaction truth fixes top-level route auth pending task sidebar and dialog boundaries', () => {
  const interaction = readJson('contracts/web-interaction-contract.json');
  const gui = readJson('contracts/web-gui-product-contract.json');
  const pageState = readJson('contracts/web-page-state-matrix.json');

  assert.equal(interaction.state, 'active_implemented_guarded');
  assert.equal(interaction.releaseReadiness.formalPublicLaunch, 'interaction_truth_guards_green_release_evidence_unchanged');
  assert.equal(interaction.releaseReadiness.doesNotChangeReleaseEvidence, true);
  assert.equal(gui.formalLaunchInteractionTruth.contract, 'contracts/web-interaction-contract.json');
  assert.equal(pageState.formalLaunchInteractionTruth.contract, 'contracts/web-interaction-contract.json');
  assert.deepEqual(pageState.formalLaunchInteractionTruth.topLevelRoutes, ['/', '/login', '/home']);

  const routesByPath = Object.fromEntries(interaction.routeTruth.topLevelRoutes.map((route) => [route.path, route]));
  assert.equal(routesByPath['/'].routeId, 'public_growth_landing');
  assert.equal(routesByPath['/login'].routeId, 'login_register_auth_surface');
  assert.equal(routesByPath['/home'].routeId, 'authenticated_workbench');
  assert.equal(routesByPath['/home'].anonymousPolicy, 'must_not_show_fake_workbench');
  assertIncludesAll(routesByPath['/home'].anonymousAllowedOutcomes, ['public_growth_landing', 'auth_required_start_path'], 'anonymous /home outcome');
  assert.equal(interaction.routeTruth.hashRoutes.scope, 'authenticated_workbench_internal_views_only');
  assert.equal(interaction.routeTruth.hashRoutes.mustNotReplaceTopLevelRouteTruth, true);

  assert.deepEqual(interaction.authInteractionTruth.tabs.login.visibleSubmitActions, ['login']);
  assert.deepEqual(interaction.authInteractionTruth.tabs.register.visibleSubmitActions, ['register']);
  assertIncludesAll(interaction.authInteractionTruth.forbiddenStates, ['login_and_register_submit_visible_at_same_time'], 'auth forbidden state');
  assertIncludesAll(interaction.pendingTaskTruth.markers, ['@科研', '@论文', '@基金', '@综述', '@文件', '@PPT', '@书'], 'pending task marker');
  assert.equal(interaction.pendingTaskTruth.mustNotAutoRunTask, true);
  assert.equal(interaction.pendingTaskTruth.mustNotFabricateResult, true);

  assert.equal(interaction.sidebarTruth.scope, 'account_based_user_product_layer_only');
  assert.equal(interaction.sidebarTruth.projectsSurfaceBusinessName, '项目 / 窗口');
  assert.equal(interaction.sidebarTruth.legacyTaskHistoryBusinessNameRetired, true);
  assert.equal(interaction.sidebarTruth.projectWindowSource, 'GET /api/tasks projection until project/window persistence exists');
  assert.equal(interaction.sidebarTruth.taskHistorySource, 'GET /api/tasks');
  assert.equal(interaction.sidebarTruth.taskHistoryProjection, 'refs_status_metadata_only');
  assertIncludesAll(interaction.sidebarTruth.forbiddenStaticCopy, ['v20文件夹', 'New project', 'opl', 'medopl', '空项目', '新建项目'], 'forbidden static sidebar copy');
  assertIncludesAll(interaction.cannotClaim, ['payment', 'runtime execution', 'artifact body/storage truth', 'full SaaS', 'production-ready SaaS', 'fake project/workspace data'], 'cannot claim');
  assertIncludesAll(interaction.implementationGate.currentGreen, ['contract_guard_green', 'browser_guard_green', 'repo_bloat_orphanGrowth_zero'], 'green implementation guard');
});

test('current Web UI must not satisfy formal launch until interaction truth is implemented', () => {
  const domSource = readFileSync('apps/web/src/onePersonLabWebDom.mjs', 'utf8');

  const violations = collectViolations([
    {
      label: '/home must not be reduced to an internal hash route',
      pass: !/window\.location\.pathname === '\/home' \? '#home' : ''/.test(domSource),
    },
    {
      label: '/login must be an explicit top-level auth route',
      pass: /window\.location\.pathname === '\/login'/.test(domSource),
    },
    {
      label: 'login/register tabs must not render two visible submit actions at once',
      pass: !/data-login-button>[\s\S]*data-register-button>/.test(domSource),
    },
    {
      label: 'sidebar must not include static Figma project copy',
      pass: !/v20文件夹|New project|name: 'opl'|name: 'medopl'|空项目|新建项目/.test(domSource),
    },
    {
      label: 'project/window sidebar must be backed by the Go control plane projection or empty state',
      pass: /GET \/api\/tasks|taskHistory\.tasks|data-project-window-empty/.test(domSource),
    },
    {
      label: 'retired task-history wording must not be the primary UI business name',
      pass: !/任务历史 \/ 交付接续|当前没有任务历史|data-task-history-center/.test(domSource),
    },
  ]);

  assertNoViolations(violations, 'current UI still violates interaction truth');
});

test('interaction truth separates current green route guard from product journey depth gaps', () => {
  const interaction = readJson('contracts/web-interaction-contract.json');
  const pageState = readJson('contracts/web-page-state-matrix.json');

  assert.equal(interaction.productJourneyDepth?.state, 'admitted_product_gap');
  assert.equal(interaction.productJourneyDepth?.interactionTruthStatus, 'green');
  assert.equal(interaction.productJourneyDepth?.productValueStatus, 'partial_returning_continuation_repo_browser_done');
  assert.equal(interaction.productJourneyDepth?.projectsSurfaceBusinessName, '项目 / 窗口');
  assert.equal(interaction.productJourneyDepth?.searchTruth, 'search_project_windows');
  assertIncludesAll(interaction.productJourneyDepth?.openGaps ?? [], ['streaming_chat_turns', 'product_acceptance_browser_e2e'], 'interaction product-depth open gap');
  assert.equal(interaction.productJourneyDepth?.openGaps?.includes('skill_import'), false);
  assert.equal(interaction.productJourneyDepth?.openGaps?.includes('model_selector'), false);
  assert.equal(interaction.productJourneyDepth?.openGaps?.includes('plus_menu'), false);
  assert.equal((interaction.productJourneyDepth?.openGaps ?? []).includes('autonomy_inspector'), false);
  assertIncludesAll(interaction.productJourneyDepth?.doesNotProve ?? [], ['commercial product journey complete', 'token streaming implemented', 'dedicated project/window persistence API'], 'interaction product-depth doesNotProve');

  assert.equal(pageState.commercialProductUserJourneyDepth?.state, 'active_gap_admitted');
  assert.equal(pageState.commercialProductUserJourneyDepth?.defaultProjectModel, 'project_with_many_conversation_windows');
  assert.equal(pageState.commercialProductUserJourneyDepth?.searchSurface?.scope, 'project_windows');
  assert.equal(pageState.commercialProductUserJourneyDepth?.taskHistoryRetirement?.retireBusinessName, '任务历史 / 交付接续');
  assert.equal(pageState.commercialProductUserJourneyDepth?.taskHistoryRetirement?.replacementBusinessName, '项目 / 窗口');
  assertIncludesAll(pageState.commercialProductUserJourneyDepth?.handoffTriggers ?? [], ['runtime_required', 'file_upload', 'specialist_run_intent'], 'page-state handoff trigger');
  assertIncludesAll(pageState.commercialProductUserJourneyDepth?.cannotClaim ?? [], ['fake project/window data', 'Web-owned runtime/storage/payment truth', 'artifact body authority'], 'page-state product-depth cannot claim');
});
