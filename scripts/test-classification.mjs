const TEST_ENTRIES = Object.freeze([
  Object.freeze({
    file: 'tests/health/registry-coverage.test.mjs',
    lane: 'health',
    ownerSurface: 'workflow',
    lifecycleRole: 'current-owner',
    contracts: Object.freeze(['scripts/test-classification.mjs', 'tests/README.md']),
    verifySuites: Object.freeze(['current', 'health']),
  }),
  Object.freeze({
    file: 'tests/health/repo-bloat.test.mjs',
    lane: 'health',
    ownerSurface: 'repo-hygiene',
    lifecycleRole: 'current-owner',
    contracts: Object.freeze(['scripts/repo-bloat-audit.mjs']),
    verifySuites: Object.freeze(['current', 'health']),
  }),
  Object.freeze({
    file: 'tests/health/workflow-entrypoint.test.mjs',
    lane: 'health',
    ownerSurface: 'workflow',
    lifecycleRole: 'current-owner',
    contracts: Object.freeze(['package.json', 'scripts/verify.mjs', 'scripts/workflow-gate.mjs']),
    verifySuites: Object.freeze(['current', 'health']),
  }),
  Object.freeze({
    file: 'tests/contract/change-package-lifecycle.test.mjs',
    lane: 'contract',
    ownerSurface: 'change-lifecycle',
    lifecycleRole: 'current-owner',
    contracts: Object.freeze(['changes/README.md']),
    verifySuites: Object.freeze(['current', 'contract']),
  }),
  Object.freeze({
    file: 'tests/contract/api-demo-loop.test.mjs',
    lane: 'contract',
    ownerSurface: 'apps-api',
    lifecycleRole: 'current-owner',
    contracts: Object.freeze([
      'apps/api/src/demoLoop.mjs',
      'packages/core/src/taskArtifactLoop.mjs',
      'packages/contracts/opl/task-contract.schema.json',
      'packages/contracts/opl/artifact-contract.schema.json',
    ]),
    verifySuites: Object.freeze(['current', 'contract']),
  }),
  Object.freeze({
    file: 'tests/contract/web-demo-data.test.mjs',
    lane: 'contract',
    ownerSurface: 'apps-web',
    lifecycleRole: 'current-owner',
    contracts: Object.freeze(['apps/web/src/demoData.mjs', 'apps/api/src/demoScenario.mjs']),
    verifySuites: Object.freeze(['current', 'contract']),
  }),
  Object.freeze({
    file: 'tests/contract/opl-adapter-whitelist.test.mjs',
    lane: 'contract',
    ownerSurface: 'opl-adapter',
    lifecycleRole: 'current-owner',
    contracts: Object.freeze(['packages/contracts/opl/command-policy.json']),
    verifySuites: Object.freeze(['current', 'contract']),
  }),
  Object.freeze({
    file: 'tests/contract/task-artifact-schema.test.mjs',
    lane: 'contract',
    ownerSurface: 'contracts',
    lifecycleRole: 'current-owner',
    contracts: Object.freeze([
      'packages/contracts/opl/task-contract.schema.json',
      'packages/contracts/opl/artifact-contract.schema.json',
      'packages/core/src/loops.mjs',
    ]),
    verifySuites: Object.freeze(['current', 'contract']),
  }),
  Object.freeze({
    file: 'tests/smoke/foundation.test.mjs',
    lane: 'smoke',
    ownerSurface: 'foundation',
    lifecycleRole: 'current-owner',
    contracts: Object.freeze(['AGENTS.md', 'package.json', 'tests/README.md']),
    verifySuites: Object.freeze(['current', 'smoke']),
  }),
  Object.freeze({
    file: 'tests/smoke/mvp-task-artifact-loop.test.mjs',
    lane: 'smoke',
    ownerSurface: 'mvp-task-artifact-loop',
    lifecycleRole: 'current-owner',
    contracts: Object.freeze(['apps/api/src/demoScenario.mjs', 'changes/active/mvp-task-artifact-loop/eval-plan.md']),
    verifySuites: Object.freeze(['current', 'smoke']),
  }),
  Object.freeze({
    file: 'tests/smoke/web-demo-shell.test.mjs',
    lane: 'smoke',
    ownerSurface: 'apps-web',
    lifecycleRole: 'current-owner',
    contracts: Object.freeze(['apps/web/index.html', 'apps/web/styles.css', 'apps/web/src/demoData.mjs']),
    verifySuites: Object.freeze(['current', 'smoke']),
  }),
]);

function lane(name, description) {
  return Object.freeze({
    description,
    tests: Object.freeze(TEST_ENTRIES.filter((entry) => entry.lane === name)),
  });
}

export const TEST_LANE_REGISTRY = Object.freeze({
  health: lane('health', 'Repository verification gate health checks.'),
  contract: lane('contract', 'Cross-package and lifecycle contracts.'),
  smoke: lane('smoke', 'Minimal foundation smoke checks.'),
  regression: Object.freeze({
    description: 'Explicit regression reproductions.',
    tests: Object.freeze([]),
  }),
});

export const VERIFY_SUITES = Object.freeze({
  current: Object.freeze(['health', 'contract', 'smoke']),
});
