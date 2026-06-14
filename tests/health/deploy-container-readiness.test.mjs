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
