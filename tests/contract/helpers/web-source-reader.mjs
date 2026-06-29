import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const WEB_SOURCE_FILES = Object.freeze([
  'frontend/web/src/onePersonLabWeb.mjs',
  'frontend/web/src/onePersonLabWebState.mjs',
  'frontend/web/src/onePersonLabWebDom.mjs',
  'frontend/web/src/onePersonLabWebContinuation.mjs',
  ...collectFiles('frontend/web/src/surfaces', (path) => path.endsWith('.mjs')),
]);

export const WEB_RENDER_SOURCE_FILES = Object.freeze([
  'frontend/web/src/onePersonLabWebDom.mjs',
  'frontend/web/src/onePersonLabWebContinuation.mjs',
  ...collectFiles('frontend/web/src/surfaces', (path) => path.endsWith('.mjs')),
]);

export function readWebSource() {
  return WEB_SOURCE_FILES.map((path) => readFileSync(path, 'utf8')).join('\n');
}

export function readWebRenderSource() {
  return WEB_RENDER_SOURCE_FILES.map((path) => readFileSync(path, 'utf8')).join('\n');
}

export function readFrontendCss() {
  return readCssWithImports('frontend/web/styles.css', new Set());
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
