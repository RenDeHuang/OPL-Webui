import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const buildDir = mkdtempSync(join(tmpdir(), 'opl-webui-go-control-plane-'));
const binaryPath = join(buildDir, 'opl-webui-control-plane');
const fakeOplPath = join(buildDir, 'opl');

execFileSync('go', ['build', '-o', binaryPath, './services/control-plane-go/cmd/opl-webui-control-plane'], {
  stdio: 'inherit',
});

writeFileSync(fakeOplPath, `#!/usr/bin/env bash
set -euo pipefail
case "$1 $2" in
  "domain resolve-request")
    printf '%s\\n' '{"version":"g2","resolution":{"status":"routed","request_kind":"discover","workstream_id":"research_ops","domain_id":"medautoscience","entry_surface":"domain_gateway","confidence":"high","routing_evidence":["research delivery semantics","domain-agent entry only"]}}'
    ;;
  "contract handoff-envelope")
    printf '%s\\n' '{"version":"g2","handoff_bundle":{"surface_id":"opl_family_handoff_bundle","target_domain_id":"medautoscience","task_intent":"research","entry_mode":"product_entry_handoff","routing_status":"routed","domain_context":{"project":"med-autoscience"}}}'
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
  const port = String(45000 + Math.floor(Math.random() * 1000));
  const child = spawn(binaryPath, [], {
    env: { ...process.env, PORT: port, OPL_CLI_PATH: fakeOplPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const baseUrl = `http://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`${baseUrl}/`);
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

test('Go control plane creates a tenant scoped task artifact projection', async () => {
  const { child, baseUrl } = await startGoServer();
  try {
    const response = await fetch(`${baseUrl}/api/mvp/task`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant_cloud_demo',
        workspaceId: 'workspace_cloud_demo',
        userId: 'user_demo',
        prompt: '生成一个医学研究项目的证据整理任务',
        intent: 'research',
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');

    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.tenantId, 'tenant_cloud_demo');
    assert.equal(body.workspaceId, 'workspace_cloud_demo');
    assert.equal(body.userId, 'user_demo');
    assert.match(body.runId, /^run_/);
    assert.equal(body.task.status, 'completed');
    assert.equal(body.task.commandPolicyId, 'opl.cli.readonly.task-route');
    assert.equal(body.artifacts.length, 1);
    assert.equal(body.adapter.command.join(' '), 'opl contract handoff-envelope');
    assert.equal(body.adapter.route.policyId, 'opl.cli.readonly.task-route');
    assert.equal(body.adapter.route.resolution.resolution.domain_id, 'medautoscience');
    assert.equal(body.adapter.route.handoffBundle.handoff_bundle.target_domain_id, 'medautoscience');
    assert.deepEqual(body.adapter.route.commands.map((entry) => entry.args.slice(0, 2).join(' ')), [
      'domain resolve-request',
      'contract handoff-envelope',
    ]);
    assert.equal(body.adapter.route.commands.every((entry) => entry.mutating === false), true);
  } finally {
    await stopGoServer(child);
  }
});

test('Go control plane exposes a deployment health check', async () => {
  const { child, baseUrl } = await startGoServer();
  try {
    const response = await fetch(`${baseUrl}/healthz`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');

    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, 'opl-webui-control-plane');
  } finally {
    await stopGoServer(child);
  }
});

test('Go control plane rejects requests without tenant boundary', async () => {
  const { child, baseUrl } = await startGoServer();
  try {
    const response = await fetch(`${baseUrl}/api/mvp/task`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'workspace_cloud_demo',
        userId: 'user_demo',
        prompt: '生成一个医学研究项目的证据整理任务',
      }),
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.errorCode, 'INVALID_MVP_TASK_REQUEST');
  } finally {
    await stopGoServer(child);
  }
});
