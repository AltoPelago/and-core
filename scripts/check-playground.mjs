import fs from 'node:fs/promises';
import path from 'node:path';

import { emitCanonical, parseAnd } from '../index.mjs';

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
assert(app.includes("from '../index.mjs'"), 'playground should import the root public API');
assert(app.includes('function readBudgets()'), 'playground should read optional parser budgets');
assert(app.includes('nd_budget_exceeded'), 'playground should explain budget diagnostics');
assert(styles.includes('@media (max-width: 900px)'), 'playground should include a mobile layout breakpoint');
assert(styles.includes('.budget-grid'), 'playground should style parser budget controls');
assert(styles.includes('.preview .and-code-block figcaption'), 'playground should style visible code block language tags');

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

console.log('Playground checks passed.');
