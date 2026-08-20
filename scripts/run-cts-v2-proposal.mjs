#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { emitCanonical } from '../implementations/reference-canonical/emitter.mjs';
import { renderHtml } from '../implementations/reference-html/renderer.mjs';
import { parseAnd, parseInline } from '../implementations/reference-parser/parser.mjs';

const repoRoot = process.cwd();
const v1FixturesRoot = path.join(repoRoot, 'cts', 'fixtures');
const v1IndexPath = path.join(v1FixturesRoot, 'index.json');
const fixturesRoot = path.join(repoRoot, 'cts', 'fixtures', 'v2');
const indexPath = path.join(fixturesRoot, 'index.proposal.json');

async function loadJson(filePath) {
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text);
}

function validateFixture(relativePath, fixture) {
  const required = ['schemaVersion', 'id', 'specVersion', 'mode', 'source', 'expected'];
  for (const key of required) {
    if (!(key in fixture)) {
      throw new Error(`${relativePath} is missing required key: ${key}`);
    }
  }
  if (fixture.schemaVersion !== '1') {
    throw new Error(`${relativePath} must declare schemaVersion "1"`);
  }
  if (typeof fixture.expected?.ok !== 'boolean') {
    throw new Error(`${relativePath} expected.ok must be boolean`);
  }
  if (fixture.expected.ok === false && typeof fixture.expected.errorCode !== 'string') {
    throw new Error(`${relativePath} expected.errorCode is required for reject fixtures`);
  }
  if (fixture.expected.document !== undefined) {
    if (fixture.expected.ok !== true) {
      throw new Error(`${relativePath} expected.document is only valid for successful fixtures`);
    }
    if (typeof fixture.expected.document !== 'object' || fixture.expected.document === null || Array.isArray(fixture.expected.document)) {
      throw new Error(`${relativePath} expected.document must be an object when present`);
    }
  }
  if (fixture.expected.spans !== undefined) {
    if (fixture.expected.ok !== true) {
      throw new Error(`${relativePath} expected.spans is only valid for successful fixtures`);
    }
    if (!Array.isArray(fixture.expected.spans)) {
      throw new Error(`${relativePath} expected.spans must be an array when present`);
    }
    for (const [index, entry] of fixture.expected.spans.entries()) {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        throw new Error(`${relativePath} expected.spans[${index}] must be an object`);
      }
      if (typeof entry.path !== 'string' || (entry.path !== '$' && !entry.path.startsWith('$.'))) {
        throw new Error(`${relativePath} expected.spans[${index}].path must be "$" or a path starting with $.`);
      }
      if (typeof entry.span !== 'object' || entry.span === null || Array.isArray(entry.span)) {
        throw new Error(`${relativePath} expected.spans[${index}].span must be an object`);
      }
    }
  }
}

function stableJson(value) {
  return JSON.stringify(value, null, 2);
}

function stripSpans(value) {
  if (Array.isArray(value)) return value.map(stripSpans);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'span') continue;
      out[key] = stripSpans(entry);
    }
    return out;
  }
  return value;
}

function valueAtPath(value, selector) {
  if (selector === '$') return value;
  if (!selector.startsWith('$.')) return undefined;
  const segments = selector.slice(2).split('.');
  let current = value;

  for (const segment of segments) {
    const match = segment.match(/^([A-Za-z_][A-Za-z0-9_]*)(\[(\d+)\])*$/);
    if (!match) return undefined;

    const property = match[1];
    current = current?.[property];
    const indexes = [...segment.matchAll(/\[(\d+)\]/g)].map((entry) => Number(entry[1]));
    for (const index of indexes) {
      if (!Array.isArray(current)) return undefined;
      current = current[index];
    }
  }

  return current;
}

function spansMatch(expectedSpans, document) {
  if (expectedSpans === undefined) return true;
  if (!document) return false;

  for (const entry of expectedSpans) {
    const node = valueAtPath(document, entry.path);
    const actualSpan = node?.span;
    if (stableJson(actualSpan) !== stableJson(entry.span)) {
      return false;
    }
  }

  return true;
}

