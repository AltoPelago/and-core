import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { parseAnd, emitCanonical } from '../../index.mjs';
import { toAeon, fromAeon, normalizeAeon, profile } from './bridge.mjs';
import { queryDocument } from './queries.mjs';
import { loadAeon } from './aeon-runtime.mjs';

const runtime = await loadAeon();
// Compare native AES-backed values/topology without source spans, origins,
// locators, inferred type-declaration spelling, or original parser AST objects.
function aesSnapshot(source) {
  const { namespace } = runtime.readAeonNamespace(source);
  function snapshot(binding) {
    const result = {};
    for (const key of ['name', 'representationKind', 'nodeTag', 'semanticType', 'datatype',
      'generics', 'clarifiers', 'scalarKind', 'nullReason', 'value']) {
      if (binding[key] !== undefined) result[key] = binding[key];
    }
    result.children = binding.children.map(snapshot);
    if (binding.attributeSpace) {
      result.attributes = binding.attributeSpace.children.map(snapshot).sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }
  return snapshot(namespace.root);
}

const semanticSnapshot = (source) => aesSnapshot(normalizeAeon(source, runtime));

const normalizedAst = (source) => {
  const parsed = parseAnd(source, { allowV2: true });
  assert.equal(parsed.ok, true);
  return parseAnd(emitCanonical(parsed.document, { profile: 'standalone', version: 'v2' }), { allowV2: true }).document;
};
const read = (file) => fs.readFile(new URL(file, import.meta.url), 'utf8');
const contract = JSON.parse(await read('../../cts/contracts/v2-projection-v1.json'));

for (const entry of contract.cases) {
  test(`v2 structure and canonical fixed point: ${entry.id}`, () => {
    const original = parseAnd(entry.source, { allowV2: true });
    assert.equal(original.ok, true);
    const aeon = toAeon(entry.source);
    assert.doesNotMatch(aeon, /^\s*<(?:children|items|record|array)(?:@|\()/m);
    assert.doesNotMatch(aeon, /shape:string=/);
    assert.doesNotMatch(aeon, /<text(?:@|\(|>)/);
    assert.doesNotMatch(aeon, /<[a-z_]+_tag(?:@|\(|>)/);
    assert.doesNotMatch(aeon, /<(?:datatype|[A-Za-z]+Literal)(?:@|\()/);
    const restored = fromAeon(aeon, runtime);
    assert.equal(restored.version, 'v2');
    assert.deepEqual(restored.document, normalizedAst(entry.source));
    assert.equal(restored.canonical, entry.expected.canonical.standalone);
    // Canonical soft-wrap normalization may change text whitespace once.
    const canonicalAst = parseAnd(restored.canonical, { allowV2: true });
    assert.equal(canonicalAst.ok, true);
    assert.equal(emitCanonical(canonicalAst.document, { profile: 'standalone', version: 'v2' }), restored.canonical);
    const again = toAeon(restored.canonical);
    assert.deepEqual(fromAeon(again, runtime).document, canonicalAst.document);
    assert.deepEqual(aesSnapshot(again), aesSnapshot(aeon));
    assert.equal(normalizeAeon(normalizeAeon(aeon, runtime), runtime), normalizeAeon(aeon, runtime));
  });
}

test('checked-in outputs reproduce exactly', async () => {
  const aeon = toAeon(await read('./input.and'));
  assert.equal(aeon, await read('./document.aeon'));
  assert.equal(fromAeon(aeon, runtime).canonical, await read('./roundtrip.and'));
});

test('round-trips quoted SANSA selectors through a typed value', () => {
  for (const address of ['$.["some key"]', '$.["a=b, c"]']) {
    const shorthand = `&ND v2\n\n[: ${address}]\n`;
    const explicit = `&ND v2\n\n[:sansa = ${address}]\n`;
    assert.equal(fromAeon(toAeon(shorthand), runtime).canonical, explicit);
    assert.equal(fromAeon(toAeon(explicit), runtime).canonical, explicit);
  }
});

test('AEON edits flow back into &ND without original source', () => {
  const aeon = toAeon('&ND v2\n\n# Before\n');
  assert.equal(fromAeon(aeon.replace('"Before"', '"After"'), runtime).canonical,
    '&ND v2\n\n# After\n');
});

test('normalizes soft wraps while preserving Unicode and opaque payloads', () => {
  const source = '&ND v2\n\nCafé 🪶 and "quotes".\nA second line.\n\n~~~$\n\\path\\file "quoted"\n~~~$\n';
  const original = parseAnd(source, { allowV2: true });
  assert.equal(original.ok, true);
  assert.deepEqual(fromAeon(toAeon(source), runtime).document, normalizedAst(source));
});

test('rejects malformed source, unsupported profile/version, and broken document links', () => {
  assert.throws(() => toAeon('&ND v1\n\nHello\n'), /requires &ND v2/);
  assert.throws(() => toAeon('&ND v2\n\n[@ #missing | broken]\n'), /Invalid &ND/);
  const aeon = toAeon('&ND v2\n\n[# target][@ #target | go]\n');
  assert.throws(() => fromAeon('<', runtime), /Invalid AEON/);
  assert.throws(() => fromAeon(aeon.replace('and-document-semantic-example-2', 'unknown'), runtime), /Unsupported/);
  assert.throws(() => fromAeon(aeon.replace('and_version = "v2"', 'and_version = "v1"'), runtime), /Unsupported/);
  assert.throws(() => fromAeon(aeon.replace('href="#target"', 'href="#missing"'), runtime));
  assert.throws(() => fromAeon(`${aeon}\nextra:string="ignored"`, runtime), /Expected exactly/);
});

// The schema now names the supported nodes explicitly, so exercise every v2
// accept fixture as well as the projection combinations (including all scalar
// families, not just those present in the illustrative input).
const v2Index = JSON.parse(await read('../../cts/fixtures/v2/index.json'));
for (const fixturePath of v2Index.fixtures) {
  const fixture = JSON.parse(await read(`../../cts/fixtures/v2/${fixturePath}`));
  if (!fixture.expected.ok) continue;
  test(`v2 accepted fixture: ${fixture.id}`, () => {
    const parsed = parseAnd(fixture.source, { allowV2: true });
    assert.equal(parsed.ok, true);
    const restored = fromAeon(toAeon(fixture.source), runtime);
    assert.deepEqual(restored.document, normalizedAst(fixture.source));
    assert.equal(restored.canonical, emitCanonical(parsed.document, { profile: 'standalone', version: 'v2' }));
    assert.deepEqual(aesSnapshot(toAeon(restored.canonical)), aesSnapshot(toAeon(fixture.source)));
  });
}

test('direct nesting reconstructs empty sequences and list item roles', () => {
  const source = '&ND v2\n\n- One\n- Two\n';
  const aeon = toAeon(source);
  assert.match(aeon, /<list@\{ordered=false\}\(\s*<list_item\(\s*<paragraph\(\s*"One"/);
  assert.deepEqual(fromAeon(aeon, runtime).document, parseAnd(source, { allowV2: true }).document);
  const empty = toAeon('&ND v2\n');
  assert.match(empty, /doc:node = <document@\{vocabulary="and-document-semantic-example-2"\}>/);
  assert.deepEqual(fromAeon(empty, runtime).document, { type: 'document', children: [] });
});

test('rejects ambiguous roles and the earlier wrapper profile', () => {
  const aeon = toAeon('&ND v2\n\nHello\n');
  assert.throws(() => fromAeon(aeon.replace('and-document-semantic-example-2', 'and-v2-node-example-1'), runtime), /Unsupported/);
  assert.throws(() => fromAeon(aeon.replace('"Hello"', '<text@{value="Hello"}>'), runtime), /Unsupported/);
  const input = toAeon('&ND v2\n\n~~~| A title\nBody\n~~~|\n');
  assert.throws(() => fromAeon(input.replace('<card_block(', '<card_block(<title()>, '), runtime), /Duplicate/);
});


const envelope = (body) => `and_version="v2"\ndoc:node=${body.replace(/^<document(?=[(>])/, `<document@{vocabulary="${profile}"}`)}`;

test('native inline attributes replace parser nodes for every closed scalar family', async () => {
  const fixture = JSON.parse(await read('../../cts/fixtures/v2/strict/accept/v2-inline-typed-value-aeon-scalars.json'));
  const aeon = toAeon(fixture.source);
  assert.match(aeon, /<typed_value@\{value:date = 2024-02-29\}>/);
  assert.match(aeon, /value:null<datetime> = !none/);
  assert.match(aeon, /value:radix\[2\] = %1011/);
  assert.match(aeon, /value:temperature = 21.5/);
  const { namespace } = runtime.readAeonNamespace(aeon);
  const values = runtime.evaluateQuery('from $.doc.**%NodeHead where . == "typed_value" select .@.value', namespace);
  assert.equal(values.ok, true);
  const bindings = values.results.flatMap((result) => result.value.bindings);
  assert.equal(bindings.length, 17);
  assert.ok(bindings.some((binding) => binding.representationKind === 'DateLiteral' && binding.semanticType === 'date'));
  assert.ok(bindings.some((binding) => binding.representationKind === 'NumberLiteral' && binding.semanticType === 'temperature'));
});

test('hand-authored native AEON and &ND have equivalent normalized AES and queries', () => {
  const nd = toAeon('&ND v2\n\n## Hello\n\n[:date = 2026-08-20]\n');
  const native = envelope(`<document(<heading@{level:number=2}('Hello')>,
    <paragraph(<typed_value@{value:date=2026-08-20}()>)>)>`);
  assert.deepEqual(semanticSnapshot(native), semanticSnapshot(nd));
  const summarize = (source) => queryDocument(source, runtime).map(({ name, results }) => ({
    name, values: results.map((result) => result.value.type === 'bindingSet'
      ? result.value.bindings.map((binding) => [binding.representationKind, binding.value]) : result.value),
  }));
  assert.deepEqual(summarize(native), summarize(nd));
  const explicit = envelope('<document(<paragraph(<typed_value@{value:number=1_000.50}()>)>)>');
  const inferred = envelope('<document(<paragraph(<typed_value@{value=1000.5}()>)>)>');
  assert.deepEqual(semanticSnapshot(explicit), semanticSnapshot(inferred));
});

test('semantic normalization preserves content distinctions and exact large numbers', () => {
  const source = '&ND v2\n\nTwo  spaces[.]stay.\nSoft wrap.\n\n[:number = 9007199254740993123456789] [:radix[10] = %19.9900]\n';
  const aeon = toAeon(source);
  assert.match(aeon, /Two  spaces/);
  assert.match(aeon, /<line_break>/);
  assert.match(aeon, /9007199254740993123456789/);
  assert.match(aeon, /%19.9900/);
  assert.equal(normalizeAeon(aeon, runtime), aeon);
  assert.notDeepEqual(semanticSnapshot(aeon), semanticSnapshot(toAeon(source.replace('Two  spaces', 'Two spaces'))));
  const bold = toAeon('&ND v2\n\n[* Keep] this.\n');
  assert.notDeepEqual(semanticSnapshot(bold), semanticSnapshot(toAeon('&ND v2\n\nKeep this.\n')));
});

test('SANSA queries select headings, values, links, tasks, references, and fallbacks', async () => {
  const reports = queryDocument(toAeon(await read('./input.and')), runtime);
  for (const report of reports) {
    const { queries } = await import('./queries.mjs');
    const expected = queries.find(({ name }) => name === report.name).exampleCandidateCount;
    if (expected !== undefined) assert.equal(report.results.length, expected, report.name);
  }
  const date = reports.find(({ name }) => name === 'Native inline values').results[0].value.bindings[0];
  assert.equal(date.representationKind, 'DateLiteral');
  assert.equal(date.value, '2026-08-20');
});

test('rejects unsupported inline AES structures and legacy parser nodes', () => {
  const native = envelope('<document(<paragraph(<typed_value@{value:object={a=1}}()>)>)>');
  assert.throws(() => fromAeon(native, runtime));
  const legacy = envelope('<document(<paragraph(<typed_value(<datatype@{name="date"}()>,<DateLiteral@{value="2026-08-20"}()>)>)>)>');
  assert.throws(() => fromAeon(legacy, runtime), /exactly one native value/);
});


test('childless nodes use the short form and accept equivalent explicit empty children', () => {
  const short = toAeon('&ND v2\n\n[:date = 2026-08-20][.]\n');
  assert.match(short, /<typed_value@\{value:date = 2026-08-20\}>/);
  assert.match(short, /<line_break>/);
  assert.doesNotMatch(short, /\(\)>/);
  const long = short.replace('<typed_value@{value:date = 2026-08-20}>',
    '<typed_value@{value:date = 2026-08-20}()>').replace('<line_break>', '<line_break()>');
  assert.deepEqual(fromAeon(short, runtime).document, fromAeon(long, runtime).document);
  assert.deepEqual(aesSnapshot(short), aesSnapshot(long));
  assert.equal(normalizeAeon(long, runtime), short);
});


test('native prose preserves order and formatting while excluding attribute strings from SANSA text selection', () => {
  const source = '&ND v2\n\nRead [* the docs] first[.][@ https://example.com | link] [~ icon.png | alt text] [:string = "typed text"]\n';
  const aeon = toAeon(source);
  assert.match(aeon, /"Read ",\s*<strong\(\s*"the docs"/);
  assert.match(aeon, /<image@/);
  const { namespace } = runtime.readAeonNamespace(aeon);
  const result = runtime.evaluateQuery('from $.doc.**%StringLiteral select .', namespace);
  assert.equal(result.ok, true);
  const prose = result.results.flatMap((entry) => entry.value.bindings.map((binding) => binding.value));
  assert.deepEqual(prose, ['Read ', 'the docs', ' first', 'link', ' ', ' ']);
  assert.deepEqual(fromAeon(aeon, runtime).document, normalizedAst(source));
  assert.equal(normalizeAeon(envelope('<document(<paragraph("a", "b", <strong("c")>, " d")>)>'), runtime),
    toAeon('&ND v2\n\nab[* c] d\n'));
  assert.throws(() => fromAeon(envelope('<document("not a block")>'), runtime), /Native text/);
  assert.throws(() => fromAeon(envelope('<document(<paragraph(123)>)>'), runtime), /Expected/);
});

test('all four checklist states are native symbols and remain distinct from strings and Booleans', () => {
  const source = '&ND v2\n\n- [ ] A\n- [x] B\n- [,] C\n- [;] D\n';
  const aeon = toAeon(source);
  for (const state of ['unchecked', 'checked', 'in_progress', 'cancelled']) assert.ok(aeon.includes(`state=|${state}|`));
  assert.deepEqual(fromAeon(aeon, runtime).document, normalizedAst(source));
  const { namespace } = runtime.readAeonNamespace(aeon);
  const result = runtime.evaluateQuery('from $.doc.**%NodeHead where . == "todo_item" select .@.state', namespace);
  assert.equal(result.ok, true);
  const states = result.results.flatMap((entry) => entry.value.bindings);
  assert.deepEqual(states.map((binding) => binding.value), ['unchecked', 'checked', 'in_progress', 'cancelled']);
  assert.ok(states.every((binding) => binding.representationKind === 'SymbolicLiteral'));
  const incomplete = queryDocument(aeon, runtime).find(({ name }) => name === 'Incomplete tasks');
  assert.equal(incomplete.results.length, 2);
  for (const invalid of ['"unchecked"', 'false', '|blocked|']) {
    assert.throws(() => fromAeon(aeon.replace('|unchecked|', invalid), runtime), /supported symbol/);
  }
});

test('document subtrees identify their vocabulary independently of syntax metadata', () => {
  const aeon = toAeon('&ND v2\n\n# Hello\n');
  assert.match(aeon, /<document@\{vocabulary="and-document-semantic-example-2"\}/);
  assert.doesNotMatch(aeon, /and_profile/);
  const { namespace } = runtime.readAeonNamespace(aeon);
  const result = runtime.resolveAddress('$.doc[0].@.vocabulary', namespace);
  assert.equal(result.ok, true);
  assert.equal(result.bindings[0].value, profile);
  assert.throws(() => fromAeon(aeon.replace(`vocabulary="${profile}"`, 'vocabulary="unknown"'), runtime), /Unsupported/);
});

test('anchors and footnotes keep document-wide identity across container boundaries', () => {
  const source = '&ND v2\n\n~~~| A card\n## Inside [# inside]\n\n[% (note) Defined inside]\n~~~|\n\n[@ #inside | Go] [% (note)]\n';
  const aeon = toAeon(source);
  assert.match(aeon, /<anchor@\{id="inside"\}>/);
  assert.deepEqual(fromAeon(aeon, runtime).document, normalizedAst(source));
  assert.throws(() => fromAeon(aeon.replace('href="#inside"', 'href="#missing"'), runtime));
  assert.throws(() => fromAeon(aeon.replace('<footnote_reference@{id="note"}>', '<footnote_reference@{id="missing"}>'), runtime));
  const { namespace } = runtime.readAeonNamespace(aeon);
  const cards = runtime.evaluateQuery('from $.doc.**%NodeHead where . == "card_block" select .', namespace);
  assert.equal(cards.ok, true);
  const card = cards.results[0].candidateAddress;
  const headings = runtime.evaluateQuery(`from ${card}.**%NodeHead where . == "heading" select .@.level`, namespace);
  assert.equal(headings.ok, true);
  assert.equal(headings.results.length, 1);
});


test('adjacent string normalization changes document segmentation without redefining raw AES structure', () => {
  const split = envelope('<document(<paragraph("Hello ", "world")>)>');
  const joined = envelope('<document(<paragraph("Hello world")>)>');
  // Raw AES contains two ordered values in one case and one in the other.
  assert.notDeepEqual(aesSnapshot(split), aesSnapshot(joined));
  const strings = (source) => {
    const { namespace } = runtime.readAeonNamespace(source);
    const result = runtime.evaluateQuery('from $.doc.**%StringLiteral select .', namespace);
    assert.equal(result.ok, true);
    return result.results.flatMap((entry) => entry.value.bindings.map((binding) => binding.value));
  };
  assert.deepEqual(strings(split), ['Hello ', 'world']);
  assert.deepEqual(strings(joined), ['Hello world']);
  const normalized = normalizeAeon(split, runtime);
  assert.equal(normalized, normalizeAeon(joined, runtime));
  assert.deepEqual(strings(normalized), ['Hello world']);
  assert.deepEqual(aesSnapshot(normalized), aesSnapshot(normalizeAeon(joined, runtime)));
  assert.equal(normalizeAeon(normalized, runtime), normalized);

  const boundary = envelope('<document(<paragraph("Hello ", <strong("world")>)>)>');
  assert.notDeepEqual(semanticSnapshot(boundary), semanticSnapshot(joined));
  assert.deepEqual(strings(normalizeAeon(boundary, runtime)), ['Hello ', 'world']);
});

test('the exact example preserves mixed-content ordering and distinguishes NodeLiteral from NodeHead in SANSA', async () => {
  const source = await read('./document.aeon');
  const { namespace } = runtime.readAeonNamespace(source);
  const container = runtime.resolveAddress('$.doc[0][1]%NodeLiteral', namespace);
  const head = runtime.resolveAddress('$.doc[0][1][0]%NodeHead', namespace);
  assert.equal(container.ok, true);
  assert.equal(head.ok, true);
  assert.equal(container.bindings.length, 1);
  assert.equal(head.bindings.length, 1);
  assert.equal(container.bindings[0].representationKind, 'NodeLiteral');
  assert.equal(head.bindings[0].representationKind, 'NodeHead');
  assert.equal(head.bindings[0].value, 'paragraph');
  assert.equal(container.bindings[0].children[0], head.bindings[0]);

  const result = runtime.evaluateQuery('from $.doc[0][1][0].* select .', namespace);
  assert.equal(result.ok, true);
  const children = result.results.flatMap((entry) => entry.value.bindings);
  assert.deepEqual(children.map((binding) => [binding.representationKind, binding.nodeTag ?? binding.value]), [
    ['StringLiteral', 'Read '],
    ['NodeLiteral', 'link'],
    ['StringLiteral', ' with '],
    ['NodeLiteral', 'typed_value'],
    ['StringLiteral', ' and '],
    ['NodeLiteral', 'image'],
    ['StringLiteral', '.'],
  ]);
  assert.deepEqual(children, head.bindings[0].children);

  const strings = runtime.evaluateQuery('from $.doc[0][1][0].*%StringLiteral select .', namespace);
  const nodes = runtime.evaluateQuery('from $.doc[0][1][0].*%NodeLiteral select .', namespace);
  assert.equal(strings.ok, true);
  assert.equal(nodes.ok, true);
  assert.deepEqual(strings.results.flatMap((entry) => entry.value.bindings.map((binding) => binding.value)),
    ['Read ', ' with ', ' and ', '.']);
  assert.deepEqual(nodes.results.flatMap((entry) => entry.value.bindings.map((binding) => binding.nodeTag)),
    ['link', 'typed_value', 'image']);
});

test('task state membership is vocabulary validation, not native AES symbol parsing', () => {
  const source = envelope('<document(<todo_list(<todo_item@{state=|blocked|}(<paragraph("Wait")>)>)>)>');
  const parsed = runtime.parse(runtime.tokenize(source).tokens);
  assert.equal(parsed.errors.length, 0);
  const { namespace } = runtime.readAeonNamespace(source);
  const result = runtime.evaluateQuery('from $.doc.**%NodeHead where . == "todo_item" and .@.state == |blocked| select .@.state', namespace);
  assert.equal(result.ok, true);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].value.bindings[0].representationKind, 'SymbolicLiteral');
  assert.throws(() => fromAeon(source, runtime), /supported symbol/);
});

test('a source-free AEON document is queryable without inventing an &ND source version', () => {
  const source = `doc:node=<document@{vocabulary="${profile}"}(<heading@{level=2}("Native document")>)>`;
  const reports = queryDocument(source, runtime);
  assert.equal(reports.find(({ name }) => name === 'Headings').results.length, 1);
  assert.equal(reports.find(({ name }) => name === 'Prose strings').results[0].value.bindings[0].value, 'Native document');
  // Only the &ND conversion example requires explicit syntax-version metadata.
  assert.throws(() => fromAeon(source, runtime), /Expected exactly and_version and doc/);
  assert.equal(fromAeon(`and_version="v2"\n${source}`, runtime).canonical, '&ND v2\n\n## Native document\n');
});


test('frozen vocabulary rejects unknown fields, missing fields, wrong types and containment', () => {
  for (const body of [
    '<document(<paragraph@{future="silently lost"}("text")>)>',
    '<document(<heading("missing level")>)>',
    '<document(<heading@{level="2"}("wrong native type")>)>',
    '<document(<paragraph(<paragraph("block in inline content")>)>)>',
    '<document(<todo_list(<list_item(<paragraph("wrong item role")>)>)>)>',
    '<document(<paragraph(<image@{src="x",alt="alt",mode="giant"}>)>)>',
    '<document(<paragraph(<anchor@{id="a",extra=true}>)>)>',
    '<document(<heading@{level:CustomLevel=2}("unpreserved property annotation")>)>',
  ]) assert.throws(() => fromAeon(envelope(body), runtime), undefined, body);
});

test('the vocabulary manifest enumerates every emitted node in the v2 fixture corpus', async () => {
  const { vocabulary } = await import('./vocabulary.mjs');
  assert.equal(vocabulary.id, profile);
  assert.equal(vocabulary.status, 'frozen-candidate');
  assert.ok(Object.isFrozen(vocabulary.nodes));
  const emitted = new Set();
  for (const entry of contract.cases) {
    const aeon = toAeon(entry.source);
    function visit(value) {
      if (!value || typeof value !== 'object') return;
      if (value.type === 'NodeLiteral') emitted.add(value.tag);
      if (value instanceof Map) { for (const item of value.values()) visit(item); }
      else for (const item of Object.values(value)) visit(item);
    }
    visit(runtime.parse(runtime.tokenize(aeon).tokens).document);
  }
  for (const tag of emitted) assert.ok(Object.hasOwn(vocabulary.nodes, tag), tag);
});
