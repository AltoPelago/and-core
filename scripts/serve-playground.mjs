#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT ?? process.argv[2] ?? 4173);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
]);

function send(response, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, { 'content-type': contentType });
  response.end(body);
}

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, `http://localhost:${port}`);
  const pathname = url.pathname === '/' ? '/playground/' : url.pathname;
  const decoded = decodeURIComponent(pathname);
  const resolved = path.resolve(repoRoot, `.${decoded}`);

  if (resolved !== repoRoot && !resolved.startsWith(`${repoRoot}${path.sep}`)) {
    return null;
  }

  if (resolved.includes(`${path.sep}.git${path.sep}`)) {
    return null;
  }

  return decoded.endsWith('/') ? path.join(resolved, 'index.html') : resolved;
}

const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    send(response, 405, 'Method not allowed\n');
    return;
  }

  const filePath = resolveRequestPath(request.url ?? '/');
  if (filePath === null) {
    send(response, 403, 'Forbidden\n');
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      send(response, 404, 'Not found\n');
      return;
    }

    const contentType = contentTypes.get(path.extname(filePath)) ?? 'application/octet-stream';
    response.writeHead(200, { 'content-type': contentType });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error.code === 'ENOENT') {
      send(response, 404, 'Not found\n');
      return;
    }

    send(response, 500, 'Internal server error\n');
  }
});

server.listen(port, () => {
  console.log(`&ND playground listening on http://localhost:${port}/playground/`);
});
