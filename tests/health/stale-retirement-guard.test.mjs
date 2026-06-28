import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const scannedRoots = [
  'apps/web',
  'services/control-plane-go',
  'scripts',
  'contracts',
  'tests',
];

const allowedFiles = new Set([
  'tests/health/stale-retirement-guard.test.mjs',
  'tests/contract/fixed-truth-lifecycle.test.mjs',
  'tests/smoke/web-shell.test.mjs',
  'tests/contract/go-control-plane-http.test.mjs',
  'tests/contract/one-person-lab-web-data.test.mjs',
]);

const forbiddenPatterns = [
  /services\/control-plane-go\/internal\/mvp/i,
  /services\/control-plane-go\/internal\/controlplane/i,
  /internal\/mvp/i,
  /internal\/controlplane/i,
  /package\s+mvp\b/i,
  /package\s+controlplane\b/i,
  /\bmvp\./,
  /\/api\/mvp\/task/i,
  /demoData/i,
  /demo:\/\//i,
  /fake storage/i,
  /fake billing/i,
  /fake runtime execution/i,
  /task_projections/i,
  /usage_events/i,
  /tenant_plans/i,
  /opl\.cli\.readonly\.task-route/i,
];

const activeRoots = [
  'AGENTS.md',
  'TASTE.md',
  'README.md',
  'docs',
  'contracts',
  'deploy',
  'scripts',
  'tests',
  'apps',
  'services',
  'package.json',
];

const productDebtAllowedPatterns = [
  /^docs\/history\/process\/closeouts\.md$/,
  /^docs\/history\/tombstones\/README\.md$/,
  /^tests\/health\/stale-retirement-guard\.test\.mjs$/,
  /^tests\/contract\/fixed-truth-lifecycle\.test\.mjs$/,
  /^tests\/contract\/go-control-plane-http\.test\.mjs$/,
  /^tests\/contract\/one-person-lab-web-data\.test\.mjs$/,
  /^tests\/smoke\/web-shell\.test\.mjs$/,
  /^apps\/web\/styles\.css$/,
  /^docs\/history\/process\/closeouts\.md$/,
];

const productIdentityTruthFiles = [
  'README.md',
  'docs/project.md',
  'docs/status.md',
  'docs/architecture.md',
  'contracts/web-product-profile.json',
  'contracts/web-runtime-bridge.json',
];

const uiSourceTruthFiles = [
  'README.md',
  'docs/project.md',
  'docs/status.md',
  'docs/architecture.md',
  'contracts/web-product-profile.json',
  'contracts/web-gui-product-contract.json',
];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
      continue;
    }
    if (entry.isFile() && /\.(?:go|mjs|js|md|json|css|html)$/.test(entry.name)) {
      yield path;
    }
  }
}

function* walkAny(path) {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (!stat) return;
  if (stat.isFile()) {
    yield path;
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.runtime') continue;
    yield* walkAny(join(path, entry.name));
  }
}

function activeTextFiles() {
  return activeRoots
    .flatMap((root) => [...walkAny(root)])
    .filter((path) => /\.(?:go|mjs|js|md|json|css|html|toml|yml)$/.test(path))
    .filter((path) => !productDebtAllowedPatterns.some((pattern) => pattern.test(path)));
}

