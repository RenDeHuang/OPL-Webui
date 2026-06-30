#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const rollback = args.has('--rollback');
const rollbackPlan = args.has('--rollback-plan');
const imagePreflight = args.has('--image-preflight');
const dryRun = !apply && !rollback && !rollbackPlan && !imagePreflight;

if ([apply, rollback, rollbackPlan, imagePreflight].filter(Boolean).length > 1) {
  throw new Error('--apply, --rollback, --rollback-plan, and --image-preflight are mutually exclusive');
}

const namespace = process.env.OPL_NAMESPACE ?? 'opl-webui';
const deployment = process.env.OPL_DEPLOYMENT ?? 'deployment/opl-webui-control-plane';
const container = process.env.OPL_CONTAINER ?? 'control-plane';
const podSelector = process.env.OPL_POD_SELECTOR ?? 'app.kubernetes.io/name=opl-webui';
const controlPlaneBin = process.env.OPL_CONTROL_PLANE_BIN ?? '/app/opl-webui-control-plane';

const kubeconfig = process.env.KUBECONFIG ?? '$KUBECONFIG';
const configuredBaseUrl = process.env.OPL_BASE_URL?.trim();
const baseUrl = (configuredBaseUrl || 'https://opl.medopl.cn').replace(/\/$/, '');
const rolloutRevisionJsonpath = 'jsonpath={.metadata.annotations.deployment\\.kubernetes\\.io/revision}';
const deploymentImageJsonpath = 'jsonpath={.spec.template.spec.containers[?(@.name=="control-plane")].image}';
const podImageIdJsonpath = 'jsonpath={.status.containerStatuses[?(@.name=="control-plane")].imageID}';
const imageRepository = 'uswccr.ccs.tencentyun.com/webopl/opl-webui';

const healthUrl = `${baseUrl}/healthz`;
const readyUrl = `${baseUrl}/readyz`;
const metricsUrl = `${baseUrl}/metricsz`;
const homeUrl = `${baseUrl}/`;
const allowedImagePattern = /^uswccr\.ccs\.tencentyun\.com\/webopl\/opl-webui(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}|@sha256:[0-9a-f]{64})$/;
const releaseShortTagPattern = /^[0-9a-f]{7,40}$/;
const kubectlRolloutTimeoutSeconds = boundedInt(process.env.OPL_KUBECTL_ROLLOUT_TIMEOUT_SECONDS, 150, 10, 600);
const rolloutStatusTimeoutMs = boundedInt(process.env.OPL_ROLLOUT_STATUS_TIMEOUT_MS, (kubectlRolloutTimeoutSeconds + 10) * 1000, 100, 600000);
const diagnosticTimeoutMs = boundedInt(process.env.OPL_ROLLOUT_DIAGNOSTIC_TIMEOUT_MS, 5000, 100, 60000);
let image = normalizeImage(process.env.OPL_IMAGE ?? '$OPL_IMAGE');

if (args.has('--help')) {
  printUsage();
  process.exit(0);
}

if (args.has('--dogfood-e2e')) {
  await runDogfoodE2E();
  process.exit(0);
}

if (args.has('--availability-probe')) {
  await runAvailabilityProbe();
  process.exit(0);
}

if (imagePreflight) {
  requireEnv('OPL_IMAGE');
  setValidatedImage(process.env.OPL_IMAGE);
  assertImageExists(image);
  process.exit(0);
}

if (rollbackPlan) {
  setValidatedImage(image);
  printRollbackPlan();
  process.exit(0);
}

if (rollback) {
  requireEnv('KUBECONFIG');
  requireEnv('OPL_IMAGE');
  setValidatedImage(process.env.OPL_IMAGE);
  runRollback();
  process.exit(0);
}

if (dryRun) {
  setValidatedImage(image);
  printDryRun();
  process.exit(0);
}

requireEnv('KUBECONFIG');
requireEnv('OPL_IMAGE');
setValidatedImage(process.env.OPL_IMAGE);
assertImageExists(image);

