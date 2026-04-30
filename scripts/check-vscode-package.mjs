import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const vscodeRoot = path.join(repoRoot, 'vscode');
const artifactsRoot = path.join(repoRoot, 'artifacts');
const manifest = JSON.parse(await fs.readFile(path.join(vscodeRoot, 'package.json'), 'utf8'));
const stageRoot = path.join(artifactsRoot, `and-vscode-${manifest.version}`);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const requiredFiles = [
  'package.json',
  'README.md',
  'INSTALL.md',
  'extension.cjs',
  'language-configuration.json',
  'syntaxes/and.tmLanguage.json',
  'samples/reference.and',
  'samples/reference.tokens.json',
  'samples/diagnostics-demo.and',
];

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(stageRoot, relativePath);
  const stats = await fs.stat(absolutePath).catch(() => null);
  assert(stats?.isFile(), `staged VS Code bundle should include ${relativePath}`);
}

const stagedManifest = JSON.parse(await fs.readFile(path.join(stageRoot, 'package.json'), 'utf8'));
const installReadme = await fs.readFile(path.join(stageRoot, 'INSTALL.md'), 'utf8');

assert(stagedManifest.name === manifest.name, 'staged VS Code bundle should preserve manifest name');
assert(stagedManifest.version === manifest.version, 'staged VS Code bundle should preserve manifest version');
assert(installReadme.includes('Install Extension from Location'), 'staged VS Code bundle should document the local install flow');

console.log('VS Code package checks passed.');