test('active surfaces do not revive retired demo or public MVP vocabulary', () => {
  const violations = [];

  for (const root of scannedRoots) {
    if (!existsSync(root)) continue;
    for (const file of walk(root)) {
      if (allowedFiles.has(file)) continue;
      const text = readFileSync(file, 'utf8');
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(text)) {
          violations.push(`${file}: ${pattern}`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('active product surfaces do not present MVP transition naming', () => {
  const violations = [];
  for (const file of activeTextFiles()) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of [/cloud-mvp/i, /cloud_mvp/i, /\bmvp\b/i]) {
      if (pattern.test(text)) {
        violations.push(`${file}: ${pattern}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('retired Go task projection surfaces are deleted from active source', () => {
  const retired = [
    'services/control-plane-go/internal/controlplane',
    'services/control-plane-go/internal/oplbridge/route.go',
  ];
  for (const path of retired) {
    assert.equal(existsSync(path), false, `retired task projection surface must be gone: ${path}`);
  }

  const tombstones = readFileSync('docs/history/tombstones/README.md', 'utf8');
  for (const retiredName of ['task_projections', 'usage_events', 'tenant_plans', 'opl.cli.readonly.task-route']) {
    assert.match(tombstones, new RegExp(retiredName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('active truth keeps OPL-Webui as browser interaction platform instead of execution platform', () => {
  const product = JSON.parse(readFileSync('contracts/web-product-profile.json', 'utf8'));
  const runtime = JSON.parse(readFileSync('contracts/web-runtime-bridge.json', 'utf8'));
  const requiredIdentity = product.productIdentity;

  assert.equal(requiredIdentity?.category, 'web_interaction_platform');
  assert.equal(requiredIdentity?.primaryRole, 'browser_entry');
  assert.deepEqual(requiredIdentity?.ownedTruth, ['route', 'auth', 'account', 'BYOK', 'task_intent', 'page_state', 'refs_projection', 'deeplink']);
  assert.deepEqual(requiredIdentity?.ordinaryUserDefaultRequires, []);
  assert.deepEqual(requiredIdentity?.specialistExecutionPath?.requiredForMarkers, runtime.runtimeRequiredMarkers);
  assert.equal(requiredIdentity?.authoritySplit?.onePersonLab, 'framework_execution_semantics');
  assert.equal(requiredIdentity?.authoritySplit?.MedOPL, 'runtime_resource_billing_storage');
  assert.equal(requiredIdentity?.authoritySplit?.FoundryAgents, 'domain_truth_quality_artifact_authority');

  for (const file of productIdentityTruthFiles) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /WebUI (?:owns|is|acts as).{0,80}(?:execution platform|runtime platform|storage platform)/i, file);
    assert.doesNotMatch(text, /ordinary users?(?![^.]{0,80}do not require).{0,80}(?:must|are required to|require|requires).{0,80}(?:runtime|storage)/i, file);
    assert.doesNotMatch(text, /release evidence.{0,120}(?:defines|changes|rewrites|owns).{0,80}product identity/i, file);
  }
});

test('active UI truth keeps Figma Make as the canonical visual source', () => {
  const product = JSON.parse(readFileSync('contracts/web-product-profile.json', 'utf8'));
  const uiTruth = product.uiSourceTruth;

  assert.equal(uiTruth?.state, 'figma_canonical_source_v1');
  assert.equal(uiTruth?.source?.fileKey, '1MNO5l7PQYKZVNqQgw6DGS');
  assert.equal(uiTruth?.source?.fileName, 'UI_UX for Commercial Launch');
  assert.equal(uiTruth?.source?.primaryAppSource, 'src/app/App.tsx');
  assert.deepEqual(uiTruth?.source?.styleSourcesToRead, ['src/styles/theme.css']);
  assert.equal(uiTruth?.implementationBoundary?.codexMaySelfDesignSurfaces, false);
  assert.equal(uiTruth?.implementationBoundary?.doNotVendorGeneratedApp, true);
  assert.equal(uiTruth?.implementationBoundary?.visualTruth, 'figma_make_source');
  assert.equal(uiTruth?.mockTruthPolicy?.figmaMockDataIsProductTruth, false);
  assert.equal(uiTruth?.contractProofBoundary?.contractTestsReplaceFigmaVisualTruth, false);
  assert.deepEqual(uiTruth?.appliesTo, ['public_growth_layer', 'account_based_user_product_layer']);
  assert.deepEqual(uiTruth?.doesNotApplyTo, ['minimal_admin_ops_layer', '/_ops', 'operator_controls']);

  for (const file of uiSourceTruthFiles) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /Codex (?:self-designed|designed).{0,80}(?:landing|sidebar|workbench|auth|search|dialog|sheet|task|UI)/i, file);
    assert.doesNotMatch(text, /(?:self-designed|self designed).{0,80}(?:landing|sidebar|workbench|auth|search|dialog|sheet|task|UI)/i, file);
    assert.doesNotMatch(text, /contract tests?.{0,120}(?:replace|substitute for).{0,80}Figma visual truth/i, file);
  }
});
