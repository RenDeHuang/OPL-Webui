import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { WEB_SOURCE_FILES, readWebSource } from './helpers/web-source-reader.mjs';

test('web source is split into backend control plane and frontend shell boundaries', () => {
  const shell = JSON.parse(readFileSync('contracts/web-shell-adapter.json', 'utf8'));
  const surfaceInventory = JSON.parse(readFileSync('contracts/web-surface-inventory.json', 'utf8'));
  const inventoryPaths = new Set(surfaceInventory.surfaces.map((surface) => surface.path));

  assert.equal(shell.activeShell.sourceRoot, 'frontend/web');
  assert.equal(shell.activeShell.entryModule, 'frontend/web/src/app/main.mjs');
  assert.equal(existsSync('backend/control-plane-go/cmd/opl-webui-control-plane/main.go'), true);
  assert.equal(existsSync('frontend/web/src/app/main.mjs'), true);
  assert.equal(existsSync('frontend/web/src/product/publicContract.mjs'), true);
  assert.equal(inventoryPaths.has('frontend/web/src/app/main.mjs'), true);
  assert.equal(inventoryPaths.has('backend/control-plane-go/cmd/opl-webui-control-plane/main.go'), true);
  assert.equal(existsSync('apps/web'), false);
  assert.equal(existsSync('services/control-plane-go'), false);
});

test('product entry stays thin while implementation surfaces own rendering details', () => {
  const entry = readFileSync('frontend/web/src/app/main.mjs', 'utf8');
  const controller = readFileSync('frontend/web/src/app/shellController.mjs', 'utf8');
  const productContract = readFileSync('frontend/web/src/product/publicContract.mjs', 'utf8');
  const source = readWebSource();

  for (const path of WEB_SOURCE_FILES) assert.equal(existsSync(path), true, `missing frontend source: ${path}`);
  for (const surface of [
    'frontend/web/src/features/public-landing/publicAuthSurface.mjs',
    'frontend/web/src/features/workbench/workbenchSurface.mjs',
    'frontend/web/src/features/results/resultRuntimeSurface.mjs',
    'frontend/web/src/features/dialogs/dialogSurface.mjs',
    'frontend/web/src/features/continuation/continuationSurface.mjs',
  ]) assert.equal(existsSync(surface), true, `missing implementation surface: ${surface}`);

  assert.match(entry, /shellController\.mjs/);
  assert.doesNotMatch(entry, /querySelector|addEventListener|appendMessage|writeJSON|readJSON|providerFallback/);
  assert.ok(entry.split('\n').length <= 80, 'product entry should stay thin');
  assert.match(productContract, /controlPlaneClient\.mjs/);
  assert.match(productContract, /viewModel\.mjs/);
  assert.doesNotMatch(controller, /<section class="home-composer"|<div class="public-landing"|<aside class="account-popover"/);
  assert.match(source, /data-public-growth-layer/);
  assert.match(source, /data-workbench-surface/);
  assert.match(source, /data-results-surface/);
  assert.match(source, /data-api-key-dialog/);
  assert.equal(existsSync('frontend/web/src/onePersonLabWeb.mjs'), false, 'retire old aggregate product entry');
  assert.equal(existsSync('frontend/web/src/onePersonLabWebState.mjs'), false, 'retire old aggregate state module');
  assert.equal(existsSync('frontend/web/src/onePersonLabWebDom.mjs'), false, 'retire old aggregate DOM module');
  assert.equal(existsSync('frontend/web/src/onePersonLabWebContinuation.mjs'), false, 'retire old aggregate continuation module');
});
