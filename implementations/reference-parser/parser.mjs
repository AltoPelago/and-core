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

function positionAtOffset(lineOffsets, offset) {
  let lineIndex = 0;
  for (let i = 0; i < lineOffsets.length; i += 1) {
    if (lineOffsets[i] > offset) break;
    lineIndex = i;
  }
  return {
    line: lineIndex + 1,
    column: offset - lineOffsets[lineIndex] + 1,
  };
}

function makeSpan(context, startOffset, endOffset) {
  const start = positionAtOffset(context.sourceLineStartOffsets, startOffset);
  const end = positionAtOffset(context.sourceLineStartOffsets, endOffset);
  return {
    startOffset,
    endOffset,
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column,
  };
}

function withSpan(node, context, startOffset, endOffset) {
  if (!context?.includeSpans) return node;
  return {
    ...node,
    span: makeSpan(context, startOffset, endOffset),
  };
}

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

function withOffset(result, baseOffset = 0) {
  if (result.ok || typeof result.nextIndex !== 'number') return result;
  const offset = baseOffset + result.nextIndex;
  return {
    ...result,
    diagnostic: {
      code: result.errorCode,
      offset,
    },
  };
}

function withLine(result, lineIndex, columnIndex = 0) {
  if (result.ok || result.diagnostic?.line) return result;
  return {
    ...result,
    diagnostic: {
      ...(result.diagnostic ?? { code: result.errorCode }),
      line: lineIndex + 1,
      column: columnIndex + 1,
    },
  };
}

function shiftDiagnosticLines(result, lineOffset) {
  if (result.ok || !result.diagnostic?.line || typeof result.diagnostic.offset === 'number') return result;
  return {
    ...result,
    diagnostic: {
      ...result.diagnostic,
      line: result.diagnostic.line + lineOffset,
    },
  };
}

function finalizeDiagnostic(result, source) {
  if (result.ok || !result.diagnostic) return result;
  if (typeof result.diagnostic.offset !== 'number') return result;

  const before = source.slice(0, result.diagnostic.offset);
  const line = before.split('\n').length;
  const lastNewline = before.lastIndexOf('\n');
  const column = result.diagnostic.offset - lastNewline;
  return {
    ...result,
    diagnostic: {
      code: result.errorCode,
      offset: result.diagnostic.offset,
      line,
      column,
    },
  };
}

