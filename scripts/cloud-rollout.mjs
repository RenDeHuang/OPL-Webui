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
const rolloutRevisionJsonpath = 'jsonpath={.metadata.annotations.deployment\\.kubernetes\\.io/revision}';
const deploymentImageJsonpath = 'jsonpath={.spec.template.spec.containers[?(@.name=="control-plane")].image}';
const podImageIdJsonpath = 'jsonpath={.status.containerStatuses[?(@.name=="control-plane")].imageID}';

const healthUrl = 'https://opl.medopl.cn/healthz';
const readyUrl = 'https://opl.medopl.cn/readyz';
const homeUrl = 'https://opl.medopl.cn/';

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

run('kubectl set image', 'kubectl', kubectlArgs([
  'set',
  'image',
  deployment,
  `${container}=${process.env.OPL_IMAGE}`,
]));

run('kubectl rollout status', 'kubectl', kubectlArgs([
  'rollout',
  'status',
  deployment,
]));

capture('rollout revision', kubectlArgs([
  'get',
  deployment,
  '-o',
  rolloutRevisionJsonpath,
]));

capture('deployment image', kubectlArgs([
  'get',
  deployment,
  '-o',
  deploymentImageJsonpath,
]));

const pod = execFileSync('kubectl', kubectlArgs([
  'get',
  'pod',
  '-l',
  podSelector,
  '-o',
  'jsonpath={.items[0].metadata.name}',
]), { encoding: 'utf8' }).trim();

if (!pod) {
  console.error('No pod found for selector:', podSelector);
  process.exit(1);
}

run('pod status', 'kubectl', kubectlArgs([
  'get',
  'pod',
  '-l',
  podSelector,
  '-o',
  'wide',
]));

capture('pod imageID', kubectlArgs([
  'get',
  'pod',
  pod,
  '-o',
  podImageIdJsonpath,
]));

run('canary db', 'kubectl', kubectlArgs([
  'exec',
  pod,
  '--',
  controlPlaneBin,
  'canary',
  'db',
]));

run('canary opl-cli', 'kubectl', kubectlArgs([
  'exec',
  pod,
  '--',
  controlPlaneBin,
  'canary',
  'opl-cli',
]));

for (const url of [healthUrl, readyUrl, homeUrl]) {
  run(`HTTPS smoke ${url}`, 'curl', ['--http2', '-fsS', url]);
}

function kubectlArgs(commandArgs) {
  return ['--kubeconfig', process.env.KUBECONFIG ?? kubeconfig, '-n', namespace, ...commandArgs];
}

function printDryRun() {
  console.log('[cloud-rollout] dryRun=true; pass --apply to mutate the cluster.');
  console.log(formatCommand('kubectl', kubectlArgs([
    'set',
    'image',
    deployment,
    `${container}=${image}`,
  ])));
  console.log(formatCommand('kubectl', kubectlArgs([
    'rollout',
    'status',
    deployment,
  ])));
  console.log(formatCommand('kubectl', kubectlArgs([
    'get',
    deployment,
    '-o',
    rolloutRevisionJsonpath,
  ])));
  console.log(formatCommand('kubectl', kubectlArgs([
    'get',
    deployment,
    '-o',
    deploymentImageJsonpath,
  ])));
  console.log(`pod="$(${formatCommand('kubectl', kubectlArgs([
    'get',
    'pod',
    '-l',
    podSelector,
    '-o',
    'jsonpath={.items[0].metadata.name}',
  ]))})"`);
  console.log(formatCommand('kubectl', kubectlArgs([
    'get',
    'pod',
    '-l',
    podSelector,
    '-o',
    'wide',
  ])));
  console.log(formatCommand('kubectl', kubectlArgs([
    'get',
    'pod',
    '$pod',
    '-o',
    podImageIdJsonpath,
  ])));
  console.log(formatCommand('kubectl', kubectlArgs([
    'exec',
    '$pod',
    '--',
    controlPlaneBin,
    'canary',
    'db',
  ])));
  console.log(formatCommand('kubectl', kubectlArgs([
    'exec',
    '$pod',
    '--',
    controlPlaneBin,
    'canary',
    'opl-cli',
  ])));
  console.log(formatCommand('curl', ['--http2', '-fsS', healthUrl]));
  console.log(formatCommand('curl', ['--http2', '-fsS', readyUrl]));
  console.log(formatCommand('curl', ['--http2', '-fsS', homeUrl]));
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
  KUBECONFIG=/path/to/kubeconfig OPL_IMAGE=registry/repo:tag node scripts/cloud-rollout.mjs --apply

Default mode prints a dry-run command plan. --apply runs kubectl rollout, pod canaries, and HTTPS smoke checks.`);
}
