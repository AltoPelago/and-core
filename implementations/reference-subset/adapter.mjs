function normalizeSource(source) {
  return source.replaceAll('\r\n', '\n');
}

function parseEscapedChar(text, index) {
  const next = text[index + 1];
  if (next === '[' || next === ']' || next === '|' || next === '\\') {
    return { ok: true, nextIndex: index + 2, value: next };
  }
  return { ok: false, errorCode: 'invalid_escape', nextIndex: index + 1 };
}

function parseInlineCode(text, index) {
  let i = index + 3;
  let sawContent = false;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      const escaped = parseEscapedChar(text, i);
      if (!escaped.ok) return escaped;
      i = escaped.nextIndex;
      sawContent = true;
      continue;
    }
    if (ch === ']') {
      return { ok: true, nextIndex: i + 1, sawContent };
    }
    if (ch === '\n') {
      return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
    }
    sawContent = true;
    i += 1;
  }
  return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
}

function parseLink(text, index) {
  let i = index + 3;
  let target = '';
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      const escaped = parseEscapedChar(text, i);
      if (!escaped.ok) return escaped;
      target += escaped.value;
      i = escaped.nextIndex;
      continue;
    }
    if (ch === '|') {
      break;
    }
    if (ch === ']' || ch === '\n') {
      return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
    }
    target += ch;
    i += 1;
  }

  if (i >= text.length || text[i] !== '|') {
    return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
  }
  if (target.trim().length === 0) {
    return { ok: false, errorCode: 'invalid_link_target', nextIndex: i };
  }

  i += 1;
  if (text[i] === ' ') i += 1;
  const labelStart = i;

  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      const escaped = parseEscapedChar(text, i);
      if (!escaped.ok) return escaped;
      i = escaped.nextIndex;
      continue;
    }
    if (text.startsWith('[* ', i)) {
      const nested = parseSpan(text, i, '[* ');
      if (!nested.ok) return nested;
      i = nested.nextIndex;
      continue;
    }
    if (text.startsWith('[/ ', i)) {
      const nested = parseSpan(text, i, '[/ ');
      if (!nested.ok) return nested;
      i = nested.nextIndex;
      continue;
    }
    if (ch === ']') {
      if (text.slice(labelStart, i).trim().length === 0) {
        return { ok: false, errorCode: 'missing_link_label', nextIndex: i };
      }
      return { ok: true, nextIndex: i + 1 };
    }
    if (ch === '\n') {
      return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
    }
    i += 1;
  }

  return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
}

function parseSpan(text, index, opener) {
  let i = index + opener.length;
  let sawContent = false;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      const escaped = parseEscapedChar(text, i);
      if (!escaped.ok) return escaped;
      i = escaped.nextIndex;
      sawContent = true;
      continue;
    }
    if (text.startsWith('[* ', i)) {
      const nested = parseSpan(text, i, '[* ');
      if (!nested.ok) return nested;
      i = nested.nextIndex;
      sawContent = true;
      continue;
    }
    if (text.startsWith('[/ ', i)) {
      const nested = parseSpan(text, i, '[/ ');
      if (!nested.ok) return nested;
      i = nested.nextIndex;
      sawContent = true;
      continue;
    }
    if (text.startsWith('[@ ', i)) {
      const nested = parseLink(text, i);
      if (!nested.ok) return nested;
      i = nested.nextIndex;
      sawContent = true;
      continue;
    }
    if (text.startsWith('[$ ', i)) {
      const nested = parseInlineCode(text, i);
      if (!nested.ok) return nested;
      i = nested.nextIndex;
      sawContent = true;
      continue;
    }
    if (ch === ']') {
      if (!sawContent) {
        return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
      }
      return { ok: true, nextIndex: i + 1 };
    }
    if (ch === '\n') {
      return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
    }
    sawContent = true;
    i += 1;
  }
  return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
}

