import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
  assert.match(helper, /https:\/\/opl\.medopl\.cn\/healthz/);
  assert.match(helper, /https:\/\/opl\.medopl\.cn\/readyz/);
  assert.match(helper, /https:\/\/opl\.medopl\.cn\//);
  assert.match(helper, /dryRun/);
  assert.doesNotMatch(helper, /OPL_DATABASE_URL|PGPASSWORD|qcloud_cert_id|AKID[A-Za-z0-9]+/);
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
  assert.match(helper, /jsonpath=\{\.items\[0\]\.metadata\.name\}/);
  assert.match(helper, /'wide'/);
});
