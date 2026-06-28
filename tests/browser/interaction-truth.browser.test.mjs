import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const runnerPath = 'tests/browser/interaction-truth-runner.mjs';

function collectViolations(evidence) {
  const forbiddenSidebarCopy = /v20文件夹|New project|(?:^|\b)opl(?:\b|$)|(?:^|\b)medopl(?:\b|$)|空项目|新建项目/;
  return [
    {
      label: '/ must render public growth landing',
      pass: evidence.routeTruth.publicLanding.locationPathname === '/'
        && evidence.routeTruth.publicLanding.publicLandingVisible
        && !evidence.routeTruth.publicLanding.workbenchVisible,
    },
    {
      label: '/login must render explicit login/register auth surface',
      pass: evidence.routeTruth.login.locationPathname === '/login'
        && evidence.routeTruth.login.authSurfaceVisible
        && !evidence.routeTruth.login.workbenchVisible,
    },
    {
      label: 'anonymous /home must not display fake authenticated workbench',
      pass: evidence.routeTruth.anonymousHome.locationPathname === '/home'
        && !evidence.routeTruth.anonymousHome.workbenchVisible
        && (evidence.routeTruth.anonymousHome.publicLandingVisible || evidence.routeTruth.anonymousHome.authSurfaceVisible),
    },
    {
      label: 'hash routes must not replace top-level /home route truth',
      pass: evidence.routeTruth.anonymousHome.locationHash === '',
    },
    {
      label: 'anonymous task click must save pending intent and open auth without auto-run',
      pass: evidence.afterTaskClick.pendingPublicTaskIntent === 'grant_plan'
        && evidence.afterTaskClick.authSurfaceVisible
        && evidence.afterTaskClick.chatState === 'grant_entry_selected'
        && evidence.afterTaskClick.taskHistoryItemCount === 0,
    },
    {
      label: 'login tab must not show register submit simultaneously',
      pass: evidence.afterTaskClick.loginVisible === true && evidence.afterTaskClick.registerVisible === false,
    },
    {
      label: 'after auth must restore pending task prompt without fabricated results',
      pass: evidence.afterAuth.authState === 'authenticated_unbound'
        && evidence.afterAuth.researchTaskIntent === 'grant_plan'
        && evidence.afterAuth.prompt.startsWith('@基金')
        && evidence.afterAuth.taskHistoryItemCount === 0,
    },
    {
      label: 'sidebar must use task history / deliverable continuation naming',
      pass: /任务历史|交付接续/.test(evidence.afterAuth.sidebarText),
    },
    {
      label: 'sidebar must not contain static Figma project copy',
      pass: !forbiddenSidebarCopy.test(evidence.afterAuth.sidebarText),
    },
    {
      label: 'cannot-claim boundary must include fake project/workspace data',
      pass: evidence.cannotClaim.includes('fake project/workspace data retired'),
    },
  ].flatMap(({ label, pass }) => (pass ? [] : [label]));
}

test('formal launch interaction truth is enforced by real browser evidence', { timeout: 220000 }, () => {
  const result = spawnSync(process.execPath, [runnerPath], {
    encoding: 'utf8',
    timeout: 210000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const evidence = JSON.parse(result.stdout.trim().split('\n').at(-1));

  assert.equal(evidence.ok, true);
  assert.equal(evidence.path, 'interaction-truth');
  assert.match(evidence.browser, /chrome|chromium/i);
  assert.deepEqual(collectViolations(evidence), []);
});
