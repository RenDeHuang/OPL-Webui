import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import pkg from '../../package.json' with { type: 'json' };

test('workflow entrypoints are wired through package scripts', () => {
  assert.equal(pkg.scripts['gate:review'], 'node scripts/workflow-gate.mjs');
  assert.equal(pkg.scripts['repo:bloat'], 'node scripts/repo-bloat-audit.mjs');
  assert.equal(pkg.scripts['check:diff'], 'git diff --check');
  assert.equal(pkg.scripts.start, 'go run ./services/control-plane-go/cmd/opl-webui-control-plane');
  assert.equal(pkg.scripts.verify, 'node scripts/verify.mjs current');
  assert.equal(pkg.scripts['test:health'], 'node scripts/verify.mjs suite health');
  assert.equal(pkg.scripts['test:contract'], 'node scripts/verify.mjs suite contract');
  assert.equal(pkg.scripts['test:smoke'], 'node scripts/verify.mjs suite smoke');
  assert.equal(pkg.scripts['verify:go'], 'node scripts/verify.mjs suite go');
  assert.equal(pkg.scripts['verify:browser'], 'node scripts/verify.mjs suite browser');
  assert.equal(pkg.scripts['verify:deploy'], 'node scripts/verify.mjs suite deploy');
  assert.equal(pkg.scripts['verify:full'], 'node scripts/verify.mjs full');
  assert.equal(pkg.scripts['test:go'], 'node scripts/verify.mjs suite go');
  assert.equal(pkg.scripts['test:browser'], 'node scripts/verify.mjs suite browser');
  assert.equal(pkg.scripts['test:deploy'], 'node scripts/verify.mjs suite deploy');
  assert.equal(pkg.scripts['lane:advisory'], 'node scripts/lane-advisory.mjs');
  assert.equal(pkg.scripts['lane:check'], 'node scripts/lane-check.mjs');
  assert.equal(pkg.scripts['gate:ai'], 'node scripts/ai-development-gate.mjs');
  assert.equal(pkg.scripts['release:evidence'], 'node scripts/release-evidence-sync.mjs');
});

test('workflow gate script exists', () => {
  assert.equal(existsSync('scripts/workflow-gate.mjs'), true);
});

test('github ci workflow runs local gates only', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

  assert.match(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /pull_request_target:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /branches:\s*\[\s*main\s*\]/);
  assert.match(workflow, /actions\/checkout/);
  assert.match(workflow, /actions\/setup-node/);
  assert.match(workflow, /actions\/setup-go/);
  assert.match(workflow, /npm run verify/);
  assert.match(workflow, /npx --yes playwright install chromium/);
  assert.match(workflow, /npm run verify:browser/);
  assert.match(workflow, /npm run gate:review/);
  assert.match(workflow, /contents:\s*read/);

  assert.doesNotMatch(workflow, /kubectl/i);
  assert.doesNotMatch(workflow, /cloud-rollout\.mjs/i);
  assert.doesNotMatch(workflow, /docker\s+(?:build|push)/i);
  assert.doesNotMatch(workflow, /KUBECONFIG|TCR_PASSWORD|TCR_USERNAME|secrets\./i);
});

test('github production canary workflow is no-secret availability only', () => {
  const workflow = readFileSync('.github/workflows/production-canary.yml', 'utf8');

  assert.match(workflow, /name:\s*Production Canary/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /cron:\s*'17,47 \* \* \* \*'/);
  assert.match(workflow, /runs-on:\s*ubuntu-latest/);
  assert.match(workflow, /OPL_BASE_URL:\s*https:\/\/opl\.medopl\.cn/);
  assert.match(workflow, /OPL_AVAILABILITY_PROBE_SAMPLES:\s*3/);
  assert.match(workflow, /node scripts\/cloud-rollout\.mjs --availability-probe/);
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);

  assert.doesNotMatch(workflow, /environment:\s*production/);
  assert.doesNotMatch(workflow, /KUBECONFIG|kubectl|OPL_IMAGE|OPL_DATABASE_URL|PGPASSWORD|OPL_DOGFOOD|MEDOPL_TOKEN|TCR_PASSWORD|secrets\./i);
  assert.doesNotMatch(workflow, /--apply|--rollback|--dogfood-e2e|research-main-path-runner/);
});