function publicFailure(result) {
  if (result.ok) return result;
  return {
    ok: false,
    errorCode: result.errorCode,
    ...(result.diagnostic ? { diagnostic: result.diagnostic } : {}),
  };
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

function pushText(nodes, value, context, startOffset, endOffset) {
  if (!value) return;
  const last = nodes[nodes.length - 1];
  if (last?.type === 'text') {
    last.value += value;
    if (context?.includeSpans) {
      last.span = makeSpan(context, last.span.startOffset, endOffset);
    }
    return;
  }
  nodes.push(withSpan({ type: 'text', value }, context, startOffset, endOffset));
}

function parseEscapedBracketLiteral(text, index) {
  let i = index + 2;
  let value = '[';
  while (i < text.length) {
    if (text[i] === '\\') {
      const escaped = parseEscape(text, i);
      if (!escaped.ok) return escaped;
      value += escaped.value;
      i = escaped.nextIndex;
      continue;
    }
    value += text[i];
    if (text[i] === ']') {
      return { ok: true, nextIndex: i + 1, value };
    }
    if (text[i] === '\n') {
      return { ok: true, nextIndex: i, value: value.slice(0, -1) };
    }
    i += 1;
  }
  return { ok: true, nextIndex: i, value };
}

function parseInlineCode(text, index, context, baseOffset = 0) {
  let i = index + 3;
  let value = '';
  while (i < text.length) {
    const char = text[i];
    if (char === '\\') {
      const escaped = parseEscape(text, i);
      if (!escaped.ok) return escaped;
      value += escaped.value;
      i = escaped.nextIndex;
      continue;
    }
    if (char === ']') {
      return {
        ok: true,
        nextIndex: i + 1,
        node: withSpan({ type: 'code', text: value }, context, baseOffset + index, baseOffset + i + 1),
      };
    }
    if (char === '\n') {
      return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
    }
    value += char;
    i += 1;
  }
  return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
}

function parseSpan(text, index, opener, options, context, baseOffset = 0) {
  const type = opener === '[* ' ? 'strong' : 'emphasis';
  const parsed = parseInlineSequence(text, index + opener.length, options, { stopOnClose: true }, context, baseOffset);
  if (!parsed.ok) return parsed;
  if (!parsed.closed) return { ok: false, errorCode: 'unclosed_inline', nextIndex: parsed.nextIndex };
  return {
    ok: true,
    nextIndex: parsed.nextIndex,
    node: withSpan({ type, children: parsed.nodes }, context, baseOffset + index, baseOffset + parsed.nextIndex),
  };
}

function parseLink(text, index, options, context, baseOffset = 0) {
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
  const label = parseInlineSequence(text, i, options, { stopOnClose: true }, context, baseOffset);
  if (!label.ok) return label;
  if (!label.closed) return { ok: false, errorCode: 'unclosed_inline', nextIndex: label.nextIndex };
  if (!hasInlineContent(label.nodes)) {
    return { ok: false, errorCode: 'missing_link_label', nextIndex: i };
  }

  return {
    ok: true,
    nextIndex: label.nextIndex,
    node: withSpan(
      { type: 'link', href: target.trim(), children: label.nodes },
      context,
      baseOffset + index,
      baseOffset + label.nextIndex
    ),
  };
}

function hasInlineContent(nodes) {
  return nodes.some((node) => {
    if (node.type === 'text') return node.value.trim().length > 0;
    if ('children' in node) return hasInlineContent(node.children);
    return true;
  });
}

function parseInlineSequence(text, startIndex, options, state = {}, context, baseOffset = 0) {
  const nodes = [];
  let index = startIndex;

  while (index < text.length) {
    const char = text[index];

    if (char === '\n') {
      if (state.stopOnClose) {
        return { ok: false, errorCode: 'unclosed_inline', nextIndex: index };
      }
      pushText(nodes, '\n', context, baseOffset + index, baseOffset + index + 1);
      index += 1;
      continue;
    }

    if (char === '\\') {
      const escaped = parseEscape(text, index);
      if (!escaped.ok) return escaped;
      if (escaped.value === '[') {
        const literal = parseEscapedBracketLiteral(text, index);
        if (!literal.ok) return literal;
        pushText(nodes, literal.value, context, baseOffset + index, baseOffset + literal.nextIndex);
        index = literal.nextIndex;
        continue;
      }
      pushText(nodes, escaped.value, context, baseOffset + index, baseOffset + escaped.nextIndex);
      index = escaped.nextIndex;
      continue;
    }

    if (text.startsWith('[* ', index)) {
      const parsed = parseSpan(text, index, '[* ', options, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (text.startsWith('[/ ', index)) {
      const parsed = parseSpan(text, index, '[/ ', options, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (text.startsWith('[@ ', index)) {
      const parsed = parseLink(text, index, options, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (text.startsWith('[$ ', index)) {
      const parsed = parseInlineCode(text, index, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (char === ']') {
      if (state.stopOnClose) {
        return { ok: true, closed: true, nextIndex: index + 1, nodes };
      }
      return { ok: false, errorCode: 'unexpected_closing', nextIndex: index };
    }

    if (char === '[' && index + 1 < text.length) {
      return { ok: false, errorCode: 'unknown_inline_type', nextIndex: index };
    }

    pushText(nodes, char, context, baseOffset + index, baseOffset + index + 1);
    index += 1;
  }

  return { ok: true, closed: false, nextIndex: index, nodes };
}

export function parseInline(text, options = {}, baseOffset = 0, context = null) {
  const parsed = parseInlineSequence(text, 0, options, {}, context, baseOffset);
  if (!parsed.ok) return parsed;
  return { ok: true, nodes: parsed.nodes };
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

function extensionOpener(line) {
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
    const prefix = rawFencePrefix(lines[i]);
    if (prefix !== null) {
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
          return failAt('raw_block_bad_closing_margin', j, lines[j].indexOf('```'));
        }
      }
      if (!closed) return failAt('unclosed_code_block', i, prefix.length);
      continue;
    }

    const extension = extensionOpener(lines[i]);
    if (extension === null) continue;

    rawLines.add(i);
    let closed = false;
    for (let j = i + 1; j < lines.length; j += 1) {
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

function parseInlineBlock(type, text, options, baseOffset = 0, context = null) {
  const inline = parseInline(text, options, baseOffset, context);
  if (!inline.ok) return withOffset(inline, baseOffset);
  return { ok: true, node: { type, children: inline.nodes } };
}

function stripQuotePrefix(line) {
  if (line.startsWith('  > ')) return line.slice(4);
  if (line === '  >') return '';
  if (line.startsWith('> ')) return line.slice(2);
  if (line === '>') return '';
  return line;
}

function stripIndent(lines) {
  return lines.map((line) => (line.startsWith('  ') ? line.slice(2) : line));
}

function parseCodeBlock(lines, start, context) {
  const line = lines[start];
  const prefix = rawFencePrefix(line);
  const openerText = line.slice(prefix.length);
  const language = openerText.slice(3).trim() || null;
  const payload = [];

  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === `${prefix}\`\`\``) {
      const node = {
        type: 'code_block',
        language,
        text: payload.map((payloadLine) =>
          payloadLine.startsWith(prefix) ? payloadLine.slice(prefix.length) : payloadLine
        ).join('\n'),
      };
      return {
        ok: true,
        nextIndex: i + 1,
        node: withSpan(node, context, context.lineStartOffsets[start], context.lineStartOffsets[i] + lines[i].length),
      };
    }
    payload.push(lines[i]);
  }

  return { ok: false, errorCode: 'unclosed_code_block' };
}

function parseExtensionBlock(lines, start, context) {
  const extension = extensionOpener(lines[start]);
  if (extension === null) return { ok: false, errorCode: 'invalid_extension_name' };
  const payload = [];

  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === `${extension.prefix}+++`) {
      const node = {
        type: 'extension_block',
        name: extension.name,
        text: payload.map((payloadLine) =>
          payloadLine.startsWith(extension.prefix) ? payloadLine.slice(extension.prefix.length) : payloadLine
        ).join('\n'),
      };
      return {
        ok: true,
        nextIndex: i + 1,
        node: withSpan(node, context, context.lineStartOffsets[start], context.lineStartOffsets[i] + lines[i].length),
      };
    }
    payload.push(lines[i]);
  }

  return { ok: false, errorCode: 'unclosed_extension_block' };
}

function isTableStart(lines, index) {
  return lines[index]?.trim().startsWith('|') && /^\s*\|\s*---/.test(lines[index + 1] ?? '');
}

function splitTableRow(line) {
  const trimmedStart = line.length - line.trimStart().length;
  const trimmedEnd = line.trimEnd().length;
  if (line[trimmedStart] !== '|') return null;
  const bodyStart = trimmedStart + 1;
  const bodyEnd = line[trimmedEnd - 1] === '|' ? trimmedEnd - 1 : trimmedEnd;
  const cells = [];
  let cellStart = bodyStart;

  for (let i = bodyStart; i < bodyEnd; i += 1) {
    const char = line[i];
    if (char === '\\') {
      if (i + 1 < bodyEnd) {
        i += 1;
      }
      continue;
    }
    if (char === '|') {
      cells.push(tableCell(line, cellStart, i));
      cellStart = i + 1;
      continue;
    }
  }

  cells.push(tableCell(line, cellStart, bodyEnd));
  return cells;
}

function tableCell(line, start, end) {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (trimmedStart < trimmedEnd && line[trimmedStart] === ' ') trimmedStart += 1;
  while (trimmedEnd > trimmedStart && line[trimmedEnd - 1] === ' ') trimmedEnd -= 1;
  return {
    text: line.slice(trimmedStart, trimmedEnd),
    start: trimmedStart,
    end: trimmedEnd,
  };
}

function isSeparatorCells(cells) {
  return cells.length > 0 && cells.every((cell) => cell.text === '---');
}

function parseTableCells(cells, options, lineOffset = 0, context = null) {
  const parsedCells = [];
  for (const cell of cells) {
    const cellOffset = lineOffset + cell.start;
    const inline = parseInline(cell.text, options, cellOffset, context);
    if (!inline.ok) return withOffset(inline, cellOffset);
    parsedCells.push({ children: inline.nodes });
  }
  return { ok: true, cells: parsedCells };
}

function parseTable(lines, start, options, context) {
  const headerCells = splitTableRow(lines[start]);
  const separatorCells = splitTableRow(lines[start + 1]);
  if (
    headerCells === null ||
    separatorCells === null ||
    !isSeparatorCells(separatorCells) ||
    headerCells.length !== separatorCells.length
  ) {
    return failAt('invalid_table_shape', context.lineOffset + start, 0);
  }

  const header = parseTableCells(headerCells, options, context.lineStartOffsets[start], context);
  if (!header.ok) return header;

  const rows = [];
  let index = start + 2;
  while (index < lines.length && lines[index].trim().startsWith('|')) {
    const cells = splitTableRow(lines[index]);
    if (cells === null || cells.length !== headerCells.length) {
      return failAt('invalid_table_shape', context.lineOffset + index, 0);
    }
    const row = parseTableCells(cells, options, context.lineStartOffsets[index], context);
    if (!row.ok) return row;
    rows.push(row.cells);
    index += 1;
  }

  if (rows.length === 0) {
    return failAt('invalid_table_shape', context.lineOffset + start + 1, 0);
  }

  return {
    ok: true,
    nextIndex: index,
    node: withSpan(
      { type: 'table', header: header.cells, rows },
      context,
      context.lineStartOffsets[start],
      context.lineStartOffsets[index - 1] + lines[index - 1].length
    ),
  };
}

function parseList(lines, start, options, context) {
  const ordered = /^\d+\. /.test(lines[start]);
  const items = [];
  let index = start;

  while (index < lines.length) {
    const itemStart = index;
    const markerMatch = ordered ? lines[index].match(/^\d+\. (.*)$/) : lines[index].match(/^- (.*)$/);
    if (!markerMatch) break;

    const item = { type: 'list_item', children: [] };
    const markerLength = lines[index].length - markerMatch[1].length;
    const head = parseInlineBlock(
      'paragraph',
      markerMatch[1],
      options,
      context.lineStartOffsets[index] + markerLength,
      context
    );
    if (!head.ok) return head;
    item.children.push(head.node);
    index += 1;

    const nested = [];
    if (lines[index] === '') {
      index += 1;
      while (
        index < lines.length &&
        !/^- /.test(lines[index]) &&
        !/^\d+\. /.test(lines[index]) &&
        lines[index] !== ''
      ) {
        nested.push(lines[index]);
        index += 1;
      }
    }

    if (nested.length > 0) {
      const nestedContext = {
        lineOffset: context.lineOffset + index - nested.length,
        lineStartOffsets: context.lineStartOffsets.slice(index - nested.length, index).map((offset) => offset + 2),
        sourceLineStartOffsets: context.sourceLineStartOffsets,
        includeSpans: context.includeSpans,
      };
      const parsedNested = parseBlocks(stripIndent(nested), options, nestedContext);
      if (!parsedNested.ok) return parsedNested;
      item.children.push(...parsedNested.children);
    }

    items.push(withSpan(item, context, context.lineStartOffsets[itemStart], context.lineStartOffsets[index - 1] + lines[index - 1].length));
  }

  return {
    ok: true,
    nextIndex: index,
    node: withSpan(
      { type: 'list', ordered, items },
      context,
      context.lineStartOffsets[start],
      context.lineStartOffsets[index - 1] + lines[index - 1].length
    ),
  };
}

function parseBlockquote(lines, start, options, context) {
  const quoteLines = [];
  const quoteOffsets = [];
  let index = start;
  while (index < lines.length && (lines[index].startsWith('>') || lines[index].startsWith('  >'))) {
    quoteLines.push(stripQuotePrefix(lines[index]));
    const prefixLength = lines[index].startsWith('  > ') ? 4 : lines[index] === '  >' ? 3 : lines[index].startsWith('> ') ? 2 : 1;
    quoteOffsets.push(context.lineStartOffsets[index] + prefixLength);
    index += 1;
  }
  const parsed = parseBlocks(quoteLines, options, {
    lineOffset: context.lineOffset + start,
    lineStartOffsets: quoteOffsets,
    sourceLineStartOffsets: context.sourceLineStartOffsets,
    includeSpans: context.includeSpans,
  });
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    nextIndex: index,
    node: withSpan(
      { type: 'blockquote', children: parsed.children },
      context,
      context.lineStartOffsets[start],
      context.lineStartOffsets[index - 1] + lines[index - 1].length
    ),
  };
}

function parseParagraph(lines, start, options, context) {
  const paragraphLines = [];
  let index = start;
  while (index < lines.length && lines[index] !== '') {
    paragraphLines.push(lines[index]);
    index += 1;
  }
  const inline = parseInline(paragraphLines.join('\n'), options, context.lineStartOffsets[start], context);
  if (!inline.ok) return withOffset(inline, context.lineStartOffsets[start]);
  return {
    ok: true,
    nextIndex: index,
    node: withSpan(
      { type: 'paragraph', children: inline.nodes },
      context,
      context.lineStartOffsets[start],
      context.lineStartOffsets[index - 1] + lines[index - 1].length
    ),
  };
}

function parseBlocks(lines, options, context) {
  const children = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line === '') {
      index += 1;
      continue;
    }

    if (rawFencePrefix(line) !== null) {
      const code = parseCodeBlock(lines, index, context);
      if (!code.ok) return withLine(code, context.lineOffset + index);
      children.push(code.node);
      index = code.nextIndex;
      continue;
    }

    if (extensionOpener(line) !== null) {
      const extension = parseExtensionBlock(lines, index, context);
      if (!extension.ok) return withLine(extension, context.lineOffset + index);
      children.push(extension.node);
      index = extension.nextIndex;
      continue;
    }

    if (/^#{1,6} /.test(line)) {
      const match = line.match(/^(#{1,6}) (.*)$/);
      const heading = parseInlineBlock(
        'heading',
        match[2],
        options,
        context.lineStartOffsets[index] + match[1].length + 1,
        context
      );
      if (!heading.ok) return heading;
      children.push(withSpan(
        {
          type: 'heading',
          level: match[1].length,
          children: heading.node.children,
        },
        context,
        context.lineStartOffsets[index],
        context.lineStartOffsets[index] + line.length
      ));
      index += 1;
      continue;
    }

    if (line === '---') {
      children.push(withSpan(
        { type: 'horizontal_rule' },
        context,
        context.lineStartOffsets[index],
        context.lineStartOffsets[index] + line.length
      ));
      index += 1;
      continue;
    }

    if (/^- /.test(line) || /^\d+\. /.test(line)) {
      const list = parseList(lines, index, options, context);
      if (!list.ok) return list;
      children.push(list.node);
      index = list.nextIndex;
      continue;
    }

    if (line.startsWith('>') || line.startsWith('  >')) {
      const quote = parseBlockquote(lines, index, options, context);
      if (!quote.ok) return quote;
      children.push(quote.node);
      index = quote.nextIndex;
      continue;
    }

    if (isTableStart(lines, index)) {
      const table = parseTable(lines, index, options, context);
      if (!table.ok) return table;
      children.push(table.node);
      index = table.nextIndex;
      continue;
    }

    const paragraph = parseParagraph(lines, index, options, context);
    if (!paragraph.ok) return paragraph;
    children.push(paragraph.node);
    index = paragraph.nextIndex;
  }

  return { ok: true, children };
}

export function parseAnd(source, options = {}) {
  const normalized = normalizeSource(source);
  const sourceLines = stripFinalEmptyLine(normalized.split('\n'));
  const sourceLineStartOffsets = lineStartOffsets(sourceLines);
  const header = stripDocumentHeader(sourceLines);
  if (!header.ok) return publicFailure(finalizeDiagnostic(header, normalized));
  const lines = header.lines;
  const context = {
    lineOffset: header.lineOffset,
    lineStartOffsets: sourceLineStartOffsets.slice(header.lineOffset),
    sourceLineStartOffsets,
    includeSpans: options.includeSpans === true,
  };

  const raw = scanRawIslands(lines);
  if (!raw.ok) return publicFailure(finalizeDiagnostic(shiftDiagnosticLines(raw, context.lineOffset), normalized));

  const blockValidation = validateBlocks(lines, raw.rawLines);
  if (!blockValidation.ok) {
    return publicFailure(finalizeDiagnostic(shiftDiagnosticLines(blockValidation, context.lineOffset), normalized));
  }

  const parsed = parseBlocks(lines, options, context);
  if (!parsed.ok) return publicFailure(finalizeDiagnostic(parsed, normalized));

  const document = {
    type: 'document',
    children: parsed.children,
  };

  return {
    ok: true,
    document: withSpan(document, context, 0, normalized.endsWith('\n') ? normalized.length - 1 : normalized.length),
  };
}
