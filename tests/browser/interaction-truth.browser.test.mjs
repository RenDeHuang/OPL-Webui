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
      label: 'authenticated workbench shell must carry Figma home slice marker',
      pass: evidence.afterAuth.workbenchSlice === 'figma_home_workbench_shell_slice',
    },
    {
      label: 'authenticated workbench sidebar must follow Figma 240px side navigation shape',
      pass: evidence.afterAuth.workbench.sidebarVisible === true && evidence.afterAuth.workbench.sidebarWidth === 240,
    },
    {
      label: 'authenticated workbench composer must remain centered with toolbar',
      pass: evidence.afterAuth.workbench.composerVisible === true
        && evidence.afterAuth.workbench.composerCentered === true
        && evidence.afterAuth.workbench.composerMaxWidth <= 680
        && evidence.afterAuth.workbench.toolbarVisible === true,
    },
    {
      label: 'authenticated workbench task launchers and pending prompt must stay real-state backed',
      pass: evidence.afterAuth.workbench.taskLauncherCount === 7
        && evidence.afterAuth.workbench.promptRestored === true
        && evidence.afterAuth.workbench.taskHistoryProjectionOnly === true,
    },
    {
      label: 'authenticated workbench search and account triggers must remain available',
      pass: evidence.afterAuth.workbench.accountTriggerVisible === true
        && evidence.afterAuth.workbench.searchTriggerVisible === true,
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

test('interaction truth runner lets Chromium allocate the DevTools port in CI', () => {
  const runner = String(spawnSync('node', ['-e', `console.log(require('node:fs').readFileSync(${JSON.stringify(runnerPath)}, 'utf8'))`], {
    encoding: 'utf8',
  }).stdout);

  assert.match(runner, /--remote-debugging-port=0/);
  assert.match(runner, /DevTools listening on/);
  assert.match(runner, /browserStartupError/);
  assert.doesNotMatch(runner, /`--remote-debugging-port=\$\{port\}`/);
});
