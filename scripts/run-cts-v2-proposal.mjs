#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { parseAnd } from '../implementations/reference-parser/parser.mjs';

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

    if (okMatches && errorMatches && documentMatches && spanMatches) {
      pass += 1;
      continue;
    }

    fail += 1;
    const expected = `ok=${fixture.expected.ok}${fixture.expected.errorCode ? ` errorCode=${fixture.expected.errorCode}` : ''}`;
    const actual = `ok=${result.ok}${result.errorCode ? ` errorCode=${result.errorCode}` : ''}`;
    console.error(`FAIL ${fixture.id} (${rel})`);
    console.error(`  expected: ${expected}`);
    console.error(`  actual:   ${actual}`);
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

  const versionBoundaries = await runVersionBoundaryChecks(index);
  pass += versionBoundaries.pass;
  fail += versionBoundaries.fail;

  console.log(`v2 proposal CTS and version boundaries: ${pass} pass, ${fail} fail`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
