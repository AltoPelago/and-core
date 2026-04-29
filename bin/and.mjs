#!/usr/bin/env node
import fs from 'node:fs/promises';
import { emitCanonical } from '../implementations/reference-canonical/emitter.mjs';
import { renderHtml } from '../implementations/reference-html/renderer.mjs';
import { parseAnd } from '../implementations/reference-parser/parser.mjs';

function usage() {
  return `Usage:
  and check <file> [--json]
  and parse <file> [--json] [--spans]
  and canonical <file> --profile embedded|standalone [--out <file>]
  and render-html <file> [--fragment|--document] [--out <file>]
`;
}

function readOption(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function hasFlag(args, name) {
  return args.includes(name);
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function failurePayload(result) {
  return {
    ok: false,
    errorCode: result.errorCode,
    diagnostic: result.diagnostic,
  };
}

function formatFailure(result) {
  const diagnostic = result.diagnostic;
  if (diagnostic?.line && diagnostic?.column) {
    return `error ${result.errorCode} at ${diagnostic.line}:${diagnostic.column}\n`;
  }
  return `error ${result.errorCode}\n`;
}

async function readSource(filePath) {
  if (!filePath || filePath.startsWith('--')) {
    throw Object.assign(new Error('Missing input file.'), { code: 'missing_input' });
  }
  return fs.readFile(filePath, 'utf8');
}

async function commandCheck(filePath, args) {
  const source = await readSource(filePath);
  const result = parseAnd(source);
  if (hasFlag(args, '--json')) {
    writeJson(result.ok ? { ok: true } : failurePayload(result));
  } else {
    process.stdout.write(result.ok ? 'ok\n' : formatFailure(result));
  }
  return result.ok ? 0 : 1;
}

async function commandParse(filePath, args) {
  const source = await readSource(filePath);
  const result = parseAnd(source, { includeSpans: hasFlag(args, '--spans') });
  if (hasFlag(args, '--json')) {
    writeJson(result);
  } else if (result.ok) {
    process.stdout.write('ok\n');
  } else {
    process.stdout.write(formatFailure(result));
  }
  return result.ok ? 0 : 1;
}

async function commandCanonical(filePath, args) {
  const profile = readOption(args, '--profile');
  const outPath = readOption(args, '--out');
  const source = await readSource(filePath);
  const parsed = parseAnd(source);
  if (!parsed.ok) {
    writeJson(failurePayload(parsed));
    return 1;
  }

  try {
    const canonical = emitCanonical(parsed.document, { profile });
    if (outPath) {
      await fs.writeFile(outPath, canonical);
    } else {
      process.stdout.write(canonical);
    }
    return 0;
  } catch (error) {
    writeJson({ ok: false, errorCode: error.code ?? 'canonical_emit_failed' });
    return 1;
  }
}

async function commandRenderHtml(filePath, args) {
  if (hasFlag(args, '--fragment') && hasFlag(args, '--document')) {
    writeJson({
      ok: false,
      errorCode: 'conflicting_html_render_mode',
      message: 'Use either --fragment or --document, not both.',
    });
    return 1;
  }

  const outPath = readOption(args, '--out');
  const source = await readSource(filePath);
  const parsed = parseAnd(source);
  if (!parsed.ok) {
    writeJson(failurePayload(parsed));
    return 1;
  }

  try {
    const html = renderHtml(parsed.document, { fragment: !hasFlag(args, '--document') });
    if (outPath) {
      await fs.writeFile(outPath, html);
    } else {
      process.stdout.write(html);
      if (!html.endsWith('\n')) process.stdout.write('\n');
    }
    return 0;
  } catch (error) {
    writeJson({ ok: false, errorCode: error.code ?? 'html_render_failed' });
    return 1;
  }
}

async function main() {
  const [command, filePath, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(usage());
    return 0;
  }

  switch (command) {
    case 'check':
      return commandCheck(filePath, args);
    case 'parse':
      return commandParse(filePath, args);
    case 'canonical':
      return commandCanonical(filePath, args);
    case 'render-html':
      return commandRenderHtml(filePath, args);
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${usage()}`);
      return 2;
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  writeJson({ ok: false, errorCode: error.code ?? 'cli_error', message: error.message });
  process.exitCode = 1;
}
