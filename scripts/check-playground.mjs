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

const v2Result = parseAnd(examples.v2.source, { allowV2: true, version: examples.v2.version, includeSpans: true });
assert(v2Result.ok && v2Result.version === 'v2', 'playground v2 selection should parse v2 input');
const v2Canonical = emitCanonical(v2Result.document, { profile: 'standalone', version: v2Result.version });
const reparsedV2 = parseAnd(v2Canonical, { allowV2: true });
assert(reparsedV2.ok && reparsedV2.version === 'v2', 'playground v2 canonical output should reparse as v2');
const v2Html = renderHtml(v2Result.document);
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

console.log('Playground checks passed.');
