import { parseAnd } from './parser.mjs';

export const capabilities = {
  document: true,
  spans: true,
};

export async function runFixture(fixture) {
  const result = parseAnd(fixture.source, {
    ...(fixture.options ?? {}),
    includeSpans: fixture.options?.includeSpans === true || Array.isArray(fixture.expected.spans),
  });
  const expectedOk = fixture.expected.ok;
  const expectedErrorCode = fixture.expected.errorCode;
  const okMatches = result.ok === expectedOk;
  const errorMatches =
    expectedErrorCode === undefined || (!result.ok && result.errorCode === expectedErrorCode);

  return {
    status: okMatches && errorMatches ? 'pass' : 'fail',
    actualOk: result.ok,
    errorCode: result.errorCode,
    document: result.document,
    notes: okMatches && errorMatches
      ? ['Evaluated by reference parser.']
      : [
          `Expected ok=${expectedOk}${expectedErrorCode ? ` errorCode=${expectedErrorCode}` : ''}.`,
          `Actual ok=${result.ok}${result.errorCode ? ` errorCode=${result.errorCode}` : ''}.`,
        ],
  };
}
