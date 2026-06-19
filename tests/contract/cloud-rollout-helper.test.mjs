import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
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

  const defaultDryRun = execFileSync(process.execPath, [helperPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      OPL_IMAGE: 'uswccr.ccs.tencentyun.com/webopl/opl-webui:e2c6b27',
    },
  });
  assert.match(defaultDryRun, /https:\/\/opl\.medopl\.cn\/healthz/);
  assert.match(defaultDryRun, /https:\/\/opl\.medopl\.cn\/readyz/);
  assert.match(defaultDryRun, /https:\/\/opl\.medopl\.cn\/metricsz/);
  assert.match(defaultDryRun, /https:\/\/opl\.medopl\.cn\//);

  const configuredBaseUrlDryRun = execFileSync(process.execPath, [helperPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      OPL_BASE_URL: 'https://preview.example.test/path/',
      OPL_IMAGE: 'uswccr.ccs.tencentyun.com/webopl/opl-webui@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      OPL_NAMESPACE: 'opl-webui-preview',
    },
  });
  assert.match(configuredBaseUrlDryRun, /-n opl-webui-preview/);
  assert.match(configuredBaseUrlDryRun, /https:\/\/preview\.example\.test\/path\/healthz/);
  assert.match(configuredBaseUrlDryRun, /https:\/\/preview\.example\.test\/path\/readyz/);
  assert.match(configuredBaseUrlDryRun, /https:\/\/preview\.example\.test\/path\/metricsz/);
  assert.doesNotMatch(configuredBaseUrlDryRun, /https:\/\/opl\.medopl\.cn\/healthz/);

  assert.throws(
    () => execFileSync(process.execPath, [helperPath], {
      encoding: 'utf8',
      env: { ...process.env, OPL_IMAGE: 'docker.io/library/opl-webui:latest' },
    }),
    /outside the allowed OPL-Webui image registry/,
  );
});

test('cloud rollout helper has a secret-gated production authenticated dogfood harness', async () => {
  const helper = readFileSync(helperPath, 'utf8');
  for (const required of [
    '--dogfood-e2e', 'OPL_PRODUCTION_DOGFOOD_E2E', 'OPL_PRODUCTION_DOGFOOD_REAL_CHAT',
    'OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY',
    'OPL_DOGFOOD_EMAIL', 'OPL_DOGFOOD_PASSWORD', 'OPL_DOGFOOD_API_KEY',
    'https://gflabtoken.cn/v1', '@基金', 'RUNTIME_REQUIRED',
  ]) assert.match(helper, new RegExp(required.replace(/[/-]/g, '\\$&')));
  assert.match(execFileSync(process.execPath, [helperPath, '--dogfood-e2e'], { encoding: 'utf8', timeout: 5000 }), /skipped/i);
  const dogfoodCode = helper.slice(helper.indexOf('async function runDogfoodE2E'), helper.indexOf('function kubectlArgs'));
  assert.doesNotMatch(dogfoodCode, /OPL_DATABASE_URL|PGPASSWORD|KUBECONFIG_CONTENT|kubectl|console\.log\(`::add-mask::/);

  const fake = await startFakeProduction();
  try {
    const output = await runHelper({
      env: {
        ...process.env,
        OPL_BASE_URL: fake.baseUrl,
        OPL_PRODUCTION_DOGFOOD_E2E: '1',
        OPL_PRODUCTION_DOGFOOD_REAL_CHAT: '1',
        OPL_PRODUCTION_DOGFOOD_MEDOPL_READONLY: '1',
        OPL_DOGFOOD_EMAIL: 'dogfood@example.test',
        OPL_DOGFOOD_PASSWORD: 'dogfood-password',
        OPL_DOGFOOD_API_KEY: 'sk-dogfood-production-secret',
      },
    });
    assert.match(output, /register|login|current session|API Key binding|ordinary chat|runtime gate|audit events|runtime status|materials deliverables|billing summary/i);
    assert.doesNotMatch(output, /sk-dogfood-production-secret|dogfood-password|opl_session=secret-session/i);
    assert.equal(fake.requests.find((request) => request.path === '/api/settings/model-provider').body.apiKey, 'sk-dogfood-production-secret');
    assert.equal(fake.requests.some((request) => request.path === '/api/chat' && request.body.message.includes('@基金')), true);
    assert.equal(fake.requests.some((request) => request.path === '/api/medopl/runtime/status'), true);
    assert.equal(fake.requests.some((request) => request.path === '/api/medopl/materials-deliverables/projection'), true);
    assert.equal(fake.requests.some((request) => request.path === '/api/account/billing-summary'), true);
  } finally {
    await fake.close();
  }
});

test('cloud rollout helper reports credential input failures without unsafe-field false positives', async () => {
  const fake = await startFakeProduction({ registerStatus: 400 });
  try {
    await assert.rejects(
      runHelper({
        env: {
          ...process.env,
          OPL_BASE_URL: fake.baseUrl,
          OPL_PRODUCTION_DOGFOOD_E2E: '1',
          OPL_DOGFOOD_EMAIL: 'dogfood@example.test',
          OPL_DOGFOOD_PASSWORD: 'dogfood-password',
          OPL_DOGFOOD_API_KEY: 'sk-dogfood-production-secret',
        },
      }),
      /register expected 201\/409 but got 400/,
    );
  } finally {
    await fake.close();
  }
});

test('cloud rollout helper validates dogfood credentials locally before production requests', async () => {
  const fake = await startFakeProduction();
  try {
    await assert.rejects(
      runHelper({
        env: {
          ...process.env,
          OPL_BASE_URL: fake.baseUrl,
          OPL_PRODUCTION_DOGFOOD_E2E: '1',
          OPL_DOGFOOD_EMAIL: 'dogfood@example.test',
          OPL_DOGFOOD_PASSWORD: 'short',
          OPL_DOGFOOD_API_KEY: 'sk-dogfood-production-secret',
        },
      }),
      /OPL_DOGFOOD_PASSWORD must be at least 12 characters/,
    );
    assert.equal(fake.requests.length, 0);
  } finally {
    await fake.close();
  }
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

test('cloud rollout helper fails closed on semantic smoke regressions', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'opl-cloud-rollout-smoke-'));
  const commandLog = join(tempDir, 'commands.log');
  const targetImage = 'uswccr.ccs.tencentyun.com/webopl/opl-webui:e2c6b27';

  writeFakeKubectl(tempDir);
  writeFakeCurl(tempDir);

  try {
    assert.throws(
      () => execFileSync(process.execPath, [helperPath, '--apply'], {
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
          FAKE_METRICS_MISSING: '1',
        },
      }),
      /metricsz semantic smoke failed/,
    );
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
url="\${@: -1}"
case "$url" in
  */readyz)
    printf '{"ok":true,"missing":[]}\\n'
    ;;
  */metricsz)
    if [ "$FAKE_METRICS_MISSING" = "1" ]; then
      printf '{"ok":true,"missingDependencyCount":1,"missingDependencies":["database"]}\\n'
    else
      printf '{"ok":true,"missingDependencyCount":0,"missingDependencies":[]}\\n'
    fi
    ;;
  */healthz)
    printf '{"ok":true}\\n'
    ;;
  *)
    printf '<html>One Person Lab Web</html>\\n'
    ;;
esac
`, { mode: 0o755 });
}

function runHelper(options) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [helperPath, '--dogfood-e2e'], options);
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('dogfood helper timed out'));
    }, 5000);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error(output || `dogfood helper exited ${code}`));
    });
  });
}

