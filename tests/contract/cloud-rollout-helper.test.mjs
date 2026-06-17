import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const helperPath = 'scripts/cloud-rollout.mjs';

test('cloud rollout helper is a dry-run first VPC runner entrypoint', () => {
  assert.equal(existsSync(helperPath), true);
  const helper = readFileSync(helperPath, 'utf8');

  assert.match(helper, /--apply/);
  assert.match(helper, /KUBECONFIG/);
  assert.match(helper, /OPL_IMAGE/);
  assert.match(helper, /kubectl/);
  assert.match(helper, /set image/);
  assert.match(helper, /rollout status/);
  assert.match(helper, /canary db/);
  assert.match(helper, /canary opl-cli/);
  assert.match(helper, /OPL_BASE_URL/);
  assert.match(helper, /OPL_NAMESPACE/);
  assert.match(helper, /dryRun/);
  assert.doesNotMatch(helper, /OPL_DATABASE_URL|PGPASSWORD|qcloud_cert_id|AKID[A-Za-z0-9]+/);

  const defaultDryRun = execFileSync(process.execPath, [helperPath], { encoding: 'utf8' });
  assert.match(defaultDryRun, /https:\/\/opl\.medopl\.cn\/healthz/);
  assert.match(defaultDryRun, /https:\/\/opl\.medopl\.cn\/readyz/);
  assert.match(defaultDryRun, /https:\/\/opl\.medopl\.cn\/metricsz/);
  assert.match(defaultDryRun, /https:\/\/opl\.medopl\.cn\//);

  const configuredBaseUrlDryRun = execFileSync(process.execPath, [helperPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      OPL_BASE_URL: 'https://preview.example.test/path/',
      OPL_NAMESPACE: 'opl-webui-preview',
    },
  });
  assert.match(configuredBaseUrlDryRun, /-n opl-webui-preview/);
  assert.match(configuredBaseUrlDryRun, /https:\/\/preview\.example\.test\/path\/healthz/);
  assert.match(configuredBaseUrlDryRun, /https:\/\/preview\.example\.test\/path\/readyz/);
  assert.match(configuredBaseUrlDryRun, /https:\/\/preview\.example\.test\/path\/metricsz/);
  assert.doesNotMatch(configuredBaseUrlDryRun, /https:\/\/opl\.medopl\.cn\/healthz/);
});

test('cloud rollout helper captures rollout state evidence for closeout', () => {
  const helper = readFileSync(helperPath, 'utf8');

  assert.match(helper, /rollout revision/);
  assert.match(helper, /deployment image/);
  assert.match(helper, /pod status/);
  assert.match(helper, /pod imageID/);
  assert.match(helper, /deployment\\\\.kubernetes\\\\.io\/revision/);
  assert.match(helper, /jsonpath=\{\.spec\.template\.spec\.containers\[\?\(@\.name=="control-plane"\)\]\.image\}/);
  assert.match(helper, /jsonpath=\{\.status\.containerStatuses\[\?\(@\.name=="control-plane"\)\]\.imageID\}/);
  assert.doesNotMatch(helper, /jsonpath=\{\.items\[0\]\.metadata\.name\}/);
  assert.match(helper, /'wide'/);
});

test('cloud rollout helper execs the current Running Ready pod when old Error pods exist', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'opl-cloud-rollout-'));
  const commandLog = join(tempDir, 'commands.log');
  const targetImage = 'uswccr.ccs.tencentyun.com/webopl/opl-webui:e2c6b27';

  writeFakeKubectl(tempDir);
  writeFakeCurl(tempDir);

  try {
    const output = execFileSync(process.execPath, [helperPath, '--apply'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${tempDir}:${process.env.PATH}`,
        KUBECONFIG: join(tempDir, 'kubeconfig'),
        OPL_IMAGE: targetImage,
        OPL_BASE_URL: 'https://opl.medopl.cn',
        OPL_NAMESPACE: 'opl-webui',
        TARGET_IMAGE: targetImage,
        COMMAND_LOG: commandLog,
      },
    });

    assert.match(output, /selected pod\nopl-webui-control-plane-new-ready/);
    const commands = readFileSync(commandLog, 'utf8');
    assert.match(commands, /exec opl-webui-control-plane-new-ready -- \/app\/opl-webui-control-plane canary db/);
    assert.match(commands, /exec opl-webui-control-plane-new-ready -- \/app\/opl-webui-control-plane canary opl-cli/);
    assert.match(commands, /curl --http2 -fsS https:\/\/opl\.medopl\.cn\/metricsz/);
    assert.doesNotMatch(commands, /exec opl-webui-control-plane-old-error --/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function writeFakeKubectl(tempDir) {
  writeFileSync(join(tempDir, 'kubectl'), `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');

const rawArgs = process.argv.slice(2);
const args = [];
for (let index = 0; index < rawArgs.length; index += 1) {
  if (rawArgs[index] === '--kubeconfig' || rawArgs[index] === '-n') {
    index += 1;
    continue;
  }
  args.push(rawArgs[index]);
}
appendFileSync(process.env.COMMAND_LOG, args.join(' ') + '\\n');

if (args[0] === 'set' || args[0] === 'rollout') process.exit(0);
if (args[0] === 'get' && args[1] === 'deployment/opl-webui-control-plane') {
  process.stdout.write(args.includes('containers') ? process.env.TARGET_IMAGE : '4');
  process.exit(0);
}
if (args[0] === 'get' && args[1] === 'pod' && args.includes('-l') && args.includes('json')) {
  process.stdout.write(JSON.stringify({ items: [
    pod('opl-webui-control-plane-old-error', 'Failed', false),
    pod('opl-webui-control-plane-new-ready', 'Running', true),
  ] }));
  process.exit(0);
}
if (args[0] === 'get' && args[1] === 'pod' && args.includes('-l') && args.includes('wide')) {
  process.stdout.write('NAME READY STATUS\\nold-error 0/1 Error\\nnew-ready 1/1 Running\\n');
  process.exit(0);
}
if (args[0] === 'get' && args[1] === 'pod' && args[2] === 'opl-webui-control-plane-new-ready') {
  process.stdout.write('docker-pullable://opl-webui@sha256:new-ready');
  process.exit(0);
}
if (args[0] === 'exec' && args[1] === 'opl-webui-control-plane-new-ready') {
  process.stdout.write('{"ok":true}\\n');
  process.exit(0);
}
if (args[0] === 'exec' && args[1] === 'opl-webui-control-plane-old-error') {
  process.stderr.write('cannot exec into a container in a completed pod; current phase is Failed\\n');
  process.exit(1);
}
process.stderr.write('unexpected kubectl args: ' + args.join(' ') + '\\n');
process.exit(64);

function pod(name, phase, ready) {
  return {
    metadata: { name, creationTimestamp: ready ? '2026-06-17T08:01:00Z' : '2026-06-17T08:00:00Z' },
    status: {
      phase,
      conditions: [{ type: 'Ready', status: ready ? 'True' : 'False' }],
      containerStatuses: [{ name: 'control-plane', ready, image: process.env.TARGET_IMAGE, imageID: name }],
    },
  };
}
`, { mode: 0o755 });
}

function writeFakeCurl(tempDir) {
  writeFileSync(join(tempDir, 'curl'), `#!/usr/bin/env bash
printf 'curl %s\\n' "$*" >> "$COMMAND_LOG"
printf 'ok\\n'
`, { mode: 0o755 });
}
