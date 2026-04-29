import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const vscodeRoot = path.join(repoRoot, 'vscode');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const manifest = JSON.parse(await fs.readFile(path.join(vscodeRoot, 'package.json'), 'utf8'));
const config = JSON.parse(await fs.readFile(path.join(vscodeRoot, 'language-configuration.json'), 'utf8'));
const grammar = JSON.parse(await fs.readFile(path.join(vscodeRoot, 'syntaxes/and.tmLanguage.json'), 'utf8'));
const readme = await fs.readFile(path.join(vscodeRoot, 'README.md'), 'utf8');
const sample = await fs.readFile(path.join(vscodeRoot, 'samples/reference.and'), 'utf8');
const tokenSnapshot = JSON.parse(await fs.readFile(path.join(vscodeRoot, 'samples/reference.tokens.json'), 'utf8'));

function collectScopeNames(value, scopes = new Set()) {
  if (Array.isArray(value)) {
    for (const entry of value) collectScopeNames(entry, scopes);
    return scopes;
  }
  if (!value || typeof value !== 'object') return scopes;
  if (typeof value.name === 'string') scopes.add(value.name);
  for (const nested of Object.values(value)) collectScopeNames(nested, scopes);
  return scopes;
}

const scopeNames = collectScopeNames(grammar);

assert(manifest.contributes?.languages?.[0]?.id === 'and', 'VS Code manifest should register the and language id');
assert(manifest.contributes.languages[0].extensions.includes('.and'), 'VS Code manifest should register .and files');
assert(manifest.contributes?.grammars?.[0]?.scopeName === 'text.and', 'VS Code grammar scope should be text.and');
assert(config.brackets?.some((pair) => pair[0] === '[' && pair[1] === ']'), 'language configuration should register square brackets');
assert(Array.isArray(grammar.patterns) && grammar.patterns.length > 0, 'grammar should expose top-level patterns');
assert(grammar.repository?.code_block, 'grammar should define code block tokenization');
assert(grammar.repository?.extension_block, 'grammar should define extension block tokenization');
assert(grammar.repository?.reserved, 'grammar should define reserved inline tokenization');
assert(readme.includes('lexical only'), 'VS Code prototype README should describe the lexical boundary');
assert(Array.isArray(tokenSnapshot.expectations) && tokenSnapshot.expectations.length > 0, 'token snapshot manifest should define expectations');

for (const expectation of tokenSnapshot.expectations) {
  assert(typeof expectation.contains === 'string' && sample.includes(expectation.contains), `sample should contain snapshot fragment: ${expectation.label}`);
  assert(Array.isArray(expectation.scopes) && expectation.scopes.length > 0, `snapshot should declare scopes: ${expectation.label}`);
  for (const scope of expectation.scopes) {
    assert(scopeNames.has(scope), `grammar should expose declared snapshot scope ${scope} (${expectation.label})`);
  }
}

console.log('VS Code prototype checks passed.');
