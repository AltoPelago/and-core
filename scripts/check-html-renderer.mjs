import fs from 'node:fs/promises';
import path from 'node:path';

import { renderHtml } from '../implementations/reference-html/renderer.mjs';
import { parseAnd } from '../implementations/reference-parser/parser.mjs';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outPath = outIndex === -1 ? null : args[outIndex + 1];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeEmptyTotals() {
  return {
    checked: 0,
    skipped: 0,
    failed: 0,
  };
}

async function checkFixtureRendering() {
  const indexPath = path.join(repoRoot, 'cts/fixtures/index.json');
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
      fragment: null,
      document: null,
      notes: [],
    };
    results.push(result);

    try {
      result.fragment = renderHtml(document);
      result.document = renderHtml(document, { fragment: false });
      result.status = 'pass';
      totals.checked += 1;
    } catch (error) {
      if (error.code?.startsWith('unsupported_')) {
        result.status = 'skipped';
        result.notes.push(error.code);
        totals.skipped += 1;
        continue;
      }

      result.status = 'failed';
      result.notes.push(error.code ?? error.message);
      totals.failed += 1;
      console.error(`FAIL ${fixture.id}: ${error.code ?? error.message}`);
    }
  }

  if (outPath) {
    const report = {
      generatedBy: 'scripts/check-html-renderer.mjs',
      totals: {
        fixtures: results.length,
        checked: totals.checked,
        skipped: totals.skipped,
        failed: totals.failed,
      },
      results,
    };
    await fs.mkdir(path.dirname(path.resolve(repoRoot, outPath)), { recursive: true });
    await fs.writeFile(path.resolve(repoRoot, outPath), `${JSON.stringify(report, null, 2)}\n`);
  }

  return totals;
}

const source = `&ND v1

+++document/meta
title = "Hello World"
author = "Patrik"
date = 2026-04-01
+++

# Render Me

This is [* strong], [/ emphasis], [$ <code>], A[_]B[<]Wrap, and [@ https://example.com?a=1&b=2 | a link].

[@ javascript:alert(1) | unsafe target]

\`\`\`html
<script>alert("nope")</script>
\`\`\`

\`\`\`aeon
title = "Hello World"
\`\`\`

\`\`\`\`aeon
title = "Hello World"
mode = "ordered"
\`\`\`\`

+++unsupported/extension
opaque extension payload
+++
+++fallback
Fallback [* content]
+++

| Name | Value |
| --- | --- |
| escaped | <tag> & text |
`;

const parsed = parseAnd(source);
assert(parsed.ok, `renderer smoke source should parse: ${parsed.errorCode ?? 'unknown_error'}`);

const fragment = renderHtml(parsed.document);
assert(fragment.includes('<h1>Render Me</h1>'), 'renderer should emit headings');
assert(fragment.includes('<strong>strong</strong>'), 'renderer should emit strong inline nodes');
assert(fragment.includes('<em>emphasis</em>'), 'renderer should emit emphasis inline nodes');
assert(fragment.includes('<code>&lt;code&gt;</code>'), 'renderer should escape inline code');
assert(fragment.includes('A&nbsp;B'), 'renderer should emit non-breaking spaces');
assert(fragment.includes('A&nbsp;B<br>Wrap'), 'renderer should emit inline hard line breaks');
assert(
  fragment.includes('<figure class="and-code-block" data-language="aeon">'),
  'renderer should wrap language-tagged code blocks in a block container'
);
assert(
  fragment.includes('<figcaption>aeon</figcaption>'),
  'renderer should show the code block language as a visible tag'
);
assert(
  fragment.includes('<figure class="and-code-block and-code-block-ordered" data-language="aeon" data-ordered="true">'),
  'renderer should expose ordered code blocks as a distinct block shape'
);
assert(
  fragment.includes('<ol class="and-code-lines">'),
  'renderer should render ordered code block lines as an ordered sequence'
);
assert(
  fragment.includes('<p>Fallback <strong>content</strong></p>'),
  'renderer should render parsed extension fallback content'
);
const unsupportedDiagnostic = renderHtml({
  type: 'document',
  children: [{ type: 'extension_block', name: 'chart/pie', text: 'apples: 30' }],
});
assert(
  unsupportedDiagnostic.includes('Unsupported extension: <code>chart/pie</code>. Opaque extension payload.'),
  'renderer should emit a diagnostic for unsupported extensions without fallback'
);
assert(
  unsupportedDiagnostic.includes('<details><summary>Open payload</summary>\n\n<pre><code>apples: 30</code></pre>\n</details>'),
  'renderer should expose opaque extension payload in diagnostic details'
);
assert(
  fragment.includes('<a href="https://example.com?a=1&amp;b=2">a link</a>'),
  'renderer should escape safe href attributes'
);
assert(
  fragment.includes('<a aria-disabled="true" title="Unsafe link target omitted">unsafe target</a>'),
  'renderer should omit unsafe href attributes'
);
assert(fragment.includes('&lt;script&gt;alert(&quot;nope&quot;)&lt;/script&gt;'), 'renderer should escape code blocks');
assert(fragment.includes('<td>&lt;tag&gt; &amp; text</td>'), 'renderer should escape table cells');

const fullDocument = renderHtml(parsed.document, { fragment: false });
assert(fullDocument.startsWith('<!doctype html>\n<html lang="en">'), 'renderer should emit full HTML documents');
assert(fullDocument.endsWith('</html>\n'), 'full HTML document should end with a newline');

let unsupportedError = null;
try {
  renderHtml({ type: 'document', children: [{ type: 'future_block' }] });
} catch (error) {
  unsupportedError = error;
}

assert(unsupportedError?.code === 'unsupported_block_node', 'renderer should fail closed on unsupported blocks');

const totals = await checkFixtureRendering();
console.log(`htmlRenderer checked=${totals.checked} skipped=${totals.skipped} failed=${totals.failed}`);
if (totals.failed > 0 || totals.checked === 0) process.exit(1);
