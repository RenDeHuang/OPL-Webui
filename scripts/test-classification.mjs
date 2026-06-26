export const TEST_COSTS = Object.freeze(['cheap', 'medium', 'heavy', 'soak', 'golden']);
export const TEST_KINDS = Object.freeze(['acceptance', 'contract', 'governance', 'regression']);
export const PROOF_LEVELS = Object.freeze(['static', 'unit', 'http', 'browser', 'production']);
export const CLAIM_SCOPES = Object.freeze(['repo', 'local', 'ci', 'production']);
export const LIFECYCLE_ROLES = Object.freeze([
  'current-owner',
  'integration',
  'regression-guard',
  'tombstone-guard',
]);
export const VERIFY_SUITE_NAMES = Object.freeze([
  'current',
  'smoke',
  'contract',
  'health',
  'go',
  'browser',
  'deploy',
  'regression',
  'real-medopl',
  'full',
]);

const CURRENT_EXPLICIT_COSTS = Object.freeze(['heavy', 'soak', 'golden']);

const NOT_PRODUCTION_EVIDENCE = Object.freeze([
  'production-ready SaaS',
  'fresh production rollout success',
  'long-term production stability',
]);
const NOT_RUNTIME_EVIDENCE = Object.freeze([
  'MedOPL runtime execution',
  'billing/payment/storage/node pool mutation',
]);
const NOT_USER_BEHAVIOR_EVIDENCE = Object.freeze([
  'browser user journey',
  'production user acceptance',
]);
const NOT_ADMIN_OPS_EXPANSION_EVIDENCE = Object.freeze([
  'Admin/Ops v0 does not prove full SaaS',
  'payment lifecycle',
  'team/RBAC lifecycle',
  'HA',
  'runtime sync',
]);
const NOT_PUBLIC_GROWTH_EVIDENCE = Object.freeze([
  'authenticated task success',
  'runtime execution',
  'artifact body authority',
  'full SaaS',
  'payment/team/RBAC/HA',
]);

