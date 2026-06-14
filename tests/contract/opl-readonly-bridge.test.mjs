import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const buildDir = mkdtempSync(join(tmpdir(), 'opl-webui-readonly-bridge-'));
const binaryPath = join(buildDir, 'opl-webui-control-plane');
const fakeOplPath = join(buildDir, 'opl');

execFileSync('go', ['build', '-o', binaryPath, './services/control-plane-go/cmd/opl-webui-control-plane'], {
  stdio: 'inherit',
});

writeFileSync(fakeOplPath, `#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  "system initialize --json")
    printf '%s\\n' '{"version":"g2","system_initialize":{"overall_state":"attention_needed","readiness":{"core_ready":true,"domain_ready":false,"full_ready":false},"setup_flow":{"blocking_items":["domain_modules"]}}}'
    ;;
  "modules --json")
    printf '%s\\n' '{"version":"g2","modules":{"summary":{"default_modules_count":3,"healthy_default_modules_count":1},"items":[{"module_id":"medautoscience","health_status":"ready"}]}}'
    ;;
  "contract domains --json")
    printf '%s\\n' '{"version":"g2","domains":[{"domain_id":"medautoscience","single_app_skill":"mas"}]}'
    ;;
  *)
    echo "unexpected command: $*" >&2
    exit 64
    ;;
esac
`, { mode: 0o755 });

process.once('exit', () => {
  rmSync(buildDir, { recursive: true, force: true });
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startGoServer() {
  const port = String(47000 + Math.floor(Math.random() * 1000));
  const child = spawn(binaryPath, [], {
    env: { ...process.env, PORT: port, OPL_CLI_PATH: fakeOplPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const baseUrl = `http://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.status === 200) return { child, baseUrl };
    } catch {
      await wait(100);
    }
  }

  child.kill();
  throw new Error('go control plane did not start');
}

async function stopGoServer(child) {
  child.kill();
  await new Promise((resolve) => child.once('exit', resolve));
}

test('Go control plane exposes an OPL readonly snapshot endpoint', async () => {
  const { child, baseUrl } = await startGoServer();
  try {
    const response = await fetch(`${baseUrl}/api/opl/snapshot`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');

    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.mode, 'readonly');
    assert.equal(body.policyId, 'opl.cli.readonly.snapshot');
    assert.equal(body.systemInitialize.system_initialize.readiness.core_ready, true);
    assert.equal(body.modules.modules.summary.default_modules_count, 3);
    assert.equal(body.domains.domains[0].domain_id, 'medautoscience');
    assert.deepEqual(body.commands.map((entry) => entry.args.join(' ')), [
      'system initialize --json',
      'modules --json',
      'contract domains --json',
    ]);
  } finally {
    await stopGoServer(child);
  }
});
