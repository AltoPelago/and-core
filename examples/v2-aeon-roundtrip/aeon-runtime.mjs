import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Prefer an explicitly selected build; otherwise use this example's installed
// packages. The main and-core package keeps its dependency-free public API.
export async function loadAeon() {
  const root = process.env.AND_AEON_TYPESCRIPT_ROOT;
  const load = (name) => root
    ? import(pathToFileURL(path.resolve(root, `packages/${name}/dist/index.js`)).href)
    : import(`@altopelago/aeon-${name}`);
  try {
    const [{ tokenize }, { parse }, { readAeonNamespace }, { evaluateQuery, resolveAddress }] = await Promise.all([
      load('lexer'), load('parser'),
      root ? import(pathToFileURL(path.resolve(root, 'packages/sdk/dist/sansa.js')).href)
        : import('@altopelago/aeon-sdk/sansa'),
      import('@altopelago/sansa'),
    ]);
    return { tokenize, parse, readAeonNamespace, evaluateQuery, resolveAddress };
  } catch (cause) {
    throw new Error('Install this example with npm install --prefix examples/v2-aeon-roundtrip, or set AND_AEON_TYPESCRIPT_ROOT to a built AEON TypeScript checkout.', { cause });
  }
}
