import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitCanonical } from '../implementations/reference-canonical/emitter.mjs';
import { parseAnd } from '../implementations/reference-parser/parser.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(repoRoot, 'cts/fixtures/index.json');

function stableJson(value) {
  return JSON.stringify(value, null, 2);
}

async function main() {
  const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
  let checked = 0;
  let skipped = 0;
  let failed = 0;

  for (const fixturePath of index.fixtures) {
    if (!fixturePath.includes('/accept/')) continue;

    const fullPath = path.join(repoRoot, 'cts/fixtures', fixturePath);
    const fixture = JSON.parse(await fs.readFile(fullPath, 'utf8'));
    const document = fixture.expected?.document;
    if (!document) continue;

    let emitted;
    try {
      emitted = emitCanonical(document);
    } catch (error) {
      if (error.code?.startsWith('unsupported_')) {
        skipped += 1;
        continue;
      }
      failed += 1;
      console.error(`FAIL ${fixture.id}: ${error.code ?? error.message}`);
      continue;
    }

    const reparsed = parseAnd(emitted);
    if (!reparsed.ok) {
      failed += 1;
      console.error(`FAIL ${fixture.id}: emitted canonical text did not parse (${reparsed.errorCode})`);
      continue;
    }

    if (stableJson(reparsed.document) !== stableJson(document)) {
      failed += 1;
      console.error(`FAIL ${fixture.id}: reparsed document did not match expected.document`);
      continue;
    }

    checked += 1;
  }

  console.log(`canonicalEmitter checked=${checked} skipped=${skipped} failed=${failed}`);
  if (failed > 0 || checked === 0) process.exit(1);
}

await main();