function asDeclaredVersion(source, version) {
  if (source.startsWith('&ND v1')) return source.replace('&ND v1', `&ND ${version}`);
  if (source.startsWith('&ND v2')) return source.replace('&ND v2', `&ND ${version}`);
  return `&ND ${version}\n\n${source}`;
}

function withoutDeclaredHeader(source) {
  const lines = source.split('\n');
  if (!lines[0]?.startsWith('&ND ')) return source;
  lines.shift();
  if (lines[0] === '') lines.shift();
  return lines.join('\n');
}

function sameDocument(left, right) {
  return stableJson(stripSpans(left)) === stableJson(stripSpans(right));
}

function reportCheck(label, condition, detail) {
  if (condition) return { pass: 1, fail: 0 };
  console.error(`FAIL ${label}`);
  if (detail) console.error(`  ${detail}`);
  return { pass: 0, fail: 1 };
}

function runApiBoundaryChecks() {
  const checks = [];
  const plainTildeV1 = parseAnd('&ND v1\n\n~~~\nordinary paragraph text\n~~~\n');
  const plainTildeV2 = parseAnd('&ND v2\n\n~~~\nordinary paragraph text\n~~~\n', { allowV2: true });
  checks.push(reportCheck(
    'plain tilde remains an inherited paragraph',
    plainTildeV1.ok
      && plainTildeV2.ok
      && plainTildeV1.document.children[0]?.type === 'paragraph'
      && sameDocument(plainTildeV1.document, plainTildeV2.document),
    'plain ~~~ lines must remain ordinary paragraph text in both v1 and v2'
  ));
  checks.push(reportCheck(
    'plain tilde canonical soft-wrap normalization',
    plainTildeV2.ok
      && emitCanonical(plainTildeV2.document, { profile: 'standalone', version: 'v2' })
        === '&ND v2\n\n~~~ ordinary paragraph text ~~~\n',
    'plain ~~~ is not a retained fence and follows inherited paragraph canonicalization'
  ));
  const inlineV2 = parseInline('[# inline-id]', { allowV2: true, version: 'v2' });
  checks.push(reportCheck(
    'public inline v2 selection',
    inlineV2.ok && inlineV2.nodes?.[0]?.type === 'anchor_tag',
    'parseInline must accept explicit embedded v2 input'
  ));

  const inlineLocalReference = parseInline('[@ #inline-id | inline]', { allowV2: true, version: 'v2' });
  checks.push(reportCheck(
    'public inline local-fragment link shape',
    inlineLocalReference.ok && inlineLocalReference.nodes?.[0]?.href === '#inline-id',
    'parseInline validates local fragment syntax while leaving document-level resolution to parseAnd'
  ));

  const inlineImage = parseInline('[~ image.jpg | Sample image]', { allowV2: true, version: 'v2' });
  checks.push(reportCheck(
    'public inline v2 image shape',
    inlineImage.ok
      && inlineImage.nodes?.[0]?.type === 'image_tag'
      && inlineImage.nodes[0].mode === 'inline',
    'parseInline must expose the normalized v2 image AST and default mode'
  ));

  const inlineTypedValue = parseInline('[:radix[2] = %1011]', { allowV2: true, version: 'v2' });
  checks.push(reportCheck(
    'public inline AEON scalar typed-value shape',
    inlineTypedValue.ok
      && inlineTypedValue.nodes?.[0]?.type === 'typed_value'
      && inlineTypedValue.nodes[0].datatype?.name === 'radix'
      && inlineTypedValue.nodes[0].value?.type === 'RadixLiteral',
    'parseInline must preserve the AEON datatype annotation and scalar literal family'
  ));

  const todoList = parseAnd('&ND v2\n\n- [x] parser\n', { allowV2: true });
  checks.push(reportCheck(
    'first-class v2 todo-list shape',
    todoList.ok
      && todoList.document.children[0]?.type === 'todo_list'
      && todoList.document.children[0]?.items?.[0]?.type === 'todo_item'
      && todoList.document.children[0]?.items?.[0]?.state === 'checked',
    'todo state belongs to a first-class todo item rather than an inline marker'
  ));

  const inlineTodo = parseInline('[x] parser', { allowV2: true, version: 'v2' });
  checks.push(reportCheck(
    'todo marker requires unordered item prefix',
    !inlineTodo.ok && inlineTodo.errorCode === 'unknown_inline_type',
    'todo markers must not parse as generic inline nodes'
  ));

  const autoNumberList = parseAnd('&ND v2\n\n- [n] first\n- [n] second\n', { allowV2: true });
  checks.push(reportCheck(
    'first-class v2 auto-number-list shape',
    autoNumberList.ok
      && autoNumberList.document.children[0]?.type === 'auto_number_list'
      && autoNumberList.document.children[0]?.items?.[0]?.type === 'list_item',
    '[n] belongs to a first-class auto-number list rather than an inline marker'
  ));

  const namedFootnote = parseAnd('&ND v2\n\nhello [% (A1) world] again [% (A1)]\n', { allowV2: true });
  checks.push(reportCheck(
    'named v2 footnote declaration and reuse',
    namedFootnote.ok
      && namedFootnote.document.children[0]?.children?.[1]?.type === 'footnote_definition'
      && namedFootnote.document.children[0]?.children?.[3]?.type === 'footnote_reference',
    'named footnotes must separate the first definition from later shorthand references'
  ));

  const inlineFootnoteReference = parseInline('[% (A1)]', { allowV2: true, version: 'v2' });
  checks.push(reportCheck(
    'inline footnote reference shape',
    inlineFootnoteReference.ok && inlineFootnoteReference.nodes?.[0]?.type === 'footnote_reference',
    'parseInline exposes footnote reference shape while parseAnd performs document resolution'
  ));

  const typedCanonicalSource = '&ND v2\n\n[:number = 1_000.50] [:hex = #FF_00] [:string = \'hello\']\n';
  const typedCanonicalParsed = parseAnd(typedCanonicalSource, { allowV2: true });
  const typedCanonical = typedCanonicalParsed.ok
    ? emitCanonical(typedCanonicalParsed.document, { profile: 'standalone', version: 'v2' })
    : null;
  checks.push(reportCheck(
    'AEON scalar canonical spelling',
    typedCanonical?.includes('[:number = 1000.5] [:hex = #ff00] [:string = "hello"]'),
    'typed values must use AEON number, hex, and string canonical spellings'
  ));

  const budgetedImage = parseInline('[~ image.jpg | Sample image]', {
    allowV2: true,
    version: 'v2',
    budgets: { maxLinkTargetLength: 4 },
  });
  checks.push(reportCheck(
    'v2 image source-length budget',
    !budgetedImage.ok && budgetedImage.errorCode === 'nd_budget_exceeded',
    'image sources must participate in the inherited link-target length budget'
  ));

  const deniedEmbeddedV2 = parseAnd('[# id]\n', { version: 'v2' });
  checks.push(reportCheck(
    'embedded v2 capability gate',
    !deniedEmbeddedV2.ok && deniedEmbeddedV2.errorCode === 'unsupported_version',
    'embedded v2 must require allowV2 capability'
  ));

  const capabilityOnlyEmbedded = parseAnd('[# id]\n', { allowV2: true });
  checks.push(reportCheck(
    'embedded v2 requires explicit version selection',
    !capabilityOnlyEmbedded.ok && capabilityOnlyEmbedded.errorCode === 'unknown_inline_type',
    'allowV2 declares capability but must not infer v2 for headerless input'
  ));

  const hostSelectedEmbedded = parseAnd('[# id]\n', { allowV2: true, version: 'v2' });
  checks.push(reportCheck(
    'host-selected embedded v2',
    hostSelectedEmbedded.ok && hostSelectedEmbedded.version === 'v2',
    'a host-controlled typed channel must supply both v2 capability and effective version'
  ));

  const declaredV1Precedence = parseAnd('&ND v1\n\ntext\n', { allowV2: true, version: 'v2' });
  checks.push(reportCheck(
    'declared v1 precedence over host version',
    declaredV1Precedence.ok && declaredV1Precedence.version === 'v1',
    'a host version option must not reinterpret a declared-v1 document'
  ));

  const declaredV2Precedence = parseAnd('&ND v2\n\n[# id]\n', { allowV2: true, version: 'v1' });
  checks.push(reportCheck(
    'declared v2 precedence over host version',
    declaredV2Precedence.ok && declaredV2Precedence.version === 'v2',
    'a host version option must not reinterpret a declared-v2 document'
  ));

  const invalidVersion = parseAnd('text\n', { version: 'v3', allowV2: true });
  checks.push(reportCheck(
    'invalid embedded version option',
    !invalidVersion.ok && invalidVersion.errorCode === 'invalid_version_option',
    'unknown effective versions must fail closed'
  ));

  const nestedV2 = parseAnd('&ND v2\n\n> [# quoted]\n\n- item\n\n  ~~~=\n  highlighted\n  ~~~=\n', { allowV2: true });
  checks.push(reportCheck(
    'nested v2 context propagation',
    nestedV2.ok
      && nestedV2.document.children[0]?.children?.[0]?.children?.[0]?.type === 'anchor_tag'
      && nestedV2.document.children[1]?.items?.[0]?.children?.[1]?.type === 'highlight_paragraph_block',
    'v2 selection must survive blockquote and list child contexts'
  ));

  const richDepth = parseAnd('&ND v2\n\n[- [* nested]]\n', {
    allowV2: true,
    budgets: { maxInlineDepth: 1 },
  });
  checks.push(reportCheck(
    'v2 rich tag inline-depth budget',
    !richDepth.ok && richDepth.errorCode === 'nd_budget_exceeded',
    'content-bearing v2 tags must participate in the inherited inline-depth budget'
  ));

  for (const [name, fence, closer = fence] of [
    ['highlight paragraph', '~~~='],
    ['header text', '~~~#'],
    ['disclaimer', '~~~^', '~~~'],
    ['semantic', '~~~(summary)', '~~~'],
    ['card', '~~~| Summary', '~~~|'],
  ]) {
    const budgeted = parseAnd(`&ND v2\n\n${fence}\ntoo long\n${closer}\n`, {
      allowV2: true,
      budgets: { maxBlockSize: 1 },
    });
    checks.push(reportCheck(
      `${name} block size budget`,
      !budgeted.ok && budgeted.errorCode === 'nd_budget_exceeded',
      'v2 paired blocks must enforce maxBlockSize'
    ));
  }

  const unknownExtension = parseAnd('&ND v2\n\n+++future/widget\nopaque\n+++\n', { allowV2: true });
  checks.push(reportCheck(
    'v2 opaque extension inheritance',
    unknownExtension.ok && unknownExtension.document.children[0]?.type === 'extension_block',
    'v2 must preserve the v1 opaque-extension compatibility model'
  ));

  const unknownInline = parseAnd('&ND v2\n\n[& future]\n', { allowV2: true });
  checks.push(reportCheck(
    'v2 strict forward boundary',
    !unknownInline.ok && unknownInline.errorCode === 'unknown_inline_type',
    'unpromoted syntax must fail in strict mode'
  ));

  let unsafeFenceError = null;
  try {
    emitCanonical({
      type: 'document',
      children: [{
        type: 'highlight_paragraph_block',
        children: [{ type: 'text', value: 'before\n~~~=\nafter' }],
      }],
    }, { profile: 'standalone', version: 'v2' });
  } catch (error) {
    unsafeFenceError = error;
  }
  checks.push(reportCheck(
    'v2 canonical fence safety',
    unsafeFenceError?.code === 'unsupported_v2_fence_payload',
    'canonical emission must reject payloads that would terminate their paired block'
  ));

  let unresolvedCanonicalError = null;
  try {
    emitCanonical({
      type: 'document',
      children: [{
        type: 'paragraph',
        children: [{
          type: 'link',
          href: '#missing',
          children: [{ type: 'text', value: 'missing' }],
        }],
      }],
    }, { profile: 'standalone', version: 'v2' });
  } catch (error) {
    unresolvedCanonicalError = error;
  }
  checks.push(reportCheck(
    'v2 canonical local-fragment integrity',
    unresolvedCanonicalError?.code === 'unresolved_local_anchor',
    'canonical emission must reject unresolved v2 local-fragment links'
  ));

  return checks.reduce(
    (totals, check) => ({ pass: totals.pass + check.pass, fail: totals.fail + check.fail }),
    { pass: 0, fail: 0 }
  );
}

