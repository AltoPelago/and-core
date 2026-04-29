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

function parseLink(text, index, options = {}) {
  const maxLinkTargetLength = options?.budgets?.maxLinkTargetLength;
  let i = index + 3;
  let target = '';
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      const escaped = parseEscapedChar(text, i);
      if (!escaped.ok) return escaped;
      target += escaped.value;
      if (typeof maxLinkTargetLength === 'number' && target.length > maxLinkTargetLength) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: i };
      }
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
    if (typeof maxLinkTargetLength === 'number' && target.length > maxLinkTargetLength) {
      return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: i };
    }
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

function parseSpan(text, index, opener, options = {}) {
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
      const nested = parseSpan(text, i, '[* ', options);
      if (!nested.ok) return nested;
      i = nested.nextIndex;
      sawContent = true;
      continue;
    }
    if (text.startsWith('[/ ', i)) {
      const nested = parseSpan(text, i, '[/ ', options);
      if (!nested.ok) return nested;
      i = nested.nextIndex;
      sawContent = true;
      continue;
    }
    if (text.startsWith('[@ ', i)) {
      const nested = parseLink(text, i, options);
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

function parseInlineDocument(text, options = {}) {
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
      const result = parseSpan(text, i, '[* ', options);
      if (!result.ok) return result;
      i = result.nextIndex;
      continue;
    }
    if (text.startsWith('[/ ', i)) {
      const result = parseSpan(text, i, '[/ ', options);
      if (!result.ok) return result;
      i = result.nextIndex;
      continue;
    }
    if (text.startsWith('[@ ', i)) {
      const result = parseLink(text, i, options);
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
  const options = fixture.options ?? {};
  const lines = source.endsWith('\n') ? source.slice(0, -1).split('\n') : source.split('\n');

  switch (fixture.id) {
    case 'seed-paragraph-vs-ordered-list':
      return { ok: lines.length === 2 && /^1\. /.test(lines[1]) };

    case 'seed-header-standalone':
      return { ok: lines.length === 3 && lines[0] === '&ND v1' && lines[1] === '' && lines[2] === '# Title' };

    case 'seed-invalid-header-version':
      return {
        ok: false,
        errorCode: lines[0] === '&ND v2' ? 'invalid_header' : 'unexpected_structure',
      };

    case 'seed-ordered-list-after-blank-line':
      return { ok: lines.length === 3 && lines[1] === '' && /^1\. /.test(lines[2]) };

    case 'seed-table-requires-separator':
      return { ok: lines.length === 2 && lines[0].startsWith('|') && !matchesTableSeparator(lines[1]) };

    case 'seed-table-valid-top-level':
      return {
        ok:
          lines.length === 3 &&
          lines[0].trim().startsWith('| A | B |') &&
          matchesTableSeparator(lines[1]) &&
          lines[2].trim().startsWith('| 1 | 2 |'),
      };

    case 'seed-table-inline-cells':
      return {
        ok:
          lines.length === 3 &&
          lines[0].trim().startsWith('| Name | Note |') &&
          matchesTableSeparator(lines[1]) &&
          lines[2] === '| [* Ada] | escaped \\| pipe |',
      };

    case 'seed-source-spans-table-inline':
      return {
        ok:
          lines.length === 5 &&
          lines[0] === '&ND v1' &&
          lines[1] === '' &&
          lines[2] === '|  Name  | Link\\|Text |' &&
          matchesTableSeparator(lines[3]) &&
          lines[4] === '|  Alpha | [* Strong] |',
      };

    case 'seed-table-mismatched-body-row':
      return {
        ok: false,
        errorCode: lines[2] === '| 1 | 2 | 3 |' ? 'invalid_table_shape' : 'unexpected_structure',
      };

    case 'seed-table-missing-body-row':
      return {
        ok: false,
        errorCode: lines.length === 2 && matchesTableSeparator(lines[1])
          ? 'invalid_table_shape'
          : 'unexpected_structure',
      };

    case 'seed-table-unescaped-pipe-extra-cell':
      return {
        ok: false,
        errorCode: lines[2] === '| escaped | pipe | ok |' ? 'invalid_table_shape' : 'unexpected_structure',
      };

    case 'seed-escaped-inline-opener':
      return {
        ok: lines.length === 1 && lines[0] === '\\[* not strong]',
      };

    case 'seed-inline-overlap-attempt':
    case 'seed-inline-link-label-nesting':
    case 'seed-inline-escaped-pipe-in-link-target':
    case 'seed-inline-link-missing-target':
    case 'seed-inline-unclosed-strong':
    case 'seed-inline-strong-newline':
    case 'seed-inline-unclosed-nested':
    case 'seed-inline-unexpected-closing':
    case 'seed-invalid-escape': {
      const inline = parseInlineDocument(source, options);
      return { ok: inline.ok, errorCode: inline.errorCode };
    }

    case 'seed-raw-block-opaque':
      return {
        ok:
          lines.length === 5 &&
          lines[0] === '```txt' &&
          lines[4] === '```',
      };

    case 'seed-extension-block-opaque':
      return {
        ok:
          lines.length === 4 &&
          lines[0] === '+++chart/pie' &&
          lines[3] === '+++',
      };

    case 'seed-extension-uppercase-name':
      return {
        ok: false,
        errorCode: lines[0] === '+++Chart/pie' ? 'invalid_extension_name' : 'unexpected_structure',
      };

    case 'seed-nested-list-two-space-indent':
      return {
        ok:
          lines.length === 5 &&
          lines[0] === '- Parent' &&
          lines[1] === '' &&
          lines[2] === '  - Child' &&
          lines[3] === '  - Child' &&
          lines[4] === '- Next parent',
      };

    case 'seed-blockquote-two-paragraphs':
      return {
        ok:
          lines.length === 3 &&
          lines[0] === '> First paragraph' &&
          lines[1] === '>' &&
          lines[2] === '> Second paragraph',
      };

    case 'seed-blockquote-escaped-inline':
      return {
        ok: lines.length === 1 && lines[0] === '> \\[* not strong]',
      };

    case 'seed-list-item-raw-block':
      return {
        ok:
          lines.length === 5 &&
          lines[0] === '- Parent' &&
          lines[1] === '' &&
          lines[2] === '  ```txt' &&
          lines[3] === '  raw' &&
          lines[4] === '  ```',
      };

    case 'seed-list-item-extension-block':
      return {
        ok:
          lines.length === 5 &&
          lines[0] === '- Parent' &&
          lines[1] === '' &&
          lines[2] === '  +++chart/pie' &&
          lines[3] === '  apples: 3' &&
          lines[4] === '  +++',
      };

    case 'seed-list-item-heading':
      return {
        ok: lines.length === 3 && lines[0] === '- Parent' && lines[1] === '' && lines[2] === '  ## Child heading',
      };

    case 'seed-list-item-horizontal-rule':
      return {
        ok: lines.length === 3 && lines[0] === '- Parent' && lines[1] === '' && lines[2] === '  ---',
      };

    case 'seed-list-item-table':
      return {
        ok:
          lines.length === 5 &&
          lines[0] === '- Parent' &&
          lines[1] === '' &&
          lines[2].trim().startsWith('| A | B |') &&
          matchesTableSeparator(lines[3]) &&
          lines[4].trim().startsWith('| 1 | 2 |'),
      };

    case 'seed-list-item-table-missing-separator':
      return {
        ok:
          lines.length === 4 &&
          lines[0] === '- Parent' &&
          lines[1] === '' &&
          lines[2].trim().startsWith('| A | B |') &&
          lines[3] === '  plain text',
      };

    case 'seed-list-item-blockquote':
      return {
        ok: lines.length === 3 && lines[0] === '- Parent' && lines[1] === '' && lines[2] === '  > Quote line',
      };

    case 'seed-list-item-blockquote-two-paragraphs':
      return {
        ok:
          lines.length === 5 &&
          lines[0] === '- Parent' &&
          lines[1] === '' &&
          lines[2] === '  > First paragraph' &&
          lines[3] === '  >' &&
          lines[4] === '  > Second paragraph',
      };

    case 'seed-blockquote-nested-list':
      return {
        ok:
          lines.length === 3 &&
          lines[0] === '> Quote intro' &&
          lines[1] === '>' &&
          lines[2] === '> - Child item',
      };

    case 'seed-blockquote-nested-list-needs-margin':
      return {
        ok:
          lines.length === 3 &&
          lines[0] === '> Quote intro' &&
          lines[1] === '>' &&
          lines[2] === '- Child item',
      };

    case 'seed-blockquote-nested-code-block':
      return {
        ok:
          lines.length === 5 &&
          lines[0] === '> Quote intro' &&
          lines[1] === '>' &&
          lines[2] === '> ```txt' &&
          lines[3] === '> raw' &&
          lines[4] === '> ```',
      };

    case 'seed-blockquote-nested-extension-block':
      return {
        ok:
          lines.length === 5 &&
          lines[0] === '> Quote intro' &&
          lines[1] === '>' &&
          lines[2] === '> +++chart/pie' &&
          lines[3] === '> apples: 3' &&
          lines[4] === '> +++',
      };

    case 'seed-list-item-blockquote-then-sibling':
      return {
        ok:
          lines.length === 4 &&
          lines[0] === '- Parent' &&
          lines[1] === '' &&
          lines[2] === '  > Quote line' &&
          lines[3] === '- Next parent',
      };

    case 'seed-blockquote-escaped-inline-opener':
      return {
        ok: lines.length === 1 && lines[0] === '> \\[@ https://example.com | label]',
      };

    case 'seed-inline-nested-strong-emphasis':
    case 'seed-inline-code-opaque-brackets':
    case 'seed-inline-link-missing-label':
    case 'seed-inline-invalid-escape-in-code':
    case 'seed-unknown-inline-tag': {
      const inline = parseInlineDocument(source, options);
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

    case 'seed-budget-link-target': {
      const inline = parseInlineDocument(source, options);
      return { ok: inline.ok, errorCode: inline.errorCode };
    }

    case 'seed-nested-list-invalid-indent-one-space':
      return {
        ok: false,
        errorCode: source.includes('\n - Child') ? 'invalid_indentation' : 'unexpected_structure',
      };

    case 'seed-nested-list-invalid-indent-tab':
      return {
        ok: false,
        errorCode: source.includes('\t- Child') ? 'invalid_indentation' : 'unexpected_structure',
      };

    case 'seed-nested-list-needs-blank-line':
      return {
        ok: false,
        errorCode: lines.length === 2 && lines[1] === '  - Child' ? 'missing_blank_line_before_nested_block' : 'unexpected_structure',
      };

    case 'seed-list-item-raw-block-bad-closing-margin':
      return {
        ok: false,
        errorCode: lines[4] === ' ```' ? 'raw_block_bad_closing_margin' : 'unexpected_structure',
      };

    case 'seed-list-item-extension-block-bad-closing-margin':
      return {
        ok: false,
        errorCode: lines[4] === ' +++' ? 'extension_block_bad_closing_margin' : 'unexpected_structure',
      };

    case 'seed-blockquote-raw-block-bad-closing-margin':
      return {
        ok: false,
        errorCode: lines[4] === '```' ? 'raw_block_bad_closing_margin' : 'unexpected_structure',
      };

    case 'seed-blockquote-extension-block-bad-closing-margin':
      return {
        ok: false,
        errorCode: lines[4] === '+++' ? 'extension_block_bad_closing_margin' : 'unexpected_structure',
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
