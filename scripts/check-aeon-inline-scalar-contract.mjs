import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { emitCanonical, parseAnd, renderHtml } from '../index.mjs';
import {
  AEON_INLINE_SCALAR_CONTRACT,
  formatAeonDatatype,
  parseAeonInlineTypedValue,
} from '../implementations/shared/aeon-inline-scalar.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'cts/contracts/aeon-inline-scalar-v1.json');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function expectedHtml(datatype, canonicalScalar, htmlText) {
  return `<p><data class="and-typed-value" data-type="${escapeHtml(datatype)}" value="${escapeHtml(canonicalScalar)}">${escapeHtml(htmlText)}</data></p>`;
}

function extractTypedValue(document) {
  assert.equal(document.type, 'document');
  assert.equal(document.children.length, 1);
  const paragraph = document.children[0];
  assert.equal(paragraph.type, 'paragraph');
  assert.equal(paragraph.children.length, 1);
  assert.equal(paragraph.children[0].type, 'typed_value');
  return paragraph.children[0];
}

function checkAcceptedCase(testCase) {
  const source = `&ND v2\n\n[:${testCase.expression}]\n`;
  const parsed = parseAnd(source, { allowV2: true });
  assert.equal(parsed.ok, true, `${testCase.id}: &ND parser rejected the pinned form (${parsed.errorCode ?? 'unknown'})`);

  const node = extractTypedValue(parsed.document);
  assert.deepEqual(node.datatype, testCase.datatype, `${testCase.id}: datatype AST drifted`);
  assert.deepEqual(node.value, testCase.value, `${testCase.id}: scalar AST drifted`);

  const shared = parseAeonInlineTypedValue(testCase.expression);
  assert.equal(shared.ok, true, `${testCase.id}: shared scalar parser rejected the pinned form`);
  assert.deepEqual(shared.datatype, testCase.datatype, `${testCase.id}: shared datatype AST drifted`);
  assert.deepEqual(shared.value, testCase.value, `${testCase.id}: shared scalar AST drifted`);

  const embedded = `[:${testCase.canonicalExpression}]\n`;
  const standalone = `&ND v2\n\n${embedded}`;
  assert.equal(
    emitCanonical(parsed.document, { profile: 'embedded', version: 'v2' }),
    embedded,
    `${testCase.id}: embedded canonical snapshot drifted`,
  );
  assert.equal(
    emitCanonical(parsed.document, { profile: 'standalone', version: 'v2' }),
    standalone,
    `${testCase.id}: standalone canonical snapshot drifted`,
  );

  const datatypeText = formatAeonDatatype(testCase.datatype);
  const canonicalScalar = testCase.canonicalExpression.slice(testCase.canonicalExpression.indexOf(' = ') + 3);
  assert.equal(
    renderHtml(parsed.document),
    expectedHtml(datatypeText, canonicalScalar, testCase.htmlText),
    `${testCase.id}: HTML snapshot drifted`,
  );
}

function expandFamilyCases(manifest) {
  return manifest.families.flatMap((family) => family.datatypes.map((datatype) => ({
    id: `${family.id}:${datatype}`,
    expression: `${datatype} = ${family.scalar}`,
    canonicalExpression: `${datatype} = ${family.canonicalScalar}`,
    datatype: { name: datatype, genericArgs: [], clarifiers: [] },
    value: family.value,
    htmlText: family.htmlText,
  })));
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  assert.equal(manifest.schemaVersion, '1');
  assert.equal(manifest.id, AEON_INLINE_SCALAR_CONTRACT.id, 'runtime and manifest contract IDs differ');
  assert.equal(
    manifest.aeon.packageVersion,
    AEON_INLINE_SCALAR_CONTRACT.aeonPackageVersion,
    'runtime and manifest AEON package versions differ',
  );
  assert.equal(
    manifest.aeon.maxGenericDepth,
    AEON_INLINE_SCALAR_CONTRACT.maxGenericDepth,
    'runtime and manifest generic depth locks differ',
  );

  const manifestDatatypes = manifest.families.flatMap((family) => family.datatypes);
  assert.equal(new Set(manifestDatatypes).size, manifestDatatypes.length, 'manifest datatype names must be unique');
  assert.deepEqual(
    [...manifestDatatypes].sort(),
    [...AEON_INLINE_SCALAR_CONTRACT.datatypes].sort(),
    'manifest must list every reserved inline datatype and alias exactly once',
  );
  assert.deepEqual(
    [...manifest.unsupportedReservedDatatypes].sort(),
    [...AEON_INLINE_SCALAR_CONTRACT.unsupportedReservedDatatypes].sort(),
    'manifest must list every unsupported reserved datatype and alias exactly once',
  );

  const acceptedCases = [...expandFamilyCases(manifest), ...manifest.annotationCases];
  assert.equal(new Set(acceptedCases.map((entry) => entry.id)).size, acceptedCases.length, 'accepted case IDs must be unique');
  for (const testCase of acceptedCases) checkAcceptedCase(testCase);

  for (const exclusion of manifest.exclusions) {
    const shared = parseAeonInlineTypedValue(exclusion.expression);
    assert.deepEqual(shared, { ok: false, errorCode: 'invalid_typed_value' }, `${exclusion.id}: shared parser accepted an exclusion`);
    const parsed = parseAnd(`&ND v2\n\n[:${exclusion.expression}]\n`, { allowV2: true });
    assert.equal(parsed.ok, false, `${exclusion.id}: &ND parser accepted an exclusion`);
  }

  console.log(
    `aeonInlineScalarContract accepted=${acceptedCases.length} excluded=${manifest.exclusions.length} datatypes=${manifestDatatypes.length} failed=0`,
  );
}

await main();