async function runVersionBoundaryChecks(v2Index) {
  let pass = 0;
  let fail = 0;

  for (const rel of v2Index.fixtures) {
    const fixture = await loadJson(path.join(fixturesRoot, rel));
    const v1Only = parseAnd(fixture.source, fixture.options ?? {});
    if (!v1Only.ok && v1Only.errorCode === 'invalid_header') {
      pass += 1;
    } else {
      fail += 1;
      console.error(`FAIL ${fixture.id} version boundary`);
      console.error('  a v1-only parser must reject the v2 declaration with invalid_header');
    }

    const declaredV1Source = asDeclaredVersion(fixture.source, 'v1');
    const declaredV1Result = parseAnd(declaredV1Source, {
      ...(fixture.options ?? {}),
      allowV2: true,
    });
    if (!declaredV1Result.ok) {
      pass += 1;
    } else {
      fail += 1;
      console.error(`FAIL ${fixture.id} declared-v1 boundary`);
      console.error('  a v2-capable parser must not enable v2 syntax in a document declared as v1');
    }
  }

  const v1Index = await loadJson(v1IndexPath);
  for (const rel of v1Index.fixtures) {
    const fixture = await loadJson(path.join(v1FixturesRoot, rel));
    if (fixture.expected?.ok !== true) continue;

    const parseOptions = fixture.options ?? {};
    const v1Result = parseAnd(fixture.source, parseOptions);
    const v2CapableV1Result = parseAnd(fixture.source, { ...parseOptions, allowV2: true });
    const sameDeclaredV1Document = v1Result.ok
      && v2CapableV1Result.ok
      && stableJson(stripSpans(v1Result.document)) === stableJson(stripSpans(v2CapableV1Result.document));
    if (sameDeclaredV1Document) {
      pass += 1;
    } else {
      fail += 1;
      console.error(`FAIL ${fixture.id} v1-reader compatibility`);
      console.error('  a v2-capable parser must preserve v1 parse behavior and document structure');
    }

    const declaredV2Source = asDeclaredVersion(fixture.source, 'v2');
    // Header promotion changes source size and positions. This comparison pins grammar and AST
    // compatibility; configured source budgets remain covered by the exact-source check above.
    const v2Result = parseAnd(declaredV2Source, { allowV2: true });
    const sameV2CoreDocument = v1Result.ok
      && v2Result.ok
      && stableJson(stripSpans(v1Result.document)) === stableJson(stripSpans(v2Result.document));
    if (sameV2CoreDocument) {
      pass += 1;
    } else {
      fail += 1;
      console.error(`FAIL ${fixture.id} v1-subset compatibility`);
      console.error('  v1 core syntax declared as v2 must retain the same document structure');
    }
  }

  return { pass, fail };
}

