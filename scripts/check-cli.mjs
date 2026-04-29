import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const cliPath = path.join(repoRoot, 'bin/and.mjs');

async function run(args, options = {}) {
  try {
    const result = await execFileAsync('node', [cliPath, ...args], {
      cwd: repoRoot,
      ...options,
    });
    return { ok: true, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      ok: false,
      code: error.code,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'and-cli-'));
const validPath = path.join(tempDir, 'valid.and');
const invalidPath = path.join(tempDir, 'invalid.and');
const invalidBodyPath = path.join(tempDir, 'invalid-body.and');
const tablePath = path.join(tempDir, 'table.and');
const canonicalPath = path.join(tempDir, 'canonical.and');
const htmlPath = path.join(tempDir, 'document.html');

await fs.writeFile(validPath, '&ND v1\n\n# Title\n\nMy number is\n1. not a list\n');
await fs.writeFile(invalidPath, '&ND v2\n\n# Title\n');
await fs.writeFile(invalidBodyPath, '&ND v1\n\nText\n---\n');
await fs.writeFile(
  tablePath,
  '&ND v1\n\n|  Name  | Link\\|Text |\n| --- | --- |\n|  Alpha | [* Strong] |\n'
);

const checkValid = await run(['check', validPath]);
assert(checkValid.ok && checkValid.stdout === 'ok\n', 'check should accept a valid document');

const checkInvalid = await run(['check', invalidPath, '--json']);
assert(!checkInvalid.ok, 'check should reject an invalid document');
assert(JSON.parse(checkInvalid.stdout).errorCode === 'invalid_header', 'check should report invalid_header');
assert(JSON.parse(checkInvalid.stdout).diagnostic.line === 1, 'check should report diagnostic line');
assert(JSON.parse(checkInvalid.stdout).diagnostic.column === 1, 'check should report diagnostic column');

const checkInvalidBody = await run(['check', invalidBodyPath, '--json']);
assert(!checkInvalidBody.ok, 'check should reject invalid body syntax');
assert(JSON.parse(checkInvalidBody.stdout).diagnostic.line === 4, 'body diagnostics should include header line offset');

const parseValid = await run(['parse', validPath, '--json']);
assert(parseValid.ok, 'parse --json should accept a valid document');
assert(JSON.parse(parseValid.stdout).document.children.length === 2, 'parse --json should emit an AST');

const parseValidWithSpans = await run(['parse', validPath, '--json', '--spans']);
assert(parseValidWithSpans.ok, 'parse --json --spans should accept a valid document');
const parsedWithSpans = JSON.parse(parseValidWithSpans.stdout);
assert(parsedWithSpans.document.span.startLine === 1, 'parse --spans should emit document spans');
assert(
  parsedWithSpans.document.children[0].span.startLine === 3,
  'parse --spans should emit block spans after headers'
);
assert(
  parsedWithSpans.document.children[0].children[0].span.startColumn === 3,
  'parse --spans should emit heading inline spans after heading markers'
);
assert(
  parsedWithSpans.document.children[1].children[0].span.startLine === 5,
  'parse --spans should emit paragraph inline spans'
);

const parseTableWithSpans = await run(['parse', tablePath, '--json', '--spans']);
assert(parseTableWithSpans.ok, 'parse --json --spans should accept a valid table document');
const parsedTable = JSON.parse(parseTableWithSpans.stdout);
assert(
  parsedTable.document.children[0].header[0].children[0].span.startColumn === 4,
  'table cell spans should ignore leading cell padding'
);
assert(
  parsedTable.document.children[0].header[1].children[0].value === 'Link|Text',
  'table cell parsing should preserve escaped pipe semantics'
);
assert(
  parsedTable.document.children[0].header[1].children[0].span.startColumn === 12,
  'table cell spans should account for escaped pipes before later cells'
);
assert(
  parsedTable.document.children[0].rows[0][1].children[0].span.startColumn === 12,
  'table nested inline spans should start at the trimmed cell content'
);
assert(
  parsedTable.document.children[0].rows[0][1].children[0].children[0].span.startColumn === 15,
  'table nested inline child spans should account for inline opener width'
);

const canonicalEmbedded = await run(['canonical', validPath, '--profile', 'embedded']);
assert(canonicalEmbedded.ok, 'canonical embedded should succeed');
assert(canonicalEmbedded.stdout === '# Title\n\nMy number is 1. not a list\n', 'embedded canonical output mismatch');

const canonicalStandalone = await run(['canonical', validPath, '--profile', 'standalone', '--out', canonicalPath]);
assert(canonicalStandalone.ok, 'canonical standalone --out should succeed');
assert(
  await fs.readFile(canonicalPath, 'utf8') === '&ND v1\n\n# Title\n\nMy number is 1. not a list\n',
  'standalone canonical output mismatch'
);

const canonicalMissingProfile = await run(['canonical', validPath]);
assert(!canonicalMissingProfile.ok, 'canonical should require --profile');
assert(
  JSON.parse(canonicalMissingProfile.stdout).errorCode === 'missing_canonical_profile',
  'canonical should report missing_canonical_profile'
);

const renderHtmlFragment = await run(['render-html', validPath]);
assert(renderHtmlFragment.ok, 'render-html should succeed for a valid document');
assert(
  renderHtmlFragment.stdout === '<h1>Title</h1>\n<p>My number is\n1. not a list</p>\n',
  'render-html fragment output mismatch'
);

const renderHtmlDocument = await run(['render-html', validPath, '--document', '--out', htmlPath]);
assert(renderHtmlDocument.ok, 'render-html --document --out should succeed');
const htmlDocument = await fs.readFile(htmlPath, 'utf8');
assert(htmlDocument.startsWith('<!doctype html>\n<html lang="en">'), 'render-html --document should emit a full HTML document');
assert(htmlDocument.includes('<h1>Title</h1>'), 'render-html --document should include rendered body content');

const renderHtmlConflictingMode = await run(['render-html', validPath, '--fragment', '--document']);
assert(!renderHtmlConflictingMode.ok, 'render-html should reject conflicting mode flags');
assert(
  JSON.parse(renderHtmlConflictingMode.stdout).errorCode === 'conflicting_html_render_mode',
  'render-html should report conflicting_html_render_mode'
);

const renderHtmlInvalid = await run(['render-html', invalidBodyPath]);
assert(!renderHtmlInvalid.ok, 'render-html should reject invalid source');
assert(
  JSON.parse(renderHtmlInvalid.stdout).errorCode === 'block_opener_on_paragraph_continuation',
  'render-html should report parser error codes'
);

console.log('CLI smoke checks passed.');
