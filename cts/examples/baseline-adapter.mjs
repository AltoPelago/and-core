import { parseAnd } from '../../implementations/reference-parser/parser.mjs';

export async function runFixture(fixture, context) {
  const result = parseAnd(fixture.source, context.options);
  const expectedErrorCode = fixture.expected.errorCode;
  const okMatches = result.ok === fixture.expected.ok;
  const errorMatches =
    expectedErrorCode === undefined || (!result.ok && result.errorCode === expectedErrorCode);

  return {
    status: okMatches && errorMatches ? 'pass' : 'fail',
    actualOk: result.ok,
    errorCode: result.errorCode,
    notes: ['Evaluated by the baseline adapter example.'],
  };
}