async function startFakeProduction(options = {}) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    requests.push({ path: request.url, body });
    const send = (status, payload, cookie = false) => {
      const headers = { 'content-type': 'application/json' };
      if (cookie) headers['set-cookie'] = 'opl_session=secret-session; HttpOnly';
      response.writeHead(status, headers);
      response.end(JSON.stringify(payload));
    };
    if (request.url === '/') return send(200, { html: '严肃工作的 AI 工作台 https://gflabtoken.cn/v1' });
    if (request.url === '/api/auth/register') {
      if (options.registerStatus === 400) {
        return send(400, { ok: false, errorCode: 'INVALID_CREDENTIALS_INPUT', message: 'valid email and password are required' });
      }
      return send(409, { errorCode: 'EMAIL_ALREADY_REGISTERED' });
    }
    if (request.url === '/api/auth/login') return send(200, { email: body.email }, true);
    if (request.url === '/api/session/current') return send(200, { email: 'dogfood@example.test' });
    if (request.url === '/api/settings/model-provider') return send(200, { baseUrl: 'https://gflabtoken.cn/v1', apiKeyConfigured: true, maskedKey: 'sk-***ret' });
    if (request.url === '/api/chat' && body.message.includes('@基金')) return send(409, { errorCode: 'RUNTIME_REQUIRED', medoplDeepLink: 'https://medopl.medopl.cn/runtime' });
    if (request.url === '/api/chat') return send(200, { assistantMessage: { content: 'pong' } });
    if (request.url === '/api/account/audit-events') return send(200, { events: [{ eventKind: 'chat.completed' }, { eventKind: 'runtime_gate.required' }] });
    if (request.url === '/api/medopl/runtime/status') {
      return send(200, {
        ok: true,
        owner: 'MedOPL',
        state: 'ready',
        deepLink: 'https://medopl.medopl.cn/runtime',
        refs: { runtimeRef: 'runtime_public_ref_dogfood' },
        counts: { activeRuns: 1 },
        webuiRuntimeExecution: 'forbidden',
      });
    }
    if (request.url === '/api/medopl/materials-deliverables/projection') {
      return send(200, {
        ok: true,
        owner: 'MedOPL',
        deepLink: 'https://medopl.medopl.cn/materials',
        materials: [{ materialId: 'material_ref_dogfood', title: 'Linked material', kind: 'reference', status: 'ready' }],
        deliverables: [{ deliverableId: 'deliverable_ref_dogfood', title: 'Linked deliverable', kind: 'artifact_ref', status: 'draft', ref: 'deliverable_ref_dogfood' }],
        webuiStorageMutation: 'forbidden',
        webuiArtifactBody: 'forbidden',
      });
    }
    if (request.url === '/api/account/billing-summary') {
      return send(200, {
        ok: true,
        owner: 'MedOPL',
        deepLink: 'https://medopl.medopl.cn/billing',
        quota: { limit: 100, used: 1, remaining: 99 },
        audit: { eventCount: 2, latestEventKind: 'runtime_gate.required' },
        webuiBillingSourceOfTruth: 'forbidden',
        webuiPaymentMutation: 'forbidden',
      });
    }
    send(404, { errorCode: 'NOT_FOUND' });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { baseUrl: `http://127.0.0.1:${port}`, requests, close: () => new Promise((resolve) => server.close(resolve)) };
}
