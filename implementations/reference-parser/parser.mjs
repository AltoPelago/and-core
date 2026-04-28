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

function pushText(nodes, value) {
  if (!value) return;
  const last = nodes[nodes.length - 1];
  if (last?.type === 'text') {
    last.value += value;
    return;
  }
  nodes.push({ type: 'text', value });
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

function parseInlineCode(text, index) {
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
      return { ok: true, nextIndex: i + 1, node: { type: 'code', text: value } };
    }
    if (char === '\n') {
      return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
    }
    value += char;
    i += 1;
  }
  return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
}

function parseSpan(text, index, opener, options) {
  const type = opener === '[* ' ? 'strong' : 'emphasis';
  const parsed = parseInlineSequence(text, index + opener.length, options, { stopOnClose: true });
  if (!parsed.ok) return parsed;
  if (!parsed.closed) return { ok: false, errorCode: 'unclosed_inline', nextIndex: parsed.nextIndex };
  return {
    ok: true,
    nextIndex: parsed.nextIndex,
    node: { type, children: parsed.nodes },
  };
}

function parseLink(text, index, options) {
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
  const label = parseInlineSequence(text, i, options, { stopOnClose: true });
  if (!label.ok) return label;
  if (!label.closed) return { ok: false, errorCode: 'unclosed_inline', nextIndex: label.nextIndex };
  if (!hasInlineContent(label.nodes)) {
    return { ok: false, errorCode: 'missing_link_label', nextIndex: i };
  }

  return {
    ok: true,
    nextIndex: label.nextIndex,
    node: { type: 'link', href: target.trim(), children: label.nodes },
  };
}

function hasInlineContent(nodes) {
  return nodes.some((node) => {
    if (node.type === 'text') return node.value.trim().length > 0;
    if ('children' in node) return hasInlineContent(node.children);
    return true;
  });
}

function parseInlineSequence(text, startIndex, options, state = {}) {
  const nodes = [];
  let index = startIndex;

  while (index < text.length) {
    const char = text[index];

    if (char === '\n') {
      if (state.stopOnClose) {
        return { ok: false, errorCode: 'unclosed_inline', nextIndex: index };
      }
      pushText(nodes, '\n');
      index += 1;
      continue;
    }

    if (char === '\\') {
      const escaped = parseEscape(text, index);
      if (!escaped.ok) return escaped;
      if (escaped.value === '[') {
        const literal = parseEscapedBracketLiteral(text, index);
        if (!literal.ok) return literal;
        pushText(nodes, literal.value);
        index = literal.nextIndex;
        continue;
      }
      pushText(nodes, escaped.value);
      index = escaped.nextIndex;
      continue;
    }

    if (text.startsWith('[* ', index)) {
      const parsed = parseSpan(text, index, '[* ', options);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (text.startsWith('[/ ', index)) {
      const parsed = parseSpan(text, index, '[/ ', options);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (text.startsWith('[@ ', index)) {
      const parsed = parseLink(text, index, options);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (text.startsWith('[$ ', index)) {
      const parsed = parseInlineCode(text, index);
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

    pushText(nodes, char);
    index += 1;
  }

  return { ok: true, closed: false, nextIndex: index, nodes };
}

export function parseInline(text, options = {}) {
  const parsed = parseInlineSequence(text, 0, options);
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
          return { ok: false, errorCode: 'raw_block_bad_closing_margin' };
        }
      }
      if (!closed) return { ok: false, errorCode: 'unclosed_code_block' };
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
        return { ok: false, errorCode: 'extension_block_bad_closing_margin' };
      }
    }
    if (!closed) return { ok: false, errorCode: 'unclosed_extension_block' };
  }
  return { ok: true, rawLines };
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
      return { ok: false, errorCode: 'invalid_extension_name' };
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

function parseInlineBlock(type, text, options) {
  const inline = parseInline(text, options);
  if (!inline.ok) return inline;
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

function parseCodeBlock(lines, start) {
  const line = lines[start];
  const prefix = rawFencePrefix(line);
  const openerText = line.slice(prefix.length);
  const language = openerText.slice(3).trim() || null;
  const payload = [];

  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === `${prefix}\`\`\``) {
      return {
        ok: true,
        nextIndex: i + 1,
        node: {
          type: 'code_block',
          language,
          text: payload.map((payloadLine) =>
            payloadLine.startsWith(prefix) ? payloadLine.slice(prefix.length) : payloadLine
          ).join('\n'),
        },
      };
    }
    payload.push(lines[i]);
  }

  return { ok: false, errorCode: 'unclosed_code_block' };
}