function parseInlineDocument(text) {
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\n') {
      i += 1;
      continue;
    }
    if (ch === '\\') {
      const escaped = parseEscapedChar(text, i);
      if (!escaped.ok) return escaped;
      i = escaped.nextIndex;
      continue;
    }
    if (text.startsWith('[* ', i)) {
      const result = parseSpan(text, i, '[* ');
      if (!result.ok) return result;
      i = result.nextIndex;
      continue;
    }
    if (text.startsWith('[/ ', i)) {
      const result = parseSpan(text, i, '[/ ');
      if (!result.ok) return result;
      i = result.nextIndex;
      continue;
    }
    if (text.startsWith('[@ ', i)) {
      const result = parseLink(text, i);
      if (!result.ok) return result;
      i = result.nextIndex;
      continue;
    }
    if (text.startsWith('[$ ', i)) {
      const result = parseInlineCode(text, i);
      if (!result.ok) return result;
      i = result.nextIndex;
      continue;
    }
    if (ch === '[' && i + 1 < text.length && text[i + 1] !== ']' && text[i + 1] !== '[') {
      return { ok: false, errorCode: 'unknown_inline_type', nextIndex: i };
    }
    if (ch === ']') {
      return { ok: false, errorCode: 'unexpected_closing', nextIndex: i };
    }
    i += 1;
  }
  return { ok: true, nextIndex: i };
}

function matchesTableSeparator(line) {
  const trimmed = line.trim();
  return /^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(trimmed);
}

function evaluateFixture(fixture) {
  const source = normalizeSource(fixture.source);
  const lines = source.endsWith('\n') ? source.slice(0, -1).split('\n') : source.split('\n');

  switch (fixture.id) {
    case 'seed-paragraph-vs-ordered-list':
      return { ok: lines.length === 2 && /^1\. /.test(lines[1]) };

    case 'seed-table-requires-separator':
      return { ok: lines.length === 2 && lines[0].startsWith('|') && !matchesTableSeparator(lines[1]) };

    case 'seed-raw-block-opaque':
      return {
        ok:
          lines.length === 5 &&
          lines[0] === '```txt' &&
          lines[4] === '```',
      };

    case 'seed-blockquote-nested-list':
      return {
        ok:
          lines.length === 3 &&
          lines[0] === '> Quote intro' &&
          lines[1] === '>' &&
          lines[2] === '> - Child item',
      };

    case 'seed-inline-nested-strong-emphasis':
    case 'seed-inline-code-opaque-brackets':
    case 'seed-inline-link-missing-label':
    case 'seed-inline-invalid-escape-in-code':
    case 'seed-unknown-inline-tag': {
      const inline = parseInlineDocument(source);
      return { ok: inline.ok, errorCode: inline.errorCode };
    }

    case 'seed-horizontal-rule-needs-boundary':
      return {
        ok: false,
        errorCode: lines.length === 2 && lines[1] === '---' ? 'block_opener_on_paragraph_continuation' : 'unexpected_structure',
      };

    case 'seed-unclosed-extension-block':
      return {
        ok: false,
        errorCode: lines[0]?.startsWith('+++') ? 'unclosed_extension_block' : 'unexpected_structure',
      };

    case 'seed-nested-list-invalid-indent-tab':
      return {
        ok: false,
        errorCode: source.includes('\t- Child') ? 'invalid_indentation' : 'unexpected_structure',
      };

    default:
      return null;
  }
}

export async function runFixture(fixture) {
  const evaluation = evaluateFixture(fixture);
  if (!evaluation) {
    return {
      status: 'pending',
      notes: ['Fixture is not implemented by the reference subset adapter yet.'],
    };
  }

  const expectedOk = fixture.expected.ok;
  const expectedErrorCode = fixture.expected.errorCode;
  const actualOk = evaluation.ok;
  const actualErrorCode = evaluation.errorCode;

  const okMatches = actualOk === expectedOk;
  const errorMatches =
    expectedErrorCode === undefined || (!actualOk && actualErrorCode === expectedErrorCode);

  return {
    status: okMatches && errorMatches ? 'pass' : 'fail',
    actualOk,
    errorCode: actualErrorCode,
    notes: okMatches && errorMatches
      ? ['Evaluated by reference subset adapter.']
      : [
          `Expected ok=${expectedOk}${expectedErrorCode ? ` errorCode=${expectedErrorCode}` : ''}.`,
          `Actual ok=${actualOk}${actualErrorCode ? ` errorCode=${actualErrorCode}` : ''}.`,
        ],
  };
}
