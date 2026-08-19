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
assert(parsed.version === 'v1', 'public parse should report the effective v1 version');
assert(parsed.document.type === 'document', 'public parse should return a document root');
assert(parsed.document.children[0].type === 'heading', 'public parse should expose block nodes');

const inline = parseInline('Hello [* world]');
assert(inline.ok, `public inline parse should succeed: ${inline.errorCode ?? 'unknown_error'}`);
assert(inline.children.length === 2, 'public inline parse should expose inline children');

const v2Source = '&ND v2\n\n# [n] Public API\n\nStart[# api][.]End\n';
const parsedV2 = parseAnd(v2Source, { allowV2: true, includeSpans: true });
assert(parsedV2.ok && parsedV2.version === 'v2', 'public parse should expose opt-in v2 capability');
const inlineV2 = parseInline('[# api]', { allowV2: true, version: 'v2' });
assert(inlineV2.ok && inlineV2.children[0].type === 'anchor_tag', 'public inline parse should expose explicit v2');

const diagnostics = collectDiagnostics('&ND v2\n');
assert(!diagnostics.ok, 'public diagnostics should surface invalid input');
assert(diagnostics.diagnostics[0].code === 'invalid_header', 'public diagnostics should retain stable codes');

const canonical = emitCanonical(parsed.document, { profile: 'standalone' });
assert(canonical.startsWith('&ND v1\n\n# Public API\n\n'), 'public canonical emission should succeed');
const canonicalV2 = emitCanonical(parsedV2.document, { profile: 'standalone', version: parsedV2.version });
assert(canonicalV2 === v2Source, 'public canonical emission should preserve v2 syntax and declaration');

const html = renderHtml(parsed.document);
assert(html.includes('<h1>Public API</h1>'), 'public HTML projection should succeed');
const htmlV2 = renderHtml(parsedV2.document);
assert(htmlV2.includes('data-auto-number="true"'), 'public HTML projection should render v2 intent');

console.log('Public API checks passed.');