run('kubectl set image', 'kubectl', kubectlArgs(['set', 'image', deployment, `${container}=${image}`]));
runRolloutStatus();
runPostRolloutChecks('rollout revision');

async function runDogfoodE2E() {
  if (process.env.OPL_PRODUCTION_DOGFOOD_E2E !== '1') {
    console.log('[cloud-rollout] production authenticated dogfood e2e skipped; set OPL_PRODUCTION_DOGFOOD_E2E=1 to run.');
    return;
  }
  for (const name of ['OPL_DOGFOOD_EMAIL', 'OPL_DOGFOOD_PASSWORD', 'OPL_DOGFOOD_API_KEY']) {
    requireEnv(name);
  }
  validateDogfoodCredentials();
  const session = await dogfoodSession();
  const current = await dogfoodFetch('/api/session/current', { cookie: session.cookie }, 'current session');
  assertEqual(current.body.email, process.env.OPL_DOGFOOD_EMAIL, 'current session email');
  const saved = await dogfoodFetch('/api/settings/model-provider', {
    method: 'PUT', cookie: session.cookie, body: { apiKey: process.env.OPL_DOGFOOD_API_KEY },
  }, 'API Key binding');
  assertEqual(saved.body.baseUrl, 'https://gflabtoken.cn/v1', 'fixed gateway');
  assertEqual(saved.body.apiKeyConfigured, true, 'api key configured');
  assertNoSensitive(saved.body);
  if (process.env.OPL_PRODUCTION_DOGFOOD_REAL_CHAT === '1') {
    const chat = await dogfoodFetch('/api/chat', {
      method: 'POST', cookie: session.cookie, body: { message: 'OPL-Webui production dogfood ping' },
    }, 'ordinary chat');
    if (!chat.body.assistantMessage?.content) throw new Error('ordinary chat did not return assistant content');
  } else {
    console.log('[cloud-rollout] ordinary chat skipped; set OPL_PRODUCTION_DOGFOOD_REAL_CHAT=1 to spend test API quota.');
  }
  const gated = await dogfoodFetch('/api/chat', {
    method: 'POST', cookie: session.cookie, body: { message: '@基金 production dogfood gate' },
  }, 'runtime gate', 409);
  assertEqual(gated.body.errorCode, 'RUNTIME_REQUIRED', 'MedOPL runtime gate');
  const audit = await dogfoodFetch('/api/account/audit-events', { cookie: session.cookie }, 'audit events');
  const kinds = (audit.body.events ?? []).map((event) => event.eventKind);
  if (!kinds.includes('runtime_gate.required')) throw new Error(`missing runtime gate audit event: ${kinds.join(',')}`);
  if (process.env.OPL_PRODUCTION_DOGFOOD_REAL_CHAT === '1' && !kinds.includes('chat.completed')) {
    throw new Error(`missing chat completed audit event: ${kinds.join(',')}`);
  }
  if (process.env.OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY === '1') {
    await dogfoodMedOPLReadonly(session.cookie);
  } else {
    console.log('[cloud-rollout] MedOPL readonly projection dogfood skipped; set OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1 to verify readonly projections.');
  }
  assertNoSensitive({ current: current.body, saved: saved.body, gated: gated.body, audit: audit.body });
  const evidenceSummary = {
    schemaVersion: 1,
    mode: 'secret_gated_http_authenticated_e2e',
    targetHost: baseUrl,
    realChat: process.env.OPL_PRODUCTION_DOGFOOD_REAL_CHAT === '1',
    medoplReadonly: process.env.OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY === '1',
    readonlyProjectionChecks: process.env.OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY === '1'
      ? ['runtime_status', 'materials_deliverables', 'billing_summary']
      : [],
    forbiddenMutationFlags: process.env.OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY === '1'
      ? ['webuiRuntimeExecution', 'webuiStorageMutation', 'webuiArtifactBody', 'webuiBillingSourceOfTruth', 'webuiPaymentMutation']
      : [],
    auditKinds: [...new Set(kinds)].sort(),
    rawLogPolicy: { storesRawLogs: false, storesSecretValues: false },
  };
  assertNoSensitive(evidenceSummary);
  console.log(`[cloud-rollout] dogfood evidence summary ${JSON.stringify(evidenceSummary)}`);
  console.log(`[cloud-rollout] production authenticated dogfood e2e passed; audit kinds=${[...new Set(kinds)].join(',')}`);
}

