import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const runnerPath = 'tests/browser/public-growth-login-return-runner.mjs';

test('unauthenticated public task entry opens login and restores selected task after auth', { timeout: 180000 }, () => {
  const result = spawnSync(process.execPath, [runnerPath], {
    encoding: 'utf8',
    timeout: 170000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const evidence = JSON.parse(result.stdout.trim().split('\n').at(-1));

  assert.equal(evidence.ok, true);
  assert.equal(evidence.path, 'public-growth-login-return');
  assert.equal(evidence.pageStates.initialAuthState, 'anonymous');
  assert.equal(evidence.pageStates.accountPopoverOpenAfterTaskClick, true);
  assert.equal(evidence.pageStates.pendingPublicTaskIntent, 'grant_plan');
  assert.equal(evidence.pageStates.authStateAfterLogin, 'authenticated_unbound');
  assert.equal(evidence.pageStates.restoredTaskIntent, 'grant_plan');
  assert.equal(evidence.pageStates.restoredChatState, 'grant_entry_selected');
  assert.match(evidence.pageStates.restoredPrompt, /^@基金/);
  assert.equal(evidence.pageStates.focusReturnedToComposer, true);
  assert.deepEqual(evidence.cannotClaim, [
    'authenticated task success',
    'runtime execution',
    'artifact body authority',
    'full SaaS',
    'payment/team/RBAC/HA',
  ]);
});
