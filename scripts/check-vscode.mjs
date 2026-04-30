import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const vscodeRoot = path.join(repoRoot, 'vscode');
const launchPath = path.join(repoRoot, '.vscode', 'launch.json');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const manifest = JSON.parse(await fs.readFile(path.join(vscodeRoot, 'package.json'), 'utf8'));
const config = JSON.parse(await fs.readFile(path.join(vscodeRoot, 'language-configuration.json'), 'utf8'));
const grammar = JSON.parse(await fs.readFile(path.join(vscodeRoot, 'syntaxes/and.tmLanguage.json'), 'utf8'));
const launchConfig = JSON.parse(await fs.readFile(launchPath, 'utf8'));
const extensionSource = await fs.readFile(path.join(vscodeRoot, 'extension.cjs'), 'utf8');
const readme = await fs.readFile(path.join(vscodeRoot, 'README.md'), 'utf8');
const sample = await fs.readFile(path.join(vscodeRoot, 'samples/reference.and'), 'utf8');
const diagnosticsDemo = await fs.readFile(path.join(vscodeRoot, 'samples/diagnostics-demo.and'), 'utf8');
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
assert(manifest.main === './extension.cjs', 'VS Code manifest should declare the extension entrypoint');
assert(manifest.activationEvents?.includes('onLanguage:and'), 'VS Code manifest should activate on and documents');
assert(launchConfig.version === '0.2.0', 'launch config should use the standard VS Code schema version');
assert(Array.isArray(launchConfig.configurations) && launchConfig.configurations.length > 0, 'launch config should define at least one runnable configuration');
assert(launchConfig.configurations.some((entry) => entry.type === 'extensionHost' && entry.name === 'Run &ND VS Code Prototype'), 'launch config should expose the extension-host prototype workflow');
assert(launchConfig.configurations.some((entry) => Array.isArray(entry.args) && entry.args.includes('--extensionDevelopmentPath=${workspaceFolder}/vscode')), 'launch config should target the local vscode prototype');
assert(config.brackets?.some((pair) => pair[0] === '[' && pair[1] === ']'), 'language configuration should register square brackets');
assert(Array.isArray(grammar.patterns) && grammar.patterns.length > 0, 'grammar should expose top-level patterns');
assert(grammar.repository?.code_block, 'grammar should define code block tokenization');
assert(grammar.repository?.extension_block, 'grammar should define extension block tokenization');
assert(grammar.repository?.reserved, 'grammar should define reserved inline tokenization');
assert(readme.includes('Run &ND VS Code Prototype'), 'VS Code prototype README should document the repo launch workflow');
assert(readme.includes('samples/diagnostics-demo.and'), 'VS Code prototype README should mention the diagnostics demo file');
assert(extensionSource.includes("createDiagnosticCollection('and')"), 'extension should create an and diagnostic collection');
assert(extensionSource.includes('collectDiagnostics'), 'extension should use the parser-backed diagnostics adapter');
assert(extensionSource.includes('onDidChangeTextDocument'), 'extension should react to editor changes');
assert(extensionSource.includes('registerCodeActionsProvider'), 'extension should register quick-fix code actions');
assert(extensionSource.includes('block_opener_on_paragraph_continuation'), 'extension should expose a quick fix for paragraph/block boundary errors');
assert(extensionSource.includes('registerHoverProvider'), 'extension should register hover guidance');
assert(extensionSource.includes('unknown_inline_type'), 'extension should explain reserved inline syntax or common strict diagnostics');
assert(extensionSource.includes('registerCompletionItemProvider'), 'extension should register authoring completions');
assert(extensionSource.includes("'+++fallback'"), 'extension should offer fallback block completion');
assert(extensionSource.includes('[@ ${1:https://example.com} | ${2:label}]'), 'extension should offer inline link completion');
assert(extensionSource.includes('[* ${1:text}]'), 'extension should offer inline strong completion');
assert(extensionSource.includes('scanDocumentContext'), 'extension should scan simple document context for completion gating');
assert(extensionSource.includes('context.canOfferFallback'), 'extension should gate fallback completion by adjacency context');
assert(extensionSource.includes('canOfferBlockStarters'), 'extension should gate block starters by local structural context');
assert(extensionSource.includes('isBlockStarterLine'), 'extension should classify previous lines before offering block starters');
assert(readme.includes('quick fixes'), 'VS Code prototype README should mention supported quick fixes');
assert(readme.includes('hover'), 'VS Code prototype README should mention hover guidance');
assert(readme.includes('completions'), 'VS Code prototype README should mention completions');
assert(readme.includes('npm run vscode:package'), 'VS Code prototype README should mention the local packaging script');
assert(readme.includes('immediately after a closed extension block'), 'VS Code prototype README should document fallback completion gating');
assert(readme.includes('continue a paragraph without the required blank-line separation'), 'VS Code prototype README should document paragraph-continuation completion suppression');
assert(Array.isArray(tokenSnapshot.expectations) && tokenSnapshot.expectations.length > 0, 'token snapshot manifest should define expectations');
assert(diagnosticsDemo.startsWith('&ND v1'), 'diagnostics demo should be a versioned and document');
assert(diagnosticsDemo.includes('---'), 'diagnostics demo should contain a deliberate strict-mode failure trigger');

for (const expectation of tokenSnapshot.expectations) {
  assert(typeof expectation.contains === 'string' && sample.includes(expectation.contains), `sample should contain snapshot fragment: ${expectation.label}`);
  assert(Array.isArray(expectation.scopes) && expectation.scopes.length > 0, `snapshot should declare scopes: ${expectation.label}`);
  for (const scope of expectation.scopes) {
    assert(scopeNames.has(scope), `grammar should expose declared snapshot scope ${scope} (${expectation.label})`);
  }
}

console.log('VS Code prototype checks passed.');
