import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const vscodeRoot = path.join(repoRoot, 'vscode');
const artifactsRoot = path.join(repoRoot, 'artifacts');
const manifest = JSON.parse(await fs.readFile(path.join(vscodeRoot, 'package.json'), 'utf8'));
const stageRoot = path.join(artifactsRoot, `and-vscode-${manifest.version}`);

async function resetDir(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.mkdir(targetPath, { recursive: true });
}

async function copyRelativeFile(relativePath) {
  const source = path.join(vscodeRoot, relativePath);
  const target = path.join(stageRoot, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

await fs.mkdir(artifactsRoot, { recursive: true });
await resetDir(stageRoot);

for (const relativePath of [
  'package.json',
  'README.md',
  'extension.cjs',
  'language-configuration.json',
  'syntaxes/and.tmLanguage.json',
  'samples/reference.and',
  'samples/reference.tokens.json',
  'samples/diagnostics-demo.and',
]) {
  await copyRelativeFile(relativePath);
}

const installGuide = [
  '# Local Install',
  '',
  'This folder is a staged unpacked VS Code extension bundle for the `&ND` prototype.',
  '',
  'Install options:',
  '',
  '1. In VS Code, run `Developer: Install Extension from Location...` and select this folder.',
  '2. Or use the repository development host from `.vscode/launch.json`.',
  '',
  `Bundle version: ${manifest.version}`,
].join('\n');

await fs.writeFile(path.join(stageRoot, 'INSTALL.md'), `${installGuide}\n`, 'utf8');

console.log(stageRoot);