function assertValidStringArray(value, field, file) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${file} must declare ${field}`);
  }

  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0) {
      throw new Error(`${file} ${field} entries must be non-empty strings`);
    }
  }
}

function validateRetirement(entry) {
  if (entry.lifecycleRole !== 'regression-guard') return;

  if (entry.lane !== 'regression') {
    throw new Error(`${entry.file} regression guard must live in regression lane`);
  }
  if (!entry.retirement || typeof entry.retirement !== 'object') {
    throw new Error(`${entry.file} regression guard must declare retirement metadata`);
  }

  for (const field of ['condition', 'deleteWhen']) {
    if (typeof entry.retirement[field] !== 'string' || entry.retirement[field].length === 0) {
      throw new Error(`${entry.file} regression guard must declare retirement.${field}`);
    }
  }

  if (
    !Array.isArray(entry.retirement.remove)
    || !entry.retirement.remove.includes('test')
    || !entry.retirement.remove.includes('registry-entry')
  ) {
    throw new Error(`${entry.file} regression guard retirement must remove test and registry entry`);
  }
}

function validateCurrentSuiteReason(entry) {
  const needsReason =
    entry.verifySuites.includes('current')
    && (entry.lifecycleRole === 'integration' || CURRENT_EXPLICIT_COSTS.includes(entry.cost));

  if (!needsReason) return;

  if (typeof entry.currentSuiteReason !== 'string' || entry.currentSuiteReason.length === 0) {
    throw new Error(`${entry.file} must explain why integration/heavy/golden/soak runs in current`);
  }
}

function validateTestEntry(entry) {
  if (!TEST_COSTS.includes(entry.cost)) {
    throw new Error(`${entry.file} must declare supported cost`);
  }
  if (!TEST_KINDS.includes(entry.testKind)) {
    throw new Error(`${entry.file} must declare supported testKind`);
  }
  if (!PROOF_LEVELS.includes(entry.proofLevel)) {
    throw new Error(`${entry.file} must declare supported proofLevel`);
  }
  if (!CLAIM_SCOPES.includes(entry.claimScope)) {
    throw new Error(`${entry.file} must declare supported claimScope`);
  }
  if (!LIFECYCLE_ROLES.includes(entry.lifecycleRole)) {
    throw new Error(`${entry.file} must declare supported lifecycle role`);
  }

  assertValidStringArray(entry.contracts, 'contracts', entry.file);
  assertValidStringArray(entry.proves, 'proves', entry.file);
  assertValidStringArray(entry.doesNotProve, 'doesNotProve', entry.file);
  assertValidStringArray(entry.riskTriggers, 'riskTriggers', entry.file);
  assertValidStringArray(entry.verifySuites, 'verifySuites', entry.file);

  for (const suite of entry.verifySuites) {
    if (!VERIFY_SUITE_NAMES.includes(suite)) {
      throw new Error(`${entry.file} references unsupported verify suite: ${suite}`);
    }
  }

  validateRetirement(entry);
  validateCurrentSuiteReason(entry);
}

function testEntry(entry) {
  const normalized = {
    cost: 'cheap',
    ...entry,
    contracts: Object.freeze(entry.contracts),
    proves: Object.freeze(entry.proves),
    doesNotProve: Object.freeze(entry.doesNotProve),
    riskTriggers: Object.freeze(entry.riskTriggers),
    verifySuites: Object.freeze(entry.verifySuites),
  };
  validateTestEntry(normalized);
  return Object.freeze(normalized);
}

const TEST_ENTRIES = Object.freeze([
  testEntry({
    file: 'tests/health/registry-coverage.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'workflow',
    lifecycleRole: 'current-owner',
    testKind: 'governance',
    proofLevel: 'static',
    claimScope: 'repo',
    contracts: ['scripts/test-classification.mjs', 'AGENTS.md'],
    proves: ['test registry taxonomy and coverage are machine-enforced'],
    doesNotProve: NOT_PRODUCTION_EVIDENCE,
    riskTriggers: ['test-workflow'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/health/lane-advisory.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'workflow',
    lifecycleRole: 'current-owner',
    testKind: 'governance',
    proofLevel: 'unit',
    claimScope: 'repo',
    contracts: ['scripts/lane-advisory.mjs', 'scripts/workflow-gate.mjs', 'AGENTS.md'],
    proves: ['changed files map to targeted verification lanes'],
    doesNotProve: NOT_PRODUCTION_EVIDENCE,
    riskTriggers: ['test-workflow'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/health/lane-check.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'workflow',
    lifecycleRole: 'current-owner',
    testKind: 'governance',
    proofLevel: 'unit',
    claimScope: 'repo',
    contracts: ['package.json', 'scripts/verify.mjs', 'scripts/lane-check.mjs', 'scripts/lane-advisory.mjs', 'scripts/workflow-gate.mjs', 'AGENTS.md'],
    proves: ['review gate requires fresh targeted lane evidence for the current diff'],
    doesNotProve: NOT_PRODUCTION_EVIDENCE,
    riskTriggers: ['test-workflow'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/health/ai-development-gate.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'workflow',
    lifecycleRole: 'current-owner',
    testKind: 'governance',
    proofLevel: 'unit',
    claimScope: 'repo',
    contracts: [
      'contracts/web-development-profile.json',
      'contracts/web-release-profile.json',
      'docs/status.md',
      'docs/active/README.md',
      'package.json',
      'scripts/ai-development-gate.mjs',
      'scripts/release-evidence-sync.mjs',
      'scripts/workflow-gate.mjs',
      'scripts/test-classification.mjs',
    ],
    proves: ['AI development gate blocks stale claims and unregistered tests'],
    doesNotProve: NOT_PRODUCTION_EVIDENCE,
    riskTriggers: ['test-workflow', 'docs-truth', 'deploy'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/health/surface-inventory.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'repo-hygiene',
    lifecycleRole: 'current-owner',
    testKind: 'governance',
    proofLevel: 'static',
    claimScope: 'repo',
    contracts: ['contracts/web-surface-inventory.json', 'scripts/repo-bloat-audit.mjs', 'AGENTS.md', 'TASTE.md'],
    proves: ['long-lived repository surfaces declare owner, consumer, contract or machine boundary, and retirement metadata when temporary'],
    doesNotProve: NOT_PRODUCTION_EVIDENCE,
    riskTriggers: ['repo-hygiene', 'test-workflow'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/health/repo-bloat.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'repo-hygiene',
    lifecycleRole: 'current-owner',
    testKind: 'governance',
    proofLevel: 'static',
    claimScope: 'repo',
    contracts: ['scripts/repo-bloat-audit.mjs', 'contracts/web-surface-inventory.json', 'AGENTS.md', 'TASTE.md', 'docs/status.md', 'docs/decisions.md'],
    proves: ['repository bloat audit reports line-budget violations and portfolio ownership signals'],
    doesNotProve: NOT_PRODUCTION_EVIDENCE,
    riskTriggers: ['repo-hygiene'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/health/workflow-entrypoint.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'workflow',
    lifecycleRole: 'current-owner',
    testKind: 'governance',
    proofLevel: 'static',
    claimScope: 'repo',
    contracts: ['.github/workflows/ci.yml', '.github/workflows/cloud-rollout.yml', '.github/workflows/release-image.yml', '.github/workflows/production-canary.yml', 'package.json', 'scripts/verify.mjs', 'scripts/workflow-gate.mjs', 'scripts/lane-advisory.mjs', 'scripts/lane-check.mjs'],
    proves: ['package scripts, CI, release image, cloud rollout, production canary, and review gate entrypoints are wired'],
    doesNotProve: NOT_PRODUCTION_EVIDENCE,
    riskTriggers: ['test-workflow', 'deploy'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/health/governance-hardening.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'repo-governance',
    lifecycleRole: 'current-owner',
    testKind: 'governance',
    proofLevel: 'static',
    claimScope: 'repo',
    contracts: ['README.md', 'AGENTS.md', 'TASTE.md', 'docs/status.md', 'docs/decisions.md', 'docs/docs_portfolio_consolidation.md', 'docs/active/README.md', 'docs/history/tombstones/README.md', 'contracts/web-product-profile.json'],
    proves: ['fixed governance docs expose owner, purpose, state, and machine-boundary lifecycle surfaces'],
    doesNotProve: NOT_PRODUCTION_EVIDENCE,
    riskTriggers: ['repo-governance', 'docs-truth'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/health/gap-phase-system.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'workflow',
    lifecycleRole: 'current-owner',
    testKind: 'governance',
    proofLevel: 'unit',
    claimScope: 'repo',
    contracts: ['contracts/web-gap-phase-registry.json', 'scripts/gap-phase-runner.mjs', 'contracts/web-surface-inventory.json', 'package.json'],
    proves: ['gap goals advance through phase queues with eval, evidence, typed blocker, cannot-claim, and runtime cleanup boundaries'],
    doesNotProve: NOT_PRODUCTION_EVIDENCE,
    riskTriggers: ['test-workflow', 'docs-truth', 'repo-hygiene'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/health/stale-retirement-guard.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'repo-governance',
    lifecycleRole: 'current-owner',
    testKind: 'governance',
    proofLevel: 'static',
    claimScope: 'repo',
    contracts: ['README.md', 'AGENTS.md', 'TASTE.md', 'docs/invariants.md', 'docs/status.md'],
    proves: ['retired routes, vocabulary, fake data, and stale product surfaces do not re-enter active source'],
    doesNotProve: NOT_PRODUCTION_EVIDENCE,
    riskTriggers: ['retired-surface'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/contract/fixed-truth-lifecycle.test.mjs',
    runner: 'node',
    lane: 'contract',
    ownerSurface: 'fixed-truth-lifecycle',
    lifecycleRole: 'current-owner',
    testKind: 'contract',
    proofLevel: 'static',
    claimScope: 'repo',
    contracts: ['README.md', 'AGENTS.md', 'TASTE.md', 'docs/status.md', 'docs/decisions.md', 'docs/active/README.md', 'docs/history/process/closeouts.md', 'docs/history/tombstones/README.md', 'deploy/web-cloud/RUNBOOK.md', 'contracts/web-product-profile.json', 'contracts/web-api.openapi.json', 'contracts/web-release-profile.json', 'contracts/web-surface-inventory.json'],
    proves: ['fixed truth docs and contracts describe the current product, three-layer product truth, and release boundaries consistently'],
    doesNotProve: [...NOT_PRODUCTION_EVIDENCE, ...NOT_ADMIN_OPS_EXPANSION_EVIDENCE],
    riskTriggers: ['docs-truth', 'contract'],
    verifySuites: ['current', 'contract'],
  }),
  testEntry({
    file: 'tests/contract/go-control-plane-http.test.mjs',
    runner: 'node',
    lane: 'contract',
    ownerSurface: 'control-plane-go',
    lifecycleRole: 'current-owner',
    testKind: 'contract',
    proofLevel: 'http',
    claimScope: 'local',
    contracts: ['services/control-plane-go/cmd/opl-webui-control-plane/main.go', 'services/control-plane-go/internal/webapp/handlers.go', 'services/control-plane-go/internal/webapp/canary.go'],
    proves: ['local Go control plane HTTP API satisfies auth, session, account, readonly projection, and chat contract behavior'],
    doesNotProve: [...NOT_PRODUCTION_EVIDENCE, ...NOT_RUNTIME_EVIDENCE],
    riskTriggers: ['public-api', 'control-plane-go'],
    verifySuites: ['current', 'contract'],
  }),
  testEntry({
    file: 'tests/contract/admin-ops-v0-contract.test.mjs',
    runner: 'node',
    lane: 'contract',
    ownerSurface: 'minimal-admin-ops-layer',
    lifecycleRole: 'current-owner',
    testKind: 'contract',
    proofLevel: 'http',
    claimScope: 'local',
    contracts: [
      'contracts/web-product-profile.json',
      'contracts/web-page-state-matrix.json',
      'contracts/web-release-profile.json',
      'contracts/web-api.openapi.json',
      'services/control-plane-go/internal/webapp/handlers.go',
      'services/control-plane-go/internal/webapp/store.go',
    ],
    proves: ['Admin/Ops v0 controls registration policy and active/disabled user admission through operator-only sanitized audited APIs'],
    doesNotProve: [...NOT_PRODUCTION_EVIDENCE, ...NOT_ADMIN_OPS_EXPANSION_EVIDENCE, 'support impersonation', 'runtime execution'],
    riskTriggers: ['public-api', 'control-plane-go', 'docs-truth', 'contract'],
    verifySuites: ['current', 'contract'],
  }),
  testEntry({
    file: 'tests/contract/one-person-lab-chat-upstream.test.mjs',
    runner: 'node',
    lane: 'contract',
    ownerSurface: 'control-plane-go',
    lifecycleRole: 'current-owner',
    testKind: 'contract',
    proofLevel: 'http',
    claimScope: 'local',
    contracts: [
      'services/control-plane-go/cmd/opl-webui-control-plane/main.go',
      'services/control-plane-go/internal/webapp/handlers.go',
      'services/control-plane-go/internal/webapp/store_guardrails.go',
    ],
    proves: ['ordinary chat calls the OpenAI-compatible upstream with user API key, sanitized diagnostics, quota guard, and 10-user staging-safe concurrency baseline'],
    doesNotProve: [...NOT_PRODUCTION_EVIDENCE, ...NOT_RUNTIME_EVIDENCE, 'production concurrent SaaS readiness'],
    riskTriggers: ['public-api', 'byok', 'tenant-isolation', 'concurrency-load'],
    verifySuites: ['current', 'contract'],
  }),
  testEntry({
    file: 'tests/contract/medopl-runtime-bridge-contract.test.mjs',
    runner: 'node',
    lane: 'contract',
    ownerSurface: 'runtime-gate',
    lifecycleRole: 'current-owner',
    testKind: 'contract',
    proofLevel: 'http',
    claimScope: 'local',
    contracts: [
      'contracts/web-runtime-bridge.json',
      'contracts/web-api.openapi.json',
      'services/control-plane-go/cmd/opl-webui-control-plane/main.go',
      'services/control-plane-go/internal/webapp/handlers.go',
    ],
    proves: ['Go control plane bridges MedOPL account/resource-state runtime gate, runtime runs, billing ledger refs, typed blockers, refs-only projection, and MedOPL contract fixture response shapes without owning execution or billing truth'],
    doesNotProve: [...NOT_PRODUCTION_EVIDENCE, 'MedOPL production runtime execution', 'sandbox MedOPL account/resource-state evidence', 'billing source of truth', 'external payment settlement', 'artifact body authority', 'domain truth'],
    riskTriggers: ['runtime-gate', 'public-api', 'control-plane-go'],
    verifySuites: ['current', 'contract'],
  }),
  testEntry({
    file: 'tests/real-medopl/real-medopl-business-flow.e2e.test.mjs',
    runner: 'node',
    lane: 'real-medopl',
    ownerSurface: 'runtime-gate',
    lifecycleRole: 'integration',
    cost: 'heavy',
    testKind: 'acceptance',
    proofLevel: 'http',
    claimScope: 'local',
    contracts: [
      'contracts/web-runtime-bridge.json',
      'contracts/web-api.openapi.json',
      'services/control-plane-go/cmd/opl-webui-control-plane/main.go',
      'services/control-plane-go/internal/webapp/handlers.go',
    ],
    proves: ['OPL-Webui bridges a runtime-required task through a real local MedOPL Go backend process for account/resource-state gate, owner lifecycle actions, run refs, billing ledger refs, and release/storage projection'],
    doesNotProve: ['production-ready SaaS', 'fresh production rollout success', 'sandbox MedOPL account lifecycle', 'external payment settlement', 'real cloud compute provisioning', 'production storage mutation', 'OPL Framework domain truth', 'artifact body authority'],
    riskTriggers: ['runtime-gate', 'control-plane-go', 'medopl-real-integration'],
    verifySuites: ['real-medopl'],
  }),
  testEntry({
    file: 'tests/contract/opl-readonly-bridge.test.mjs',
    runner: 'node',
    lane: 'contract',
    ownerSurface: 'opl-bridge',
    lifecycleRole: 'current-owner',
    testKind: 'contract',
    proofLevel: 'http',
    claimScope: 'local',
    contracts: ['services/control-plane-go/internal/oplbridge/snapshot.go', 'services/control-plane-go/cmd/opl-webui-control-plane/main.go', 'contracts/web-runtime-bridge.json'],
    proves: ['OPL readonly bridge exposes refs-only sanitized projection through the local Go control plane'],
    doesNotProve: [...NOT_PRODUCTION_EVIDENCE, 'MedOPL runtime execution', 'artifact body authority'],
    riskTriggers: ['opl-bridge', 'runtime-gate'],
    verifySuites: ['current', 'contract'],
  }),
  testEntry({
    file: 'tests/contract/one-person-lab-web-data.test.mjs',
    runner: 'node',
    lane: 'contract',
    ownerSurface: 'apps-web',
    lifecycleRole: 'current-owner',
    testKind: 'contract',
    proofLevel: 'unit',
    claimScope: 'repo',
    contracts: ['apps/web/src/onePersonLabWeb.mjs', 'services/control-plane-go/cmd/opl-webui-control-plane/main.go', 'contracts/web-product-profile.json', 'contracts/web-page-state-matrix.json', 'contracts/web-api.openapi.json', 'contracts/web-runtime-bridge.json', 'contracts/web-release-profile.json'],
    proves: ['Web data model and product contracts align on account-based Web App main path, three-layer product truth, page state, runtime gate, provider, commercial lifecycle, and release evidence boundaries'],
    doesNotProve: [...NOT_PRODUCTION_EVIDENCE, ...NOT_USER_BEHAVIOR_EVIDENCE, ...NOT_ADMIN_OPS_EXPANSION_EVIDENCE],
    riskTriggers: ['apps-web', 'page-state', 'public-api'],
    verifySuites: ['current', 'contract'],
  }),
  testEntry({
    file: 'tests/contract/web-runtime-state.test.mjs',
    runner: 'node',
    lane: 'contract',
    ownerSurface: 'apps-web',
    lifecycleRole: 'current-owner',
    testKind: 'contract',
    proofLevel: 'unit',
    claimScope: 'repo',
    contracts: ['apps/web/src/onePersonLabWeb.mjs', 'contracts/web-page-state-matrix.json', 'contracts/web-runtime-bridge.json'],
    proves: ['Web data layer checks MedOPL runtime gate before runtime-required runs and keeps run results to typed blockers, refs, progress, and deliverables'],
    doesNotProve: [...NOT_PRODUCTION_EVIDENCE, ...NOT_USER_BEHAVIOR_EVIDENCE, 'MedOPL production runtime execution', 'artifact body authority'],
    riskTriggers: ['apps-web', 'page-state', 'runtime-gate'],
    verifySuites: ['current', 'contract'],
  }),
  testEntry({
    file: 'tests/contract/public-growth-layer-contract.test.mjs',
    runner: 'node',
    lane: 'contract',
    ownerSurface: 'public-growth-layer',
    lifecycleRole: 'current-owner',
    testKind: 'contract',
    proofLevel: 'static',
    claimScope: 'repo',
    contracts: ['contracts/web-product-profile.json', 'contracts/web-page-state-matrix.json', 'contracts/web-release-profile.json', 'contracts/web-api.openapi.json'],
    proves: ['public growth layer product/page-state/API/release contract is implemented as an unauthenticated education and start-path surface'],
    doesNotProve: [...NOT_PRODUCTION_EVIDENCE, ...NOT_PUBLIC_GROWTH_EVIDENCE],
    riskTriggers: ['apps-web', 'docs-truth', 'page-state'],
    verifySuites: ['current', 'contract'],
  }),
  testEntry({
    file: 'tests/smoke/foundation.test.mjs',
    runner: 'node',
    lane: 'smoke',
    ownerSurface: 'foundation',
    lifecycleRole: 'current-owner',
    testKind: 'governance',
    proofLevel: 'static',
    claimScope: 'repo',
    contracts: ['AGENTS.md', 'package.json', 'scripts/test-classification.mjs'],
    proves: ['foundation manifest, scripts, and test registry exist'],
    doesNotProve: NOT_PRODUCTION_EVIDENCE,
    riskTriggers: ['foundation'],
    verifySuites: ['current', 'smoke'],
  }),
  testEntry({
    file: 'tests/smoke/web-shell.test.mjs',
    runner: 'node',
    lane: 'smoke',
    ownerSurface: 'apps-web',
    lifecycleRole: 'current-owner',
    testKind: 'acceptance',
    proofLevel: 'static',
    claimScope: 'repo',
    contracts: ['apps/web/index.html', 'apps/web/styles.css', 'apps/web/src/onePersonLabWeb.mjs', 'contracts/web-gui-product-contract.json'],
    proves: ['static Web shell exposes the public growth layer, AI-native research homepage, OPL green polish guard, artifact-first result stream contract, responsive inspector states, and hidden internal workspace concepts'],
    doesNotProve: [...NOT_PRODUCTION_EVIDENCE, ...NOT_PUBLIC_GROWTH_EVIDENCE, 'interactive browser behavior'],
    riskTriggers: ['apps-web'],
    verifySuites: ['current', 'smoke'],
  }),
  testEntry({
    file: 'services/control-plane-go/cmd/opl-webui-control-plane/main_test.go',
    runner: 'go',
    cwd: 'services/control-plane-go',
    goPackage: './cmd/opl-webui-control-plane',
    lane: 'go',
    ownerSurface: 'control-plane-go',
    lifecycleRole: 'current-owner',
    testKind: 'contract',
    proofLevel: 'unit',
    claimScope: 'local',
    contracts: ['services/control-plane-go/cmd/opl-webui-control-plane/main.go'],
    proves: ['Go control plane command package compiles and preserves command-level behavior'],
    doesNotProve: NOT_PRODUCTION_EVIDENCE,
    riskTriggers: ['control-plane-go'],
    verifySuites: ['current', 'go'],
  }),
  testEntry({
    file: 'services/control-plane-go/internal/webapp/chat_test.go',
    runner: 'go',
    cwd: 'services/control-plane-go',
    goPackage: './internal/webapp',
    lane: 'go',
    ownerSurface: 'control-plane-go',
    lifecycleRole: 'current-owner',
    testKind: 'contract',
    proofLevel: 'unit',
    claimScope: 'local',
    contracts: [
      'services/control-plane-go/internal/webapp/chat.go',
      'services/control-plane-go/internal/webapp/handlers.go',
      'contracts/web-product-profile.json',
    ],
    proves: ['Go webapp chat package preserves upstream chat and guardrail behavior'],
    doesNotProve: [...NOT_PRODUCTION_EVIDENCE, ...NOT_RUNTIME_EVIDENCE],
    riskTriggers: ['control-plane-go', 'byok', 'public-api'],
    verifySuites: ['current', 'go'],
  }),
  testEntry({
    file: 'services/control-plane-go/internal/oplbridge/snapshot_test.go',
    runner: 'go',
    cwd: 'services/control-plane-go',
    goPackage: './internal/oplbridge',
    lane: 'go',
    ownerSurface: 'opl-bridge',
    lifecycleRole: 'current-owner',
    testKind: 'contract',
    proofLevel: 'unit',
    claimScope: 'local',
    contracts: [
      'services/control-plane-go/internal/oplbridge/snapshot.go',
      'contracts/web-runtime-bridge.json',
    ],
    proves: ['Go OPL bridge snapshot package preserves refs-only projection behavior'],
    doesNotProve: [...NOT_PRODUCTION_EVIDENCE, 'MedOPL runtime execution'],
    riskTriggers: ['opl-bridge', 'runtime-gate'],
    verifySuites: ['current', 'go'],
  }),
  testEntry({
    file: 'services/control-plane-go/internal/runtimegate/gate_test.go',
    runner: 'go',
    cwd: 'services/control-plane-go',
    goPackage: './internal/runtimegate',
    lane: 'go',
    ownerSurface: 'production-runtime',
    lifecycleRole: 'current-owner',
    testKind: 'contract',
    proofLevel: 'unit',
    claimScope: 'local',
    contracts: ['services/control-plane-go/internal/runtimegate/gate.go', 'contracts/web-runtime-bridge.json'],
    proves: ['Go runtime gate package preserves local fail-closed runtime boundary decisions'],
    doesNotProve: [...NOT_PRODUCTION_EVIDENCE, 'MedOPL runtime execution'],
    riskTriggers: ['runtime-gate', 'control-plane-go'],
    verifySuites: ['current', 'go'],
  }),
  testEntry({
    file: 'tests/browser/public-growth-login-return.browser.test.mjs',
    runner: 'node',
    lane: 'browser',
    ownerSurface: 'public-growth-layer',
    lifecycleRole: 'integration',
    cost: 'medium',
    testKind: 'acceptance',
    proofLevel: 'browser',
    claimScope: 'ci',
    contracts: ['tests/browser/public-growth-login-return-runner.mjs', 'contracts/web-page-state-matrix.json', 'contracts/web-product-profile.json'],
    proves: ['anonymous public CTA or task entry opens login/register and restores the selected task entry after authentication'],
    doesNotProve: [...NOT_PRODUCTION_EVIDENCE, ...NOT_PUBLIC_GROWTH_EVIDENCE],
    riskTriggers: ['apps-web', 'page-state', 'browser-e2e', 'public-growth-layer'],
    verifySuites: ['browser', 'full'],
  }),
  testEntry({
    file: 'tests/browser/research-main-path.browser.test.mjs',
    runner: 'node',
    lane: 'browser',
    ownerSurface: 'browser-e2e',
    lifecycleRole: 'integration',
    cost: 'medium',
    testKind: 'acceptance',
    proofLevel: 'browser',
    claimScope: 'ci',
    contracts: ['tests/browser/research-main-path-runner.mjs', 'contracts/web-page-state-matrix.json', 'contracts/web-release-profile.json', 'contracts/web-gui-product-contract.json'],
    proves: ['CI/local Chromium account-based Web App business main path works with user-like login, API key binding, task choice, result/gate, refs/deeplink continuity, sanitized evidence, artifact-first research results, stable desktop inspector, lightweight mobile sheet, responsive visual QA, and repo-local keyboard path, modal focus trap, and contrast closeout checks'],
    doesNotProve: ['production-ready SaaS', 'long-term production stability', 'MedOPL runtime execution', 'complete UI/UX design system', 'production visual polish complete', 'human owner accepted production UI quality'],
    riskTriggers: ['apps-web', 'page-state', 'browser-e2e', 'ui-ux'],
    verifySuites: ['browser', 'full'],
  }),
  testEntry({
    file: 'tests/deploy/container-readiness.test.mjs',
    runner: 'node',
    lane: 'deploy',
    ownerSurface: 'deploy',
    lifecycleRole: 'integration',
    testKind: 'contract',
    proofLevel: 'static',
    claimScope: 'repo',
    contracts: ['Dockerfile', 'Dockerfile.cloud', '.dockerignore', '.dockerignore.cloud', 'services/control-plane-go/cmd/opl-webui-control-plane/main.go'],
    proves: ['container recipes build the Go control plane and exclude runtime bloat'],
    doesNotProve: NOT_PRODUCTION_EVIDENCE,
    riskTriggers: ['deploy', 'container'],
    verifySuites: ['deploy', 'full'],
  }),
  testEntry({
    file: 'tests/contract/web-cloud-deploy-shape.test.mjs',
    runner: 'node',
    lane: 'deploy',
    ownerSurface: 'deploy',
    lifecycleRole: 'integration',
    testKind: 'contract',
    proofLevel: 'static',
    claimScope: 'repo',
    contracts: ['deploy/web-cloud/opl-webui.k8s.json', 'deploy/web-cloud/RUNBOOK.md'],
    proves: ['cloud deploy manifests and runbook preserve production shape and secret boundaries'],
    doesNotProve: NOT_PRODUCTION_EVIDENCE,
    riskTriggers: ['deploy'],
    verifySuites: ['deploy', 'full'],
  }),
  testEntry({
    file: 'tests/contract/cloud-rollout-helper.test.mjs',
    runner: 'node',
    lane: 'deploy',
    ownerSurface: 'deploy',
    lifecycleRole: 'integration',
    cost: 'medium',
    testKind: 'contract',
    proofLevel: 'unit',
    claimScope: 'repo',
    contracts: ['scripts/cloud-rollout.mjs', 'deploy/web-cloud/RUNBOOK.md'],
    proves: ['cloud rollout helper enforces dry-run, allowlist, dogfood, availability, rollback, and fail-closed behavior'],
    doesNotProve: ['production-ready SaaS', 'fresh production rollout success', 'long-term production stability'],
    riskTriggers: ['deploy', 'cloud-rollout'],
    verifySuites: ['deploy', 'full'],
  }),
]);

function lane(name, description) {
  return Object.freeze({
    description,
    tests: Object.freeze(TEST_ENTRIES.filter((entry) => entry.lane === name)),
  });
}

export const TEST_LANE_REGISTRY = Object.freeze({
  smoke: lane('smoke', 'Minimal foundation and static Web shell smoke checks.'),
  contract: lane('contract', 'Public API, page-state, BYOK, tenant isolation, and OPL boundary contracts.'),
  health: lane('health', 'Repository governance, workflow, documentation truth, and hygiene checks.'),
  go: lane('go', 'Go control plane package tests.'),
  browser: lane('browser', 'Browser-level main-path runner and page-state checks.'),
  deploy: lane('deploy', 'Container, cloud rollout, CI, and production runbook checks.'),
  'real-medopl': lane('real-medopl', 'Explicit real local MedOPL process E2E evidence; not part of current or full.'),
  regression: Object.freeze({
    description: 'Explicit regression reproductions.',
    tests: Object.freeze([]),
  }),
});

export const VERIFY_SUITES = Object.freeze({
  current: Object.freeze(['smoke', 'contract', 'health', 'go']),
  full: Object.freeze(['smoke', 'contract', 'health', 'go', 'browser', 'deploy', 'regression']),
  'real-medopl': Object.freeze(['real-medopl']),
});
