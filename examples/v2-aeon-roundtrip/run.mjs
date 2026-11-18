import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parseAnd, emitCanonical } from '../../index.mjs';
import { toAeon, fromAeon, normalizeAeon } from './bridge.mjs';
import { queryDocument } from './queries.mjs';
import { loadAeon } from './aeon-runtime.mjs';

const runtime = await loadAeon();
const source = await fs.readFile(new URL('./input.and', import.meta.url), 'utf8');
const original = parseAnd(source, { allowV2: true });
assert.equal(original.ok, true);
const aeon = toAeon(source);
const restored = fromAeon(aeon, runtime);
const originalCanonical = emitCanonical(original.document, { profile: 'standalone', version: 'v2' });
assert.equal(restored.canonical, originalCanonical);
const reparsed = parseAnd(restored.canonical, { allowV2: true });
assert.equal(reparsed.ok, true);
assert.deepEqual(reparsed.document, restored.document);
assert.equal(toAeon(restored.canonical), aeon);
assert.equal(normalizeAeon(normalizeAeon(aeon, runtime), runtime), aeon);
const reports = queryDocument(aeon, runtime);
assert.equal(emitCanonical(reparsed.document, { profile: 'standalone', version: 'v2' }), restored.canonical);
if (process.argv.includes('--write')) {
  await fs.writeFile(new URL('./document.aeon', import.meta.url), aeon);
  await fs.writeFile(new URL('./roundtrip.and', import.meta.url), restored.canonical);
} else {
  console.log(aeon);
  console.log(restored.canonical);
}
console.log('Semantic round trip passed: &ND v2 → native AEON/AES → canonical &ND v2 → native AEON/AES');
console.log('SANSA queries:');
for (const report of reports) {
  console.log(`${report.name}: ${report.results.length} match(es)`);
  console.log(`  ${report.query}`);
}
