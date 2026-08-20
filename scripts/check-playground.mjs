import fs from 'node:fs/promises';
import path from 'node:path';

import { emitCanonical, parseAnd, renderHtml } from '../index.mjs';
import { examples } from '../playground/examples.mjs';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const index = await fs.readFile(path.join(repoRoot, 'playground/index.html'), 'utf8');
const app = await fs.readFile(path.join(repoRoot, 'playground/app.mjs'), 'utf8');
const styles = await fs.readFile(path.join(repoRoot, 'playground/styles.css'), 'utf8');

assert(index.includes('src="./app.mjs"'), 'playground index should load app.mjs');
assert(index.includes('href="./styles.css"'), 'playground index should load styles.css');
assert(index.includes('data-tab="html"'), 'playground should expose an HTML output tab');
assert(index.includes('data-budget="maxLineLength"'), 'playground should expose parser budget controls');
assert(index.includes('id="version"'), 'playground should expose an explicit parser-version selector');
assert(index.includes('id="example"'), 'playground should expose an example selector');
assert(index.includes('value="v2">v2 capabilities'), 'playground should expose a visible v2 example');
assert(app.includes("from '../index.mjs'"), 'playground should import the root public API');
assert(app.includes('function readBudgets()'), 'playground should read optional parser budgets');
assert(app.includes('nd_budget_exceeded'), 'playground should explain budget diagnostics');
assert(app.includes("allowV2: selectedVersion === 'v2'"), 'playground should gate v2 through explicit selection');
assert(app.includes("import { examples } from './examples.mjs'"), 'playground should load shared version-aware examples');
assert(app.includes('function loadExample('), 'playground should load source and parser version together');
assert(app.includes("loadExample(elements.example.value)"), 'playground reset should restore the selected example');
assert(styles.includes('@media (max-width: 900px)'), 'playground should include a mobile layout breakpoint');
assert(styles.includes('.budget-grid'), 'playground should style parser budget controls');
assert(styles.includes('.source-actions select'), 'playground should style the parser-version selector');
assert(styles.includes('.preview .and-code-block figcaption'), 'playground should style visible code block language tags');
assert(styles.includes('.preview .and-highlight-paragraph'), 'playground should visibly style highlighted paragraph blocks');
assert(styles.includes('.preview .and-callout-content'), 'playground should style inline advisory callouts');
assert(styles.includes('.preview .and-advisory-paragraph'), 'playground should style advisory paragraph blocks');

const source = `&ND v1

# Playground

This is [* deterministic] prose with [/ visible structure].

\`\`\`aeon
title = "Playground"
mode = "strict"
\`\`\`

\`\`\`\`aeon
title = "Playground"
mode = "ordered"
\`\`\`\`

| Name | Note |
| --- | --- |
| &ND | escaped \\| pipe |
`;

const result = parseAnd(source, { includeSpans: true });
assert(result.ok, `playground smoke source should parse: ${result.errorCode ?? 'unknown_error'}`);

const budgetResult = parseAnd(source, { includeSpans: true, budgets: { maxLineLength: 5 } });
assert(!budgetResult.ok, 'playground smoke source should fail under an intentionally tiny line budget');
assert(budgetResult.errorCode === 'nd_budget_exceeded', 'tiny line budget should report nd_budget_exceeded');

const canonical = emitCanonical(result.document, { profile: 'standalone' });
assert(canonical.startsWith('&ND v1\n\n# Playground\n\n'), 'playground source should emit standalone canonical text');
assert(canonical.includes('```aeon\ntitle = "Playground"\nmode = "strict"\n```'), 'playground source should preserve aeon code blocks');
assert(canonical.includes('````aeon\ntitle = "Playground"\nmode = "ordered"\n````'), 'playground source should preserve ordered aeon code blocks');
assert(canonical.includes('escaped \\| pipe'), 'canonical table output should preserve escaped table pipes');

assert(examples.v1.version === 'v1' && examples.v1.source.startsWith('&ND v1'), 'v1 example metadata should agree with its declaration');
assert(examples.v2.version === 'v2' && examples.v2.source.startsWith('&ND v2'), 'v2 example metadata should agree with its declaration');
const v1ExampleResult = parseAnd(examples.v1.source, { includeSpans: true });
assert(v1ExampleResult.ok && v1ExampleResult.version === 'v1', 'playground v1 example should parse dollar code fences');
const v1ExampleCanonical = emitCanonical(v1ExampleResult.document, { profile: 'standalone', version: v1ExampleResult.version });
assert(v1ExampleCanonical.includes('```aeon\ntitle = "Playground"\nmode = "strict"\n```'), 'v1 canonical output should normalize an unnumbered dollar fence to backticks');
assert(v1ExampleCanonical.includes('````aeon\ntitle = "Playground"\nmode = "ordered"\n````'), 'v1 canonical output should retain ordered backtick fences');