test('github release image workflow only builds and pushes after ci passes', () => {
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
  assert.match(workflow, /id:\s*build/);
  assert.match(workflow, /TCR_USERNAME/);
  assert.match(workflow, /TCR_PASSWORD/);
  assert.match(workflow, /OPL_BUILD_CONTEXT/);
  assert.match(workflow, /runs-on:\s*\[\s*self-hosted,\s*tencent-cloud,\s*opl-webui\s*\]/);

  assert.doesNotMatch(workflow, /staging-rollout:/);
  assert.doesNotMatch(workflow, /environment:\s*staging/);
  assert.doesNotMatch(workflow, /staging\.opl\.medopl\.cn/);
  assert.doesNotMatch(workflow, /OPL_NAMESPACE:\s*opl-webui-staging/);
  assert.doesNotMatch(workflow, /cloud-rollout\.mjs/);
  assert.doesNotMatch(workflow, /KUBECONFIG/);
  assert.doesNotMatch(workflow, /environment:\s*production/);
  assert.doesNotMatch(workflow, /runs-on:\s*ubuntu-latest/);
});

test('github cloud rollout workflow manually gates production rollout', () => {
  const workflow = readFileSync('.github/workflows/cloud-rollout.yml', 'utf8');

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /image:/);
  assert.match(workflow, /target_environment:/);
  assert.match(workflow, /authenticated_dogfood_e2e:/);
  assert.match(workflow, /availability_probe:/);
  assert.match(workflow, /production_browser_e2e:/);
  assert.match(workflow, /rollback:/);
  assert.match(workflow, /production/);
  assert.match(workflow, /options:\s*\n\s*- production/);
  assert.match(workflow, /runs-on:\s*\[\s*self-hosted,\s*tencent-cloud,\s*opl-webui\s*\]/);
  assert.match(workflow, /production-dry-run:/);
  assert.match(workflow, /name:\s*Production Dry Run/);
  assert.doesNotMatch(workflow, /production-dry-run:[\s\S]*?if:\s*\$\{\{\s*!inputs\.apply\s*\}\}/);
  assert.match(workflow, /rollout-mutation-guard:/);
  assert.match(workflow, /name:\s*Rollout Mutation Guard/);
  assert.match(workflow, /rollout-mutation-guard:[\s\S]*?if:\s*\$\{\{\s*inputs\.apply && inputs\.rollback\s*\}\}/);
  assert.match(workflow, /apply=true and rollback=true are mutually exclusive\./);
  assert.match(workflow, /production-apply:/);
  assert.match(workflow, /name:\s*Production Apply/);
  assert.match(workflow, /production-apply:[\s\S]*?if:\s*\$\{\{\s*inputs\.apply && !inputs\.rollback\s*\}\}/);
  assert.match(workflow, /production-apply:[\s\S]*?needs:\s*production-dry-run/);
  assert.match(workflow, /production-rollback:/);
  assert.match(workflow, /name:\s*Production Rollback/);
  assert.match(workflow, /production-rollback:[\s\S]*?needs:\s*production-dry-run/);
  assert.match(workflow, /production-rollback:[\s\S]*?if:\s*\$\{\{\s*inputs\.rollback && !inputs\.apply\s*\}\}/);
  assert.match(workflow, /production-rollback:[\s\S]*?environment:\s*production/);
  assert.match(workflow, /production-rollback:[\s\S]*?node scripts\/cloud-rollout\.mjs --rollback/);
  assert.match(workflow, /production-dogfood-e2e:/);
  assert.match(workflow, /production-dogfood-e2e:[\s\S]*?needs:\s*production-apply/);
  assert.match(workflow, /production-dogfood-e2e:[\s\S]*?if:\s*\$\{\{\s*inputs\.apply && inputs\.authenticated_dogfood_e2e\s*\}\}/);
  assert.match(workflow, /production-browser-e2e:/);
  assert.match(workflow, /production-browser-e2e:[\s\S]*?needs:\s*production-apply/);
  assert.match(workflow, /production-browser-e2e:[\s\S]*?if:\s*\$\{\{\s*inputs\.apply && inputs\.production_browser_e2e\s*\}\}/);
  assert.match(workflow, /production-availability-probe-current:/);
  assert.match(workflow, /production-availability-probe-current:[\s\S]*?needs:\s*production-dry-run/);
  assert.match(workflow, /production-availability-probe-current:[\s\S]*?if:\s*\$\{\{\s*!inputs\.apply && !inputs\.rollback && inputs\.availability_probe\s*\}\}/);
  assert.match(workflow, /production-availability-probe-after-apply:/);
  assert.match(workflow, /production-availability-probe-after-apply:[\s\S]*?needs:\s*production-apply/);
  assert.match(workflow, /production-availability-probe-after-apply:[\s\S]*?if:\s*\$\{\{\s*inputs\.apply && inputs\.availability_probe\s*\}\}/);
  assert.match(workflow, /production-availability-probe-after-rollback:/);
  assert.match(workflow, /production-availability-probe-after-rollback:[\s\S]*?needs:\s*production-rollback/);
  assert.match(workflow, /production-availability-probe-after-rollback:[\s\S]*?if:\s*\$\{\{\s*inputs\.rollback && inputs\.availability_probe\s*\}\}/);
  assert.match(workflow, /dogfood-request-guard:/);
  assert.match(workflow, /dogfood-request-guard:[\s\S]*?if:\s*\$\{\{\s*!inputs\.apply && inputs\.authenticated_dogfood_e2e\s*\}\}/);
  assert.match(workflow, /Dogfood e2e requires apply=true so it can run after rollout canary\/smoke evidence\./);
  assert.match(workflow, /environment:\s*production/);
  assert.match(workflow, /node scripts\/cloud-rollout\.mjs/);
  assert.match(workflow, /node scripts\/cloud-rollout\.mjs --rollback-plan/);
  assert.match(workflow, /node scripts\/cloud-rollout\.mjs --availability-probe/);
  assert.match(workflow, /node scripts\/cloud-rollout\.mjs --rollback/);
  assert.match(workflow, /--apply/);
  assert.match(workflow, /KUBECONFIG/);
  assert.match(workflow, /OPL_PRODUCTION_DOGFOOD_E2E:\s*1/);
  assert.match(workflow, /OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY:\s*\$\{\{\s*vars\.OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY\s*\}\}/);
  assert.match(workflow, /OPL_DOGFOOD_EMAIL:\s*\$\{\{\s*secrets\.OPL_DOGFOOD_EMAIL\s*\}\}/);
  assert.match(workflow, /OPL_DOGFOOD_PASSWORD:\s*\$\{\{\s*secrets\.OPL_DOGFOOD_PASSWORD\s*\}\}/);
  assert.match(workflow, /OPL_DOGFOOD_API_KEY:\s*\$\{\{\s*secrets\.OPL_DOGFOOD_API_KEY\s*\}\}/);
  assert.match(workflow, /node scripts\/cloud-rollout\.mjs --dogfood-e2e/);
  assert.match(workflow, /node tests\/browser\/research-main-path-runner\.mjs --production/);
  assert.match(workflow, /RUNNER_TEMP\/kubeconfig/);
  assert.match(workflow, /chmod 600 "\$RUNNER_TEMP\/kubeconfig"/);
  assert.match(workflow, /printf '%s' "\$KUBECONFIG_CONTENT" > "\$RUNNER_TEMP\/kubeconfig"/);
  assert.match(workflow, /OPL_IMAGE/);
  assert.match(workflow, /OPL_NAMESPACE:\s*opl-webui/);
  assert.match(workflow, /OPL_BASE_URL:\s*https:\/\/opl\.medopl\.cn/);
  assert.match(workflow, /Validate image allowlist/);
  assert.match(workflow, /Full image tag\/digest or release short commit tag to deploy\./);
  assert.match(workflow, /short_tag_pattern='\^\[0-9a-f\]\{7,40\}\$'/);
  assert.match(workflow, /image="uswccr\.ccs\.tencentyun\.com\/webopl\/opl-webui:\$image"/);
  assert.match(workflow, /echo "OPL_IMAGE=\$image" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /uswccr\\\.ccs\\\.tencentyun\\\.com\/webopl\/opl-webui/);
  assert.match(workflow, /sha256:\[0-9a-f\]\{64\}/);
  assert.match(workflow, /exit 1/);
  assert.match(workflow, /contents:\s*read/);

  assert.doesNotMatch(workflow, /staging\.opl\.medopl\.cn/);
  assert.doesNotMatch(workflow, /opl-webui-staging/);
  assert.doesNotMatch(workflow, /TCR_PASSWORD|docker\s+push|docker\/build-push-action|OPL_DATABASE_URL|PGPASSWORD/i);
  assert.doesNotMatch(workflow, /KUBECONFIG:\s*\$\{\{\s*secrets\.KUBECONFIG\s*\}\}/);

  const dryRunJob = workflow.slice(workflow.indexOf('production-dry-run:'), workflow.indexOf('production-apply:'));
  assert.doesNotMatch(dryRunJob, /environment:\s*production/);
  assert.doesNotMatch(dryRunJob, /KUBECONFIG/);
  assert.match(dryRunJob, /inputs\.rollback/);
  assert.match(dryRunJob, /node scripts\/cloud-rollout\.mjs --rollback-plan/);

  const applyJob = workflow.slice(workflow.indexOf('production-apply:'));
  assert.match(applyJob, /KUBECONFIG_CONTENT:\s*\$\{\{\s*secrets\.KUBECONFIG\s*\}\}/);
  assert.match(applyJob, /KUBECONFIG="\$RUNNER_TEMP\/kubeconfig" node scripts\/cloud-rollout\.mjs --apply/);

  const dogfoodJob = workflow.slice(workflow.indexOf('production-dogfood-e2e:'));
  assert.match(dogfoodJob, /environment:\s*production/);
  assert.match(dogfoodJob, /::add-mask::\$\{OPL_DOGFOOD_API_KEY\}/);
  assert.match(dogfoodJob, /::add-mask::\$\{OPL_DOGFOOD_PASSWORD\}/);
  assert.match(dogfoodJob, /OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY:\s*\$\{\{\s*vars\.OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY\s*\}\}/);
  assert.match(dogfoodJob, /OPL_DOGFOOD_EMAIL:\s*\$\{\{\s*secrets\.OPL_DOGFOOD_EMAIL\s*\}\}/);
  assert.match(dogfoodJob, /OPL_DOGFOOD_PASSWORD:\s*\$\{\{\s*secrets\.OPL_DOGFOOD_PASSWORD\s*\}\}/);
  assert.match(dogfoodJob, /OPL_DOGFOOD_API_KEY:\s*\$\{\{\s*secrets\.OPL_DOGFOOD_API_KEY\s*\}\}/);
  assert.doesNotMatch(dogfoodJob, /KUBECONFIG|kubectl|OPL_DATABASE_URL|PGPASSWORD/i);

  const rollbackJob = workflow.slice(
    workflow.indexOf('production-rollback:'),
    workflow.indexOf('production-availability-probe-after-rollback:'),
  );
  assert.match(rollbackJob, /environment:\s*production/);
  assert.match(rollbackJob, /KUBECONFIG_CONTENT:\s*\$\{\{\s*secrets\.KUBECONFIG\s*\}\}/);
  assert.match(rollbackJob, /KUBECONFIG="\$RUNNER_TEMP\/kubeconfig" node scripts\/cloud-rollout\.mjs --rollback/);
  assert.doesNotMatch(rollbackJob, /OPL_DOGFOOD_API_KEY|OPL_DATABASE_URL|PGPASSWORD|docker\s+push/i);

  const productionBrowserJob = workflow.slice(workflow.indexOf('production-browser-e2e:'));
  assert.match(productionBrowserJob, /environment:\s*production/);
  assert.match(productionBrowserJob, /runs-on:\s*ubuntu-latest/);
  assert.match(productionBrowserJob, /actions\/setup-node@v4/);
  assert.match(productionBrowserJob, /npx --yes playwright install chromium/);
  assert.match(productionBrowserJob, /OPL_BROWSER_BINARY/);
  assert.match(productionBrowserJob, /GITHUB_ENV/);
  assert.doesNotMatch(productionBrowserJob, /--with-deps|sudo|apt-get|apt install/);
  assert.match(productionBrowserJob, /OPL_PRODUCTION_BROWSER_E2E:\s*1/);
  assert.match(productionBrowserJob, /OPL_DOGFOOD_EMAIL:\s*\$\{\{\s*secrets\.OPL_DOGFOOD_EMAIL\s*\}\}/);
  assert.match(productionBrowserJob, /OPL_DOGFOOD_PASSWORD:\s*\$\{\{\s*secrets\.OPL_DOGFOOD_PASSWORD\s*\}\}/);
  assert.match(productionBrowserJob, /OPL_DOGFOOD_API_KEY:\s*\$\{\{\s*secrets\.OPL_DOGFOOD_API_KEY\s*\}\}/);
  assert.match(productionBrowserJob, /::add-mask::\$\{OPL_DOGFOOD_API_KEY\}/);
  assert.match(productionBrowserJob, /::add-mask::\$\{OPL_DOGFOOD_PASSWORD\}/);
  assert.doesNotMatch(productionBrowserJob, /self-hosted|tencent-cloud|KUBECONFIG|kubectl|OPL_DATABASE_URL|PGPASSWORD/i);

  const availabilityCurrentJob = workflow.slice(
    workflow.indexOf('production-availability-probe-current:'),
    workflow.indexOf('production-availability-probe-after-apply:'),
  );
  assert.match(availabilityCurrentJob, /OPL_BASE_URL:\s*https:\/\/opl\.medopl\.cn/);
  assert.match(availabilityCurrentJob, /node scripts\/cloud-rollout\.mjs --availability-probe/);
  assert.doesNotMatch(availabilityCurrentJob, /environment:\s*production/);
  assert.doesNotMatch(availabilityCurrentJob, /KUBECONFIG|kubectl|OPL_IMAGE|OPL_DATABASE_URL|PGPASSWORD|secrets\./i);

  const availabilityAfterApplyJob = workflow.slice(
    workflow.indexOf('production-availability-probe-after-apply:'),
    workflow.indexOf('dogfood-request-guard:'),
  );
  assert.match(availabilityAfterApplyJob, /OPL_BASE_URL:\s*https:\/\/opl\.medopl\.cn/);
  assert.match(availabilityAfterApplyJob, /node scripts\/cloud-rollout\.mjs --availability-probe/);
  assert.doesNotMatch(availabilityAfterApplyJob, /KUBECONFIG|kubectl|OPL_IMAGE|OPL_DATABASE_URL|PGPASSWORD|secrets\./i);

  const availabilityAfterRollbackJob = workflow.slice(
    workflow.indexOf('production-availability-probe-after-rollback:'),
    workflow.indexOf('dogfood-request-guard:'),
  );
  assert.match(availabilityAfterRollbackJob, /OPL_BASE_URL:\s*https:\/\/opl\.medopl\.cn/);
  assert.match(availabilityAfterRollbackJob, /node scripts\/cloud-rollout\.mjs --availability-probe/);
  assert.doesNotMatch(availabilityAfterRollbackJob, /KUBECONFIG|kubectl|OPL_IMAGE|OPL_DATABASE_URL|PGPASSWORD|secrets\./i);
  assert.doesNotMatch(workflow, /failure\(\)[\s\S]*?--rollback/);
});

