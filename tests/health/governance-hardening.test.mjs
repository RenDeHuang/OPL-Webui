import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const coreDocs = [
  'TASTE.md',
  'docs/project.md',
  'docs/status.md',
  'docs/architecture.md',
  'docs/invariants.md',
  'docs/decisions.md',
  'docs/docs_portfolio_consolidation.md',
];

test('repository governance exposes OPL-style lifecycle surfaces', () => {
  for (const file of coreDocs) {
    assert.equal(existsSync(file), true, `missing governance surface: ${file}`);
  }

  const agents = readFileSync('AGENTS.md', 'utf8');
  for (const required of [
    '`AGENTS.md` 只约束工作方式',
    'TASTE.md',
    '文档生命周期',
    '代码清退',
    '测试登记',
    '机器 gate',
    '不得保留无 consumer 的兼容层',
    '每次正式变更必须同步清退',
    '理想态优先',
    '旧实现只能作为迁移输入',
    '不保留兼容污染',
    '进入 code、docs、contracts、tests、scripts、deploy、specs 或 API 行为变更',
    '独立 worktree',
    'subagent',
    'Plan Completion Audit',
  ]) {
    assert.match(agents, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('documentation portfolio defines lightweight OPL-inspired taxonomy', () => {
  const portfolio = readFileSync('docs/docs_portfolio_consolidation.md', 'utf8');

  for (const required of [
    'Lightweight OPL-Inspired Taxonomy',
    'docs/product/',
    'docs/runtime/',
    'docs/policies/',
    'contracts/',
    '不要复制 one-person-lab 的目录体量',
    '只在出现稳定 machine-readable API、DTO、allowlist 或 schema 时新增',
  ]) {
    assert.match(portfolio, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('long-lived docs declare owner purpose state and machine boundary', () => {
  for (const file of coreDocs.filter((path) => path.startsWith('docs/'))) {
    const text = readFileSync(file, 'utf8');
    for (const required of ['owner:', 'purpose:', 'state:', 'machine boundary:']) {
      assert.match(text, new RegExp(required), `${file} missing ${required}`);
    }
  }
});

test('retired vocabulary guard is tracked as a health gate', () => {
  assert.equal(existsSync('tests/health/stale-retirement-guard.test.mjs'), true);

  const registry = readFileSync('scripts/test-classification.mjs', 'utf8');
  assert.match(registry, /tests\/health\/governance-hardening\.test\.mjs/);
  assert.match(registry, /tests\/health\/stale-retirement-guard\.test\.mjs/);
});
