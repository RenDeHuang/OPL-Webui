#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--apply');

const namespace = process.env.OPL_NAMESPACE ?? 'opl-webui';
const deployment = process.env.OPL_DEPLOYMENT ?? 'deployment/opl-webui-control-plane';
const container = process.env.OPL_CONTAINER ?? 'control-plane';
const podSelector = process.env.OPL_POD_SELECTOR ?? 'app.kubernetes.io/name=opl-webui';
const controlPlaneBin = process.env.OPL_CONTROL_PLANE_BIN ?? '/app/opl-webui-control-plane';

const kubeconfig = process.env.KUBECONFIG ?? '$KUBECONFIG';
const image = process.env.OPL_IMAGE ?? '$OPL_IMAGE';
const configuredBaseUrl = process.env.OPL_BASE_URL?.trim();
const baseUrl = (configuredBaseUrl || 'https://opl.medopl.cn').replace(/\/$/, '');
const rolloutRevisionJsonpath = 'jsonpath={.metadata.annotations.deployment\\.kubernetes\\.io/revision}';
const deploymentImageJsonpath = 'jsonpath={.spec.template.spec.containers[?(@.name=="control-plane")].image}';
const podImageIdJsonpath = 'jsonpath={.status.containerStatuses[?(@.name=="control-plane")].imageID}';

const healthUrl = `${baseUrl}/healthz`;
const readyUrl = `${baseUrl}/readyz`;
const metricsUrl = `${baseUrl}/metricsz`;
const homeUrl = `${baseUrl}/`;

if (args.has('--help')) {
  printUsage();
  process.exit(0);
}

if (args.has('--dogfood-e2e')) {
  await runDogfoodE2E();
  process.exit(0);
}

if (dryRun) {
  printDryRun();
  process.exit(0);
}

requireEnv('KUBECONFIG');
requireEnv('OPL_IMAGE');

run('kubectl set image', 'kubectl', kubectlArgs(['set', 'image', deployment, `${container}=${process.env.OPL_IMAGE}`]));

run('kubectl rollout status', 'kubectl', kubectlArgs(['rollout', 'status', deployment]));

capture('rollout revision', kubectlArgs(['get', deployment, '-o', rolloutRevisionJsonpath]));

capture('deployment image', kubectlArgs(['get', deployment, '-o', deploymentImageJsonpath]));

const pod = selectReadyPod();

run('pod status', 'kubectl', kubectlArgs(['get', 'pod', '-l', podSelector, '-o', 'wide']));

capture('pod imageID', kubectlArgs(['get', 'pod', pod, '-o', podImageIdJsonpath]));

run('canary db', 'kubectl', kubectlArgs(['exec', pod, '--', controlPlaneBin, 'canary', 'db']));

run('canary opl-cli', 'kubectl', kubectlArgs(['exec', pod, '--', controlPlaneBin, 'canary', 'opl-cli']));

for (const url of [healthUrl, readyUrl, metricsUrl, homeUrl]) {
  run(`HTTPS smoke ${url}`, 'curl', ['--http2', '-fsS', url]);
}

async function runDogfoodE2E() {
  if (process.env.OPL_PRODUCTION_DOGFOOD_E2E !== '1') {
    console.log('[cloud-rollout] production authenticated dogfood e2e skipped; set OPL_PRODUCTION_DOGFOOD_E2E=1 to run.');
    return;
  }
  for (const name of ['OPL_DOGFOOD_EMAIL', 'OPL_DOGFOOD_PASSWORD', 'OPL_DOGFOOD_API_KEY']) {
    requireEnv(name);
  }
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
  assertNoSensitive({ current: current.body, saved: saved.body, gated: gated.body, audit: audit.body });
  console.log(`[cloud-rollout] production authenticated dogfood e2e passed; audit kinds=${[...new Set(kinds)].join(',')}`);
}

async function dogfoodSession() {
  const credentials = { email: process.env.OPL_DOGFOOD_EMAIL, password: process.env.OPL_DOGFOOD_PASSWORD };
  const registered = await dogfoodFetch('/api/auth/register', { method: 'POST', body: credentials }, 'register', [201, 409]);
  if (registered.response.status === 201) return registered;
  return dogfoodFetch('/api/auth/login', { method: 'POST', body: credentials }, 'login');
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
  printKubectl(['rollout', 'status', deployment]);
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

function capture(label, commandArgs) {
  console.log(`[cloud-rollout] ${label}`);
  const value = execFileSync('kubectl', commandArgs, { encoding: 'utf8' }).trim();
  console.log(value || '(empty)');
  return value;
}

function selectReadyPod() {
  const pods = JSON.parse(execFileSync('kubectl', kubectlArgs(['get', 'pod', '-l', podSelector, '-o', 'json']), { encoding: 'utf8' }));

  const expectedImage = process.env.OPL_IMAGE;
  const candidates = (pods.items ?? [])
    .filter((pod) => pod.status?.phase === 'Running')
    .filter((pod) => hasReadyCondition(pod))
    .filter((pod) => containerStatus(pod)?.ready === true)
    .filter((pod) => !expectedImage || containerStatus(pod)?.image === expectedImage)
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

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} mismatch`);
}

function assertNoSensitive(value) {
  const text = JSON.stringify(value);
  for (const sensitive of [process.env.OPL_DOGFOOD_API_KEY, process.env.OPL_DOGFOOD_PASSWORD]) {
    if (sensitive && text.includes(sensitive)) throw new Error('dogfood response contains sensitive material');
  }
  if (/rawApiKey|encryptedApiKey|password|postgres:\/\//i.test(text)) throw new Error('dogfood response contains unsafe fields');
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
  KUBECONFIG=/path/to/kubeconfig OPL_IMAGE=registry/repo:tag OPL_BASE_URL=https://opl.medopl.cn node scripts/cloud-rollout.mjs --apply
  OPL_PRODUCTION_DOGFOOD_E2E=1 OPL_DOGFOOD_EMAIL=... OPL_DOGFOOD_PASSWORD=... OPL_DOGFOOD_API_KEY=... node scripts/cloud-rollout.mjs --dogfood-e2e

Default mode prints a dry-run command plan. --apply runs kubectl rollout, pod canaries, and HTTPS smoke checks. --dogfood-e2e verifies production auth/key/chat/gate paths without kubectl.`);
}
