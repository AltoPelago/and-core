import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { emitCanonical, parseAnd, renderHtml } from '../index.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractPath = path.join(repoRoot, 'cts/contracts/v2-projection-v1.json');

function stable(value) {
  return JSON.stringify(value);
}

function sameDocument(left, right) {
  return stable(left) === stable(right);
}

async function main() {
  const contract = JSON.parse(await fs.readFile(contractPath, 'utf8'));
  assert.equal(contract.schemaVersion, '1');
  assert.equal(contract.id, 'and-v2-projection-v1');
  assert.ok(Array.isArray(contract.requiredCoverage) && contract.requiredCoverage.length > 0);
  assert.ok(Array.isArray(contract.cases) && contract.cases.length > 0);
  assert.equal(new Set(contract.requiredCoverage).size, contract.requiredCoverage.length, 'required coverage IDs must be unique');
  assert.equal(new Set(contract.cases.map((entry) => entry.id)).size, contract.cases.length, 'case IDs must be unique');

  const observedCoverage = new Set();
  let canonicalSnapshots = 0;
  let htmlSnapshots = 0;
  let fullDocumentSnapshots = 0;

  for (const testCase of contract.cases) {
    assert.ok(testCase.source.startsWith('&ND v2\n'), `${testCase.id}: source must be standalone v2`);
    assert.ok(Array.isArray(testCase.covers) && testCase.covers.length > 0, `${testCase.id}: covers must not be empty`);
    for (const coverage of testCase.covers) {
      assert.ok(contract.requiredCoverage.includes(coverage), `${testCase.id}: unknown coverage ID ${coverage}`);
      observedCoverage.add(coverage);
    }

    const parsed = parseAnd(testCase.source, { allowV2: true });
    assert.equal(parsed.ok, true, `${testCase.id}: source did not parse (${parsed.errorCode ?? 'unknown'})`);
    assert.equal(parsed.version, 'v2', `${testCase.id}: effective version drifted`);

    for (const profile of ['embedded', 'standalone']) {
      const expected = testCase.expected?.canonical?.[profile];
      assert.equal(typeof expected, 'string', `${testCase.id}: missing ${profile} canonical snapshot`);
      const actual = emitCanonical(parsed.document, { profile, version: 'v2' });
      assert.equal(actual, expected, `${testCase.id}: ${profile} canonical snapshot drifted`);
      canonicalSnapshots += 1;

      const reparsed = parseAnd(actual, {
        allowV2: true,
        ...(profile === 'embedded' ? { version: 'v2' } : {}),
      });
      assert.equal(reparsed.ok, true, `${testCase.id}: ${profile} canonical snapshot did not reparse`);
      assert.ok(sameDocument(reparsed.document, parsed.document), `${testCase.id}: ${profile} canonical AST drifted`);
      assert.equal(
        emitCanonical(reparsed.document, { profile, version: 'v2' }),
        expected,
        `${testCase.id}: ${profile} canonical snapshot is not a fixed point`,
      );
    }

    const htmlOptions = testCase.htmlOptions ?? {};
    assert.equal(typeof testCase.expected?.html?.fragment, 'string', `${testCase.id}: missing HTML fragment snapshot`);
    assert.equal(
      renderHtml(parsed.document, htmlOptions),
      testCase.expected.html.fragment,
      `${testCase.id}: HTML fragment snapshot drifted`,
    );
    htmlSnapshots += 1;

    if (testCase.expected.html.document !== undefined) {
      assert.equal(
        renderHtml(parsed.document, { ...htmlOptions, fragment: false }),
        testCase.expected.html.document,
        `${testCase.id}: full HTML document snapshot drifted`,
      );
      htmlSnapshots += 1;
      fullDocumentSnapshots += 1;
    }
  }

  assert.deepEqual(
    [...observedCoverage].sort(),
    [...contract.requiredCoverage].sort(),
    'projection contract does not cover every required promoted surface',
  );
  assert.ok(fullDocumentSnapshots > 0, 'projection contract must pin at least one full HTML document');

  console.log(
    `v2ProjectionContract cases=${contract.cases.length} coverage=${observedCoverage.size} canonicalSnapshots=${canonicalSnapshots} htmlSnapshots=${htmlSnapshots} failed=0`,
  );
}

await main();
