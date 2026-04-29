#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const fixturesRoot = path.join(repoRoot, 'cts', 'fixtures');
const indexPath = path.join(fixturesRoot, 'index.json');

function printUsage() {
  console.log(`Usage: node scripts/run-cts.mjs [--adapter ./path/to/adapter.mjs] [--json] [--quiet] [--list] [--out ./path/to/report.json]

Options:
  --adapter <path>   Load a CTS adapter module that exports runFixture(fixture, context)
  --json             Emit machine-readable JSON instead of text
  --quiet            Suppress stdout; requires --out unless --list is used
  --list             List fixture ids and exit
  --out <path>       Write the emitted report to a file
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    adapter: null,
    json: false,
    quiet: false,
    list: false,
    help: false,
    out: null,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--adapter') {
      options.adapter = args[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--quiet') {
      options.quiet = true;
      continue;
    }
    if (arg === '--list') {
      options.list = true;
      continue;
    }
    if (arg === '--out') {
      options.out = args[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.adapter === null && args.includes('--adapter')) {
    throw new Error('Missing value for --adapter');
  }
  if (options.out === null && args.includes('--out')) {
    throw new Error('Missing value for --out');
  }
  if (options.quiet && options.out === null && !options.list) {
    throw new Error('--quiet requires --out');
  }

  return options;
}

async function loadJson(filePath) {
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text);
}

function validateFixture(relativePath, fixture) {
  const errors = [];
  const requiredTop = ['schemaVersion', 'id', 'specVersion', 'mode', 'source', 'expected'];
  for (const key of requiredTop) {
    if (!(key in fixture)) {
      errors.push(`${relativePath} is missing required key: ${key}`);
    }
  }

  if (fixture.schemaVersion !== '1') {
    errors.push(`${relativePath} must declare schemaVersion "1"`);
  }

  if (typeof fixture.id !== 'string' || fixture.id.length === 0) {
    errors.push(`${relativePath} id must be a non-empty string`);
  }

  if (typeof fixture.source !== 'string') {
    errors.push(`${relativePath} source must be a string`);
  }

  if ('options' in fixture && (typeof fixture.options !== 'object' || fixture.options === null || Array.isArray(fixture.options))) {
    errors.push(`${relativePath} options must be an object when present`);
  }

  if (typeof fixture.expected !== 'object' || fixture.expected === null || Array.isArray(fixture.expected)) {
    errors.push(`${relativePath} expected must be an object`);
  } else {
    if (typeof fixture.expected.ok !== 'boolean') {
      errors.push(`${relativePath} expected.ok must be a boolean`);
    }
    if ('assertions' in fixture.expected) {
      const { assertions } = fixture.expected;
      if (!Array.isArray(assertions) || !assertions.every((entry) => typeof entry === 'string')) {
        errors.push(`${relativePath} expected.assertions must be an array of strings`);
      }
    }
    if ('errorCode' in fixture.expected && typeof fixture.expected.errorCode !== 'string') {
      errors.push(`${relativePath} expected.errorCode must be a string when present`);
    }
    if (fixture.expected.ok === false && typeof fixture.expected.errorCode !== 'string') {
      errors.push(`${relativePath} expected.errorCode is required for reject fixtures`);
    }
    if ('document' in fixture.expected) {
      if (fixture.expected.ok !== true) {
        errors.push(`${relativePath} expected.document is only valid for successful fixtures`);
      }
      if (
        typeof fixture.expected.document !== 'object'
        || fixture.expected.document === null
        || Array.isArray(fixture.expected.document)
      ) {
        errors.push(`${relativePath} expected.document must be an object when present`);
      }
    }
    if ('spans' in fixture.expected) {
      if (fixture.expected.ok !== true) {
        errors.push(`${relativePath} expected.spans is only valid for successful fixtures`);
      }
      if (!Array.isArray(fixture.expected.spans)) {
        errors.push(`${relativePath} expected.spans must be an array when present`);
      } else {
        for (const [index, entry] of fixture.expected.spans.entries()) {
          if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
            errors.push(`${relativePath} expected.spans[${index}] must be an object`);
            continue;
          }
          if (typeof entry.path !== 'string' || (entry.path !== '$' && !entry.path.startsWith('$.'))) {
            errors.push(`${relativePath} expected.spans[${index}].path must be "$" or a string path starting with $.`);
          }
          if (typeof entry.span !== 'object' || entry.span === null || Array.isArray(entry.span)) {
            errors.push(`${relativePath} expected.spans[${index}].span must be an object`);
          }
        }
      }
    }
  }

  return errors;
}

async function loadManifest() {
  const index = await loadJson(indexPath);
  if (index.schemaVersion !== '1') {
    throw new Error('cts/fixtures/index.json must declare schemaVersion "1"');
  }
  if (!Array.isArray(index.fixtures) || index.fixtures.length === 0) {
    throw new Error('cts/fixtures/index.json must contain a non-empty fixtures array');
  }
  return index;
}

async function loadFixtures(index) {
  const seen = new Set();
  const fixtures = [];

  for (const relativePath of index.fixtures) {
    if (seen.has(relativePath)) {
      throw new Error(`Duplicate fixture entry in index: ${relativePath}`);
    }
    seen.add(relativePath);

    const fullPath = path.join(fixturesRoot, relativePath);
    const fixture = await loadJson(fullPath);
    const validationErrors = validateFixture(relativePath, fixture);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('\n'));
    }
    fixtures.push({
      path: relativePath,
      fullPath,
      fixture,
    });
  }

  return fixtures;
}

async function loadAdapter(adapterPath) {
  if (!adapterPath) return null;
  const absolutePath = path.resolve(repoRoot, adapterPath);
  const module = await import(pathToFileURL(absolutePath).href);
  if (typeof module.runFixture !== 'function') {
    throw new Error(`CTS adapter must export runFixture(fixture, context): ${adapterPath}`);
  }
  return {
    path: adapterPath,
    runFixture: module.runFixture,
    capabilities: typeof module.capabilities === 'object' && module.capabilities !== null
      ? module.capabilities
      : {},
  };
}

function stableJson(value) {
  return JSON.stringify(value, null, 2);
}

function compareDocumentExpectation(expectedDocument, actualDocument) {
  if (expectedDocument === undefined) {
    return {
      checked: false,
      match: undefined,
      notes: [],
    };
  }

  if (actualDocument === undefined) {
    return {
      checked: true,
      match: false,
      notes: ['Expected document AST, but adapter did not return document.'],
    };
  }

  const expectedJson = stableJson(expectedDocument);
  const actualJson = stableJson(actualDocument);
  if (expectedJson === actualJson) {
    return {
      checked: true,
      match: true,
      notes: ['Document AST matched expected structure.'],
    };
  }

  return {
    checked: true,
    match: false,
    notes: [
      'Document AST mismatch.',
      `Expected document: ${expectedJson}`,
      `Actual document: ${actualJson}`,
    ],
  };
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

function compareSpanExpectations(expectedSpans, actualDocument) {
  if (expectedSpans === undefined) {
    return {
      expected: false,
      checked: false,
      matched: 0,
      failed: 0,
      notes: [],
    };
  }

  if (actualDocument === undefined) {
    return {
      expected: true,
      checked: true,
      matched: 0,
      failed: expectedSpans.length,
      notes: ['Expected source spans, but adapter did not return a document.'],
    };
  }

  const notes = [];
  let matched = 0;
  let failed = 0;
  for (const entry of expectedSpans) {
    const node = valueAtPath(actualDocument, entry.path);
    const actualSpan = node?.span;
    const expectedJson = stableJson(entry.span);
    const actualJson = stableJson(actualSpan);
    if (expectedJson === actualJson) {
      matched += 1;
      continue;
    }
    failed += 1;
    notes.push(`Span mismatch at ${entry.path}. Expected span: ${expectedJson}. Actual span: ${actualJson}`);
  }

  if (failed === 0) {
    notes.push(`Span expectations matched (${matched}/${expectedSpans.length}).`);
  }

  return {
    expected: true,
    checked: true,
    matched,
    failed,
    notes,
  };
}

function makePlaceholderResult(entry) {
  return {
    id: entry.fixture.id,
    path: entry.path,
    status: 'pending',
    mode: entry.fixture.mode,
    expectedOk: entry.fixture.expected.ok,
    notes: ['No CTS adapter configured yet.'],
  };
}

async function runWithAdapter(adapter, entry) {
  const result = await adapter.runFixture(entry.fixture, {
    repoRoot,
    fixturePath: entry.fullPath,
    relativeFixturePath: entry.path,
    options: entry.fixture.options ?? {},
  });

  if (typeof result !== 'object' || result === null) {
    throw new Error(`Adapter returned invalid result for ${entry.path}`);
  }

  const expectedDocument = entry.fixture.expected.document;
  const documentExpectationPresent = expectedDocument !== undefined;
  const documentSupported = adapter.capabilities.document === true;
  const expectedSpans = entry.fixture.expected.spans;
  const spanExpectationPresent = expectedSpans !== undefined;
  const spansSupported = adapter.capabilities.spans === true;
  const documentCheck = documentSupported
    ? compareDocumentExpectation(expectedDocument, result.document)
    : {
        checked: false,
        match: undefined,
        notes: documentExpectationPresent
          ? ['Document AST expectation skipped; adapter does not declare document capability.']
          : [],
      };
  const spanCheck = spansSupported
    ? compareSpanExpectations(expectedSpans, result.document)
    : {
        expected: spanExpectationPresent,
        checked: false,
        matched: 0,
        failed: 0,
        notes: spanExpectationPresent
          ? ['Source span expectation skipped; adapter does not declare spans capability.']
          : [],
      };
  const status = (documentCheck.checked && documentCheck.match === false) || spanCheck.failed > 0
    ? 'fail'
    : result.status ?? 'error';

  return {
    id: entry.fixture.id,
    path: entry.path,
    status,
    mode: entry.fixture.mode,
    expectedOk: entry.fixture.expected.ok,
    expectedErrorCode: entry.fixture.expected.errorCode,
    actualOk: result.actualOk,
    errorCode: result.errorCode,
    documentExpected: documentExpectationPresent,
    documentChecked: documentCheck.checked,
    documentMatch: documentCheck.match,
    spansExpected: spanExpectationPresent,
    spansChecked: spanCheck.checked,
    spansMatched: spanCheck.matched,
    spansFailed: spanCheck.failed,
    notes: [
      ...(Array.isArray(result.notes) ? result.notes : []),
      ...documentCheck.notes,
      ...spanCheck.notes,
    ],
  };
}

function summarize(results, adapter) {
  const counts = {
    pending: 0,
    pass: 0,
    fail: 0,
    error: 0,
  };
  const documentCounts = {
    expected: 0,
    checked: 0,
    matched: 0,
    skipped: 0,
    failed: 0,
  };
  const errorCodeCounts = {
    expected: 0,
    matched: 0,
    missingActual: 0,
    mismatched: 0,
  };
  const spanCounts = {
    expected: 0,
    checked: 0,
    matched: 0,
    failed: 0,
    skipped: 0,
  };

  for (const result of results) {
    counts[result.status] = (counts[result.status] ?? 0) + 1;
    if (result.expectedErrorCode) {
      errorCodeCounts.expected += 1;
      if (result.errorCode === result.expectedErrorCode) {
        errorCodeCounts.matched += 1;
      } else if (result.errorCode === undefined) {
        errorCodeCounts.missingActual += 1;
      } else {
        errorCodeCounts.mismatched += 1;
      }
    }
    if (result.documentExpected) {
      documentCounts.expected += 1;
      if (result.documentChecked) {
        documentCounts.checked += 1;
        if (result.documentMatch === true) {
          documentCounts.matched += 1;
        } else {
          documentCounts.failed += 1;
        }
      } else {
        documentCounts.skipped += 1;
      }
    }
    if (result.spansExpected) {
      spanCounts.expected += 1;
      if (result.spansChecked) {
        spanCounts.checked += 1;
        spanCounts.matched += result.spansMatched ?? 0;
        spanCounts.failed += result.spansFailed ?? 0;
      } else {
        spanCounts.skipped += 1;
      }
    }
  }

  return {
    ok: counts.fail === 0 && counts.error === 0,
    mode: adapter ? 'adapter' : 'placeholder',
    adapter: adapter?.path ?? null,
    totals: {
      fixtures: results.length,
      ...counts,
    },
    documentChecks: documentCounts,
    spanChecks: spanCounts,
    errorCodeChecks: errorCodeCounts,
    results,
  };
}

function printText(summary) {
  console.log(`CTS mode: ${summary.mode}${summary.adapter ? ` (${summary.adapter})` : ''}`);
  for (const result of summary.results) {
    const suffix = result.notes && result.notes.length > 0 ? ` - ${result.notes.join(' ')}` : '';
    console.log(`${result.status.toUpperCase()} ${result.id} (${result.path})${suffix}`);
  }
  console.log('');
  console.log(
    `fixtures=${summary.totals.fixtures} pass=${summary.totals.pass} fail=${summary.totals.fail} error=${summary.totals.error} pending=${summary.totals.pending}`
  );
  console.log(
    `documentChecks expected=${summary.documentChecks.expected} checked=${summary.documentChecks.checked} matched=${summary.documentChecks.matched} skipped=${summary.documentChecks.skipped} failed=${summary.documentChecks.failed}`
  );
  console.log(
    `spanChecks expected=${summary.spanChecks.expected} checked=${summary.spanChecks.checked} matched=${summary.spanChecks.matched} skipped=${summary.spanChecks.skipped} failed=${summary.spanChecks.failed}`
  );
  console.log(
    `errorCodeChecks expected=${summary.errorCodeChecks.expected} matched=${summary.errorCodeChecks.matched} missingActual=${summary.errorCodeChecks.missingActual} mismatched=${summary.errorCodeChecks.mismatched}`
  );
}

async function writeOutputFile(outPath, text) {
  const absolutePath = path.resolve(repoRoot, outPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, text, 'utf8');
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    printUsage();
    return;
  }

  const index = await loadManifest();
  const fixtures = await loadFixtures(index);

  if (options.list) {
    if (options.json) {
      const output = `${JSON.stringify(fixtures.map((entry) => entry.fixture.id), null, 2)}\n`;
      if (!options.quiet) process.stdout.write(output);
      if (options.out) {
        await writeOutputFile(options.out, output);
      }
    } else {
      const lines = [];
      for (const entry of fixtures) {
        lines.push(entry.fixture.id);
      }
      const output = `${lines.join('\n')}\n`;
      if (!options.quiet) process.stdout.write(output);
      if (options.out) {
        await writeOutputFile(options.out, output);
      }
    }
    return;
  }

  const adapter = await loadAdapter(options.adapter);
  const results = [];
  for (const entry of fixtures) {
    if (!adapter) {
      results.push(makePlaceholderResult(entry));
      continue;
    }
    results.push(await runWithAdapter(adapter, entry));
  }

  const summary = summarize(results, adapter);
  if (options.json) {
    const output = `${JSON.stringify(summary, null, 2)}\n`;
    if (!options.quiet) process.stdout.write(output);
    if (options.out) {
      await writeOutputFile(options.out, output);
    }
  } else {
    if (!options.quiet) printText(summary);
    if (options.out) {
      const output = `${JSON.stringify(summary, null, 2)}\n`;
      await writeOutputFile(options.out, output);
    }
  }

  if (summary.totals.fail > 0 || summary.totals.error > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
