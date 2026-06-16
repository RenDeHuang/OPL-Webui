import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('container deploy entrypoint builds the Go control plane only', () => {
  assert.equal(existsSync('Dockerfile'), true);

  const dockerfile = readFileSync('Dockerfile', 'utf8');
  assert.match(dockerfile, /FROM golang:1\.22-alpine AS builder/);
  assert.match(dockerfile, /go build .*\.\/services\/control-plane-go\/cmd\/opl-webui-control-plane/);
  assert.match(dockerfile, /COPY --from=builder .*\/opl-webui-control-plane/);
  assert.match(dockerfile, /COPY apps\/web apps\/web/);
  assert.match(dockerfile, /ENV HOST=0\.0\.0\.0/);
  assert.match(dockerfile, /ENV OPL_CLI_PATH=\/opt\/opl\/bin\/opl/);
  assert.match(dockerfile, /EXPOSE 4173/);
  assert.match(dockerfile, /HEALTHCHECK .*127\.0\.0\.1:\$\{PORT\}\/healthz/);
  assert.doesNotMatch(dockerfile, /npm install|node /);
  assert.doesNotMatch(dockerfile, /apk add/);
  assert.doesNotMatch(dockerfile, /one-person-lab/);
  assert.doesNotMatch(dockerfile, /COPY .*\/opt\/opl\/bin\/opl/);
});

test('cloud image recipe materializes OPL CLI into the runtime path', () => {
  assert.equal(existsSync('Dockerfile.cloud'), true);
  assert.equal(existsSync('.dockerignore.cloud'), true);

  const dockerfile = readFileSync('Dockerfile.cloud', 'utf8');
  assert.match(dockerfile, /FROM golang:1\.22-alpine AS builder/);
  assert.match(dockerfile, /FROM node:22-bookworm-slim AS opl-build/);
  assert.match(dockerfile, /FROM node:22-bookworm-slim AS runtime/);
  assert.doesNotMatch(dockerfile, /FROM node:22-alpine AS (?:opl-build|runtime)/);
  assert.doesNotMatch(dockerfile, /COPY --from=\$\{/);
  assert.match(dockerfile, /COPY --from=opl \/bin\/opl \/opt\/opl\/bin\/opl/);
  assert.doesNotMatch(dockerfile, /COPY --from=opl \/dist /);
  assert.match(dockerfile, /COPY --from=opl-build \/src\/dist \/opt\/opl\/dist/);
  assert.match(dockerfile, /npm prune --omit=dev --ignore-scripts/);
  assert.match(dockerfile, /COPY --from=opl-build \/src\/package-lock\.json \/opt\/opl\/package-lock\.json/);
  assert.match(dockerfile, /COPY --from=opl-build \/src\/node_modules \/opt\/opl\/node_modules/);
  assert.doesNotMatch(dockerfile, /COPY --from=opl-build \/src\/node_modules\/@temporalio\/common\b/);
  assert.match(dockerfile, /COPY --from=opl \/contracts\/opl-framework \/opt\/opl\/contracts\/opl-framework/);
  assert.doesNotMatch(dockerfile, /COPY --from=opl \/contracts\/opl-gateway\b/);
  assert.match(dockerfile, /npm run build/);
  assert.match(dockerfile, /RUN chmod \+x \/opt\/opl\/bin\/opl/);
  assert.match(dockerfile, /ENV OPL_CLI_PATH=\/opt\/opl\/bin\/opl/);
  assert.match(dockerfile, /CMD \["\/app\/opl-webui-control-plane"\]/);
  assert.doesNotMatch(dockerfile, /OPL_DATABASE_URL|PGPASSWORD|kubectl|kubeconfig/i);

  const dockerignore = readFileSync('.dockerignore.cloud', 'utf8');
  for (const required of ['*', '!Dockerfile.cloud', '!go.work', '!services/control-plane-go/**', '!apps/web/**']) {
    assert.ok(dockerignore.includes(required), `.dockerignore.cloud must include ${required}`);
  }
  assert.doesNotMatch(dockerignore, /^!opl/m);
  assert.doesNotMatch(dockerignore, /^!opl\/src/m);
  assert.doesNotMatch(dockerignore, /^!opl\/node_modules/m);
});

test('docker build context excludes runtime bloat', () => {
  assert.equal(existsSync('.dockerignore'), true);

  const dockerignore = readFileSync('.dockerignore', 'utf8');
  const ignored = dockerignore
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const required of ['*', '!.dockerignore', '!Dockerfile', '!go.work', '!services', '!services/control-plane-go', '!services/control-plane-go/**', '!apps', '!apps/web', '!apps/web/**']) {
    assert.ok(ignored.includes(required), `.dockerignore must include ${required}`);
  }

  assert.doesNotMatch(dockerignore, /^!docs/m);
  assert.doesNotMatch(dockerignore, /^!tests/m);
  assert.doesNotMatch(dockerignore, /^!changes/m);
});
