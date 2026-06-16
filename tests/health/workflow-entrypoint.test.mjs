import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import pkg from '../../package.json' with { type: 'json' };

test('workflow entrypoints are wired through package scripts', () => {
  assert.equal(pkg.scripts['gate:review'], 'node scripts/workflow-gate.mjs');
  assert.equal(pkg.scripts['repo:bloat'], 'node scripts/repo-bloat-audit.mjs');
  assert.equal(pkg.scripts['check:diff'], 'git diff --check');
  assert.equal(pkg.scripts['start:mvp'], 'go run ./services/control-plane-go/cmd/opl-webui-control-plane');
  assert.equal(pkg.scripts['test:go'], 'cd services/control-plane-go && go test ./...');
  assert.equal(pkg.scripts.verify, 'node scripts/verify.mjs current');
  assert.equal(pkg.scripts['test:health'], 'node scripts/verify.mjs suite health');
  assert.equal(pkg.scripts['test:contract'], 'node scripts/verify.mjs suite contract');
  assert.equal(pkg.scripts['test:smoke'], 'node scripts/verify.mjs suite smoke');
});

test('workflow gate script exists', () => {
  assert.equal(existsSync('scripts/workflow-gate.mjs'), true);
});

test('github ci workflow runs local gates only', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /branches:\s*\[\s*main\s*\]/);
  assert.match(workflow, /actions\/checkout/);
  assert.match(workflow, /actions\/setup-node/);
  assert.match(workflow, /actions\/setup-go/);
  assert.match(workflow, /npm run verify/);
  assert.match(workflow, /npm run gate:review/);
  assert.match(workflow, /contents:\s*read/);

  assert.doesNotMatch(workflow, /kubectl/i);
  assert.doesNotMatch(workflow, /cloud-rollout\.mjs/i);
  assert.doesNotMatch(workflow, /docker\s+(?:build|push)/i);
  assert.doesNotMatch(workflow, /KUBECONFIG|TCR_PASSWORD|TCR_USERNAME|secrets\./i);
});

test('github release image workflow builds, pushes, and stages only after ci passes', () => {
  const workflow = readFileSync('.github/workflows/release-image.yml', 'utf8');

  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows:\s*\[\s*CI\s*\]/);
  assert.match(workflow, /types:\s*\[\s*completed\s*\]/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /github\.event\.workflow_run\.event == 'push'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_repository\.full_name == github\.repository/);
  assert.match(workflow, /github\.event\.workflow_run\.head_sha/);
  assert.match(workflow, /docker\/setup-buildx-action/);
  assert.match(workflow, /docker\/login-action/);
  assert.match(workflow, /docker\/build-push-action/);
  assert.match(workflow, /Dockerfile\.cloud/);
  assert.match(workflow, /tags:.*uswccr\.ccs\.tencentyun\.com\/webopl\/opl-webui:\$\{\{\s*steps\.meta\.outputs\.short_sha\s*\}\}/s);
  assert.match(workflow, /digest/);
  assert.match(workflow, /TCR_USERNAME/);
  assert.match(workflow, /TCR_PASSWORD/);
  assert.match(workflow, /OPL_BUILD_CONTEXT/);
  assert.match(workflow, /staging-rollout:/);
  assert.match(workflow, /needs:\s*build-push/);
  assert.match(workflow, /runs-on:\s*\[\s*self-hosted,\s*tencent-cloud,\s*opl-webui\s*\]/);
  assert.match(workflow, /environment:\s*staging/);
  assert.match(workflow, /OPL_NAMESPACE:\s*opl-webui-staging/);
  assert.match(workflow, /OPL_BASE_URL:\s*https:\/\/staging\.opl\.medopl\.cn/);
  assert.match(workflow, /Rollout staging dry-run/);
  assert.match(workflow, /node scripts\/cloud-rollout\.mjs\n/);
  assert.match(workflow, /Rollout staging apply/);
  assert.match(workflow, /node scripts\/cloud-rollout\.mjs --apply/);

  assert.doesNotMatch(workflow, /environment:\s*production/);
});

test('github cloud rollout workflow separates staging and production approval', () => {
  const workflow = readFileSync('.github/workflows/cloud-rollout.yml', 'utf8');

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /image:/);
  assert.match(workflow, /target_environment:/);
  assert.match(workflow, /staging/);
  assert.match(workflow, /production/);
  assert.match(workflow, /runs-on:\s*\[\s*self-hosted,\s*tencent-cloud,\s*opl-webui\s*\]/);
  assert.match(workflow, /environment:\s*\$\{\{\s*inputs\.target_environment\s*\}\}/);
  assert.match(workflow, /node scripts\/cloud-rollout\.mjs/);
  assert.match(workflow, /--apply/);
  assert.match(workflow, /KUBECONFIG/);
  assert.match(workflow, /OPL_IMAGE/);
  assert.match(workflow, /OPL_NAMESPACE/);
  assert.match(workflow, /OPL_BASE_URL/);
  assert.match(workflow, /contents:\s*read/);

  assert.doesNotMatch(workflow, /TCR_PASSWORD|docker\s+push|docker\/build-push-action/i);
});

test('review gate includes diff hygiene, bloat, and current verify', async () => {
  const { REVIEW_GATE_STEPS } = await import('../../scripts/workflow-gate.mjs');
  assert.deepEqual(REVIEW_GATE_STEPS.map((step) => step.label), [
    'diff hygiene',
    'repo bloat audit',
    'go tests',
    'current verify',
  ]);
  assert.deepEqual(REVIEW_GATE_STEPS.find((step) => step.label === 'go tests').args, ['test', './...']);
});

test('workflow gate can be imported without executing gate steps', () => {
  const stdout = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', "import './scripts/workflow-gate.mjs'; console.log('imported')"],
    { encoding: 'utf8' },
  );

  assert.equal(stdout.trim(), 'imported');
});
