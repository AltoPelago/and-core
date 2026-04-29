function failAt(errorCode, lineIndex, columnIndex = 0) {
  return {
    ok: false,
    errorCode,
    diagnostic: {
      code: errorCode,
      line: lineIndex + 1,
      column: columnIndex + 1,
    },
  };
}

function normalizeSource(source) {
  return source.replaceAll('\r\n', '\n');
}

function stripFinalEmptyLine(lines) {
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    return lines.slice(0, -1);
  }
  return lines;
}

function stripDocumentHeader(lines) {
  if (lines[0] === '&ND v1') {
    const consumed = lines[1] === '' ? 2 : 1;
    return { ok: true, lines: lines.slice(consumed), lineOffset: consumed };
  }
  if (lines[0]?.startsWith('&ND ')) {
    return failAt('invalid_header', 0, 0);
  }
  return { ok: true, lines, lineOffset: 0 };
}

function lineStartOffsets(lines) {
  const offsets = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  return offsets;
}

export function rawFence(line) {
  const match = line.match(/^((?: {2})?)(`{3,4})/);
  if (match) return { prefix: match[1], fence: match[2] };
  const quoteMatch = line.match(/^(> ?)(`{3,4})/);
  if (quoteMatch) return { prefix: quoteMatch[1], fence: quoteMatch[2] };
  const nestedQuoteMatch = line.match(/^(  > ?)(`{3,4})/);
  if (nestedQuoteMatch) return { prefix: nestedQuoteMatch[1], fence: nestedQuoteMatch[2] };
  return null;
}

export function extensionOpener(line) {
  const match = line.match(/^((?: {2})?|> ?|  > ?)\+\+\+([a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*(?:\.v[0-9]+)?)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    name: match[2],
  };
}

function scanRawIslands(lines) {
  const rawLines = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    const fence = rawFence(lines[i]);
    if (fence !== null) {
      rawLines.add(i);
      let closed = false;
      for (let j = i + 1; j < lines.length; j += 1) {
        rawLines.add(j);
        if (lines[j] === `${fence.prefix}${fence.fence}`) {
          closed = true;
          i = j;
          break;
        }
        if (lines[j].trim() === fence.fence && lines[j] !== `${fence.prefix}${fence.fence}`) {
          return failAt('raw_block_bad_closing_margin', j, lines[j].indexOf(fence.fence));
        }
      }
      if (!closed) return failAt('unclosed_code_block', i, fence.prefix.length);
      continue;
    }

    const extension = extensionOpener(lines[i]);
    if (extension === null) continue;

    rawLines.add(i);
    let closed = false;
    for (let j = i + 1; j < lines.length; j += 1) {
      const nestedExtension = extension.name === 'fallback' ? extensionOpener(lines[j]) : null;
      if (nestedExtension?.prefix === extension.prefix) {
        rawLines.add(j);
        let foundNestedClose = false;
        for (j += 1; j < lines.length; j += 1) {
          rawLines.add(j);
          if (lines[j] === `${nestedExtension.prefix}+++`) {
            foundNestedClose = true;
            break;
          }
        }
        if (!foundNestedClose) return failAt('unclosed_extension_block', i, extension.prefix.length);
        continue;
      }
      rawLines.add(j);
      if (lines[j] === `${extension.prefix}+++`) {
        closed = true;
        i = j;
        break;
      }
      if (lines[j].trim() === '+++' && lines[j] !== `${extension.prefix}+++`) {
        return failAt('extension_block_bad_closing_margin', j, lines[j].indexOf('+++'));
      }
    }
    if (!closed) return failAt('unclosed_extension_block', i, extension.prefix.length);
  }
  return { ok: true, rawLines };
}

function structuralTabLocation(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const column = lines[i].indexOf('\t');
    if (column !== -1) return { lineIndex: i, columnIndex: column };
  }
  return null;
}

function validateBlocks(lines, rawLines) {
  const tab = structuralTabLocation(lines);
  if (tab) return failAt('invalid_indentation', tab.lineIndex, tab.columnIndex);

  for (let i = 0; i < lines.length; i += 1) {
    if (rawLines.has(i)) continue;
    const line = lines[i];
    const previous = i > 0 ? lines[i - 1] : '';

    if (line.startsWith('+++')) {
      return failAt('invalid_extension_name', i, 0);
    }
    if (line.startsWith(' - ')) {
      return failAt('invalid_indentation', i, 0);
    }
    if (line.startsWith('  - ') && previous !== '' && !previous.startsWith('  - ')) {
      return failAt('missing_blank_line_before_nested_block', i, 2);
    }
    if (line === '---' && previous !== '') {
      return failAt('block_opener_on_paragraph_continuation', i, 0);
    }
  }

  return { ok: true };
}

export function scanDocument(source, options = {}) {
  const normalized = normalizeSource(source);
  const sourceLines = stripFinalEmptyLine(normalized.split('\n'));
  const sourceLineStartOffsets = lineStartOffsets(sourceLines);
  const header = stripDocumentHeader(sourceLines);
  if (!header.ok) {
    return {
      ...header,
      normalized,
      sourceLines,
      sourceLineStartOffsets,
    };
  }

  const lines = header.lines;
  const context = {
    lineOffset: header.lineOffset,
    lineStartOffsets: sourceLineStartOffsets.slice(header.lineOffset),
    sourceLineStartOffsets,
    includeSpans: options.includeSpans === true,
  };

  const raw = scanRawIslands(lines);
  if (!raw.ok) {
    return {
      ...raw,
      normalized,
      sourceLines,
      sourceLineStartOffsets,
      lines,
      context,
    };
  }

  const blockValidation = validateBlocks(lines, raw.rawLines);
  if (!blockValidation.ok) {
    return {
      ...blockValidation,
      normalized,
      sourceLines,
      sourceLineStartOffsets,
      lines,
      context,
      rawLines: raw.rawLines,
    };
  }

  return {
    ok: true,
    normalized,
    sourceLines,
    sourceLineStartOffsets,
    lineOffset: header.lineOffset,
    lines,
    context,
    rawLines: raw.rawLines,
  };
}
