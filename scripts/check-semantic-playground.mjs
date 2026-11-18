import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { createServer } from 'node:http';
import { bootstrap, executeSemanticRequest, handleSemanticApi } from './semantic-playground-api.mjs';

const sample = await bootstrap();
test('playground converts both ways with the real bridge and runtime', async () => {
  const forward = await executeSemanticRequest('convert', { direction: 'to-aeon', source: sample.and });
  assert.equal(forward.verified, true);
  assert.match(forward.aeon, /state=\|unchecked\|/);
  const backward = await executeSemanticRequest('convert', {
    direction: 'to-and', source: forward.aeon.replace('"Field guide "', '"Changed title "'),
  });
  assert.match(backward.and, /Changed title/);
  assert.equal(backward.verified, true);
});
test('playground queries edited Aeon, supports source-free documents, and returns diagnostics', async () => {
  const source = 'doc=<document@{vocabulary="and-document-semantic-example-2"}(<heading@{level=2}("Native")>)>';
  const result = await executeSemanticRequest('query', { source, query: sample.queries[1].query });
  assert.equal(result.ok, true);
  assert.equal(result.results.length, 1);
  const bad = await executeSemanticRequest('query', { source, query: 'from' });
  assert.equal(bad.ok, false);
  await assert.rejects(executeSemanticRequest('convert', { direction: 'to-and', source: 'broken' }));
  await assert.rejects(executeSemanticRequest('convert', { direction: 'invalid', source: sample.and }));
  await assert.rejects(executeSemanticRequest('query', { source, query: '' }));
  await assert.rejects(executeSemanticRequest('query', { source: 'a'.repeat(262_145), query: 'from $ select .' }));
});
test('semantic page is discoverable and uses the API without rendering user query data as HTML', async () => {
  const parent = await fs.readFile(new URL('../playground/index.html', import.meta.url), 'utf8');
  const html = await fs.readFile(new URL('../playground/semantic/index.html', import.meta.url), 'utf8');
  const app = await fs.readFile(new URL('../playground/semantic/app.mjs', import.meta.url), 'utf8');
  assert.ok(parent.includes('href="./semantic/"'));
  for (const id of ['and-source', 'aeon-source', 'query', 'query-preset', 'results', 'to-aeon', 'to-and', 'run-query']) {
    assert.ok(html.includes(`id="${id}"`));
  }
  assert.ok(app.includes('ui.results.textContent = JSON.stringify'));
  assert.ok(!app.includes('.innerHTML'));
});

// HTTP tests run only when requested; pure/runtime tests need no listening socket.
if (process.argv.includes('--http')) {
  test('HTTP API serves bootstrap, handles POST, and rejects malformed and cross-origin requests', async () => {
    const server = createServer((req, res) => handleSemanticApi(req, res, new URL(req.url, 'http://localhost').pathname));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/semantic`;
    try {
      assert.equal((await fetch(`${url}/bootstrap`)).status, 200);
      const result = await fetch(`${url}/convert`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ direction: 'to-aeon', source: sample.and }) });
      assert.equal((await result.json()).verified, true);
      const malformed = await fetch(`${url}/convert`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
      assert.equal(malformed.status, 400);
      const crossOrigin = await fetch(`${url}/convert`, { method: 'POST', headers: { origin: 'https://example.com', 'content-type': 'application/json' }, body: '{}' });
      assert.equal(crossOrigin.status, 403);
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });
}