async function dogfoodMedOPLReadonly(cookie) {
  const runtime = await dogfoodFetch('/api/medopl/runtime/status', { cookie }, 'runtime status');
  assertEqual(runtime.body.owner, 'MedOPL', 'runtime status owner');
  assertEqual(runtime.body.webuiRuntimeExecution, 'forbidden', 'runtime execution boundary');

  const materials = await dogfoodFetch('/api/medopl/materials-deliverables/projection', { cookie }, 'materials deliverables');
  assertEqual(materials.body.owner, 'MedOPL', 'materials owner');
  assertEqual(materials.body.webuiStorageMutation, 'forbidden', 'storage mutation boundary');
  assertEqual(materials.body.webuiArtifactBody, 'forbidden', 'artifact body boundary');

  const billing = await dogfoodFetch('/api/account/billing-summary', { cookie }, 'billing summary');
  assertEqual(billing.body.owner, 'MedOPL', 'billing owner');
  assertEqual(billing.body.webuiBillingSourceOfTruth, 'forbidden', 'billing truth boundary');
  assertEqual(billing.body.webuiPaymentMutation, 'forbidden', 'payment mutation boundary');

  assertNoSensitive({ runtime: runtime.body, materials: materials.body, billing: billing.body });
}

async function dogfoodSession() {
  const credentials = { email: process.env.OPL_DOGFOOD_EMAIL, password: process.env.OPL_DOGFOOD_PASSWORD };
  const registered = await dogfoodFetch('/api/auth/register', { method: 'POST', body: credentials }, 'register', [201, 409]);
  if (registered.response.status === 201) return registered;
  return dogfoodFetch('/api/auth/login', { method: 'POST', body: credentials }, 'login');
}

async function runAvailabilityProbe() {
  const samples = boundedInt(process.env.OPL_AVAILABILITY_PROBE_SAMPLES, 3, 1, 20);
  const intervalMs = boundedInt(process.env.OPL_AVAILABILITY_PROBE_INTERVAL_MS, 1000, 0, 60000);
  const summary = { targetHost: baseUrl, samples, failures: 0, checks: [] };

  for (let index = 0; index < samples; index += 1) {
    if (index > 0 && intervalMs > 0) await sleep(intervalMs);
    summary.checks.push(await availabilityCheck('healthz', healthUrl, (body) => body?.ok === true));
    summary.checks.push(await availabilityCheck('readyz', readyUrl, (body) => body?.ok === true && Array.isArray(body.missing) && body.missing.length === 0));
    summary.checks.push(await availabilityCheck('metricsz', metricsUrl, (body) => body?.ok === true && body?.missingDependencyCount === 0));
    summary.checks.push(await availabilityCheck('home', homeUrl, (_body, text) => /One Person Lab Web|严肃工作的 AI 工作台/.test(text)));
  }

  summary.failures = summary.checks.filter((check) => !check.ok).length;
  summary.observabilityBaseline = buildObservabilityBaseline(summary);
  summary.rawLogPolicy = { storesRawLogs: false, storesSecretValues: false };
  assertNoSensitive(summary);
  console.log(`[cloud-rollout] availability probe summary ${JSON.stringify(summary)}`);
  if (summary.failures > 0) throw new Error(`availability probe failed: ${summary.failures} check(s) failed`);
  console.log('[cloud-rollout] availability probe passed');
}

