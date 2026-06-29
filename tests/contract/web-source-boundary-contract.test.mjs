import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { WEB_SOURCE_FILES, readWebSource } from './helpers/web-source-reader.mjs';

test('web source is split into backend control plane and frontend shell boundaries', () => {
  const shell = JSON.parse(readFileSync('contracts/web-shell-adapter.json', 'utf8'));
  const surfaceInventory = JSON.parse(readFileSync('contracts/web-surface-inventory.json', 'utf8'));
  const inventoryPaths = new Set(surfaceInventory.surfaces.map((surface) => surface.path));

  assert.equal(shell.activeShell.sourceRoot, 'frontend/web');
  assert.equal(shell.activeShell.entryModule, 'frontend/web/src/onePersonLabWeb.mjs');
  assert.equal(existsSync('backend/control-plane-go/cmd/opl-webui-control-plane/main.go'), true);
  assert.equal(existsSync('frontend/web/src/onePersonLabWeb.mjs'), true);
  assert.equal(inventoryPaths.has('frontend/web/src/onePersonLabWeb.mjs'), true);
  assert.equal(inventoryPaths.has('backend/control-plane-go/cmd/opl-webui-control-plane/main.go'), true);
  assert.equal(existsSync('apps/web'), false);
  assert.equal(existsSync('services/control-plane-go'), false);
});

test('product entry stays thin while implementation surfaces own rendering details', () => {
  const entry = readFileSync('frontend/web/src/onePersonLabWeb.mjs', 'utf8');
  const dom = readFileSync('frontend/web/src/onePersonLabWebDom.mjs', 'utf8');
  const source = readWebSource();

  for (const path of WEB_SOURCE_FILES) assert.equal(existsSync(path), true, `missing frontend source: ${path}`);
  for (const surface of [
    'frontend/web/src/surfaces/publicAuthSurface.mjs',
    'frontend/web/src/surfaces/workbenchSurface.mjs',
    'frontend/web/src/surfaces/resultRuntimeSurface.mjs',
    'frontend/web/src/surfaces/dialogSurface.mjs',
  ]) assert.equal(existsSync(surface), true, `missing implementation surface: ${surface}`);

  assert.match(entry, /onePersonLabWebState\.mjs/);
  assert.match(entry, /onePersonLabWebDom\.mjs/);
  assert.doesNotMatch(entry, /querySelector|addEventListener|appendMessage|writeJSON|readJSON|providerFallback/);
  assert.ok(entry.split('\n').length <= 80, 'product entry should stay thin');
  assert.doesNotMatch(dom, /<section class="home-composer"|<div class="public-landing"|<aside class="account-popover"/);
  assert.match(source, /data-public-growth-layer/);
  assert.match(source, /data-workbench-surface/);
  assert.match(source, /data-results-surface/);
  assert.match(source, /data-api-key-dialog/);
});
