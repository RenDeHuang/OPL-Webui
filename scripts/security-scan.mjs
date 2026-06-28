#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const files = trackedFiles();
const failures = [];

checkDeployExamplesForRawSecrets();
checkProductionMutationCommands();
checkDefaultPostgresRedisDependency();
checkCiStaysLocalOnly();

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[security] ${failure}`);
  }
  process.exit(1);
}

console.log('security scan passed');

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .filter((file) => !file.startsWith('.runtime/'))
      .filter((file) => !file.startsWith('node_modules/'));
  } catch (error) {
    failures.push(`unable to enumerate tracked files: ${error.message}`);
    return [];
  }
}

function checkDeployExamplesForRawSecrets() {
  // raw secret check: examples may contain placeholders, never committed credentials.
  for (const file of files.filter((path) => path.startsWith('deploy/'))) {
    if (!isTextFile(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const [index, line] of text.split('\n').entries()) {
      const match = line.match(/^\s*([A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|API_KEY|DATABASE_URL)[A-Z0-9_]*)\s*[:=]\s*(.+?)\s*$/i);
      if (!match) continue;
      const value = stripComment(match[2]).trim();
      if (value.length === 0 || isPlaceholder(value)) continue;
      failures.push(`${file}:${index + 1} contains raw secret-looking example value for ${match[1]}`);
    }
  }
}

function checkProductionMutationCommands() {
  // production mutation check: local/security surfaces must not carry rollout mutators.
  const commandParts = [
    ['kubectl', 'apply'],
    ['docker', 'push'],
    ['helm', 'upgrade'],
    ['terraform', 'apply'],
  ];
  const scopedFiles = [
    ...files.filter((file) => file.startsWith('deploy/') && !file.startsWith('deploy/web-cloud/')),
    'scripts/security-scan.mjs',
  ];

  for (const file of unique(scopedFiles)) {
    if (!isTextFile(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const parts of commandParts) {
      const pattern = new RegExp(`${escapeRegExp(parts[0])}\\s+${escapeRegExp(parts[1])}`, 'i');
      if (pattern.test(text)) {
        failures.push(`${file} contains forbidden production mutation command ${parts.join(' ')}`);
      }
    }
  }
}

function checkDefaultPostgresRedisDependency() {
  // default PostgreSQL/Redis check: Webui examples may reference external MedOPL/Webui state, not vendor default data services.
  const scopedFiles = files.filter((file) =>
    file.startsWith('deploy/docker-compose.')
    || file === 'deploy/config.example.yaml'
    || file === 'deploy/.env.example'
    || file === 'package.json'
  );

  for (const file of scopedFiles) {
    if (!isTextFile(file)) continue;
    const text = readFileSync(file, 'utf8');
    if (/^\s*(postgres|redis):\s*$/im.test(text)) {
      failures.push(`${file} defines default PostgreSQL/Redis service ownership in Webui`);
    }
    if (/image:\s*(postgres|redis)(?:\s|:|$)/i.test(text)) {
      failures.push(`${file} vendors default PostgreSQL/Redis image in Webui deploy examples`);
    }
    if (/OPL_DATABASE_URL\s*[:=]\s*(postgres|postgresql|redis):\/\//i.test(text)) {
      failures.push(`${file} hardcodes default PostgreSQL/Redis URL instead of secret-managed external state`);
    }
  }
}

function checkCiStaysLocalOnly() {
  const ciPath = '.github/workflows/ci.yml';
  if (!existsSync(ciPath)) {
    failures.push('missing CI workflow');
    return;
  }
  const workflow = readFileSync(ciPath, 'utf8');
  if (/secrets\./i.test(workflow)) {
    failures.push('CI workflow references production secrets');
  }
  if (/cloud-rollout\.mjs|KUBECONFIG|TCR_PASSWORD|TCR_USERNAME/i.test(workflow)) {
    failures.push('CI workflow includes deploy or production credential surface');
  }
}

function isTextFile(file) {
  return existsSync(file) && !/\.(png|jpg|jpeg|gif|webp|ico|pdf|zip)$/i.test(file);
}

function stripComment(value) {
  return value.replace(/\s+#.*$/, '').replace(/\s+\\$/, '');
}

function isPlaceholder(value) {
  return /^<[^>]+>$/.test(value)
    || /^\$[A-Z0-9_]+$/i.test(value)
    || /^\$\{\{\s*secrets\.[A-Z0-9_]+\s*\}\}$/i.test(value)
    || /^["']?<[^>]+>["']?$/.test(value);
}

function unique(items) {
  return [...new Set(items)];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