function runRollback() {
  const rollbackArgs = ['rollout', 'undo', deployment];
  if (process.env.OPL_ROLLBACK_REVISION) {
    rollbackArgs.push(`--to-revision=${process.env.OPL_ROLLBACK_REVISION}`);
  }
  run('kubectl rollout undo', 'kubectl', kubectlArgs(rollbackArgs));
  runRolloutStatus();
  const rolledBackImage = runPostRolloutChecks('rollback revision');
  const summary = {
    schemaVersion: 1,
    mode: 'manual_environment_approved_rollback',
    targetHost: baseUrl,
    namespace,
    deployment,
    requestedImage: image,
    image: rolledBackImage,
    checks: ['rollout_undo', 'rollout_status', 'canary_db', 'canary_opl_cli', 'healthz', 'readyz', 'metricsz', 'home'],
    rawLogPolicy: { storesRawLogs: false, storesSecretValues: false },
  };
  assertNoSensitive(summary);
  console.log(`[cloud-rollout] rollback evidence summary ${JSON.stringify(summary)}`);
}

function runPostRolloutChecks(revisionLabel) {
  capture(revisionLabel, kubectlArgs(['get', deployment, '-o', rolloutRevisionJsonpath]));
  const deploymentImage = capture('deployment image', kubectlArgs(['get', deployment, '-o', deploymentImageJsonpath]));

  const pod = selectReadyPod(deploymentImage || image);

  run('pod status', 'kubectl', kubectlArgs(['get', 'pod', '-l', podSelector, '-o', 'wide']));
  capture('pod imageID', kubectlArgs(['get', 'pod', pod, '-o', podImageIdJsonpath]));
  run('canary db', 'kubectl', kubectlArgs(['exec', pod, '--', controlPlaneBin, 'canary', 'db']));
  run('canary opl-cli', 'kubectl', kubectlArgs(['exec', pod, '--', controlPlaneBin, 'canary', 'opl-cli']));
  run(`HTTPS smoke ${healthUrl}`, 'curl', ['--http2', '-fsS', healthUrl]);
  semanticSmoke('readyz', readyUrl, (body) => body?.ok === true && Array.isArray(body.missing) && body.missing.length === 0);
  semanticSmoke('metricsz', metricsUrl, (body) => body?.ok === true && body?.missingDependencyCount === 0);
  run(`HTTPS smoke ${homeUrl}`, 'curl', ['--http2', '-fsS', homeUrl]);
  return deploymentImage;
}

function buildObservabilityBaseline(summary) {
  const endpoints = {};
  for (const label of ['healthz', 'readyz', 'metricsz', 'home']) {
    const checks = summary.checks.filter((check) => check.label === label);
    endpoints[label] = {
      samples: checks.length,
      successes: checks.filter((check) => check.ok).length,
      failures: checks.filter((check) => !check.ok).length,
      maxDurationMs: Math.max(0, ...checks.map((check) => check.durationMs ?? 0)),
    };
  }
  return {
    schemaVersion: 1,
    contract: 'production_observability_baseline_v1',
    targetHost: summary.targetHost,
    samples: summary.samples,
    endpoints,
  };
}

async function availabilityCheck(label, url, validate) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { headers: { connection: 'close' } });
    const text = await response.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    assertNoSensitive(body);
    const ok = response.status === 200 && validate(body, text);
    return { label, status: response.status, durationMs: Date.now() - startedAt, ok };
  } catch (error) {
    return { label, status: 0, durationMs: Date.now() - startedAt, ok: false, errorCode: error.name ?? 'FetchError' };
  }
}

