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
const profiles = ['embedded', 'standalone'];

function makeEmptyTotals() {
  return {
    checked: 0,
    skipped: 0,
    failed: 0,
  };
}

async function main() {
  const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
  const totals = makeEmptyTotals();
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
      profiles: {},
      notes: [],
    };
    results.push(result);

    let fixtureFailed = false;
    let fixtureSkipped = true;

    for (const profile of profiles) {
      const profileResult = {
        status: 'pending',
        canonical: null,
        notes: [],
      };
      result.profiles[profile] = profileResult;

      let emitted;
      try {
        emitted = emitCanonical(document, { profile });
        profileResult.canonical = emitted;
      } catch (error) {
        if (error.code?.startsWith('unsupported_')) {
          totals.skipped += 1;
          profileResult.status = 'skipped';
          profileResult.notes.push(error.code);
          continue;
        }
        totals.failed += 1;
        fixtureFailed = true;
        profileResult.status = 'failed';
        profileResult.notes.push(error.code ?? error.message);
        console.error(`FAIL ${fixture.id} (${profile}): ${error.code ?? error.message}`);
        continue;
      }

      fixtureSkipped = false;

      const reparsed = parseAnd(emitted);
      if (!reparsed.ok) {
        totals.failed += 1;
        fixtureFailed = true;
        profileResult.status = 'failed';
        profileResult.notes.push(`reparse:${reparsed.errorCode}`);
        console.error(`FAIL ${fixture.id} (${profile}): emitted canonical text did not parse (${reparsed.errorCode})`);
        continue;
      }

      let reemitted;
      try {
        reemitted = emitCanonical(reparsed.document, { profile });
      } catch (error) {
        totals.failed += 1;
        fixtureFailed = true;
        profileResult.status = 'failed';
        profileResult.notes.push(`reemission:${error.code ?? error.message}`);
        console.error(
          `FAIL ${fixture.id} (${profile}): reparsed document could not be re-emitted (${error.code ?? error.message})`
        );
        continue;
      }

      if (reemitted !== emitted) {
        totals.failed += 1;
        fixtureFailed = true;
        profileResult.status = 'failed';
        profileResult.notes.push('not_fixed_point');
        console.error(`FAIL ${fixture.id} (${profile}): canonical output was not stable after reparse/re-emit`);
        continue;
      }

      totals.checked += 1;
      profileResult.status = 'pass';
    }

    if (fixtureFailed) {
      result.status = 'failed';
    } else if (fixtureSkipped) {
      result.status = 'skipped';
    } else {
      result.status = 'pass';
    }
  }

  console.log(`canonicalEmitter checked=${totals.checked} skipped=${totals.skipped} failed=${totals.failed}`);
  if (outPath) {
    const report = {
      generatedBy: 'scripts/check-canonical-emitter.mjs',
      totals: {
        fixtures: results.length,
        profiles: profiles.length,
        checked: totals.checked,
        skipped: totals.skipped,
        failed: totals.failed,
      },
      results,
    };
    await fs.mkdir(path.dirname(path.resolve(repoRoot, outPath)), { recursive: true });
    await fs.writeFile(path.resolve(repoRoot, outPath), `${JSON.stringify(report, null, 2)}\n`);
  }
  if (totals.failed > 0 || totals.checked === 0) process.exit(1);
}

await main();
