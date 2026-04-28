#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const fixturesRoot = path.join(repoRoot, 'cts', 'fixtures');
const indexPath = path.join(fixturesRoot, 'index.json');

function printUsage() {
  console.log(`Usage: node scripts/run-cts.mjs [--adapter ./path/to/adapter.mjs] [--json] [--list]

Options:
  --adapter <path>   Load a CTS adapter module that exports runFixture(fixture, context)
  --json             Emit machine-readable JSON instead of text
  --list             List fixture ids and exit
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    adapter: null,
    json: false,
    list: false,
    help: false,
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
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.adapter === null && args.includes('--adapter')) {
    throw new Error('Missing value for --adapter');
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
  });

  if (typeof result !== 'object' || result === null) {
    throw new Error(`Adapter returned invalid result for ${entry.path}`);
  }

  return {
    id: entry.fixture.id,
    path: entry.path,
    status: result.status ?? 'error',
    mode: entry.fixture.mode,
    expectedOk: entry.fixture.expected.ok,
    actualOk: result.actualOk,
    errorCode: result.errorCode,
    notes: Array.isArray(result.notes) ? result.notes : [],
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
      process.stdout.write(JSON.stringify(fixtures.map((entry) => entry.fixture.id), null, 2));
      process.stdout.write('\n');
    } else {
      for (const entry of fixtures) {
        console.log(entry.fixture.id);
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
    process.stdout.write(JSON.stringify(summary, null, 2));
    process.stdout.write('\n');
  } else {
    printText(summary);
  }

  if (summary.totals.fail > 0 || summary.totals.error > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
