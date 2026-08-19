import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'cts/contracts/aeon-inline-scalar-v1.json');
const configuredRoot = process.env.AND_AEON_TYPESCRIPT_ROOT;
const aeonRoot = configuredRoot
  ? path.resolve(configuredRoot)
  : path.resolve(repoRoot, '../aeon/implementations/typescript');

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function normalizeDatatype(datatype) {
  return {
    name: datatype.name,
    genericArgs: [...datatype.genericArgs],
    clarifiers: [...datatype.clarifiers],
  };
}

function normalizeValue(value) {
  const normalized = { type: value.type, value: value.value };
  if (value.type === 'NullLiteral') normalized.mode = value.mode;
  if (value.type === 'DateTimeLiteral') {
    normalized.temporalKind = value.value.includes('&') ? 'wtc' : 'datetime';
  }
  return normalized;
}

function expandCases(manifest) {
  const families = manifest.families.flatMap((family) => family.datatypes.map((datatype) => ({
    id: `${family.id}:${datatype}`,
    expression: `${datatype} = ${family.scalar}`,
    canonicalExpression: `${datatype} = ${family.canonicalScalar}`,
    datatype: { name: datatype, genericArgs: [], clarifiers: [] },
    value: family.value,
  })));
  return [...families, ...manifest.annotationCases];
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const packagePaths = {
    lexer: path.join(aeonRoot, 'packages/lexer/dist/index.js'),
    parser: path.join(aeonRoot, 'packages/parser/dist/index.js'),
    canonical: path.join(aeonRoot, 'packages/canonical/dist/index.js'),
    parserPackage: path.join(aeonRoot, 'packages/parser/package.json'),
  };
  if (!(await Promise.all(Object.values(packagePaths).map(exists))).every(Boolean)) {
    console.log(`aeonInlineScalarDrift status=skipped reason=aeon_builds_not_found root=${aeonRoot}`);
    return;
  }

  const parserPackage = JSON.parse(await fs.readFile(packagePaths.parserPackage, 'utf8'));
  assert.equal(parserPackage.version, manifest.aeon.packageVersion, 'pinned AEON package version drifted');

  const [{ tokenize }, { parse }, { canonicalize }] = await Promise.all([
    import(pathToFileURL(packagePaths.lexer)),
    import(pathToFileURL(packagePaths.parser)),
    import(pathToFileURL(packagePaths.canonical)),
  ]);

  const cases = expandCases(manifest);
  for (const testCase of cases) {
    const source = `values:list = [:${testCase.expression}]`;
    const lexed = tokenize(source);
    assert.equal(lexed.errors.length, 0, `${testCase.id}: AEON lexer rejected the pinned form`);
    const parsed = parse(lexed.tokens, { maxGenericDepth: manifest.aeon.maxGenericDepth });
    assert.equal(parsed.errors.length, 0, `${testCase.id}: AEON parser rejected the pinned form`);
    const typedValue = parsed.document.bindings[0].value.elements[0];
    assert.equal(typedValue.type, 'TypedValue', `${testCase.id}: AEON AST is not a TypedValue`);
    assert.deepEqual(normalizeDatatype(typedValue.datatype), testCase.datatype, `${testCase.id}: AEON datatype AST drifted`);
    assert.equal(typedValue.value.type, testCase.value.type, `${testCase.id}: AEON scalar literal family drifted`);

    const canonical = canonicalize(source, { maxGenericDepth: manifest.aeon.maxGenericDepth });
    assert.equal(canonical.errors.length, 0, `${testCase.id}: AEON canonicalizer rejected the pinned form`);
    assert.ok(
      canonical.text.includes(`:${testCase.canonicalExpression}`),
      `${testCase.id}: AEON canonical spelling drifted`,
    );
    const canonicalParsed = parse(tokenize(canonical.text).tokens, { maxGenericDepth: manifest.aeon.maxGenericDepth });
    assert.equal(canonicalParsed.errors.length, 0, `${testCase.id}: canonical AEON output did not reparse`);
    const canonicalTypedValue = canonicalParsed.document.bindings.find((binding) => binding.key === 'values').value.elements[0];
    assert.deepEqual(
      normalizeValue(canonicalTypedValue.value),
      testCase.value,
      `${testCase.id}: canonical AEON scalar AST drifted`,
    );
  }

  console.log(`aeonInlineScalarDrift status=pass version=${parserPackage.version} checked=${cases.length} failed=0`);
}

await main();