test('current frontend engineering stays static until browser/product evidence requires migration', () => {
  const decisions = readFileSync('docs/decisions.md', 'utf8');
  const dockerfile = readFileSync('Dockerfile.cloud', 'utf8');
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

  assert.match(decisions, /Maintain static HTML\/CSS\/ESM web shell/);
  assert.match(decisions, /browser e2e/);
  assert.match(decisions, /React\/Vite\/TypeScript migration trigger/);
  assert.equal(pkg.scripts.build, undefined);
  assert.equal(existsSync('vite.config.ts'), false);
  assert.equal(existsSync('package-lock.json'), false);
  assert.match(dockerfile, /COPY apps\/web apps\/web/);
  assert.doesNotMatch(workflow, /npm run build/);
});

test('review gate includes diff hygiene, bloat, hard lane check, and current verify', async () => {
  const { REVIEW_GATE_STEPS } = await import('../../scripts/workflow-gate.mjs');
  assert.deepEqual(REVIEW_GATE_STEPS.map((step) => step.label), [
    'diff hygiene',
    'repo bloat audit',
    'ai development gate',
    'required lane evidence check',
    'current verify',
  ]);
  assert.deepEqual(REVIEW_GATE_STEPS.find((step) => step.label === 'required lane evidence check').args, ['scripts/lane-check.mjs']);
});

