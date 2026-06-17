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
    console.error(`Missing required ${name}. Run without --apply for dry-run output.`);
    process.exit(2);
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
  KUBECONFIG=/path/to/kubeconfig OPL_IMAGE=registry/repo:tag OPL_BASE_URL=https://opl.medopl.cn node scripts/cloud-rollout.mjs --apply

Default mode prints a dry-run command plan. --apply runs kubectl rollout, pod canaries, and HTTPS smoke checks.`);
}
