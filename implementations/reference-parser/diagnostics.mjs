import { parseAnd } from './parser.mjs';

function toZeroBased(value) {
  return Math.max(Number(value ?? 1) - 1, 0);
}

function formatMessage(result) {
  if (result.diagnostic?.line && result.diagnostic?.column) {
    return `${result.errorCode} at ${result.diagnostic.line}:${result.diagnostic.column}`;
  }
  return result.errorCode;
}

function toRange(diagnostic = {}) {
  const line = toZeroBased(diagnostic.line);
  const character = toZeroBased(diagnostic.column);
  return {
    start: { line, character },
    end: { line, character: character + 1 },
  };
}

export function collectDiagnostics(source, options = {}) {
  const result = parseAnd(source, options);
  if (result.ok) {
    return {
      ok: true,
      diagnostics: [],
    };
  }

  return {
    ok: false,
    diagnostics: [
      {
        severity: 1,
        code: result.errorCode,
        source: 'and-core',
        message: formatMessage(result),
        range: toRange(result.diagnostic),
        data: {
          errorCode: result.errorCode,
          diagnostic: result.diagnostic ?? null,
        },
      },
    ],
  };
}