test('workflow gate can be imported without executing gate steps', () => {
  const stdout = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', "import './scripts/workflow-gate.mjs'; console.log('imported')"],
    { encoding: 'utf8' },
  );

  assert.equal(stdout.trim(), 'imported');
});

test('release evidence sync folds dogfood readonly and rollback evidence without raw logs', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'opl-release-evidence-'));
  const jobsPath = join(fixtureRoot, 'jobs.json');
  const profilePath = join(fixtureRoot, 'web-release-profile.json');

  writeFileSync(jobsPath, `${JSON.stringify({
    jobs: [
      { name: 'Production Dry Run', conclusion: 'success', html_url: 'https://example.test/dry' },
      { name: 'Production Apply', conclusion: 'success', html_url: 'https://example.test/apply' },
      { name: 'Production Availability Probe After Apply', conclusion: 'success', html_url: 'https://example.test/availability' },
      { name: 'Production Authenticated Dogfood E2E', conclusion: 'success', html_url: 'https://example.test/dogfood' },
      { name: 'Production Rollback', conclusion: 'success', html_url: 'https://example.test/rollback' },
      { name: 'Production Availability Probe After Rollback', conclusion: 'success', html_url: 'https://example.test/rollback-availability' },
    ],
  }, null, 2)}\n`);
  writeFileSync(profilePath, `${JSON.stringify({
    schemaVersion: 1,
    productionDogfoodReadiness: {
      state: 'executed_success_run_27863328297_real_chat_readonly_unconfirmed',
      latestSuccessfulRun: {
        runId: 27863328297,
        medoplReadonly: 'unconfirmed',
        publicMetadataConfirmsReadonlySwitch: false,
        coverage: ['register_or_login', 'runtime_gate_audit'],
      },
      cannotClaim: ['MedOPL runtime execution'],
    },
    productionRollbackReadiness: {
      state: 'manual_harness_ready_pending_first_run',
      latestAttempt: null,
      cannotClaim: ['automatic rollback', 'production-ready SaaS'],
    },
  }, null, 2)}\n`);

  execFileSync(process.execPath, [
    'scripts/release-evidence-sync.mjs',
    '--run-id', '27890000000',
    '--commit', 'fedcba9',
    '--jobs-json', jobsPath,
    '--dogfood-readonly-confirmed',
    '--image', 'uswccr.ccs.tencentyun.com/webopl/opl-webui:fedcba9',
    '--update-release-profile', profilePath,
  ], {
    encoding: 'utf8',
  });

  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  assert.equal(profile.productionDogfoodReadiness.state, 'executed_success_run_27890000000_real_chat_readonly_confirmed');
  assert.equal(profile.productionDogfoodReadiness.latestSuccessfulRun.runId, 27890000000);
  assert.equal(profile.productionDogfoodReadiness.latestSuccessfulRun.medoplReadonly, true);
  assert.equal(profile.productionDogfoodReadiness.latestSuccessfulRun.publicMetadataConfirmsReadonlySwitch, true);
  assert.equal(profile.productionDogfoodReadiness.latestSuccessfulRun.coverage.includes('medopl_readonly_runtime_status'), true);
  assert.equal(profile.productionDogfoodReadiness.latestSuccessfulRun.coverage.includes('medopl_readonly_materials_deliverables'), true);
  assert.equal(profile.productionDogfoodReadiness.latestSuccessfulRun.coverage.includes('medopl_readonly_billing_summary'), true);
  assert.equal(profile.productionDogfoodReadiness.latestSuccessfulRun.rawLogPolicy.storesRawLogs, false);
  assert.equal(profile.productionDogfoodReadiness.latestSuccessfulRun.rawLogPolicy.storesSecretValues, false);
  assert.equal(profile.productionRollbackReadiness.state, 'executed_success_run_27890000000');
  assert.equal(profile.productionRollbackReadiness.latestAttempt.runId, 27890000000);
  assert.equal(profile.productionRollbackReadiness.latestAttempt.status, 'success');
  assert.equal(profile.productionRollbackReadiness.latestAttempt.passedStages.includes('production_rollback'), true);
  assert.equal(profile.productionRollbackReadiness.latestAttempt.passedStages.includes('production_availability_probe_after_rollback'), true);
  assert.equal(profile.productionRollbackReadiness.latestAttempt.rawLogPolicy.storesRawLogs, false);
  assert.equal(profile.productionRollbackReadiness.latestAttempt.rawLogPolicy.storesSecretValues, false);
  assert.equal(profile.productionRollbackReadiness.cannotClaim.includes('automatic rollback'), true);
  assert.equal(profile.productionRollbackReadiness.cannotClaim.includes('production-ready SaaS'), true);
});

