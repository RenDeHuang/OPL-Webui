import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const buildDir = mkdtempSync(join(tmpdir(), 'opl-webui-go-control-plane-'));
const binaryPath = join(buildDir, 'opl-webui-control-plane');
const fakeOplPath = join(buildDir, 'opl');

execFileSync('go', ['build', '-o', binaryPath, './backend/control-plane-go/cmd/opl-webui-control-plane'], {
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

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  return String(port);
}

export async function startGoServer() {
  return startGoServerWithEnv({});
}

export async function startGoServerWithEnv(extraEnv) {
  const port = await availablePort();
  const child = spawn(binaryPath, [], {
    env: { ...process.env, OPL_DATABASE_URL: '', ...extraEnv, PORT: port, OPL_CLI_PATH: fakeOplPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-2000);
  });
  child.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-2000);
  });

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
  throw new Error(`go control plane did not start at ${baseUrl}; exitCode=${child.exitCode}; signal=${child.signalCode}; stdout=${JSON.stringify(stdout)}; stderr=${JSON.stringify(stderr)}`);
}

export async function stopGoServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, 1000);
    child.once('exit', finish);
    if (!child.kill()) finish();
  });
}
