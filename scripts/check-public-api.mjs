import { collectDiagnostics, emitCanonical, parseAnd, parseInline, renderHtml } from '../index.mjs';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const source = `&ND v1

# Public API

This is [* deterministic] prose.
`;

const parsed = parseAnd(source, { includeSpans: true });
assert(parsed.ok, `public parse should succeed: ${parsed.errorCode ?? 'unknown_error'}`);
assert(parsed.document.type === 'document', 'public parse should return a document root');
assert(parsed.document.children[0].type === 'heading', 'public parse should expose block nodes');

const inline = parseInline('Hello [* world]');
assert(inline.ok, `public inline parse should succeed: ${inline.errorCode ?? 'unknown_error'}`);
assert(inline.children.length === 2, 'public inline parse should expose inline children');

const diagnostics = collectDiagnostics('&ND v2\n');
assert(!diagnostics.ok, 'public diagnostics should surface invalid input');
assert(diagnostics.diagnostics[0].code === 'invalid_header', 'public diagnostics should retain stable codes');

const canonical = emitCanonical(parsed.document, { profile: 'standalone' });
assert(canonical.startsWith('&ND v1\n\n# Public API\n\n'), 'public canonical emission should succeed');

const html = renderHtml(parsed.document);
assert(html.includes('<h1>Public API</h1>'), 'public HTML projection should succeed');

console.log('Public API checks passed.');