test('release evidence sync ignores skipped rollback jobs', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'opl-release-evidence-'));
  const jobsPath = join(fixtureRoot, 'jobs.json');
  const profilePath = join(fixtureRoot, 'web-release-profile.json');

  writeFileSync(jobsPath, `${JSON.stringify({
    jobs: [
      { name: 'Production Dry Run', conclusion: 'success', html_url: 'https://example.test/dry' },
      { name: 'Production Apply', conclusion: 'success', html_url: 'https://example.test/apply' },
      { name: 'Production Rollback', conclusion: 'skipped', html_url: 'https://example.test/rollback' },
      { name: 'Production Availability Probe After Apply', conclusion: 'success', html_url: 'https://example.test/availability' },
    ],
  }, null, 2)}\n`);
  writeFileSync(profilePath, `${JSON.stringify({
    schemaVersion: 1,
    productionRollbackReadiness: {
      state: 'manual_harness_ready_pending_first_run',
      latestAttempt: null,
      cannotClaim: ['automatic rollback', 'production-ready SaaS'],
    },
  }, null, 2)}\n`);

  execFileSync(process.execPath, [
    'scripts/release-evidence-sync.mjs',
    '--run-id', '27891000000',
    '--commit', 'abc1234',
    '--jobs-json', jobsPath,
    '--update-release-profile', profilePath,
  ], {
    encoding: 'utf8',
  });

  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  assert.equal(profile.productionRollbackReadiness.state, 'manual_harness_ready_pending_first_run');
  assert.equal(profile.productionRollbackReadiness.latestAttempt, null);
});
