function normalizeSource(source) {
  return source.replaceAll('\r\n', '\n');
}

function stripFinalEmptyLine(lines) {
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    return lines.slice(0, -1);
  }
  return lines;
}

function isEscapable(char) {
  return char === '[' || char === ']' || char === '|' || char === '\\';
}

function parseEscape(text, index) {
  const next = text[index + 1];
  if (isEscapable(next)) {
    return { ok: true, nextIndex: index + 2, value: next };
  }
  return { ok: false, errorCode: 'invalid_escape', nextIndex: index + 1 };
}

function scanInlineCode(text, index) {
  let i = index + 3;
  while (i < text.length) {
    const char = text[i];
    if (char === '\\') {
      const escaped = parseEscape(text, i);
      if (!escaped.ok) return escaped;
      i = escaped.nextIndex;
      continue;
    }
    if (char === ']') {
      return { ok: true, nextIndex: i + 1 };
    }
    if (char === '\n') {
      return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
    }
    i += 1;
  }
  return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
}

function scanSpan(text, index, opener, options) {
  let i = index + opener.length;
  while (i < text.length) {
    const result = scanInlineAt(text, i, options, { insideSpan: true });
    if (!result.ok) return result;
    if (result.closed) return { ok: true, nextIndex: result.nextIndex };
    i = result.nextIndex;
  }
  return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
}

function scanLink(text, index, options) {
  const maxLinkTargetLength = options?.budgets?.maxLinkTargetLength;
  let i = index + 3;
  let target = '';

  while (i < text.length) {
    const char = text[i];
    if (char === '\\') {
      const escaped = parseEscape(text, i);
      if (!escaped.ok) return escaped;
      target += escaped.value;
      if (typeof maxLinkTargetLength === 'number' && target.length > maxLinkTargetLength) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: i };
      }
      i = escaped.nextIndex;
      continue;
    }
    if (char === '|') break;
    if (char === ']' || char === '\n') {
      return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
    }
    target += char;
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
    const result = scanInlineAt(text, i, options, { insideSpan: true });
    if (!result.ok) return result;
    if (result.closed) {
      if (text.slice(labelStart, i).trim().length === 0) {
        return { ok: false, errorCode: 'missing_link_label', nextIndex: i };
      }
      return { ok: true, nextIndex: result.nextIndex };
    }
    i = result.nextIndex;
  }

  return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
}

function scanEscapedBracketLiteral(text, index) {
  let i = index + 2;
  while (i < text.length) {
    if (text[i] === '\\') {
      const escaped = parseEscape(text, i);
      if (!escaped.ok) return escaped;
      i = escaped.nextIndex;
      continue;
    }
    if (text[i] === ']') {
      return { ok: true, nextIndex: i + 1 };
    }
    if (text[i] === '\n') {
      return { ok: true, nextIndex: i };
    }
    i += 1;
  }
  return { ok: true, nextIndex: i };
}

function scanInlineAt(text, index, options, state = {}) {
  const char = text[index];
  if (char === '\n') return { ok: true, nextIndex: index + 1 };

  if (char === '\\') {
    const escaped = parseEscape(text, index);
    if (!escaped.ok) return escaped;
    if (escaped.value === '[') {
      return scanEscapedBracketLiteral(text, index);
    }
    return { ok: true, nextIndex: escaped.nextIndex };
  }

  if (text.startsWith('[* ', index)) return scanSpan(text, index, '[* ', options);
  if (text.startsWith('[/ ', index)) return scanSpan(text, index, '[/ ', options);
  if (text.startsWith('[@ ', index)) return scanLink(text, index, options);
  if (text.startsWith('[$ ', index)) return scanInlineCode(text, index);

  if (char === ']') {
    if (state.insideSpan) return { ok: true, closed: true, nextIndex: index + 1 };
    return { ok: false, errorCode: 'unexpected_closing', nextIndex: index };
  }

  if (char === '[' && index + 1 < text.length) {
    return { ok: false, errorCode: 'unknown_inline_type', nextIndex: index };
  }

  return { ok: true, nextIndex: index + 1 };
}

