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

function validateScanBudgets(normalized, lines, options) {
  const budgets = options?.budgets ?? {};
  if (
    typeof budgets.maxDocumentSize === 'number' &&
    normalized.length > budgets.maxDocumentSize
  ) {
    return failAt('nd_budget_exceeded', 0, budgets.maxDocumentSize);
  }

  if (typeof budgets.maxLineLength === 'number') {
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].length > budgets.maxLineLength) {
        return failAt('nd_budget_exceeded', i, budgets.maxLineLength);
      }
    }
  }

  return { ok: true };
}

function stripDocumentHeader(lines, options = {}) {
  if (lines[0] === '&ND v1') {
    const consumed = lines[1] === '' ? 2 : 1;
    return { ok: true, lines: lines.slice(consumed), lineOffset: consumed, version: 'v1' };
  }
  if (lines[0] === '&ND v2' && options.allowV2 === true) {
    const consumed = lines[1] === '' ? 2 : 1;
    return { ok: true, lines: lines.slice(consumed), lineOffset: consumed, version: 'v2' };
  }
  if (lines[0]?.startsWith('&ND ')) {
    return failAt('invalid_header', 0, 0);
  }
  const embeddedVersion = options.version ?? 'v1';
  if (embeddedVersion !== 'v1' && embeddedVersion !== 'v2') {
    return failAt('invalid_version_option', 0, 0);
  }
  if (embeddedVersion === 'v2' && options.allowV2 !== true) {
    return failAt('unsupported_version', 0, 0);
  }
  return { ok: true, lines, lineOffset: 0, version: embeddedVersion };
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

export function backtickRawFence(line) {
  const match = line.match(/^((?: {2})?)(`{3,4})/);
  if (match) return { prefix: match[1], fence: match[2], kind: 'backtick' };
  const quoteMatch = line.match(/^(> ?)(`{3,4})/);
  if (quoteMatch) return { prefix: quoteMatch[1], fence: quoteMatch[2], kind: 'backtick' };
  const nestedQuoteMatch = line.match(/^(  > ?)(`{3,4})/);
  if (nestedQuoteMatch) return { prefix: nestedQuoteMatch[1], fence: nestedQuoteMatch[2], kind: 'backtick' };
  return null;
}

export function tildeLanguageRawFence(line) {
  const tildeMatch = line.match(/^((?: {2})?|> ?|  > ?)(~{3,4})([A-Za-z][A-Za-z0-9_-]*)$/);
  if (tildeMatch) return { prefix: tildeMatch[1], fence: tildeMatch[2], kind: 'tilde-language' };
  return null;
}

export function dollarRawFence(line) {
  const match = line.match(
    /^((?: {2})?|> ?|  > ?)(~~~\$)(?: (\[n\])(?: ([A-Za-z][A-Za-z0-9_-]*))?| ([A-Za-z][A-Za-z0-9_-]*))?$/
  );
  if (!match) return null;
  return {
    prefix: match[1],
    fence: match[2],
    language: match[4] ?? match[5] ?? null,
    ordered: match[3] === '[n]',
    kind: 'dollar',
  };
}

export function isDollarRawFenceCandidate(line) {
  return /^((?: {2})?|> ?|  > ?)~~~\$/.test(line);
}

export function rawFence(line, version = 'v1') {
  const backtickFence = backtickRawFence(line);
  if (backtickFence !== null) return backtickFence;
  const dollarFence = dollarRawFence(line);
  if (dollarFence === null) return null;
  return version === 'v2' || dollarFence.ordered === false ? dollarFence : null;
}

export function extensionOpener(line) {
  const match = line.match(/^((?: {2})?|> ?|  > ?)\+\+\+([a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*(?:\.v[0-9]+)?)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    name: match[2],
  };
}

export function blockCloser(line, expected, version = 'v1', allowCaption = true) {
  if (line === expected) return { ok: true, caption: null, captionOffset: null };
  if (!allowCaption || !line.startsWith(`${expected} (`) || !line.endsWith(')')) return null;
  if (version !== 'v2') return { ok: false, errorCode: 'block_caption_requires_v2' };
  return {
    ok: true,
    caption: line.slice(expected.length + 2, -1),
    captionOffset: expected.length + 2,
  };
}

function scanRawIslands(lines, version) {
  const rawLines = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    const fence = rawFence(lines[i], version);
    if (fence !== null) {
      rawLines.add(i);
      let closed = false;
      for (let j = i + 1; j < lines.length; j += 1) {
        rawLines.add(j);
        const closer = blockCloser(lines[j], `${fence.prefix}${fence.fence}`, version);
        if (closer?.ok === false) return failAt(closer.errorCode, j, fence.prefix.length);
        if (closer?.ok === true) {
          closed = true;
          i = j;
          break;
        }
        if (
          fence.fence.startsWith('`')
          && lines[j].trim() === fence.fence
          && lines[j] !== `${fence.prefix}${fence.fence}`
        ) {
          return failAt('raw_block_bad_closing_margin', j, lines[j].indexOf(fence.fence));
        }
      }
      if (!closed) return failAt('unclosed_code_block', i, fence.prefix.length);
      continue;
    }

    const deprecatedTildeFence = tildeLanguageRawFence(lines[i]);
    if (deprecatedTildeFence !== null) {
      return failAt('deprecated_code_fence', i, deprecatedTildeFence.prefix.length);
    }

    if (isDollarRawFenceCandidate(lines[i])) {
      return failAt('invalid_code_fence', i, lines[i].indexOf('~~~$'));
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
          const nestedCloser = blockCloser(lines[j], `${nestedExtension.prefix}+++`, version);
          if (nestedCloser?.ok === false) return failAt(nestedCloser.errorCode, j, nestedExtension.prefix.length);
          if (nestedCloser?.ok === true) {
            foundNestedClose = true;
            break;
          }
        }
        if (!foundNestedClose) return failAt('unclosed_extension_block', i, extension.prefix.length);
        continue;
      }
      rawLines.add(j);
      const closer = blockCloser(
        lines[j],
        `${extension.prefix}+++`,
        version,
        extension.name !== 'fallback'
      );
      if (closer?.ok === false) return failAt(closer.errorCode, j, extension.prefix.length);
      if (closer?.ok === true) {
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

function validateBlocks(lines, rawLines, version) {
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
    if (version !== 'v2' && line.startsWith('  - ') && previous !== '' && !previous.startsWith('  - ')) {
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
  const budgetValidation = validateScanBudgets(normalized, sourceLines, options);
  if (!budgetValidation.ok) {
    return {
      ...budgetValidation,
      normalized,
      sourceLines,
      sourceLineStartOffsets: lineStartOffsets(sourceLines),
    };
  }

  const sourceLineStartOffsets = lineStartOffsets(sourceLines);
  const header = stripDocumentHeader(sourceLines, options);
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
    documentVersion: header.version,
  };

  const raw = scanRawIslands(lines, header.version);
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

  const blockValidation = validateBlocks(lines, raw.rawLines, header.version);
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