async function dogfoodFetch(path, options, label, expected = 200) {
  const headers = { connection: 'close' };
  if (options?.body) headers['content-type'] = 'application/json';
  if (options?.cookie) headers.cookie = options.cookie;
  const response = await fetch(`${baseUrl}${path}`, {
    method: options?.method ?? 'GET',
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  const allowed = Array.isArray(expected) ? expected : [expected];
  console.log(`[cloud-rollout] dogfood ${label}: ${response.status}${body.errorCode ? ` ${body.errorCode}` : ''}`);
  assertNoSensitive(body);
  if (!allowed.includes(response.status)) throw new Error(`${label} expected ${allowed.join('/')} but got ${response.status}`);
  const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? options?.cookie ?? '';
  return { response, body, cookie };
}

function kubectlArgs(commandArgs) {
  return ['--kubeconfig', process.env.KUBECONFIG ?? kubeconfig, '-n', namespace, ...commandArgs];
}

function printDryRun() {
  console.log('[cloud-rollout] dryRun=true; pass --apply to mutate the cluster.');
  printKubectl(['set', 'image', deployment, `${container}=${image}`]);
  printKubectl(['rollout', 'status', deployment, `--timeout=${kubectlRolloutTimeoutSeconds}s`]);
  printKubectl(['get', deployment, '-o', rolloutRevisionJsonpath]);
  printKubectl(['get', deployment, '-o', deploymentImageJsonpath]);
  console.log(`# selected pod is resolved from Running + Ready pods on ${image}`);
  printKubectl(['get', 'pod', '-l', podSelector, '-o', 'json']);
  console.log('pod="<selected Running Ready pod matching OPL_IMAGE>"');
  printKubectl(['get', 'pod', '-l', podSelector, '-o', 'wide']);
  printKubectl(['get', 'pod', '$pod', '-o', podImageIdJsonpath]);
  printKubectl(['exec', '$pod', '--', controlPlaneBin, 'canary', 'db']);
  printKubectl(['exec', '$pod', '--', controlPlaneBin, 'canary', 'opl-cli']);
  console.log(formatCommand('curl', ['--http2', '-fsS', healthUrl]));
  console.log(formatCommand('curl', ['--http2', '-fsS', readyUrl]));
  console.log(formatCommand('curl', ['--http2', '-fsS', metricsUrl]));
  console.log(formatCommand('curl', ['--http2', '-fsS', homeUrl]));
}

function printRollbackPlan() {
  console.log('[cloud-rollout] rollbackPlan=true; pass --rollback after production approval to undo the rollout.');
  const rollbackArgs = ['rollout', 'undo', deployment];
  if (process.env.OPL_ROLLBACK_REVISION) {
    rollbackArgs.push(`--to-revision=${process.env.OPL_ROLLBACK_REVISION}`);
  }
  printKubectl(rollbackArgs);
  printKubectl(['rollout', 'status', deployment, `--timeout=${kubectlRolloutTimeoutSeconds}s`]);
  console.log('# rollback revision');
  printKubectl(['get', deployment, '-o', rolloutRevisionJsonpath]);
  console.log('# post-rollback deployment image');
  printKubectl(['get', deployment, '-o', deploymentImageJsonpath]);
  console.log('# selected pod is resolved from Running + Ready pods on the post-rollback Deployment image');
  printKubectl(['get', 'pod', '-l', podSelector, '-o', 'json']);
  console.log('pod="<selected Running Ready pod matching post-rollback deployment image>"');
  printKubectl(['get', 'pod', '-l', podSelector, '-o', 'wide']);
  printKubectl(['get', 'pod', '$pod', '-o', podImageIdJsonpath]);
  printKubectl(['exec', '$pod', '--', controlPlaneBin, 'canary', 'db']);
  printKubectl(['exec', '$pod', '--', controlPlaneBin, 'canary', 'opl-cli']);
  console.log(formatCommand('curl', ['--http2', '-fsS', healthUrl]));
  console.log(formatCommand('curl', ['--http2', '-fsS', readyUrl]));
  console.log(formatCommand('curl', ['--http2', '-fsS', metricsUrl]));
  console.log(formatCommand('curl', ['--http2', '-fsS', homeUrl]));
}

function printKubectl(commandArgs) {
  console.log(formatCommand('kubectl', kubectlArgs(commandArgs)));
}

function run(label, command, commandArgs) {
  console.log(`[cloud-rollout] ${label}`);
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertImageExists(targetImage) {
  console.log(`[cloud-rollout] image preflight ${targetImage}`);
  const result = spawnSync('docker', ['manifest', 'inspect', targetImage], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: diagnosticTimeoutMs,
    killSignal: 'SIGTERM',
  });
  if (result.status === 0) {
    console.log('[cloud-rollout] image preflight passed');
    return;
  }
  const reason = result.error?.code === 'ETIMEDOUT'
    ? `docker manifest inspect timed out after ${diagnosticTimeoutMs}ms`
    : (result.stderr || result.stdout || `docker manifest inspect exited ${result.status ?? 1}`).trim();
  console.error(`[cloud-rollout] image preflight failed: ${targetImage}`);
  console.error(`[cloud-rollout] failureKind=image_missing_rollout_order_issue imagePullOccurred=false`);
  if (reason) console.error(reason);
  process.exit(result.status || 1);
}

function runRolloutStatus() {
  console.log('[cloud-rollout] kubectl rollout status');
  const result = spawnSync('kubectl', kubectlArgs(['rollout', 'status', deployment, `--timeout=${kubectlRolloutTimeoutSeconds}s`]), {
    stdio: 'inherit',
    timeout: rolloutStatusTimeoutMs,
    killSignal: 'SIGTERM',
  });
  if (result.error?.code === 'ETIMEDOUT') {
    console.error(`[cloud-rollout] kubectl rollout status timed out after ${rolloutStatusTimeoutMs}ms`);
    printRolloutDiagnostics();
    process.exit(124);
  }
  if (result.status !== 0) {
    printRolloutDiagnostics();
    process.exit(result.status ?? 1);
  }
}

function printRolloutDiagnostics() {
  console.error('[cloud-rollout] rollout diagnostics');
  const outputs = [
    diagnostic('kubectl get deployment wide', ['get', deployment, '-o', 'wide']),
    diagnostic('kubectl describe deployment/opl-webui-control-plane', ['describe', deployment]),
    diagnostic('kubectl get rs,pod wide', ['get', 'rs,pod', '-l', podSelector, '-o', 'wide']),
    diagnostic('kubectl describe pod -l app.kubernetes.io/name=opl-webui', ['describe', 'pod', '-l', podSelector]),
    diagnostic('kubectl logs -l app.kubernetes.io/name=opl-webui', ['logs', '-l', podSelector, '--all-containers', '--tail=120']),
    diagnostic('kubectl get events', ['get', 'events', '--sort-by=.lastTimestamp']),
  ];
  const combined = outputs.map((item) => item.output).join('\n');
  console.error(`[cloud-rollout] rollout likely cause: ${classifyRolloutFailure(combined)}`);
}

function diagnostic(label, commandArgs) {
  console.error(`[cloud-rollout] ${label}`);
  const result = spawnSync('kubectl', kubectlArgs(commandArgs), {
    encoding: 'utf8',
    timeout: diagnosticTimeoutMs,
    killSignal: 'SIGTERM',
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (output) console.error(output);
  if (result.error?.code === 'ETIMEDOUT') console.error(`[cloud-rollout] diagnostic command timed out after ${diagnosticTimeoutMs}ms`);
  if (result.status !== 0) console.error(`[cloud-rollout] diagnostic command failed: ${result.status}`);
  return { label, output };
}

function classifyRolloutFailure(text) {
  if (/FailedScheduling|Insufficient cpu|Insufficient memory|didn'?t match.*node selector|node\(s\) had untolerated taint|No preemption victims/i.test(text)) {
    return 'scheduling_or_node_resources';
  }
  if (/ErrImagePull|ImagePullBackOff|pull access denied|failed to pull and unpack image|Back-off pulling image/i.test(text)) {
    return 'image_pull';
  }
  if (/CreateContainerConfigError|secret .* not found|couldn'?t find key|configmap .* not found/i.test(text)) {
    return 'missing_kubernetes_secret_or_config';
  }
  if (/CrashLoopBackOff|Back-off restarting failed container|Error: failed|panic:|executable file not found/i.test(text)) {
    return 'container_startup_or_crash';
  }
  if (/Readiness probe failed|Liveness probe failed|connection refused|HTTP probe failed/i.test(text)) {
    return 'readiness_or_liveness_probe';
  }
  if (/Terminating|marked for deletion|failed to kill pod|volume.*detach/i.test(text)) {
    return 'old_pod_termination_or_node';
  }
  return 'unknown_rollout_failure';
}

function semanticSmoke(label, url, validate) {
  console.log(`[cloud-rollout] HTTPS smoke ${url}`);
  const result = spawnSync('curl', ['--http2', '-fsS', url], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    process.exit(result.status ?? 1);
  }
  process.stdout.write(result.stdout ?? '');
  const body = parseJson(result.stdout, label);
  if (!validate(body)) {
    console.error(`${label} semantic smoke failed`);
    process.exit(1);
  }
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    console.error(`${label} semantic smoke did not return JSON`);
    process.exit(1);
  }
}

function capture(label, commandArgs) {
  console.log(`[cloud-rollout] ${label}`);
  const value = execFileSync('kubectl', commandArgs, { encoding: 'utf8' }).trim();
  console.log(value || '(empty)');
  return value;
}

function selectReadyPod(expectedImage = image) {
  const pods = JSON.parse(execFileSync('kubectl', kubectlArgs(['get', 'pod', '-l', podSelector, '-o', 'json']), { encoding: 'utf8' }));

  const candidates = (pods.items ?? [])
    .filter((pod) => pod.status?.phase === 'Running')
    .filter((pod) => hasReadyCondition(pod))
    .filter((pod) => containerStatus(pod)?.ready === true)
    .filter((pod) => podMatchesExpectedImage(pod, expectedImage))
    .sort((left, right) => (right.metadata?.creationTimestamp ?? '').localeCompare(left.metadata?.creationTimestamp ?? ''));

  const selected = candidates[0]?.metadata?.name;
  if (selected) {
    console.log('[cloud-rollout] selected pod');
    console.log(selected);
    return selected;
  }

  console.error(`No Running Ready pod found for selector ${podSelector} and image ${expectedImage}.`);
  console.error(formatPodSummary(pods.items ?? []));
  process.exit(1);
}

function hasReadyCondition(pod) {
  return (pod.status?.conditions ?? []).some((condition) => condition.type === 'Ready' && condition.status === 'True');
}

function containerStatus(pod) {
  return (pod.status?.containerStatuses ?? []).find((status) => status.name === container);
}

function podMatchesExpectedImage(pod, expectedImage) {
  if (!expectedImage) return true;
  const status = containerStatus(pod);
  if (!status) return false;
  if (status.image === expectedImage || status.imageID === expectedImage) return true;
  const expectedDigest = expectedImage.match(/@sha256:([0-9a-f]{64})$/)?.[1];
  if (!expectedDigest) return false;
  return [status.image, status.imageID].some((value) => (
    value === `sha256:${expectedDigest}` || (value ?? '').includes(`@sha256:${expectedDigest}`)
  ));
}

function formatPodSummary(pods) {
  if (pods.length === 0) {
    return 'Pod summary: no pods returned.';
  }
  const lines = pods.map((pod) => {
    const status = containerStatus(pod);
    return [
      pod.metadata?.name ?? '(unknown)',
      `phase=${pod.status?.phase ?? '(unknown)'}`,
      `ready=${hasReadyCondition(pod)}`,
      `containerReady=${status?.ready === true}`,
      `image=${status?.image ?? '(unknown)'}`,
      `imageID=${status?.imageID ?? '(unknown)'}`,
    ].join(' ');
  });
  return ['Pod summary:', ...lines].join('\n');
}

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`Missing required ${name}. Run without --apply or --dogfood-e2e for dry-run output.`);
    process.exit(2);
  }
}