export function parseInline(text, options = {}) {
  let index = 0;
  while (index < text.length) {
    const result = scanInlineAt(text, index, options);
    if (!result.ok) return result;
    index = result.nextIndex;
  }
  return { ok: true };
}

function rawFencePrefix(line) {
  const match = line.match(/^((?: {2})?)(```)/);
  if (match) return match[1];
  const quoteMatch = line.match(/^(> ?)(```)/);
  if (quoteMatch) return quoteMatch[1];
  const nestedQuoteMatch = line.match(/^(  > ?)(```)/);
  if (nestedQuoteMatch) return nestedQuoteMatch[1];
  return null;
}

function scanRawIslands(lines) {
  const rawLines = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    const prefix = rawFencePrefix(lines[i]);
    if (prefix === null) continue;

    rawLines.add(i);
    let closed = false;
    for (let j = i + 1; j < lines.length; j += 1) {
      rawLines.add(j);
      if (lines[j] === `${prefix}\`\`\``) {
        closed = true;
        i = j;
        break;
      }
      if (lines[j].trim() === '```' && lines[j] !== `${prefix}\`\`\``) {
        return { ok: false, errorCode: 'raw_block_bad_closing_margin' };
      }
    }
    if (!closed) return { ok: false, errorCode: 'unclosed_code_block' };
  }
  return { ok: true, rawLines };
}

function stripInlinePrefix(line) {
  if (line.startsWith('  > ')) return line.slice(4);
  if (line === '  >') return '';
  if (line.startsWith('> ')) return line.slice(2);
  if (line === '>') return '';
  if (line.startsWith('  - ')) return line.slice(4);
  if (line.startsWith('- ')) return line.slice(2);
  if (/^  #{1,6} /.test(line)) return line.replace(/^  #{1,6} /, '');
  if (/^#{1,6} /.test(line)) return line.replace(/^#{1,6} /, '');
  if (/^\d+\. /.test(line)) return line.replace(/^\d+\. /, '');
  return line;
}

function hasStructuralTab(lines) {
  return lines.some((line) => line.startsWith('\t') || line.includes('\n\t'));
}

function validateBlocks(lines, rawLines) {
  if (hasStructuralTab(lines)) return { ok: false, errorCode: 'invalid_indentation' };

  for (let i = 0; i < lines.length; i += 1) {
    if (rawLines.has(i)) continue;
    const line = lines[i];
    const previous = i > 0 ? lines[i - 1] : '';

    if (line.startsWith('+++')) {
      return { ok: false, errorCode: 'unclosed_extension_block' };
    }
    if (line.startsWith(' - ')) {
      return { ok: false, errorCode: 'invalid_indentation' };
    }
    if (line.startsWith('  - ') && previous !== '' && !previous.startsWith('  - ')) {
      return { ok: false, errorCode: 'missing_blank_line_before_nested_block' };
    }
    if (line === '---' && previous !== '') {
      return { ok: false, errorCode: 'block_opener_on_paragraph_continuation' };
    }
  }

  return { ok: true };
}

export function parseAnd(source, options = {}) {
  const normalized = normalizeSource(source);
  const lines = stripFinalEmptyLine(normalized.split('\n'));

  const raw = scanRawIslands(lines);
  if (!raw.ok) return raw;

  const blockValidation = validateBlocks(lines, raw.rawLines);
  if (!blockValidation.ok) return blockValidation;

  for (let i = 0; i < lines.length; i += 1) {
    if (raw.rawLines.has(i)) continue;
    const line = lines[i];
    if (line.trim() === '') continue;
    if (line.trim().startsWith('|')) continue;
    const inline = parseInline(stripInlinePrefix(line), options);
    if (!inline.ok) return inline;
  }

  return { ok: true };
}
