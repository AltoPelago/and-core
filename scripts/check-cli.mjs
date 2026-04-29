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
const canonicalPath = path.join(tempDir, 'canonical.and');

await fs.writeFile(validPath, '&ND v1\n\n# Title\n\nMy number is\n1. not a list\n');
await fs.writeFile(invalidPath, '&ND v2\n\n# Title\n');
await fs.writeFile(invalidBodyPath, '&ND v1\n\nText\n---\n');

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
assert(JSON.parse(parseValidWithSpans.stdout).document.span.startLine === 1, 'parse --spans should emit document spans');
assert(
  JSON.parse(parseValidWithSpans.stdout).document.children[0].span.startLine === 3,
  'parse --spans should emit block spans after headers'
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

console.log('CLI smoke checks passed.');