const v2Result = parseAnd(examples.v2.source, { allowV2: true, version: examples.v2.version, includeSpans: true });
assert(v2Result.ok && v2Result.version === 'v2', 'playground v2 selection should parse v2 input');
const v2Canonical = emitCanonical(v2Result.document, { profile: 'standalone', version: v2Result.version });
const reparsedV2 = parseAnd(v2Canonical, { allowV2: true });
assert(reparsedV2.ok && reparsedV2.version === 'v2', 'playground v2 canonical output should reparse as v2');
assert(v2Canonical.includes('\\# This is literal heading text, not a heading'), 'playground v2 canonical output should preserve required structural escapes');
assert(v2Canonical.includes('~~~$ aeon\ntitle = "v2 code"\nmode = "plain"\n~~~$'), 'playground v2 canonical output should preserve language-tagged dollar code blocks');
assert(v2Canonical.includes('~~~$ [n] aeon\ntitle = "v2 code"\nmode = "numbered"\n~~~$'), 'playground v2 canonical output should preserve numbered dollar code blocks');
const v2Html = renderHtml(v2Result.document);
assert(v2Html.includes('<p># This is literal heading text, not a heading</p>'), 'playground v2 preview should decode an escaped heading opener as paragraph text');
assert(v2Html.includes('data-auto-number="true"'), 'playground v2 preview should preserve auto-number intent');
assert(v2Html.includes('<span class="and-heading-number">1.</span>'), 'playground v2 preview should display heading numbers');
assert(v2Html.includes('<span class="and-heading-number">1.1.</span>'), 'playground v2 preview should display hierarchical heading numbers');
assert(v2Html.includes('class="and-auto-number-list"'), 'playground v2 preview should render first-class auto-number lists');
assert(v2Html.includes('class="and-directional-list-item"'), 'playground v2 preview should replace directional list bullets');
assert(v2Html.includes('class="and-directional-list-marker"'), 'playground v2 preview should render leading arrows as list markers');
assert(v2Html.includes('class="and-footnote-reference"'), 'playground v2 preview should render footnote references');
assert(v2Html.includes('class="and-footnotes"'), 'playground v2 preview should render endnotes');
assert(v2Html.includes('id="overview"'), 'playground v2 preview should render anchors');
assert(v2Html.includes('href="#overview"'), 'playground v2 preview should link local references');
assert(v2Html.includes('class="and-image and-image-inline"'), 'playground v2 preview should render inline images');
assert(v2Html.includes('alt="Ampersand ND sample"'), 'playground v2 preview should preserve image alt text');
assert(v2Html.includes('class="and-code-block" data-language="aeon"'), 'playground v2 preview should render language-tagged code blocks');
assert(v2Html.includes('class="and-code-block and-code-block-ordered"'), 'playground v2 preview should render numbered code blocks');
assert(v2Html.includes('class="and-code-lines"'), 'playground v2 preview should number code lines');
assert(v2Html.includes('class="and-highlight-paragraph"'), 'playground v2 preview should render paired blocks');
assert(v2Html.includes('class="and-strong-paragraph"'), 'playground v2 preview should render strong paragraph blocks');
assert(v2Html.includes('class="and-emphasis-paragraph"'), 'playground v2 preview should render emphasis paragraph blocks');
assert(v2Html.includes('class="and-underline-paragraph"'), 'playground v2 preview should render underline paragraph blocks');
assert(v2Html.includes('class="and-callout and-question" tabindex="0"'), 'playground v2 preview should render keyboard-focusable inline hints');
assert(v2Html.includes('class="and-callout and-admonition" tabindex="0"'), 'playground v2 preview should render keyboard-focusable inline admonitions');
assert(v2Html.includes('class="and-advisory-list-item"'), 'playground v2 preview should replace advisory list bullets');
assert(v2Html.includes('and-question-paragraph'), 'playground v2 preview should render hint paragraph blocks');
assert(v2Html.includes('and-admonition-paragraph'), 'playground v2 preview should render attention paragraph blocks');
assert(v2Html.includes('class="and-comment-block" hidden'), 'playground v2 preview should preserve hidden block comments');
assert(v2Html.includes('class="and-disclaimer-inline"'), 'playground v2 preview should render inline disclaimers');
assert(v2Canonical.includes('[(consumer-term) like ordinary rich text]'), 'playground v2 canonical output should preserve inline semantic IDs');
assert(v2Canonical.includes('~~~(consumer-tone)'), 'playground v2 canonical output should preserve semantic block IDs');
assert(v2Html.includes('This semantic block appears like an ordinary paragraph'), 'playground v2 preview should retain semantic block content');
assert(!v2Html.includes('consumer-term') && !v2Html.includes('consumer-tone'), 'playground v2 preview must not expose semantic IDs');

console.log('Playground checks passed.');
