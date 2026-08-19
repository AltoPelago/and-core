import { extensionOpener, rawFence, scanDocument } from './scanner.mjs';

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

function parseAnchorTag(text, index, context, baseOffset = 0) {
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
      const id = value.trim();
      if (id.length === 0) {
        return { ok: false, errorCode: 'invalid_anchor_tag', nextIndex: i };
      }
      return {
        ok: true,
        nextIndex: i + 1,
        node: withSpan({ type: 'anchor_tag', id }, context, baseOffset + index, baseOffset + i + 1),
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

function parseSimpleV2Tag(text, index, context, baseOffset, opener, nodeType, invalidCode) {
  let i = index + opener.length;
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
      const content = value.trim();
      if (content.length === 0) {
        return { ok: false, errorCode: invalidCode, nextIndex: i };
      }
      return {
        ok: true,
        nextIndex: i + 1,
        node: withSpan({ type: nodeType, value: content }, context, baseOffset + index, baseOffset + i + 1),
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

function parseReferenceTag(text, index, context, baseOffset = 0) {
  return parseSimpleV2Tag(text, index, context, baseOffset, '[~ ', 'reference_tag', 'invalid_reference_tag');
}

function parseAdmonitionTag(text, index, context, baseOffset = 0) {
  return parseSimpleV2Tag(text, index, context, baseOffset, '[! ', 'admonition_tag', 'invalid_admonition_tag');
}

function parseQuestionTag(text, index, context, baseOffset = 0) {
  return parseSimpleV2Tag(text, index, context, baseOffset, '[? ', 'question_tag', 'invalid_question_tag');
}

function parsePlusTag(text, index, context, baseOffset = 0) {
  return parseSimpleV2Tag(text, index, context, baseOffset, '[+ ', 'plus_tag', 'invalid_plus_tag');
}

function parseStrikeTag(text, index, context, baseOffset = 0) {
  return parseSimpleV2Tag(text, index, context, baseOffset, '[- ', 'strike_tag', 'invalid_strike_tag');
}

function parseQuotedTag(text, index, context, baseOffset = 0) {
  return parseSimpleV2Tag(text, index, context, baseOffset, '[" ', 'quoted_tag', 'invalid_quoted_tag');
}

function parseCommentTag(text, index, context, baseOffset = 0) {
  return parseSimpleV2Tag(text, index, context, baseOffset, "[' ", 'comment_tag', 'invalid_comment_tag');
}

function parseTypedValueTag(text, index, context, baseOffset = 0) {
  let i = index + 2;
  let datatype = '';

  while (i < text.length) {
    const char = text[i];
    if (char === '\\') {
      const escaped = parseEscape(text, i);
      if (!escaped.ok) return escaped;
      datatype += escaped.value;
      i = escaped.nextIndex;
      continue;
    }
    if (char === ']' || char === '\n' || char === ' ') break;
    datatype += char;
    i += 1;
  }

  if (datatype.length === 0) {
    return { ok: false, errorCode: 'invalid_typed_value', nextIndex: i };
  }
  if (i >= text.length || text[i] === '\n') {
    return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
  }
  if (text[i] === ']') {
    return { ok: false, errorCode: 'invalid_typed_value', nextIndex: i };
  }

  while (i < text.length && text[i] === ' ') i += 1;

  let rawValue = '';
  while (i < text.length) {
    const char = text[i];
    if (char === '\\') {
      const escaped = parseEscape(text, i);
      if (!escaped.ok) return escaped;
      rawValue += escaped.value;
      i = escaped.nextIndex;
      continue;
    }
    if (char === ']') {
      const payload = rawValue.trim();
      if (payload.length === 0) {
        return { ok: false, errorCode: 'invalid_typed_value', nextIndex: i };
      }
      const value = payload.startsWith('"') && payload.endsWith('"') && payload.length >= 2 ? payload.slice(1, -1) : payload;
      return {
        ok: true,
        nextIndex: i + 1,
        node: withSpan(
          { type: 'typed_value', datatype, value },
          context,
          baseOffset + index,
          baseOffset + i + 1
        ),
      };
    }
    if (char === '\n') {
      return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
    }
    rawValue += char;
    i += 1;
  }

  return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
}

function parseHighlightTag(text, index, context, baseOffset = 0) {
  return parseSimpleV2Tag(text, index, context, baseOffset, '[= ', 'highlight_tag', 'invalid_highlight_tag');
}

function parseUnderlineTag(text, index, context, baseOffset = 0) {
  return parseSimpleV2Tag(text, index, context, baseOffset, '[_ ', 'underline_tag', 'invalid_underline_tag');
}

function parseTodoMarker(text, index, context, baseOffset = 0) {
  const markers = {
    '[ ]': 'unchecked',
    '[x]': 'checked',
    '[,]': 'in_progress',
    '[;]': 'cancelled',
  };
  const token = text.slice(index, index + 3);
  const state = markers[token];
  if (!state) {
    return { ok: false, errorCode: 'invalid_todo_marker', nextIndex: index };
  }
  return {
    ok: true,
    nextIndex: index + 3,
    node: withSpan({ type: 'todo_marker', state }, context, baseOffset + index, baseOffset + index + 3),
  };
}

function parseDirectionalMarker(text, index, context, baseOffset = 0) {
  const markers = {
    '[>]': 'forward',
    '[<]': 'backward',
  };
  const token = text.slice(index, index + 3);
  const direction = markers[token];
  if (!direction) {
    return { ok: false, errorCode: 'invalid_directional_marker', nextIndex: index };
  }
  return {
    ok: true,
    nextIndex: index + 3,
    node: withSpan({ type: 'directional_marker', direction }, context, baseOffset + index, baseOffset + index + 3),
  };
}

function parseAutoNumberMarker(text, index, context, baseOffset = 0) {
  if (!text.startsWith('[%]', index)) {
    return { ok: false, errorCode: 'invalid_auto_number_marker', nextIndex: index };
  }
  return {
    ok: true,
    nextIndex: index + 3,
    node: withSpan({ type: 'auto_number_marker' }, context, baseOffset + index, baseOffset + index + 3),
  };
}

function parseLineBreakMarker(text, index, context, baseOffset = 0) {
  if (text.startsWith('[.]', index)) {
    return {
      ok: true,
      nextIndex: index + 3,
      node: withSpan({ type: 'line_break' }, context, baseOffset + index, baseOffset + index + 3),
    };
  }
  return { ok: false, errorCode: 'invalid_line_break_marker', nextIndex: index };
}

function isV2Document(context) {
  return context?.documentVersion === 'v2';
}

function isReservedV2BlockOpener(line) {
  return line === '~~~=' || line.startsWith('===') || line.startsWith('***');
}

function parseSpan(text, index, opener, options, context, baseOffset = 0, inlineDepth = 0) {
  const type = opener === '[* ' ? 'strong' : 'emphasis';
  const parsed = parseInlineSequence(text, index + opener.length, options, { stopOnClose: true, inlineDepth }, context, baseOffset);
  if (!parsed.ok) return parsed;
  if (!parsed.closed) return { ok: false, errorCode: 'unclosed_inline', nextIndex: parsed.nextIndex };
  return {
    ok: true,
    nextIndex: parsed.nextIndex,
    node: withSpan({ type, children: parsed.nodes }, context, baseOffset + index, baseOffset + parsed.nextIndex),
  };
}

function parseLink(text, index, options, context, baseOffset = 0, inlineDepth = 0) {
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
  const label = parseInlineSequence(text, i, options, { stopOnClose: true, inlineDepth }, context, baseOffset);
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
  const inlineDepth = state.inlineDepth ?? 0;

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
      const nextDepth = inlineDepth + 1;
      if (typeof options?.budgets?.maxInlineDepth === 'number' && nextDepth > options.budgets.maxInlineDepth) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: index };
      }
      const parsed = parseSpan(text, index, '[* ', options, context, baseOffset, nextDepth);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (text.startsWith('[/ ', index)) {
      const nextDepth = inlineDepth + 1;
      if (typeof options?.budgets?.maxInlineDepth === 'number' && nextDepth > options.budgets.maxInlineDepth) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: index };
      }
      const parsed = parseSpan(text, index, '[/ ', options, context, baseOffset, nextDepth);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (text.startsWith('[@ ', index)) {
      const nextDepth = inlineDepth + 1;
      if (typeof options?.budgets?.maxInlineDepth === 'number' && nextDepth > options.budgets.maxInlineDepth) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: index };
      }
      const parsed = parseLink(text, index, options, context, baseOffset, nextDepth);
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

    if (isV2Document(context) && text.startsWith('[# ', index)) {
      const parsed = parseAnchorTag(text, index, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[~ ', index)) {
      const parsed = parseReferenceTag(text, index, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[! ', index)) {
      const parsed = parseAdmonitionTag(text, index, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[? ', index)) {
      const parsed = parseQuestionTag(text, index, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[+ ', index)) {
      const parsed = parsePlusTag(text, index, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[- ', index)) {
      const parsed = parseStrikeTag(text, index, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[" ', index)) {
      const parsed = parseQuotedTag(text, index, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith("[' ", index)) {
      const parsed = parseCommentTag(text, index, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[:', index)) {
      const parsed = parseTypedValueTag(text, index, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[= ', index)) {
      const parsed = parseHighlightTag(text, index, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[_ ', index)) {
      const parsed = parseUnderlineTag(text, index, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && char === '[') {
      const parsed = parseTodoMarker(text, index, context, baseOffset);
      if (parsed.ok) {
        nodes.push(parsed.node);
        index = parsed.nextIndex;
        continue;
      }

      const directional = parseDirectionalMarker(text, index, context, baseOffset);
      if (directional.ok) {
        nodes.push(directional.node);
        index = directional.nextIndex;
        continue;
      }

      const autoNumber = parseAutoNumberMarker(text, index, context, baseOffset);
      if (autoNumber.ok) {
        nodes.push(autoNumber.node);
        index = autoNumber.nextIndex;
        continue;
      }
    }

    if (isV2Document(context) && text.startsWith('[.', index)) {
      const parsed = parseLineBreakMarker(text, index, context, baseOffset);
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

function parseInlineBlock(type, text, options, baseOffset = 0, context = null) {
  const inline = parseInline(text, options, baseOffset, context);
  if (!inline.ok) return withOffset(inline, baseOffset);
  return { ok: true, node: { type, children: inline.nodes } };
}

function stripListContinuationIndent(nodes) {
  let pendingIndentSpaces = 0;

  function stripText(value) {
    let output = '';
    for (const char of value) {
      if (char === '\n') {
        output += char;
        pendingIndentSpaces = 2;
      } else if (pendingIndentSpaces > 0 && char === ' ') {
        pendingIndentSpaces -= 1;
      } else {
        output += char;
        pendingIndentSpaces = 0;
      }
    }
    return output;
  }

  function visit(children) {
    for (const node of children) {
      if (node.type === 'text') {
        node.value = stripText(node.value);
      } else if (node.children) {
        visit(node.children);
      }
    }
  }

  visit(nodes);
  return nodes;
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

function rawPayloadLine(line, prefix) {
  return line.startsWith(prefix) ? line.slice(prefix.length) : line;
}

function addPayloadSize(currentSize, line) {
  return currentSize + (currentSize === 0 ? 0 : 1) + line.length;
}

function exceedsBlockBudget(size, options) {
  const maxBlockSize = options?.budgets?.maxBlockSize;
  return typeof maxBlockSize === 'number' && size > maxBlockSize;
}

function recordBlock(options, context, lineIndex) {
  const maxBlockCount = options?.budgets?.maxBlockCount;
  if (typeof maxBlockCount !== 'number') return { ok: true };
  context.budgetState.blockCount += 1;
  if (context.budgetState.blockCount > maxBlockCount) {
    return failAt('nd_budget_exceeded', context.lineOffset + lineIndex, 0);
  }
  return { ok: true };
}

function recordListItem(options, context, lineIndex) {
  const maxListItemCount = options?.budgets?.maxListItemCount;
  if (typeof maxListItemCount !== 'number') return { ok: true };
  context.budgetState.listItemCount += 1;
  if (context.budgetState.listItemCount > maxListItemCount) {
    return failAt('nd_budget_exceeded', context.lineOffset + lineIndex, 0);
  }
  return { ok: true };
}

function makeChildContext(context, fields = {}) {
  return {
    ...fields,
    budgetState: context.budgetState,
    depth: (context.depth ?? 0) + 1,
  };
}

function parseCodeBlock(lines, start, options, context) {
  const line = lines[start];
  const fence = rawFence(line);
  const openerText = line.slice(fence.prefix.length);
  const language = openerText.slice(fence.fence.length).trim() || null;
  const payload = [];
  let payloadSize = 0;

  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === `${fence.prefix}${fence.fence}`) {
      const node = {
        type: 'code_block',
        language,
        ordered: fence.fence.length === 4,
        text: payload.map((payloadLine) => rawPayloadLine(payloadLine, fence.prefix)).join('\n'),
      };
      return {
        ok: true,
        nextIndex: i + 1,
        node: withSpan(node, context, context.lineStartOffsets[start], context.lineStartOffsets[i] + lines[i].length),
      };
    }
    payloadSize = addPayloadSize(payloadSize, rawPayloadLine(lines[i], fence.prefix));
    if (exceedsBlockBudget(payloadSize, options)) {
      return failAt('nd_budget_exceeded', context.lineOffset + i, 0);
    }
    payload.push(lines[i]);
  }

  return { ok: false, errorCode: 'unclosed_code_block' };
}

function parseHighlightParagraphBlock(lines, start, options, context) {
  const payload = [];

  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === '~~~=') {
      const text = payload.join('\n');
      if (text.trim().length === 0) {
        return { ok: false, errorCode: 'invalid_highlight_paragraph_block' };
      }
      const inline = parseInline(text, options, context.lineStartOffsets[start + 1], context);
      if (!inline.ok) return withOffset(inline, context.lineStartOffsets[start + 1]);

      return {
        ok: true,
        nextIndex: i + 1,
        node: withSpan(
          {
            type: 'highlight_paragraph_block',
            children: inline.nodes,
          },
          context,
          context.lineStartOffsets[start],
          context.lineStartOffsets[i] + lines[i].length
        ),
      };
    }
    payload.push(lines[i]);
  }

  return { ok: false, errorCode: 'unclosed_highlight_paragraph_block' };
}

function parseTaggedPairedBlock(lines, start, options, context, config) {
  const opener = lines[start];
  const tag = opener.slice(config.fence.length);

  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(tag)) {
    return { ok: false, errorCode: config.invalidCode };
  }

  const payload = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === opener) {
      const text = payload.join('\n');
      if (text.trim().length === 0) {
        return { ok: false, errorCode: config.invalidCode };
      }
      const inline = parseInline(text, options, context.lineStartOffsets[start + 1], context);
      if (!inline.ok) return withOffset(inline, context.lineStartOffsets[start + 1]);

      return {
        ok: true,
        nextIndex: i + 1,
        node: withSpan(
          {
            type: config.nodeType,
            tag,
            children: inline.nodes,
          },
          context,
          context.lineStartOffsets[start],
          context.lineStartOffsets[i] + lines[i].length
        ),
      };
    }
    payload.push(lines[i]);
  }

  return { ok: false, errorCode: config.unclosedCode };
}

function parseHeaderTextBlock(lines, start, options, context) {
  const opener = lines[start];
  const tag = opener.slice(3);
  if (tag.length > 0 && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(tag)) {
    return { ok: false, errorCode: 'invalid_header_text_block' };
  }

  const payload = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === '===') {
      const text = payload.join('\n');
      if (text.trim().length === 0) {
        return { ok: false, errorCode: 'invalid_header_text_block' };
      }
      const inline = parseInline(text, options, context.lineStartOffsets[start + 1], context);
      if (!inline.ok) return withOffset(inline, context.lineStartOffsets[start + 1]);

      return {
        ok: true,
        nextIndex: i + 1,
        node: withSpan(
          {
            type: 'header_text_block',
            ...(tag.length > 0 ? { tag } : {}),
            children: inline.nodes,
          },
          context,
          context.lineStartOffsets[start],
          context.lineStartOffsets[i] + lines[i].length
        ),
      };
    }
    payload.push(lines[i]);
  }

  return { ok: false, errorCode: 'unclosed_header_text_block' };
}

function parseDisclaimerBlock(lines, start, options, context) {
  const opener = lines[start];
  const tag = opener.slice(3);
  if (tag.length > 0 && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(tag)) {
    return { ok: false, errorCode: 'invalid_disclaimer_block' };
  }

  const payload = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === '***') {
      const text = payload.join('\n');
      if (text.trim().length === 0) {
        return { ok: false, errorCode: 'invalid_disclaimer_block' };
      }
      const inline = parseInline(text, options, context.lineStartOffsets[start + 1], context);
      if (!inline.ok) return withOffset(inline, context.lineStartOffsets[start + 1]);

      return {
        ok: true,
        nextIndex: i + 1,
        node: withSpan(
          {
            type: 'disclaimer_block',
            ...(tag.length > 0 ? { tag } : {}),
            children: inline.nodes,
          },
          context,
          context.lineStartOffsets[start],
          context.lineStartOffsets[i] + lines[i].length
        ),
      };
    }
    payload.push(lines[i]);
  }

  return { ok: false, errorCode: 'unclosed_disclaimer_block' };
}

function parseExtensionBlock(lines, start, options, context) {
  const extension = extensionOpener(lines[start]);
  if (extension === null) return { ok: false, errorCode: 'invalid_extension_name' };
  const payload = [];
  let payloadSize = 0;

  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === `${extension.prefix}+++`) {
      const node = {
        type: 'extension_block',
        name: extension.name,
        text: payload.map((payloadLine) => rawPayloadLine(payloadLine, extension.prefix)).join('\n'),
      };
      return {
        ok: true,
        nextIndex: i + 1,
        node: withSpan(node, context, context.lineStartOffsets[start], context.lineStartOffsets[i] + lines[i].length),
      };
    }
    payloadSize = addPayloadSize(payloadSize, rawPayloadLine(lines[i], extension.prefix));
    if (exceedsBlockBudget(payloadSize, options)) {
      return failAt('nd_budget_exceeded', context.lineOffset + i, 0);
    }
    payload.push(lines[i]);
  }

  return { ok: false, errorCode: 'unclosed_extension_block' };
}

function parseFallbackBlock(lines, start, options, context) {
  const fallback = extensionOpener(lines[start]);
  if (fallback === null || fallback.name !== 'fallback') return { ok: false, errorCode: 'orphan_fallback_block' };
  const payload = [];

  for (let i = start + 1; i < lines.length; i += 1) {
    const nestedExtension = extensionOpener(lines[i]);
    if (nestedExtension?.prefix === fallback.prefix) {
      payload.push(lines[i]);
      let foundNestedClose = false;
      for (i += 1; i < lines.length; i += 1) {
        payload.push(lines[i]);
        if (lines[i] === `${nestedExtension.prefix}+++`) {
          foundNestedClose = true;
          break;
        }
      }
      if (!foundNestedClose) return { ok: false, errorCode: 'unclosed_extension_block' };
      continue;
    }
    if (lines[i] === `${fallback.prefix}+++`) {
      const fallbackContext = {
        lineOffset: context.lineOffset + start + 1,
        lineStartOffsets: context.lineStartOffsets
          .slice(start + 1, i)
          .map((offset) => offset + fallback.prefix.length),
        sourceLineStartOffsets: context.sourceLineStartOffsets,
        includeSpans: context.includeSpans,
      };
      const parsedFallback = parseBlocks(stripExtensionPrefix(payload, fallback.prefix), {
        ...options,
        allowExtensionFallback: false,
      }, makeChildContext(context, fallbackContext));
      if (!parsedFallback.ok) return parsedFallback;
      return {
        ok: true,
        nextIndex: i + 1,
        fallback: {
          type: 'document_fragment',
          children: parsedFallback.children,
        },
      };
    }
    payload.push(lines[i]);
  }

  return { ok: false, errorCode: 'unclosed_extension_block' };
}

function stripExtensionPrefix(lines, prefix) {
  if (prefix === '') return lines;
  return lines.map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : line));
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

  const maxTableColumns = options?.budgets?.maxTableColumns;
  if (typeof maxTableColumns === 'number' && headerCells.length > maxTableColumns) {
    return failAt('nd_budget_exceeded', context.lineOffset + start, 0);
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
  let expectedNumber = null;

  while (index < lines.length) {
    const itemStart = index;
    const markerMatch = ordered ? lines[index].match(/^(\d+)\. (.*)$/) : lines[index].match(/^- (.*)$/);
    if (!markerMatch) break;

    const itemBudget = recordListItem(options, context, index);
    if (!itemBudget.ok) return itemBudget;

    const itemText = ordered ? markerMatch[2] : markerMatch[1];
    if (ordered) {
      const actualNumber = Number(markerMatch[1]);
      if (expectedNumber !== null && actualNumber !== expectedNumber) {
        return failAt('invalid_ordered_list_sequence', context.lineOffset + index, 0);
      }
      expectedNumber = actualNumber + 1;
    }

    const item = { type: 'list_item', children: [] };
    const markerLength = lines[index].length - itemText.length;
    const headBaseOffset = context.lineStartOffsets[index] + markerLength;
    const headLines = [itemText];
    index += 1;
    while (
      index < lines.length &&
      lines[index].startsWith('  ') &&
      lines[index] !== ''
    ) {
      headLines.push(lines[index]);
      index += 1;
    }

    const head = parseInlineBlock(
      'paragraph',
      headLines.join('\n'),
      options,
      headBaseOffset,
      context
    );
    if (!head.ok) return head;
    stripListContinuationIndent(head.node.children);
    const headBlockBudget = recordBlock(options, context, itemStart);
    if (!headBlockBudget.ok) return headBlockBudget;
    item.children.push(head.node);

    const nested = [];
    if (lines[index] === '') {
      index += 1;
      while (index < lines.length) {
        if (lines[index] === '') {
          nested.push(lines[index]);
          index += 1;
          continue;
        }
        if (!lines[index].startsWith('  ')) {
          break;
        }
        nested.push(lines[index]);
        index += 1;
      }
    }

    if (nested.length > 0) {
      const nestedContext = makeChildContext(context, {
        lineOffset: context.lineOffset + index - nested.length,
        lineStartOffsets: context.lineStartOffsets.slice(index - nested.length, index).map((offset) => offset + 2),
        sourceLineStartOffsets: context.sourceLineStartOffsets,
        includeSpans: context.includeSpans,
      });
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
  const parsed = parseBlocks(quoteLines, options, makeChildContext(context, {
    lineOffset: context.lineOffset + start,
    lineStartOffsets: quoteOffsets,
    sourceLineStartOffsets: context.sourceLineStartOffsets,
    includeSpans: context.includeSpans,
  }));
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
  const maxNestingDepth = options?.budgets?.maxNestingDepth;
  if (typeof maxNestingDepth === 'number' && (context.depth ?? 0) > maxNestingDepth) {
    return failAt('nd_budget_exceeded', context.lineOffset, 0);
  }

  const children = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line === '') {
      index += 1;
      continue;
    }

    if (rawFence(line) !== null) {
      const code = parseCodeBlock(lines, index, options, context);
      if (!code.ok) return withLine(code, context.lineOffset + index);
      const blockBudget = recordBlock(options, context, index);
      if (!blockBudget.ok) return blockBudget;
      children.push(code.node);
      index = code.nextIndex;
      continue;
    }

    if (!isV2Document(context) && isReservedV2BlockOpener(line)) {
      return failAt('unknown_block_type', context.lineOffset + index, 0);
    }

    if (isV2Document(context) && line === '~~~=') {
      const highlight = parseHighlightParagraphBlock(lines, index, options, context);
      if (!highlight.ok) return withLine(highlight, context.lineOffset + index);
      const blockBudget = recordBlock(options, context, index);
      if (!blockBudget.ok) return blockBudget;
      children.push(highlight.node);
      index = highlight.nextIndex;
      continue;
    }

    if (isV2Document(context) && line.startsWith('===')) {
      const headerText = parseHeaderTextBlock(lines, index, options, context);
      if (!headerText.ok) return withLine(headerText, context.lineOffset + index);
      const blockBudget = recordBlock(options, context, index);
      if (!blockBudget.ok) return blockBudget;
      children.push(headerText.node);
      index = headerText.nextIndex;
      continue;
    }

    if (isV2Document(context) && line.startsWith('***')) {
      const disclaimer = parseDisclaimerBlock(lines, index, options, context);
      if (!disclaimer.ok) return withLine(disclaimer, context.lineOffset + index);
      const blockBudget = recordBlock(options, context, index);
      if (!blockBudget.ok) return blockBudget;
      children.push(disclaimer.node);
      index = disclaimer.nextIndex;
      continue;
    }

    const opener = extensionOpener(line);
    if (opener !== null) {
      if (opener.name === 'fallback') {
        return failAt('orphan_fallback_block', context.lineOffset + index, opener.prefix.length);
      }
      const extension = parseExtensionBlock(lines, index, options, context);
      if (!extension.ok) return withLine(extension, context.lineOffset + index);
      let nextIndex = extension.nextIndex;
      const fallbackOpener = extensionOpener(lines[nextIndex] ?? '');
      if (fallbackOpener?.name === 'fallback') {
        if (options.allowExtensionFallback === false) {
          return failAt('nested_fallback_block', context.lineOffset + nextIndex, fallbackOpener.prefix.length);
        }
        const fallback = parseFallbackBlock(lines, nextIndex, options, context);
        if (!fallback.ok) return withLine(fallback, context.lineOffset + nextIndex, fallbackOpener.prefix.length);
        extension.node.fallback = fallback.fallback;
        nextIndex = fallback.nextIndex;
      }
      const blockBudget = recordBlock(options, context, index);
      if (!blockBudget.ok) return blockBudget;
      children.push(extension.node);
      index = nextIndex;
      continue;
    }

    if (/^#{1,6} /.test(line)) {
      const match = line.match(/^(#{1,6}) (.*)$/);
      let headingText = match[2];
      let autoNumber = false;
      let markerConsumed = 0;
      if (isV2Document(context) && headingText.startsWith('[n]')) {
        autoNumber = true;
        headingText = headingText.slice(3);
        markerConsumed = 3;
        if (headingText.startsWith(' ')) {
          headingText = headingText.slice(1);
          markerConsumed += 1;
        }
        if (headingText.length === 0) {
          return failAt('invalid_heading_auto_number_marker', context.lineOffset + index, match[1].length + 1);
        }
      }
      const heading = parseInlineBlock(
        'heading',
        headingText,
        options,
        context.lineStartOffsets[index] + match[1].length + 1 + markerConsumed,
        context
      );
      if (!heading.ok) return heading;
      const blockBudget = recordBlock(options, context, index);
      if (!blockBudget.ok) return blockBudget;
      children.push(withSpan(
        {
          type: 'heading',
          level: match[1].length,
          ...(autoNumber ? { autoNumber: true } : {}),
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
      const blockBudget = recordBlock(options, context, index);
      if (!blockBudget.ok) return blockBudget;
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
      const blockBudget = recordBlock(options, context, index);
      if (!blockBudget.ok) return blockBudget;
      children.push(list.node);
      index = list.nextIndex;
      continue;
    }

    if (line.startsWith('>') || line.startsWith('  >')) {
      const quote = parseBlockquote(lines, index, options, context);
      if (!quote.ok) return quote;
      const blockBudget = recordBlock(options, context, index);
      if (!blockBudget.ok) return blockBudget;
      children.push(quote.node);
      index = quote.nextIndex;
      continue;
    }

    if (isTableStart(lines, index)) {
      const table = parseTable(lines, index, options, context);
      if (!table.ok) return table;
      const blockBudget = recordBlock(options, context, index);
      if (!blockBudget.ok) return blockBudget;
      children.push(table.node);
      index = table.nextIndex;
      continue;
    }

    const paragraph = parseParagraph(lines, index, options, context);
    if (!paragraph.ok) return paragraph;
    const blockBudget = recordBlock(options, context, index);
    if (!blockBudget.ok) return blockBudget;
    children.push(paragraph.node);
    index = paragraph.nextIndex;
  }

  return { ok: true, children };
}

export function parseAnd(source, options = {}) {
  const scanned = scanDocument(source, options);
  if (!scanned.ok) {
    const lineOffset = scanned.context?.lineOffset ?? scanned.lineOffset ?? 0;
    return publicFailure(finalizeDiagnostic(shiftDiagnosticLines(scanned, lineOffset), scanned.normalized));
  }

  const parsed = parseBlocks(scanned.lines, options, {
    ...scanned.context,
    budgetState: { blockCount: 0, listItemCount: 0 },
    depth: 0,
  });
  if (!parsed.ok) return publicFailure(finalizeDiagnostic(parsed, scanned.normalized));

  const document = {
    type: 'document',
    children: parsed.children,
  };

  return {
    ok: true,
    document: withSpan(
      document,
      scanned.context,
      0,
      scanned.normalized.endsWith('\n') ? scanned.normalized.length - 1 : scanned.normalized.length
    ),
  };
}