async function main() {
  const index = await loadJson(indexPath);
  if (index.schemaVersion !== '1') {
    throw new Error('cts/fixtures/v2/index.proposal.json must declare schemaVersion "1"');
  }
  if (!Array.isArray(index.fixtures) || index.fixtures.length === 0) {
    throw new Error('cts/fixtures/v2/index.proposal.json must include at least one fixture');
  }

  let pass = 0;
  let fail = 0;

  for (const rel of index.fixtures) {
    const fixturePath = path.join(fixturesRoot, rel);
    const fixture = await loadJson(fixturePath);
    validateFixture(rel, fixture);

    const result = parseAnd(fixture.source, {
      allowV2: true,
      includeSpans: Array.isArray(fixture.expected.spans),
      ...(fixture.options ?? {}),
    });
    const okMatches = result.ok === fixture.expected.ok;
    const errorMatches = fixture.expected.errorCode === undefined
      || (!result.ok && result.errorCode === fixture.expected.errorCode);
    const documentMatches = fixture.expected.document === undefined
      || (result.ok && stableJson(stripSpans(result.document)) === stableJson(stripSpans(fixture.expected.document)));
    const spanMatches = spansMatch(fixture.expected.spans, result.document);
    const versionMatches = result.ok !== true || result.version === 'v2';

    if (okMatches && errorMatches && documentMatches && spanMatches && versionMatches) {
      pass += 1;
    } else {
      fail += 1;
      const expected = `ok=${fixture.expected.ok}${fixture.expected.errorCode ? ` errorCode=${fixture.expected.errorCode}` : ''}`;
      const actual = `ok=${result.ok}${result.errorCode ? ` errorCode=${result.errorCode}` : ''}`;
      console.error(`FAIL ${fixture.id} (${rel})`);
      console.error(`  expected: ${expected}`);
      console.error(`  actual:   ${actual}`);
      if (!versionMatches) console.error(`  expected version=v2, actual version=${result.version}`);
      if (fixture.expected.document !== undefined) {
        console.error('  expected.document and actual document differ');
        console.error(`  expected.document: ${stableJson(fixture.expected.document)}`);
        console.error(`  actual.document:   ${stableJson(stripSpans(result.document))}`);
      }
      if (fixture.expected.spans !== undefined && !spanMatches) {
        console.error('  expected.spans and actual spans differ');
        for (const entry of fixture.expected.spans) {
          const actualSpan = valueAtPath(result.document, entry.path)?.span;
          if (stableJson(actualSpan) !== stableJson(entry.span)) {
            console.error(`  path: ${entry.path}`);
            console.error(`  expected.span: ${stableJson(entry.span)}`);
            console.error(`  actual.span:   ${stableJson(actualSpan)}`);
          }
        }
      }
    }

    const embeddedResult = parseAnd(withoutDeclaredHeader(fixture.source), {
      allowV2: true,
      version: 'v2',
      includeSpans: Array.isArray(fixture.expected.spans),
      ...(fixture.options ?? {}),
    });
    const embeddedMatches = embeddedResult.ok === fixture.expected.ok
      && (fixture.expected.errorCode === undefined || embeddedResult.errorCode === fixture.expected.errorCode)
      && (fixture.expected.document === undefined || sameDocument(embeddedResult.document, fixture.expected.document));
    if (embeddedMatches) {
      pass += 1;
    } else {
      fail += 1;
      console.error(`FAIL ${fixture.id} embedded-v2 equivalence`);
      console.error('  headerless input with explicit version=v2 must preserve declared-v2 behavior');
    }

    if (!result.ok) continue;

    for (const profile of ['standalone', 'embedded']) {
      try {
        const emitted = emitCanonical(result.document, { profile, version: 'v2' });
        const reparsed = parseAnd(emitted, {
          allowV2: true,
          ...(profile === 'embedded' ? { version: 'v2' } : {}),
        });
        const reemitted = reparsed.ok
          ? emitCanonical(reparsed.document, { profile, version: 'v2' })
          : null;
        if (reparsed.ok && sameDocument(result.document, reparsed.document) && reemitted === emitted) {
          pass += 1;
        } else {
          fail += 1;
          console.error(`FAIL ${fixture.id} canonical ${profile} roundtrip`);
          console.error('  v2 canonical output must preserve AST structure and reach a fixed point');
        }
      } catch (error) {
        fail += 1;
        console.error(`FAIL ${fixture.id} canonical ${profile} roundtrip`);
        console.error(`  ${error.code ?? error.message}`);
      }
    }

    try {
      const fragment = renderHtml(result.document);
      const documentHtml = renderHtml(result.document, { fragment: false });
      if (typeof fragment === 'string' && documentHtml.startsWith('<!doctype html>')) {
        pass += 1;
      } else {
        fail += 1;
        console.error(`FAIL ${fixture.id} HTML projection`);
      }
    } catch (error) {
      fail += 1;
      console.error(`FAIL ${fixture.id} HTML projection`);
      console.error(`  ${error.code ?? error.message}`);
    }
  }

  const versionBoundaries = await runVersionBoundaryChecks(index);
  pass += versionBoundaries.pass;
  fail += versionBoundaries.fail;

  const apiBoundaries = runApiBoundaryChecks();
  pass += apiBoundaries.pass;
  fail += apiBoundaries.fail;

  console.log(`v2 proposal CTS and version boundaries: ${pass} pass, ${fail} fail`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
