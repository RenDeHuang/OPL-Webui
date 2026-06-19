export const TEST_COSTS = Object.freeze(['cheap', 'medium', 'heavy', 'soak', 'golden']);
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
  'full',
]);

const CURRENT_EXPLICIT_COSTS = Object.freeze(['heavy', 'soak', 'golden']);

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
  if (!LIFECYCLE_ROLES.includes(entry.lifecycleRole)) {
    throw new Error(`${entry.file} must declare supported lifecycle role`);
  }

  assertValidStringArray(entry.contracts, 'contracts', entry.file);
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
    contracts: ['scripts/test-classification.mjs', 'AGENTS.md'],
    riskTriggers: ['test-workflow'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/health/lane-advisory.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'workflow',
    lifecycleRole: 'current-owner',
    contracts: ['scripts/lane-advisory.mjs', 'scripts/workflow-gate.mjs', 'AGENTS.md'],
    riskTriggers: ['test-workflow'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/health/lane-check.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'workflow',
    lifecycleRole: 'current-owner',
    contracts: ['package.json', 'scripts/verify.mjs', 'scripts/lane-check.mjs', 'scripts/lane-advisory.mjs', 'scripts/workflow-gate.mjs', 'AGENTS.md'],
    riskTriggers: ['test-workflow'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/health/repo-bloat.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'repo-hygiene',
    lifecycleRole: 'current-owner',
    contracts: ['scripts/repo-bloat-audit.mjs', 'AGENTS.md', 'TASTE.md', 'docs/status.md', 'docs/decisions.md'],
    riskTriggers: ['repo-hygiene'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/health/workflow-entrypoint.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'workflow',
    lifecycleRole: 'current-owner',
    contracts: ['.github/workflows/ci.yml', '.github/workflows/cloud-rollout.yml', '.github/workflows/release-image.yml', 'package.json', 'scripts/verify.mjs', 'scripts/workflow-gate.mjs', 'scripts/lane-advisory.mjs', 'scripts/lane-check.mjs'],
    riskTriggers: ['test-workflow', 'deploy'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/health/governance-hardening.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'repo-governance',
    lifecycleRole: 'current-owner',
    contracts: ['README.md', 'AGENTS.md', 'TASTE.md', 'docs/status.md', 'docs/decisions.md', 'docs/docs_portfolio_consolidation.md', 'docs/active/README.md', 'docs/history/tombstones/README.md', 'contracts/web-product-profile.json'],
    riskTriggers: ['repo-governance', 'docs-truth'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/health/stale-retirement-guard.test.mjs',
    runner: 'node',
    lane: 'health',
    ownerSurface: 'repo-governance',
    lifecycleRole: 'current-owner',
    contracts: ['README.md', 'AGENTS.md', 'TASTE.md', 'docs/invariants.md', 'docs/status.md'],
    riskTriggers: ['retired-surface'],
    verifySuites: ['current', 'health'],
  }),
  testEntry({
    file: 'tests/contract/fixed-truth-lifecycle.test.mjs',
    runner: 'node',
    lane: 'contract',
    ownerSurface: 'fixed-truth-lifecycle',
    lifecycleRole: 'current-owner',
    contracts: ['README.md', 'AGENTS.md', 'TASTE.md', 'docs/status.md', 'docs/decisions.md', 'docs/active/README.md', 'docs/history/process/closeouts.md', 'docs/history/tombstones/README.md', 'deploy/web-cloud/RUNBOOK.md', 'contracts/web-product-profile.json', 'contracts/web-api.openapi.json', 'contracts/web-release-profile.json'],
    riskTriggers: ['docs-truth', 'contract'],
    verifySuites: ['current', 'contract'],
  }),
  testEntry({
    file: 'tests/contract/go-control-plane-http.test.mjs',
    runner: 'node',
    lane: 'contract',
    ownerSurface: 'control-plane-go',
    lifecycleRole: 'current-owner',
    contracts: ['services/control-plane-go/cmd/opl-webui-control-plane/main.go', 'services/control-plane-go/internal/webapp/handlers.go', 'services/control-plane-go/internal/webapp/canary.go'],
    riskTriggers: ['public-api', 'control-plane-go'],
    verifySuites: ['current', 'contract'],
  }),
  testEntry({
    file: 'tests/contract/one-person-lab-chat-upstream.test.mjs',
    runner: 'node',
    lane: 'contract',
    ownerSurface: 'control-plane-go',
    lifecycleRole: 'current-owner',
    contracts: [
      'services/control-plane-go/cmd/opl-webui-control-plane/main.go',
      'services/control-plane-go/internal/webapp/handlers.go',
      'services/control-plane-go/internal/webapp/store_guardrails.go',
    ],
    riskTriggers: ['public-api', 'byok', 'tenant-isolation'],
    verifySuites: ['current', 'contract'],
  }),
  testEntry({
    file: 'tests/contract/opl-readonly-bridge.test.mjs',
    runner: 'node',
    lane: 'contract',
    ownerSurface: 'opl-bridge',
    lifecycleRole: 'current-owner',
    contracts: ['services/control-plane-go/internal/oplbridge/snapshot.go', 'services/control-plane-go/cmd/opl-webui-control-plane/main.go', 'contracts/web-runtime-bridge.json'],
    riskTriggers: ['opl-bridge', 'runtime-gate'],
    verifySuites: ['current', 'contract'],
  }),
  testEntry({
    file: 'tests/contract/one-person-lab-web-data.test.mjs',
    runner: 'node',
    lane: 'contract',
    ownerSurface: 'apps-web',
    lifecycleRole: 'current-owner',
    contracts: ['apps/web/src/onePersonLabWeb.mjs', 'services/control-plane-go/cmd/opl-webui-control-plane/main.go', 'contracts/web-product-profile.json', 'contracts/web-page-state-matrix.json', 'contracts/web-api.openapi.json', 'contracts/web-runtime-bridge.json', 'contracts/web-release-profile.json'],
    riskTriggers: ['apps-web', 'page-state', 'public-api'],
    verifySuites: ['current', 'contract'],
  }),
  testEntry({
    file: 'tests/smoke/foundation.test.mjs',
    runner: 'node',
    lane: 'smoke',
    ownerSurface: 'foundation',
    lifecycleRole: 'current-owner',
    contracts: ['AGENTS.md', 'package.json', 'scripts/test-classification.mjs'],
    riskTriggers: ['foundation'],
    verifySuites: ['current', 'smoke'],
  }),
  testEntry({
    file: 'tests/smoke/web-shell.test.mjs',
    runner: 'node',
    lane: 'smoke',
    ownerSurface: 'apps-web',
    lifecycleRole: 'current-owner',
    contracts: ['apps/web/index.html', 'apps/web/styles.css', 'apps/web/src/onePersonLabWeb.mjs'],
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
    contracts: ['services/control-plane-go/cmd/opl-webui-control-plane/main.go'],
    riskTriggers: ['control-plane-go'],
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
    contracts: [
      'services/control-plane-go/internal/oplbridge/snapshot.go',
      'contracts/web-runtime-bridge.json',
    ],
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
    contracts: ['services/control-plane-go/internal/runtimegate/gate.go', 'contracts/web-runtime-bridge.json'],
    riskTriggers: ['runtime-gate', 'control-plane-go'],
    verifySuites: ['current', 'go'],
  }),
  testEntry({
    file: 'tests/browser/research-main-path.browser.test.mjs',
    runner: 'node',
    lane: 'browser',
    ownerSurface: 'browser-e2e',
    lifecycleRole: 'integration',
    cost: 'medium',
    contracts: ['tests/browser/research-main-path-runner.mjs', 'contracts/web-page-state-matrix.json', 'contracts/web-release-profile.json'],
    riskTriggers: ['apps-web', 'page-state', 'browser-e2e'],
    verifySuites: ['browser', 'full'],
  }),
  testEntry({
    file: 'tests/deploy/container-readiness.test.mjs',
    runner: 'node',
    lane: 'deploy',
    ownerSurface: 'deploy',
    lifecycleRole: 'integration',
    contracts: ['Dockerfile', 'Dockerfile.cloud', '.dockerignore', '.dockerignore.cloud', 'services/control-plane-go/cmd/opl-webui-control-plane/main.go'],
    riskTriggers: ['deploy', 'container'],
    verifySuites: ['deploy', 'full'],
  }),
  testEntry({
    file: 'tests/contract/web-cloud-deploy-shape.test.mjs',
    runner: 'node',
    lane: 'deploy',
    ownerSurface: 'deploy',
    lifecycleRole: 'integration',
    contracts: ['deploy/web-cloud/opl-webui.k8s.json', 'deploy/web-cloud/RUNBOOK.md'],
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
    contracts: ['scripts/cloud-rollout.mjs', 'deploy/web-cloud/RUNBOOK.md'],
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
  regression: Object.freeze({
    description: 'Explicit regression reproductions.',
    tests: Object.freeze([]),
  }),
});

export const VERIFY_SUITES = Object.freeze({
  current: Object.freeze(['smoke', 'contract', 'health', 'go']),
  full: Object.freeze(['smoke', 'contract', 'health', 'go', 'browser', 'deploy', 'regression']),
});
