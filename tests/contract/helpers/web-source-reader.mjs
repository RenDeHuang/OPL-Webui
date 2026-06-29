import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const WEB_CSS_ENTRY = 'frontend/web/styles.css';
export const WEB_CSS_SOURCE_FILES = Object.freeze([
  WEB_CSS_ENTRY,
  ...collectFiles('frontend/web/styles', (path) => path.endsWith('.css')),
]);

export const WEB_SOURCE_FILES = Object.freeze([
  'frontend/web/src/app/main.mjs',
  'frontend/web/src/app/shellController.mjs',
  'frontend/web/src/api/controlPlaneClient.mjs',
  'frontend/web/src/product/catalog.mjs',
  'frontend/web/src/product/publicContract.mjs',
  'frontend/web/src/state/viewModel.mjs',
  ...collectFiles('frontend/web/src/features', (path) => path.endsWith('.mjs')),
]);

export const WEB_RENDER_SOURCE_FILES = Object.freeze([
  'frontend/web/src/app/shellController.mjs',
  ...collectFiles('frontend/web/src/features', (path) => path.endsWith('.mjs')),
]);

export function readWebSource() {
  return WEB_SOURCE_FILES.map((path) => readFileSync(path, 'utf8')).join('\n');
}

export function readWebRenderSource() {
  return WEB_RENDER_SOURCE_FILES.map((path) => readFileSync(path, 'utf8')).join('\n');
}

export function readFrontendCss() {
  return readCssWithImports(WEB_CSS_ENTRY, new Set());
}

export function readCssSource(path) {
  return readFileSync(path, 'utf8');
}

function readCssWithImports(path, seen) {
  if (seen.has(path)) return '';
  seen.add(path);
  const source = readFileSync(path, 'utf8');
  const imports = [...source.matchAll(/@import\s+["']([^"']+)["'];/g)]
    .map((match) => join(path.split('/').slice(0, -1).join('/'), match[1]));
  return [source, ...imports.map((importPath) => readCssWithImports(importPath, seen))].join('\n');
}

function collectFiles(dir, predicate) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return collectFiles(path, predicate);
      return entry.isFile() && predicate(path) ? [path] : [];
    })
    .sort();
}