function parseExtensionBlock(lines, start) {
  const extension = extensionOpener(lines[start]);
  if (extension === null) return { ok: false, errorCode: 'invalid_extension_name' };
  const payload = [];

  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === `${extension.prefix}+++`) {
      return {
        ok: true,
        nextIndex: i + 1,
        node: {
          type: 'extension_block',
          name: extension.name,
          text: payload.map((payloadLine) =>
            payloadLine.startsWith(extension.prefix) ? payloadLine.slice(extension.prefix.length) : payloadLine
          ).join('\n'),
        },
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
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;
  const body = trimmed.endsWith('|') ? trimmed.slice(1, -1) : trimmed.slice(1);
  const cells = [];
  let current = '';

  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (char === '\\') {
      current += char;
      if (i + 1 < body.length) {
        current += body[i + 1];
        i += 1;
      }
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function isSeparatorCells(cells) {
  return cells.length > 0 && cells.every((cell) => cell === '---');
}

function parseTableCells(cells, options) {
  const parsedCells = [];
  for (const cell of cells) {
    const inline = parseInline(cell, options);
    if (!inline.ok) return inline;
    parsedCells.push({ children: inline.nodes });
  }
  return { ok: true, cells: parsedCells };
}

function parseTable(lines, start, options) {
  const headerCells = splitTableRow(lines[start]);
  const separatorCells = splitTableRow(lines[start + 1]);
  if (
    headerCells === null ||
    separatorCells === null ||
    !isSeparatorCells(separatorCells) ||
    headerCells.length !== separatorCells.length
  ) {
    return { ok: false, errorCode: 'invalid_table_shape' };
  }

  const header = parseTableCells(headerCells, options);
  if (!header.ok) return header;

  const rows = [];
  let index = start + 2;
  while (index < lines.length && lines[index].trim().startsWith('|')) {
    const cells = splitTableRow(lines[index]);
    if (cells === null || cells.length !== headerCells.length) {
      return { ok: false, errorCode: 'invalid_table_shape' };
    }
    const row = parseTableCells(cells, options);
    if (!row.ok) return row;
    rows.push(row.cells);
    index += 1;
  }

  if (rows.length === 0) {
    return { ok: false, errorCode: 'invalid_table_shape' };
  }

  return { ok: true, nextIndex: index, node: { type: 'table', header: header.cells, rows } };
}

function parseList(lines, start, options) {
  const ordered = /^\d+\. /.test(lines[start]);
  const items = [];
  let index = start;

  while (index < lines.length) {
    const markerMatch = ordered ? lines[index].match(/^\d+\. (.*)$/) : lines[index].match(/^- (.*)$/);
    if (!markerMatch) break;

    const item = { type: 'list_item', children: [] };
    const head = parseInlineBlock('paragraph', markerMatch[1], options);
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
      const parsedNested = parseBlocks(stripIndent(nested), options);
      if (!parsedNested.ok) return parsedNested;
      item.children.push(...parsedNested.children);
    }

    items.push(item);
  }

  return { ok: true, nextIndex: index, node: { type: 'list', ordered, items } };
}

function parseBlockquote(lines, start, options) {
  const quoteLines = [];
  let index = start;
  while (index < lines.length && (lines[index].startsWith('>') || lines[index].startsWith('  >'))) {
    quoteLines.push(stripQuotePrefix(lines[index]));
    index += 1;
  }
  const parsed = parseBlocks(quoteLines, options);
  if (!parsed.ok) return parsed;
  return { ok: true, nextIndex: index, node: { type: 'blockquote', children: parsed.children } };
}

function parseParagraph(lines, start, options) {
  const paragraphLines = [];
  let index = start;
  while (index < lines.length && lines[index] !== '') {
    paragraphLines.push(lines[index]);
    index += 1;
  }
  const inline = parseInline(paragraphLines.join('\n'), options);
  if (!inline.ok) return inline;
  return { ok: true, nextIndex: index, node: { type: 'paragraph', children: inline.nodes } };
}

function parseBlocks(lines, options) {
  const children = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line === '') {
      index += 1;
      continue;
    }

    if (rawFencePrefix(line) !== null) {
      const code = parseCodeBlock(lines, index);
      if (!code.ok) return code;
      children.push(code.node);
      index = code.nextIndex;
      continue;
    }

    if (extensionOpener(line) !== null) {
      const extension = parseExtensionBlock(lines, index);
      if (!extension.ok) return extension;
      children.push(extension.node);
      index = extension.nextIndex;
      continue;
    }

    if (/^#{1,6} /.test(line)) {
      const match = line.match(/^(#{1,6}) (.*)$/);
      const heading = parseInlineBlock('heading', match[2], options);
      if (!heading.ok) return heading;
      heading.node.level = match[1].length;
      children.push(heading.node);
      index += 1;
      continue;
    }

    if (line === '---') {
      children.push({ type: 'horizontal_rule' });
      index += 1;
      continue;
    }

    if (/^- /.test(line) || /^\d+\. /.test(line)) {
      const list = parseList(lines, index, options);
      if (!list.ok) return list;
      children.push(list.node);
      index = list.nextIndex;
      continue;
    }

    if (line.startsWith('>') || line.startsWith('  >')) {
      const quote = parseBlockquote(lines, index, options);
      if (!quote.ok) return quote;
      children.push(quote.node);
      index = quote.nextIndex;
      continue;
    }

    if (isTableStart(lines, index)) {
      const table = parseTable(lines, index, options);
      if (!table.ok) return table;
      children.push(table.node);
      index = table.nextIndex;
      continue;
    }

    const paragraph = parseParagraph(lines, index, options);
    if (!paragraph.ok) return paragraph;
    children.push(paragraph.node);
    index = paragraph.nextIndex;
  }

  return { ok: true, children };
}

export function parseAnd(source, options = {}) {
  const normalized = normalizeSource(source);
  const lines = stripFinalEmptyLine(normalized.split('\n'));

  const raw = scanRawIslands(lines);
  if (!raw.ok) return raw;

  const blockValidation = validateBlocks(lines, raw.rawLines);
  if (!blockValidation.ok) return blockValidation;

  const parsed = parseBlocks(lines, options);
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    document: {
      type: 'document',
      children: parsed.children,
    },
  };
}
