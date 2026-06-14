#!/usr/bin/env node
import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMvpTaskResponse } from './mvpTaskHandler.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const webRoot = path.join(repoRoot, 'apps/web');

const contentTypes = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
});

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function staticFilePath(urlPath) {
  const pathname = urlPath === '/' ? '/index.html' : urlPath;
  const resolved = path.resolve(webRoot, `.${pathname}`);
  if (!resolved.startsWith(webRoot)) return null;
  return resolved;
}

async function handleMvpTask(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { ok: false, errorCode: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    const payload = await readJsonBody(request);
    sendJson(response, 200, await createMvpTaskResponse(payload));
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      errorCode: 'INVALID_MVP_TASK_REQUEST',
      message: error.message,
    });
  }
}

function handleStatic(request, response) {
  const filePath = staticFilePath(new URL(request.url, 'http://localhost').pathname);
  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const extension = path.extname(filePath);
  response.writeHead(200, {
    'content-type': contentTypes[extension] ?? 'application/octet-stream',
  });
  createReadStream(filePath).pipe(response);
}

export function createMvpHttpServer() {
  return createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/api/mvp/task') {
      handleMvpTask(request, response);
      return;
    }

    handleStatic(request, response);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  createMvpHttpServer().listen(port, () => {
    console.log(`OPL WebUI MVP listening on http://127.0.0.1:${port}`);
  });
}
