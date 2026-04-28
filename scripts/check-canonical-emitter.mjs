import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitCanonical } from '../implementations/reference-canonical/emitter.mjs';
import { parseAnd } from '../implementations/reference-parser/parser.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(repoRoot, 'cts/fixtures/index.json');
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outPath = outIndex === -1 ? null : args[outIndex + 1];

async function main() {
  const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
  let checked = 0;
  let skipped = 0;
  let failed = 0;
  const results = [];

  for (const fixturePath of index.fixtures) {
    if (!fixturePath.includes('/accept/')) continue;

    const fullPath = path.join(repoRoot, 'cts/fixtures', fixturePath);
    const fixture = JSON.parse(await fs.readFile(fullPath, 'utf8'));
    const document = fixture.expected?.document;
    if (!document) continue;

    const result = {
      id: fixture.id,
      path: fixturePath,
      status: 'pending',
      canonical: null,
      notes: [],
    };
    results.push(result);

    let emitted;
    try {
      emitted = emitCanonical(document);
      result.canonical = emitted;
    } catch (error) {
      if (error.code?.startsWith('unsupported_')) {
        skipped += 1;
        result.status = 'skipped';
        result.notes.push(error.code);
        continue;
      }
      failed += 1;
      result.status = 'failed';
      result.notes.push(error.code ?? error.message);
      console.error(`FAIL ${fixture.id}: ${error.code ?? error.message}`);
      continue;
    }

    const reparsed = parseAnd(emitted);
    if (!reparsed.ok) {
      failed += 1;
      result.status = 'failed';
      result.notes.push(`reparse:${reparsed.errorCode}`);
      console.error(`FAIL ${fixture.id}: emitted canonical text did not parse (${reparsed.errorCode})`);
      continue;
    }

    let reemitted;
    try {
      reemitted = emitCanonical(reparsed.document);
    } catch (error) {
      failed += 1;
      result.status = 'failed';
      result.notes.push(`reemission:${error.code ?? error.message}`);
      console.error(`FAIL ${fixture.id}: reparsed document could not be re-emitted (${error.code ?? error.message})`);
      continue;
    }

    if (reemitted !== emitted) {
      failed += 1;
      result.status = 'failed';
      result.notes.push('not_fixed_point');
      console.error(`FAIL ${fixture.id}: canonical output was not stable after reparse/re-emit`);
      continue;
    }

    checked += 1;
    result.status = 'pass';
  }

  console.log(`canonicalEmitter checked=${checked} skipped=${skipped} failed=${failed}`);
  if (outPath) {
    const report = {
      generatedBy: 'scripts/check-canonical-emitter.mjs',
      totals: {
        fixtures: results.length,
        checked,
        skipped,
        failed,
      },
      results,
    };
    await fs.mkdir(path.dirname(path.resolve(repoRoot, outPath)), { recursive: true });
    await fs.writeFile(path.resolve(repoRoot, outPath), `${JSON.stringify(report, null, 2)}\n`);
  }
  if (failed > 0 || checked === 0) process.exit(1);
}

await main();