function validateDogfoodCredentials() {
  const email = process.env.OPL_DOGFOOD_EMAIL?.trim() ?? '';
  const password = process.env.OPL_DOGFOOD_PASSWORD ?? '';
  if (!isValidDogfoodEmail(email)) {
    console.error('OPL_DOGFOOD_EMAIL must be a valid email address.');
    process.exit(2);
  }
  if (password.length === 0) {
    console.error('OPL_DOGFOOD_PASSWORD must be non-empty.');
    process.exit(2);
  }
}

function isValidDogfoodEmail(email) {
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@') || at === email.length - 1) return false;
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
}

function setValidatedImage(value) {
  image = validateImage(value);
  process.env.OPL_IMAGE = image;
  return image;
}

function normalizeImage(value) {
  const trimmed = (value ?? '').trim();
  if (releaseShortTagPattern.test(trimmed)) return `${imageRepository}:${trimmed}`;
  return trimmed;
}

function validateImage(value) {
  const normalized = normalizeImage(value);
  if (!normalized || normalized === '$OPL_IMAGE') {
    console.error('Missing required OPL_IMAGE. Set an allowed OPL-Webui image tag, digest, or release short commit tag.');
    process.exit(2);
  }
  if (!allowedImagePattern.test(normalized)) {
    console.error('OPL_IMAGE is outside the allowed OPL-Webui image registry.');
    process.exit(2);
  }
  return normalized;
}

function boundedInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} mismatch`);
}

function assertNoSensitive(value) {
  const text = JSON.stringify(value);
  for (const sensitive of [process.env.OPL_DOGFOOD_API_KEY, process.env.OPL_DOGFOOD_PASSWORD]) {
    if (sensitive && text.includes(sensitive)) throw new Error('dogfood response contains sensitive material');
  }
  assertNoUnsafeFields(value);
}

function assertNoUnsafeFields(value) {
  if (Array.isArray(value)) {
    for (const item of value) assertNoUnsafeFields(item);
    return;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && /postgres:\/\//i.test(value)) throw new Error('dogfood response contains unsafe fields');
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (/rawApiKey|encryptedApiKey|passwordHash/i.test(key)) throw new Error('dogfood response contains unsafe fields');
    if (/password/i.test(key) && typeof nested !== 'boolean') throw new Error('dogfood response contains unsafe fields');
    assertNoUnsafeFields(nested);
  }
}

function formatCommand(command, commandArgs) {
  return [command, ...commandArgs].map(shellQuote).join(' ');
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:=@{}$-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function printUsage() {
  console.log(`Usage:
  node scripts/cloud-rollout.mjs
  OPL_IMAGE=4a9d439 node scripts/cloud-rollout.mjs
  OPL_IMAGE=4a9d439 node scripts/cloud-rollout.mjs --image-preflight
  KUBECONFIG=/path/to/kubeconfig OPL_IMAGE=uswccr.ccs.tencentyun.com/webopl/opl-webui:4a9d439 OPL_BASE_URL=https://opl.medopl.cn node scripts/cloud-rollout.mjs --apply
  OPL_IMAGE=uswccr.ccs.tencentyun.com/webopl/opl-webui:previous-tag OPL_BASE_URL=https://opl.medopl.cn node scripts/cloud-rollout.mjs --rollback-plan
  KUBECONFIG=/path/to/kubeconfig OPL_IMAGE=uswccr.ccs.tencentyun.com/webopl/opl-webui:previous-tag OPL_BASE_URL=https://opl.medopl.cn node scripts/cloud-rollout.mjs --rollback
  OPL_PRODUCTION_DOGFOOD_E2E=1 OPL_DOGFOOD_EMAIL=... OPL_DOGFOOD_PASSWORD=... OPL_DOGFOOD_API_KEY=... node scripts/cloud-rollout.mjs --dogfood-e2e
  OPL_BASE_URL=https://opl.medopl.cn OPL_AVAILABILITY_PROBE_SAMPLES=3 node scripts/cloud-rollout.mjs --availability-probe

Default mode prints a dry-run command plan. Short release commit tags are normalized to ${imageRepository}:<tag>. --image-preflight checks that the target image manifest exists before cluster mutation. --apply runs image preflight, kubectl rollout, pod canaries, and HTTPS smoke checks. --rollback-plan prints the manual rollback plan without cluster mutation. --rollback runs manual environment-approved kubectl rollout undo and the same canary/smoke checks against the post-rollback Deployment image. --dogfood-e2e verifies production auth/key/chat/gate paths without kubectl. --availability-probe repeatedly checks public availability without secrets or cluster mutation. Set OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY=1 to include readonly projection checks.`);
}
