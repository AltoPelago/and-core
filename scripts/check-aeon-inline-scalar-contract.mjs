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

function checkStoredSansaAddress() {
  const canonical = '&ND v2\n\n[:sansa = $.foo]\n';
  const parsed = parseAnd(canonical, { allowV2: true });
  assert.equal(parsed.ok, true);
  const document = JSON.parse(JSON.stringify(parsed.document));
  const node = extractTypedValue(document);
  const options = { profile: 'standalone', version: 'v2' };

  node.value.value = '$.["foo"]';
  assert.equal(emitCanonical(document, options), canonical);
  assert.equal(renderHtml(document), expectedHtml('sansa', '$.foo', '$.foo'));
  assert.equal(node.value.value, '$.["foo"]');

  node.value.value = '$.foo=bar';
  assert.throws(() => emitCanonical(document, options), { code: 'invalid_typed_value' });
  assert.throws(() => renderHtml(document), { code: 'invalid_typed_value' });
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
  return manifest.families.flatMap((family) => {
    const explicit = family.datatypes.map((datatype) => ({
      id: `${family.id}:${datatype}`,
      expression: `${datatype} = ${family.scalar}`,
      canonicalExpression: `${datatype} = ${family.canonicalScalar}`,
      datatype: { name: datatype, genericArgs: [], clarifiers: [] },
      value: family.value,
      htmlText: family.htmlText,
    }));
    // Each family lists its inferred datatype first, followed by its explicit aliases.
    return [...explicit, {
      ...explicit[0],
      id: `${family.id}:inferred`,
      expression: ` ${family.scalar} `,
    }];
  });
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
  checkStoredSansaAddress();

  for (const exclusion of manifest.exclusions) {
    const shared = parseAeonInlineTypedValue(exclusion.expression);
    assert.deepEqual(shared, { ok: false, errorCode: 'invalid_typed_value' }, `${exclusion.id}: shared parser accepted an exclusion`);
    const parsed = parseAnd(`&ND v2\n\n[:${exclusion.expression}]\n`, { allowV2: true });
    assert.equal(parsed.ok, false, `${exclusion.id}: &ND parser accepted an exclusion`);
  }

  const invalidExpressions = [
    ' ', ' 2024-02-30', ' 2024-01-01 extra', ' date 2024-01-01',
    ' = 2024-01-01', ' [1, 2]', '2024-01-01',
    ...['001', '-01.5', '0_1', '00e2'].flatMap((literal) => [` ${literal}`, `number = ${literal}`]),
    ...['\u00a0', '\u2028'].flatMap((padding) => [` true${padding}`, `boolean = true${padding}`]),
    ...['3.', '3.e2'].flatMap((literal) => [` ${literal}`, `number = ${literal}`]),
    ...['Local', 'LOCAL'].flatMap((zone) => [
      ` 2025-01-01T09:30Z&${zone}`, `wtc = 2025-01-01T09:30Z&${zone}`,
    ]),
    ...['$.foo=bar', '$.foo[]', '$.foo.[1]', '$.foo:unit[0.0000001]'].flatMap((address) => [
      ` ${address}`, `sansa = ${address}`,
    ]),
  ];
  for (const expression of invalidExpressions) {
    const parsed = parseAnd(`&ND v2\n\n[:${expression}]\n`, { allowV2: true });
    assert.equal(parsed.errorCode, 'invalid_typed_value', `[:${expression}]: expected a typed-value error`);
  }

  console.log(
    `aeonInlineScalarContract accepted=${acceptedCases.length} excluded=${manifest.exclusions.length + invalidExpressions.length} datatypes=${manifestDatatypes.length} failed=0`,
  );
}

await main();
