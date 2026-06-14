import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const policyPath = path.resolve(__dirname, '../../contracts/opl/command-policy.json');

export function loadCommandPolicy() {
  return JSON.parse(fs.readFileSync(policyPath, 'utf8'));
}

function sameCommand(left, right) {
  return left.length === right.length && left.every((part, index) => part === right[index]);
}

function startsWithParts(command, prefix) {
  return command.length >= prefix.length && prefix.every((part, index) => part === command[index]);
}

export function evaluateCommand(command, policy = loadCommandPolicy()) {
  if (!Array.isArray(command) || command.some((part) => typeof part !== 'string' || part.length === 0)) {
    return {
      allowed: false,
      reason: 'command must be a non-empty string array'
    };
  }

  const deniedPrefix = policy.deniedPrefixes.find((prefix) => startsWithParts(command, prefix));
  if (deniedPrefix) {
    return {
      allowed: false,
      reason: `command matches denied prefix: ${deniedPrefix.join(' ')}`
    };
  }

  const allowed = policy.allowed.find((entry) => sameCommand(command, entry.command));
  if (!allowed) {
    return {
      allowed: false,
      reason: 'command is not in the MVP readonly allowlist'
    };
  }

  return {
    allowed: true,
    policyId: allowed.id,
    mode: allowed.mode,
    reason: allowed.reason
  };
}

export function listAllowedCommands(policy = loadCommandPolicy()) {
  return policy.allowed.map((entry) => ({
    id: entry.id,
    command: entry.command,
    mode: entry.mode,
    reason: entry.reason
  }));
}
