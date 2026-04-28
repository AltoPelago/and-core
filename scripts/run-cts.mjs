#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const fixturesRoot = path.join(repoRoot, 'cts', 'fixtures');
const indexPath = path.join(fixturesRoot, 'index.json');

function printUsage() {
  console.log(`Usage: node scripts/run-cts.mjs [--adapter ./path/to/adapter.mjs] [--json] [--list] [--out ./path/to/report.json]

Options:
  --adapter <path>   Load a CTS adapter module that exports runFixture(fixture, context)
  --json             Emit machine-readable JSON instead of text
  --list             List fixture ids and exit
  --out <path>       Write the emitted report to a file
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    adapter: null,
    json: false,
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
  const documentCheck = documentSupported
    ? compareDocumentExpectation(expectedDocument, result.document)
    : {
        checked: false,
        match: undefined,
        notes: documentExpectationPresent
          ? ['Document AST expectation skipped; adapter does not declare document capability.']
          : [],
      };
  const status = documentCheck.checked && documentCheck.match === false
    ? 'fail'
    : result.status ?? 'error';

  return {
    id: entry.fixture.id,
    path: entry.path,
    status,
    mode: entry.fixture.mode,
    expectedOk: entry.fixture.expected.ok,
    actualOk: result.actualOk,
    errorCode: result.errorCode,
    documentExpected: documentExpectationPresent,
    documentChecked: documentCheck.checked,
    documentMatch: documentCheck.match,
    notes: [
      ...(Array.isArray(result.notes) ? result.notes : []),
      ...documentCheck.notes,
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

  for (const result of results) {
    counts[result.status] = (counts[result.status] ?? 0) + 1;
  }

  return {
    ok: counts.fail === 0 && counts.error === 0,
    mode: adapter ? 'adapter' : 'placeholder',
    adapter: adapter?.path ?? null,
    totals: {
      fixtures: results.length,
      ...counts,
    },
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
      process.stdout.write(output);
      if (options.out) {
        await writeOutputFile(options.out, output);
      }
    } else {
      const lines = [];
      for (const entry of fixtures) {
        lines.push(entry.fixture.id);
      }
      const output = `${lines.join('\n')}\n`;
      process.stdout.write(output);
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
    process.stdout.write(output);
    if (options.out) {
      await writeOutputFile(options.out, output);
    }
  } else {
    printText(summary);
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
