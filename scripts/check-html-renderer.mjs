import fs from 'node:fs/promises';
import path from 'node:path';

import { parseAnd, renderHtml } from '../index.mjs';

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

This is [* strong], [/ emphasis], [$ <code>], and [@ https://example.com?a=1&b=2 | a link].

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
  fragment.includes('<a href="https://example.com?a=1&amp;b=2" target="_blank" rel="noopener noreferrer nofollow" referrerpolicy="no-referrer">a link</a>'),
  'renderer should harden external safe href attributes'
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

const v2Source = `&ND v2

# [n] Proposal

[# anchor][@ #anchor | anchor][! caution][? why][+ custom][~ image.jpg | Sample image][~ diagram.png | Diagram | half][~ /hero.jpg | Hero | full][- old [* nested]][" quote][' hidden][:date = 2026-08-20][= marked][_ under][ ][x][,][;][>][<][%][.]

~~~=
Highlighted
~~~=

===hero
Header text
===

***legal
Disclaimer
***
`;
const parsedV2 = parseAnd(v2Source, { allowV2: true });
assert(parsedV2.ok, `v2 renderer smoke source should parse: ${parsedV2.errorCode ?? 'unknown_error'}`);
const v2Fragment = renderHtml(parsedV2.document);
assert(v2Fragment.includes('<h1 class="and-auto-numbered" data-auto-number="true">Proposal</h1>'), 'renderer should project v2 heading auto-number intent');
assert(v2Fragment.includes('<span class="and-anchor" id="anchor" aria-hidden="true"></span>'), 'renderer should project v2 anchors');
assert(v2Fragment.includes('<a href="#anchor">anchor</a>'), 'renderer should project inherited links to v2 local anchors');
assert(v2Fragment.includes('class="and-image and-image-inline" src="image.jpg" alt="Sample image"'), 'renderer should project inline images with alt text');
assert(v2Fragment.includes('class="and-image and-image-half" srcset="diagram.png 2x" alt="Diagram"'), 'renderer should express half intrinsic dimensions through image density');
assert(v2Fragment.includes('class="and-image and-image-full" src="/hero.jpg" alt="Hero"'), 'renderer should project full intrinsic image intent');
assert(v2Fragment.includes('<s>old <strong>nested</strong></s>'), 'renderer should preserve nested content in rich v2 tags');
assert(v2Fragment.includes('<q>quote</q>'), 'renderer should project v2 quoted tags');
assert(v2Fragment.includes('<span class="and-comment" hidden>hidden</span>'), 'renderer should keep v2 comments inert');
assert(v2Fragment.includes('<data class="and-typed-value" data-type="date" value="2026-08-20">2026-08-20</data>'), 'renderer should project AEON scalar typed values without interpreting them');
assert(v2Fragment.includes('<mark>marked</mark>'), 'renderer should project v2 highlights');
assert(v2Fragment.includes('<u>under</u>'), 'renderer should project v2 underlines');
assert(v2Fragment.includes('data-state="in_progress"'), 'renderer should project v2 todo states');
assert(v2Fragment.includes('data-direction="forward"'), 'renderer should project v2 directions');
assert(v2Fragment.includes('class="and-auto-number-marker"'), 'renderer should project v2 inline auto-number intent');
assert(v2Fragment.includes('<br>'), 'renderer should project v2 explicit line breaks');
assert(v2Fragment.includes('<p class="and-highlight-paragraph">Highlighted</p>'), 'renderer should project v2 highlighted blocks');
assert(v2Fragment.includes('<header class="and-header-text" data-tag="hero">Header text</header>'), 'renderer should project v2 header-text blocks');
assert(v2Fragment.includes('<aside class="and-disclaimer" data-tag="legal">Disclaimer</aside>'), 'renderer should project v2 disclaimer blocks');

const unsafeImage = renderHtml({
  type: 'document',
  children: [{
    type: 'paragraph',
    children: [{ type: 'image_tag', src: 'javascript:alert(1)', alt: 'Unsafe image', mode: 'inline' }],
  }],
});
assert(!unsafeImage.includes('src="javascript:'), 'renderer should omit unsafe image schemes');
assert(unsafeImage.includes('alt="Unsafe image"'), 'renderer should retain alt text when omitting an unsafe image source');

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
