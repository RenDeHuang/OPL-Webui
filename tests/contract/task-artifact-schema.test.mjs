import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { TASK_STATUSES } from '../../packages/core/src/loops.mjs';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('task status constants stay aligned with task contract schema', () => {
  const schema = readJson('packages/contracts/opl/task-contract.schema.json');
  assert.deepEqual(TASK_STATUSES, schema.properties.status.enum);
});

test('artifact contract keeps source refs mandatory for traceability', () => {
  const schema = readJson('packages/contracts/opl/artifact-contract.schema.json');
  assert.ok(schema.required.includes('sourceRefs'));
  assert.equal(schema.properties.sourceRefs.minItems, 1);
});

test('MVP HTTP task contract requires tenant, workspace, and user boundary', () => {
  const schema = readJson('packages/contracts/opl/mvp-task-http.schema.json');
  assert.deepEqual(schema.required, ['tenantId', 'workspaceId', 'userId', 'prompt']);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.intent.enum, ['research', 'grant', 'presentation', 'general']);
});
