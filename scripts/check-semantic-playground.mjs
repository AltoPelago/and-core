import './check-semantic-highlighting.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { highlight, highlightAnd, highlightSansa } from '../playground/semantic/highlighting.mjs';
import { loadAeon } from '../examples/v2-aeon-roundtrip/aeon-runtime.mjs';
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
  assert.ok(app.includes('showQueryResult()'));
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
      const converted = await result.json();
      assert.equal(converted.verified, true);
      const query = await fetch(`${url}/query`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: converted.aeon, query: sample.queries[0].query }) });
      const queried = await query.json();
      assert.equal(queried.ok, true);
      assert.match(queried.aeon, /level = 1/);
      const malformed = await fetch(`${url}/convert`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
      assert.equal(malformed.status, 400);
      const crossOrigin = await fetch(`${url}/convert`, { method: 'POST', headers: { origin: 'https://example.com', 'content-type': 'application/json' }, body: '{}' });
      assert.equal(crossOrigin.status, 403);
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });
}


test('highlighting preserves exact source text and escapes markup in all three languages', () => {
  const text = (html) => html.replace(/<[^>]+>/g, '').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  const sources = {
    and: '&ND v2\n\n# Heading\n\n- [x] [= Rich] [~ image.png | alt] [:date = 2026-08-20] <img onerror="bad">\n',
    aeon: 'doc=<document@{name="<img onerror=bad>"}(<todo_item@{state=|unchecked|}>)>',
    sansa: 'from $.doc.**%NodeHead where . == "todo_item" and .@.state == |unchecked| select .',
  };
  for (const [language, source] of Object.entries(sources)) {
    const html = highlight(source, language);
    assert.equal(text(html), source);
    assert.match(html, /class="tok-/);
    assert.ok(!html.includes('<img'));
  }
  assert.match(highlightAnd('~~~$ js\nconst x = "<script>";\n~~~$\n'), /tok-string/);
  assert.match(highlightSansa('from $.x select "from"'), /tok-keyword">from/);
  assert.match(highlightSansa('from $.x select "from"'), /tok-string">"from"/);
});

test('SANSA results are parseable AEON with native projections and selected subtrees', async () => {
  const runtime = await loadAeon();
  const forward = await executeSemanticRequest('convert', { direction: 'to-aeon', source: sample.and });
  for (const preset of sample.queries) {
    const result = await executeSemanticRequest('query', { source: forward.aeon, query: preset.query });
    assert.equal(result.ok, true, preset.name);
    assert.match(result.aeon, /^results = \[/);
    const parsed = runtime.parse(runtime.tokenize(result.aeon).tokens);
    assert.equal(parsed.errors.length, 0, `${preset.name}: ${JSON.stringify(parsed.errors)}`);
  }
  const result = await executeSemanticRequest('query', { source: forward.aeon, query: sample.queries[0].query });
  assert.match(result.aeon, /level = 1/);
  assert.doesNotMatch(result.aeon, /level = "1"/);
  const states = await executeSemanticRequest('query', { source: forward.aeon, query: 'from $.doc.**%NodeHead where . == "todo_item" select { state = .@.state }' });
  assert.match(states.aeon, /state = \|unchecked\|/);
  const dates = await executeSemanticRequest('query', { source: forward.aeon, query: 'from $.doc.**%NodeHead where . == "typed_value" select .@.value' });
  assert.match(dates.aeon, /value:date = 2026-08-20/);
});

test('Aeon query output preserves numeric precision, Unicode spans, null reasons, non-finite values and symbols', async () => {
  const source = 'label="🪶 café"\nvalues={ huge:number=9007199254740993123456789, when:date=2026-08-20, state=|in_progress|, absent:null<string>=!notSet, nan=NaN, infinity=-Infinity }';
  const native = await executeSemanticRequest('query', { source, query: 'from $.values.* select .' });
  assert.match(native.aeon, /9007199254740993123456789/);
  assert.match(native.aeon, /value:null<string> = !notSet/);
  assert.match(native.aeon, /value = NaN/);
  assert.match(native.aeon, /value = -Infinity/);
  assert.match(native.aeon, /value = \|in_progress\|/);
  const projected = await executeSemanticRequest('query', { source, query: 'from $.values select { number = .huge state = .state when = .when }' });
  assert.match(projected.aeon, /number = 9007199254740993123456789/);
  assert.match(projected.aeon, /state = \|in_progress\|/);
  assert.match(projected.aeon, /when = 2026-08-20/);
});


test('both result views use a list envelope for the footnote text', async () => {
  const forward = await executeSemanticRequest('convert', { direction: 'to-aeon', source: sample.and });
  const query = 'from $.doc.**%NodeHead where . == "footnote_definition" select .**';
  const result = await executeSemanticRequest('query', { source: forward.aeon, query });
  assert.equal(result.aeonValues, 'results = [\n  "a reusable footnote"\n]\n');
  assert.equal(result.valueCount, 1);
  assert.equal(result.resultFormat, 'and-query-results-v1');
  assert.match(result.aeon, /address = /);
  assert.match(result.aeon, /kind = "StringLiteral"/);
  assert.match(result.aeon, /value = "a reusable footnote"/);
  const scalar = await executeSemanticRequest('query', { source: forward.aeon, query: 'from $.doc.**%NodeHead where . == "footnote_definition" select concat(.**%StringLiteral, "")' });
  assert.equal(scalar.aeonValues, result.aeonValues);
});

test('values-only output preserves native values, empty results, and intrinsic object fields', async () => {
  const source = 'data={n:number=9007199254740993123456789, state=|unchecked|, when:date=2026-08-20}\nitem={address="home",kind=|note|,value=1}';
  const result = await executeSemanticRequest('query', { source, query: 'from $.data.* select .' });
  assert.match(result.aeonValues, /9007199254740993123456789/);
  assert.match(result.aeonValues, /\|unchecked\|/);
  assert.match(result.aeonValues, /:date = 2026-08-20/);
  const runtime = await loadAeon();
  assert.equal(runtime.parse(runtime.tokenize(result.aeonValues).tokens).errors.length, 0);
  const item = await executeSemanticRequest('query', { source, query: 'from $.item select .' });
  assert.equal(item.aeonValues, 'results = [\n  {address="home",kind=|note|,value=1}\n]\n');
  const empty = await executeSemanticRequest('query', { source, query: 'from $.missing.* select .' });
  assert.equal(empty.aeonValues, 'results = []\n');
  const grouped = await executeSemanticRequest('query', { source: 'groups=[["a","b"],["c"]]', query: 'from $.groups.* select .*' });
  assert.equal(grouped.results.length, 2);
  assert.equal(grouped.aeonValues, 'results = [\n  "a",\n  "b",\n  "c"\n]\n');
  assert.equal(grouped.valueCount, 3);
});


test('result cardinality is stable across zero, one and many matches, including actual list values', async () => {
  const runtime = await loadAeon();
  const source = 'groups=[[],["a"],["b","c"]]';
  for (const [query, count] of [
    ['from $.missing select .', 0],
    ['from $.groups[1][0] select .', 1],
    ['from $.groups.* select .*', 3],
    ['from $.groups.* select .', 3],
    ['from $.groups.* select "constant"', 3],
  ]) {
    const result = await executeSemanticRequest('query', { source, query });
    assert.equal(result.ok, true, query);
    assert.equal(result.valueCount, count, query);
    for (const output of [result.aeon, result.aeonValues]) {
      const parsed = runtime.parse(runtime.tokenize(output).tokens);
      assert.equal(parsed.errors.length, 0, output);
      const list = parsed.document.bindings[0].value;
      assert.equal(list.type, 'ListNode');
      assert.equal(list.elements.length, count, output);
    }
    if (query === 'from $.groups.* select .') assert.match(result.aeonValues, /\[\],/);
  }
});

test('document cookbook queries assert expected content and both outputs parse as standalone AEON', async () => {
  const runtime = await loadAeon();
  const cookbook = await fs.readFile(new URL('../examples/v2-aeon-roundtrip/QUERIES.md', import.meta.url), 'utf8');
  const { aeon: source } = await executeSemanticRequest('convert', { direction: 'to-aeon', source: sample.and });
  for (const preset of sample.queries) {
    assert.ok(preset.description, preset.name);
    assert.ok(cookbook.includes(preset.description), preset.name);
    assert.ok(cookbook.includes(preset.query.replace(' where ', '\nwhere ').replace(' select ', '\nselect ')), preset.name);
    const result = await executeSemanticRequest('query', { source, query: preset.query });
    assert.equal(result.ok, true, `${preset.name}: ${JSON.stringify(result.errors)}`);
    if (preset.exampleCandidateCount !== undefined) assert.equal(result.candidateCount, preset.exampleCandidateCount, preset.name);
    for (const output of [result.aeon, result.aeonValues]) {
      const { document, errors } = runtime.parse(runtime.tokenize(output).tokens);
      assert.equal(errors.length, 0, `${preset.name}: ${JSON.stringify(errors)}`);
      assert.equal(document.bindings[0].value.elements.length, result.valueCount, preset.name);
    }
    const expected = {
      'Heading text': ['Field guide ', 'Details '],
      'Footnote text': ['a reusable footnote'],
      'Anchor IDs': ['guide', 'details'],
      'Table cell text': ['Feature', 'Status', 'Nodes', 'Preserved'],
    }[preset.name];
    if (expected) {
      const parsed = runtime.parse(runtime.tokenize(result.aeonValues).tokens);
      assert.deepEqual(parsed.document.bindings[0].value.elements.map((item) => item.value), expected, preset.name);
    }
  }
});

test('derived native projections use the public metadata API with no private property access', async () => {
  const source = await fs.readFile(new URL('./semantic-query-output.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /__sansa|Object\.getOwnPropertyDescriptor/);
  const runtime = await loadAeon();
  let scalarCalls = 0, objectCalls = 0;
  const engine = { ...runtime,
    getQueryValueMetadata(value) { scalarCalls++; return runtime.getQueryValueMetadata(value); },
    getQueryObjectFieldMetadata(value) { objectCalls++; return runtime.getQueryObjectFieldMetadata(value); },
  };
  const result = await executeSemanticRequest('query', { source: 'x=1', query: 'from $.x select { n = 9007199254740993123456789 state = |checked| nested = { day = 2026-08-20 } reason = !notSet }' }, engine);
  assert.equal(result.ok, true);
  assert.match(result.aeonValues, /n = 9007199254740993123456789/);
  assert.match(result.aeonValues, /state = \|checked\|/);
  assert.match(result.aeonValues, /day = 2026-08-20/);
  assert.match(result.aeonValues, /reason = !notSet/);
  assert.ok(scalarCalls && objectCalls);
});
