import { blockCloser, extensionOpener, rawFence, scanDocument, tildeLanguageRawFence } from './scanner.mjs';
import { parseAeonInlineTypedValue } from '../shared/aeon-inline-scalar.mjs';
import { isNdV2Identifier } from '../shared/v2-identifier.mjs';

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

function isStructuralBlockOpener(lines, context) {
  const line = lines[0] ?? '';
  if (rawFence(line, 'v2') !== null || tildeLanguageRawFence(line) !== null) return true;
  if (formattedParagraphFence(line) !== null) return true;
  if (semanticBlockOpener(line) !== null) return true;
  if (cardBlockOpener(line) !== null) return true;
  if (line.startsWith('===') || line.startsWith('***') || line.startsWith('+++')) return true;
  if (/^#{1,6} /.test(line)) return true;
  if (line === '---') return true;
  if (/^- /.test(line) || /^\d+\. /.test(line)) return true;
  if (line.startsWith('>') || line.startsWith('  >')) return true;
  if (tableCaptionLine(line) !== null) return true;
  return isTableStart(lines, 0, context?.documentVersion ?? 'v2');
}

function structuralEscapeValue(text, index, context) {
  if (context?.documentVersion !== 'v2' || context.allowStructuralEscape !== true || index !== 0) {
    return null;
  }
  const unescaped = `${text.slice(0, index)}${text.slice(index + 1)}`;
  return isStructuralBlockOpener(unescaped.split('\n'), context) ? text[index + 1] : null;
}

function parseEscape(text, index, context = null) {
  const next = text[index + 1];
  if (isEscapable(next)) {
    return { ok: true, nextIndex: index + 2, value: next };
  }
  const structural = structuralEscapeValue(text, index, context);
  if (structural !== null) {
    return { ok: true, nextIndex: index + 2, value: structural };
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
      if (!isNdV2Identifier(id)) {
        return { ok: false, errorCode: 'invalid_anchor_tag', nextIndex: i };
      }
      context?.semanticState?.anchors.push({ id, offset: baseOffset + index });
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

function parseScalarV2Tag(text, index, context, baseOffset, opener, nodeType, invalidCode) {
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

function parsePlusTag(text, index, context, baseOffset = 0) {
  return parseScalarV2Tag(text, index, context, baseOffset, '[+ ', 'plus_tag', 'invalid_plus_tag');
}

function parseImageTag(text, index, options, context, baseOffset = 0) {
  let i = index + 3;
  const fields = [''];

  while (i < text.length) {
    const char = text[i];
    if (char === '\\') {
      const escaped = parseEscape(text, i);
      if (!escaped.ok) return escaped;
      fields[fields.length - 1] += escaped.value;
      i = escaped.nextIndex;
      continue;
    }
    if (char === '|') {
      if (fields.length === 3) {
        return { ok: false, errorCode: 'invalid_image_tag', nextIndex: i };
      }
      fields.push('');
      i += 1;
      continue;
    }
    if (char === ']') {
      if (fields.length < 2) {
        return { ok: false, errorCode: 'invalid_image_tag', nextIndex: i };
      }
      const src = fields[0].trim();
      const alt = fields[1].trim();
      const rawMode = fields.length === 3 ? fields[2].trim() : 'inline';
      if (
        typeof options?.budgets?.maxLinkTargetLength === 'number'
        && src.length > options.budgets.maxLinkTargetLength
      ) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: i };
      }
      if (src.length === 0 || alt.length === 0 || !['inline', 'half', 'full'].includes(rawMode)) {
        return { ok: false, errorCode: 'invalid_image_tag', nextIndex: i };
      }
      return {
        ok: true,
        nextIndex: i + 1,
        node: withSpan(
          { type: 'image_tag', src, alt, mode: rawMode },
          context,
          baseOffset + index,
          baseOffset + i + 1
        ),
      };
    }
    if (char === '\n') {
      return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
    }
    fields[fields.length - 1] += char;
    i += 1;
  }

  return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
}

function parseAdmonitionTag(text, index, options, context, baseOffset = 0, inlineDepth = 0) {
  return parseRichV2Tag(
    text, index, options, context, baseOffset, '[! ', 'admonition_tag', 'invalid_admonition_tag', inlineDepth
  );
}

function parseQuestionTag(text, index, options, context, baseOffset = 0, inlineDepth = 0) {
  return parseRichV2Tag(
    text, index, options, context, baseOffset, '[? ', 'question_tag', 'invalid_question_tag', inlineDepth
  );
}

function containsFootnote(nodes) {
  return nodes.some((node) => (
    node.type === 'footnote_definition'
    || node.type === 'footnote_reference'
    || (Array.isArray(node.children) && containsFootnote(node.children))
  ));
}

function parseFootnoteTag(text, index, options, context, baseOffset = 0, inlineDepth = 0) {
  let contentStart = index + 3;
  let id = null;

  if (text[contentStart] === '(') {
    const idEnd = text.indexOf(')', contentStart + 1);
    const closingBracket = text.indexOf(']', contentStart + 1);
    const lineBreak = text.indexOf('\n', contentStart + 1);
    if (
      idEnd === -1
      || (closingBracket !== -1 && closingBracket < idEnd)
      || (lineBreak !== -1 && lineBreak < idEnd)
    ) {
      return { ok: false, errorCode: 'invalid_footnote_id', nextIndex: contentStart };
    }

    id = text.slice(contentStart + 1, idEnd);
    if (!isNdV2Identifier(id)) {
      return { ok: false, errorCode: 'invalid_footnote_id', nextIndex: contentStart + 1 };
    }

    if (text[idEnd + 1] === ']') {
      context?.semanticState?.footnotes.push({ type: 'reference', id, offset: baseOffset + index });
      return {
        ok: true,
        nextIndex: idEnd + 2,
        node: withSpan(
          { type: 'footnote_reference', id },
          context,
          baseOffset + index,
          baseOffset + idEnd + 2
        ),
      };
    }
    if (text[idEnd + 1] !== ' ') {
      return { ok: false, errorCode: 'invalid_footnote', nextIndex: idEnd + 1 };
    }
    contentStart = idEnd + 2;
  }

  const parsed = parseInlineSequence(
    text,
    contentStart,
    options,
    { stopOnClose: true, inlineDepth },
    context,
    baseOffset
  );
  if (!parsed.ok) return parsed;
  if (!parsed.closed) return { ok: false, errorCode: 'unclosed_inline', nextIndex: parsed.nextIndex };

  const children = trimRichInlineBoundaries(parsed.nodes, context);
  if (!hasInlineContent(children)) {
    return { ok: false, errorCode: 'invalid_footnote', nextIndex: parsed.nextIndex - 1 };
  }
  if (containsFootnote(children)) {
    return { ok: false, errorCode: 'nested_footnote', nextIndex: contentStart };
  }

  if (id !== null) {
    context?.semanticState?.footnotes.push({ type: 'definition', id, offset: baseOffset + index });
  }
  return {
    ok: true,
    nextIndex: parsed.nextIndex,
    node: withSpan(
      { type: 'footnote_definition', ...(id === null ? {} : { id }), children },
      context,
      baseOffset + index,
      baseOffset + parsed.nextIndex
    ),
  };
}

function parseStrikeTag(text, index, options, context, baseOffset = 0, inlineDepth = 0) {
  return parseRichV2Tag(
    text, index, options, context, baseOffset, '[- ', 'strike_tag', 'invalid_strike_tag', inlineDepth
  );
}

function parseQuotedTag(text, index, options, context, baseOffset = 0, inlineDepth = 0) {
  return parseRichV2Tag(
    text, index, options, context, baseOffset, '[" ', 'quoted_tag', 'invalid_quoted_tag', inlineDepth
  );
}

function parseCommentTag(text, index, options, context, baseOffset = 0, inlineDepth = 0) {
  return parseRichV2Tag(
    text, index, options, context, baseOffset, "[' ", 'comment_tag', 'invalid_comment_tag', inlineDepth
  );
}

function parseDisclaimerTag(text, index, options, context, baseOffset = 0, inlineDepth = 0) {
  return parseRichV2Tag(
    text, index, options, context, baseOffset, '[^ ', 'disclaimer_tag', 'invalid_disclaimer_tag', inlineDepth
  );
}

function parseSemanticTag(text, index, options, context, baseOffset = 0, inlineDepth = 0) {
  const idEnd = text.indexOf(')', index + 2);
  if (idEnd === -1 || text.slice(index + 2, idEnd).includes('\n')) {
    return { ok: false, errorCode: 'invalid_semantic_tag', nextIndex: index + 2 };
  }

  const id = text.slice(index + 2, idEnd);
  if (!isNdV2Identifier(id) || text[idEnd + 1] !== ' ') {
    return { ok: false, errorCode: 'invalid_semantic_tag', nextIndex: idEnd + 1 };
  }

  const parsed = parseInlineSequence(
    text,
    idEnd + 2,
    options,
    { stopOnClose: true, inlineDepth },
    context,
    baseOffset
  );
  if (!parsed.ok) return parsed;
  if (!parsed.closed) return { ok: false, errorCode: 'unclosed_inline', nextIndex: parsed.nextIndex };

  const children = trimRichInlineBoundaries(parsed.nodes, context);
  if (!hasInlineContent(children)) {
    return { ok: false, errorCode: 'invalid_semantic_tag', nextIndex: parsed.nextIndex - 1 };
  }

  return {
    ok: true,
    nextIndex: parsed.nextIndex,
    node: withSpan(
      { type: 'semantic_tag', id, children },
      context,
      baseOffset + index,
      baseOffset + parsed.nextIndex
    ),
  };
}

function parseTypedValueTag(text, index, context, baseOffset = 0) {
  let i = index + 2;
  let quote = null;
  let escaped = false;
  let bracketDepth = 0;
  while (i < text.length) {
    const char = text[i];

    if (quote !== null) {
      if (char === '\n' || char === '\r') {
        return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
      }
      if (quote !== '`' && escaped) escaped = false;
      else if (quote !== '`' && char === '\\') escaped = true;
      else if (char === quote) quote = null;
      i += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      i += 1;
      continue;
    }
    if (char === '[') {
      bracketDepth += 1;
      i += 1;
      continue;
    }
    if (char === ']' && bracketDepth > 0) {
      bracketDepth -= 1;
      i += 1;
      continue;
    }
    if (char === ']') {
      const parsed = parseAeonInlineTypedValue(text.slice(index + 2, i));
      if (!parsed.ok) return { ok: false, errorCode: parsed.errorCode, nextIndex: i };
      return {
        ok: true,
        nextIndex: i + 1,
        node: withSpan(
          { type: 'typed_value', datatype: parsed.datatype, value: parsed.value },
          context,
          baseOffset + index,
          baseOffset + i + 1
        ),
      };
    }
    if (char === '\n') {
      return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
    }
    i += 1;
  }

  return { ok: false, errorCode: 'unclosed_inline', nextIndex: i };
}

function parseHighlightTag(text, index, options, context, baseOffset = 0, inlineDepth = 0) {
  return parseRichV2Tag(
    text, index, options, context, baseOffset, '[= ', 'highlight_tag', 'invalid_highlight_tag', inlineDepth
  );
}

function parseUnderlineTag(text, index, options, context, baseOffset = 0, inlineDepth = 0) {
  return parseRichV2Tag(
    text, index, options, context, baseOffset, '[_ ', 'underline_tag', 'invalid_underline_tag', inlineDepth
  );
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

const V2_FORMATTED_PARAGRAPH_FENCES = {
  '~~~=': {
    nodeType: 'highlight_paragraph_block',
    invalidCode: 'invalid_highlight_paragraph_block',
    unclosedCode: 'unclosed_highlight_paragraph_block',
  },
  '~~~*': {
    nodeType: 'strong_paragraph_block',
    invalidCode: 'invalid_strong_paragraph_block',
    unclosedCode: 'unclosed_strong_paragraph_block',
  },
  '~~~/': {
    nodeType: 'emphasis_paragraph_block',
    invalidCode: 'invalid_emphasis_paragraph_block',
    unclosedCode: 'unclosed_emphasis_paragraph_block',
  },
  '~~~_': {
    nodeType: 'underline_paragraph_block',
    invalidCode: 'invalid_underline_paragraph_block',
    unclosedCode: 'unclosed_underline_paragraph_block',
  },
  '~~~?': {
    nodeType: 'question_paragraph_block',
    invalidCode: 'invalid_question_paragraph_block',
    unclosedCode: 'unclosed_question_paragraph_block',
  },
  '~~~!': {
    nodeType: 'admonition_paragraph_block',
    invalidCode: 'invalid_admonition_paragraph_block',
    unclosedCode: 'unclosed_admonition_paragraph_block',
  },
  "~~~'": {
    nodeType: 'comment_block',
    invalidCode: 'invalid_comment_block',
    unclosedCode: 'unclosed_comment_block',
  },
  '~~~#': {
    nodeType: 'header_text_block',
    invalidCode: 'invalid_header_text_block',
    unclosedCode: 'unclosed_header_text_block',
  },
  '~~~^': {
    nodeType: 'disclaimer_block',
    closer: '~~~',
    invalidCode: 'invalid_disclaimer_block',
    unclosedCode: 'unclosed_disclaimer_block',
  },
};

function formattedParagraphFence(line) {
  return V2_FORMATTED_PARAGRAPH_FENCES[line] ?? null;
}

function semanticBlockOpener(line) {
  if (!line.startsWith('~~~(')) return null;
  const match = line.match(/^~~~\(([^)]*)\)$/);
  if (!match || !isNdV2Identifier(match[1])) {
    return { ok: false, errorCode: 'invalid_semantic_block' };
  }
  return {
    ok: true,
    config: {
      nodeType: 'semantic_block',
      id: match[1],
      closer: '~~~',
      invalidCode: 'invalid_semantic_block',
      unclosedCode: 'unclosed_semantic_block',
    },
  };
}

function cardBlockOpener(line) {
  if (!line.startsWith('~~~|')) return null;
  if (line === '~~~|') return { ok: true, title: null };
  const match = line.match(/^~~~\| (\S(?:.*\S)?)$/);
  if (!match) {
    return { ok: false, errorCode: 'invalid_card_block' };
  }
  return { ok: true, title: match[1] };
}

function isReservedV2BlockOpener(line) {
  return formattedParagraphFence(line) !== null
    || line.startsWith('~~~(')
    || line.startsWith('~~~|')
    || line.startsWith('~~~$')
    || line.startsWith('===')
    || line.startsWith('***');
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

  const href = target.trim();
  if (isV2Document(context) && href.startsWith('#') && href.length > 1) {
    const localTarget = href.slice(1);
    if (!isNdV2Identifier(localTarget)) {
      return { ok: false, errorCode: 'invalid_local_anchor_target', nextIndex: index };
    }
    context?.semanticState?.localLinks.push({ target: localTarget, offset: baseOffset + index });
  }

  return {
    ok: true,
    nextIndex: label.nextIndex,
    node: withSpan(
      { type: 'link', href, children: label.nodes },
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

function trimRichInlineBoundaries(nodes, context) {
  while (nodes[0]?.type === 'text') {
    const first = nodes[0];
    const leadingLength = first.value.match(/^\s+/u)?.[0].length ?? 0;
    if (leadingLength === 0) break;
    first.value = first.value.slice(leadingLength);
    if (context?.includeSpans) {
      first.span = makeSpan(context, first.span.startOffset + leadingLength, first.span.endOffset);
    }
    if (first.value.length > 0) break;
    nodes.shift();
  }

  while (nodes.at(-1)?.type === 'text') {
    const last = nodes.at(-1);
    const trailingLength = last.value.match(/\s+$/u)?.[0].length ?? 0;
    if (trailingLength === 0) break;
    last.value = last.value.slice(0, -trailingLength);
    if (context?.includeSpans) {
      last.span = makeSpan(context, last.span.startOffset, last.span.endOffset - trailingLength);
    }
    if (last.value.length > 0) break;
    nodes.pop();
  }

  return nodes;
}

function parseRichV2Tag(
  text,
  index,
  options,
  context,
  baseOffset,
  opener,
  nodeType,
  invalidCode,
  inlineDepth
) {
  const parsed = parseInlineSequence(
    text,
    index + opener.length,
    options,
    { stopOnClose: true, inlineDepth },
    context,
    baseOffset
  );
  if (!parsed.ok) return parsed;
  if (!parsed.closed) return { ok: false, errorCode: 'unclosed_inline', nextIndex: parsed.nextIndex };

  const children = trimRichInlineBoundaries(parsed.nodes, context);
  if (!hasInlineContent(children)) {
    return { ok: false, errorCode: invalidCode, nextIndex: parsed.nextIndex - 1 };
  }

  return {
    ok: true,
    nextIndex: parsed.nextIndex,
    node: withSpan(
      { type: nodeType, children },
      context,
      baseOffset + index,
      baseOffset + parsed.nextIndex
    ),
  };
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
      const escaped = parseEscape(text, index, context);
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

    if (isV2Document(context) && text.startsWith('[! ', index)) {
      const nextDepth = inlineDepth + 1;
      if (typeof options?.budgets?.maxInlineDepth === 'number' && nextDepth > options.budgets.maxInlineDepth) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: index };
      }
      const parsed = parseAdmonitionTag(text, index, options, context, baseOffset, nextDepth);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[? ', index)) {
      const nextDepth = inlineDepth + 1;
      if (typeof options?.budgets?.maxInlineDepth === 'number' && nextDepth > options.budgets.maxInlineDepth) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: index };
      }
      const parsed = parseQuestionTag(text, index, options, context, baseOffset, nextDepth);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[% ', index)) {
      const nextDepth = inlineDepth + 1;
      if (typeof options?.budgets?.maxInlineDepth === 'number' && nextDepth > options.budgets.maxInlineDepth) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: index };
      }
      const parsed = parseFootnoteTag(text, index, options, context, baseOffset, nextDepth);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[%', index)) {
      return { ok: false, errorCode: 'invalid_footnote', nextIndex: index };
    }

    if (isV2Document(context) && text.startsWith('[+ ', index)) {
      const parsed = parsePlusTag(text, index, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[~ ', index)) {
      const parsed = parseImageTag(text, index, options, context, baseOffset);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[- ', index)) {
      const nextDepth = inlineDepth + 1;
      if (typeof options?.budgets?.maxInlineDepth === 'number' && nextDepth > options.budgets.maxInlineDepth) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: index };
      }
      const parsed = parseStrikeTag(text, index, options, context, baseOffset, nextDepth);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[" ', index)) {
      const nextDepth = inlineDepth + 1;
      if (typeof options?.budgets?.maxInlineDepth === 'number' && nextDepth > options.budgets.maxInlineDepth) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: index };
      }
      const parsed = parseQuotedTag(text, index, options, context, baseOffset, nextDepth);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith("[' ", index)) {
      const nextDepth = inlineDepth + 1;
      if (typeof options?.budgets?.maxInlineDepth === 'number' && nextDepth > options.budgets.maxInlineDepth) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: index };
      }
      const parsed = parseCommentTag(text, index, options, context, baseOffset, nextDepth);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[^ ', index)) {
      const nextDepth = inlineDepth + 1;
      if (typeof options?.budgets?.maxInlineDepth === 'number' && nextDepth > options.budgets.maxInlineDepth) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: index };
      }
      const parsed = parseDisclaimerTag(text, index, options, context, baseOffset, nextDepth);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[(', index)) {
      const nextDepth = inlineDepth + 1;
      if (typeof options?.budgets?.maxInlineDepth === 'number' && nextDepth > options.budgets.maxInlineDepth) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: index };
      }
      const parsed = parseSemanticTag(text, index, options, context, baseOffset, nextDepth);
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
      const nextDepth = inlineDepth + 1;
      if (typeof options?.budgets?.maxInlineDepth === 'number' && nextDepth > options.budgets.maxInlineDepth) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: index };
      }
      const parsed = parseHighlightTag(text, index, options, context, baseOffset, nextDepth);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && text.startsWith('[_ ', index)) {
      const nextDepth = inlineDepth + 1;
      if (typeof options?.budgets?.maxInlineDepth === 'number' && nextDepth > options.budgets.maxInlineDepth) {
        return { ok: false, errorCode: 'nd_budget_exceeded', nextIndex: index };
      }
      const parsed = parseUnderlineTag(text, index, options, context, baseOffset, nextDepth);
      if (!parsed.ok) return parsed;
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    if (isV2Document(context) && char === '[') {
      const directional = parseDirectionalMarker(text, index, context, baseOffset);
      if (directional.ok) {
        nodes.push(directional.node);
        index = directional.nextIndex;
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
  const requestedVersion = options.version ?? 'v1';
  if (context === null && requestedVersion !== 'v1' && requestedVersion !== 'v2') {
    return { ok: false, errorCode: 'invalid_version_option', nextIndex: 0 };
  }
  if (context === null && requestedVersion === 'v2' && options.allowV2 !== true) {
    return { ok: false, errorCode: 'unsupported_version', nextIndex: 0 };
  }
  const effectiveContext = context ?? {
    documentVersion: requestedVersion,
    includeSpans: options.includeSpans === true,
    sourceLineStartOffsets: lineStartOffsets(text.replaceAll('\r\n', '\n').split('\n')),
  };
  const parsed = parseInlineSequence(text, 0, options, {}, effectiveContext, baseOffset);
  if (!parsed.ok) return parsed;
  return { ok: true, nodes: parsed.nodes };
}

function parseInlineBlock(type, text, options, baseOffset = 0, context = null) {
  const inline = parseInline(text, options, baseOffset, context);
  if (!inline.ok) return withOffset(inline, baseOffset);
  return { ok: true, node: { type, children: inline.nodes } };
}

function parseBlockCaption(closer, lineIndex, options, context) {
  if (closer.caption === null) return { ok: true, caption: undefined };
  if (closer.caption.trim().length === 0) {
    return { ok: false, errorCode: 'invalid_block_caption' };
  }
  const captionOffset = context.lineStartOffsets[lineIndex] + closer.captionOffset;
  const inline = parseInline(closer.caption, options, captionOffset, context);
  if (!inline.ok) return withOffset(inline, captionOffset);
  if (!hasInlineContent(inline.nodes)) {
    return { ok: false, errorCode: 'invalid_block_caption' };
  }
  return { ok: true, caption: inline.nodes };
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
    ...context,
    ...fields,
    budgetState: context.budgetState,
    depth: (context.depth ?? 0) + 1,
  };
}

function parseCodeBlock(lines, start, options, context) {
  const line = lines[start];
  const fence = rawFence(line, context.documentVersion);
  const openerText = line.slice(fence.prefix.length);
  const language = fence.kind === 'dollar'
    ? fence.language
    : openerText.slice(fence.fence.length).trim() || null;
  const payload = [];
  let payloadSize = 0;

  for (let i = start + 1; i < lines.length; i += 1) {
    const closer = blockCloser(lines[i], `${fence.prefix}${fence.fence}`, context.documentVersion);
    if (closer?.ok === false) return { ok: false, errorCode: closer.errorCode };
    if (closer?.ok === true) {
      const parsedCaption = parseBlockCaption(closer, i, options, context);
      if (!parsedCaption.ok) return parsedCaption;
      const node = {
        type: 'code_block',
        language,
        ordered: fence.kind === 'dollar' ? fence.ordered : fence.fence.length === 4,
        text: payload.map((payloadLine) => rawPayloadLine(payloadLine, fence.prefix)).join('\n'),
        ...(parsedCaption.caption === undefined ? {} : { caption: parsedCaption.caption }),
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

function parseFormattedParagraphBlock(lines, start, options, context, config) {
  const fence = lines[start];
  const closer = config.closer ?? fence;
  const payload = [];
  let payloadSize = 0;

  for (let i = start + 1; i < lines.length; i += 1) {
    const matchedCloser = blockCloser(lines[i], closer, context.documentVersion);
    if (matchedCloser?.ok === true) {
      const parsedCaption = parseBlockCaption(matchedCloser, i, options, context);
      if (!parsedCaption.ok) return parsedCaption;
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
            ...(config.id === undefined ? {} : { id: config.id }),
            children: inline.nodes,
            ...(parsedCaption.caption === undefined ? {} : { caption: parsedCaption.caption }),
          },
          context,
          context.lineStartOffsets[start],
          context.lineStartOffsets[i] + lines[i].length
        ),
      };
    }
    payloadSize = addPayloadSize(payloadSize, lines[i]);
    if (exceedsBlockBudget(payloadSize, options)) {
      return failAt('nd_budget_exceeded', context.lineOffset + i, 0);
    }
    payload.push(lines[i]);
  }

  return { ok: false, errorCode: config.unclosedCode };
}

function parseCardBlock(lines, start, options, context, opener) {
  const payload = [];
  let payloadSize = 0;

  for (let i = start + 1; i < lines.length; i += 1) {
    const closer = blockCloser(lines[i], '~~~|', context.documentVersion);
    if (closer?.ok === true) {
      const parsedCaption = parseBlockCaption(closer, i, options, context);
      if (!parsedCaption.ok) return parsedCaption;
      const bodyContext = makeChildContext(context, {
        lineOffset: context.lineOffset + start + 1,
        lineStartOffsets: context.lineStartOffsets.slice(start + 1, i),
        sourceLineStartOffsets: context.sourceLineStartOffsets,
        includeSpans: context.includeSpans,
      });
      const body = parseBlocks(payload, options, bodyContext);
      if (!body.ok) return body;
      if (body.children.length === 0) {
        return { ok: false, errorCode: 'invalid_card_block' };
      }

      let title;
      if (opener.title !== null) {
        const titleOffset = context.lineStartOffsets[start] + '~~~| '.length;
        const parsedTitle = parseInline(opener.title, options, titleOffset, context);
        if (!parsedTitle.ok) return withOffset(parsedTitle, titleOffset);
        title = parsedTitle.nodes;
      }

      return {
        ok: true,
        nextIndex: i + 1,
        node: withSpan(
          {
            type: 'card_block',
            ...(title === undefined ? {} : { title }),
            children: body.children,
            ...(parsedCaption.caption === undefined ? {} : { caption: parsedCaption.caption }),
          },
          context,
          context.lineStartOffsets[start],
          context.lineStartOffsets[i] + lines[i].length
        ),
      };
    }
    payloadSize = addPayloadSize(payloadSize, lines[i]);
    if (exceedsBlockBudget(payloadSize, options)) {
      return failAt('nd_budget_exceeded', context.lineOffset + i, 0);
    }
    payload.push(lines[i]);
  }

  return { ok: false, errorCode: 'unclosed_card_block' };
}

function parseExtensionBlock(lines, start, options, context) {
  const extension = extensionOpener(lines[start]);
  if (extension === null) return { ok: false, errorCode: 'invalid_extension_name' };
  const payload = [];
  let payloadSize = 0;

  for (let i = start + 1; i < lines.length; i += 1) {
    const closer = blockCloser(lines[i], `${extension.prefix}+++`, context.documentVersion);
    if (closer?.ok === false) return { ok: false, errorCode: closer.errorCode };
    if (closer?.ok === true) {
      const parsedCaption = parseBlockCaption(closer, i, options, context);
      if (!parsedCaption.ok) return parsedCaption;
      const node = {
        type: 'extension_block',
        name: extension.name,
        text: payload.map((payloadLine) => rawPayloadLine(payloadLine, extension.prefix)).join('\n'),
        ...(parsedCaption.caption === undefined ? {} : { caption: parsedCaption.caption }),
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
        const nestedCloser = blockCloser(lines[i], `${nestedExtension.prefix}+++`, context.documentVersion);
        if (nestedCloser?.ok === true) {
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

const TABLE_ALIGNMENT_BY_SEPARATOR = Object.freeze({
  '---': null,
  '<--': 'left',
  '-=-': 'center',
  '-->': 'right',
});

function isTableStart(lines, index) {
  if (!lines[index]?.trim().startsWith('|')) return false;
  const separatorCells = splitTableRow(lines[index + 1] ?? '');
  return separatorCells !== null
    && Object.hasOwn(TABLE_ALIGNMENT_BY_SEPARATOR, separatorCells[0]?.text);
}

function tableCaptionLine(line) {
  const trimmed = line.trimStart();
  if (!trimmed.startsWith('|~')) return null;
  const offset = line.length - trimmed.length;
  if (trimmed === '|~') {
    return { ok: true, caption: '', captionOffset: offset + 2 };
  }
  if (!trimmed.startsWith('|~ ')) {
    return { ok: false };
  }
  const caption = trimmed.slice(3).trimEnd();
  if (caption.startsWith(' ')) {
    return { ok: false };
  }
  return { ok: true, caption, captionOffset: offset + 3 };
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
    rawText: line.slice(start, end),
    rawStart: start,
    rawEnd: end,
    text: line.slice(trimmedStart, trimmedEnd),
    start: trimmedStart,
    end: trimmedEnd,
  };
}

function parseSeparatorCells(cells, version) {
  if (cells.length === 0 || !cells.every((cell) => Object.hasOwn(TABLE_ALIGNMENT_BY_SEPARATOR, cell.text))) {
    return { ok: false, errorCode: 'invalid_table_shape' };
  }
  const alignments = cells.map((cell) => TABLE_ALIGNMENT_BY_SEPARATOR[cell.text]);
  if (version !== 'v2' && alignments.some((alignment) => alignment !== null)) {
    return { ok: false, errorCode: 'invalid_table_alignment' };
  }
  return { ok: true, alignments };
}

function spanCellContent(cell) {
  if (!cell.rawText.startsWith('>')) {
    return { ok: true, cell, colSpan: 1, hasSpan: false };
  }
  const match = cell.rawText.match(/^(>+) (.*)$/);
  if (!match) return { ok: false, errorCode: 'invalid_table_span', column: cell.rawStart };
  const markerLength = match[1].length;
  const contentRaw = match[2];
  let leading = 0;
  let trailing = contentRaw.length;
  while (leading < trailing && contentRaw[leading] === ' ') leading += 1;
  while (trailing > leading && contentRaw[trailing - 1] === ' ') trailing -= 1;
  if (leading === trailing) {
    return { ok: false, errorCode: 'invalid_table_span', column: cell.rawStart };
  }
  return {
    ok: true,
    colSpan: markerLength + 1,
    hasSpan: true,
    cell: {
      ...cell,
      text: contentRaw.slice(leading, trailing),
      start: cell.rawStart + markerLength + 1 + leading,
      end: cell.rawStart + markerLength + 1 + trailing,
    },
  };
}

function parseTableCells(cells, options, lineOffset = 0, context = null) {
  const parsedCells = [];
  let logicalWidth = 0;
  let hasSpan = false;
  for (const sourceCell of cells) {
    const spanCell = spanCellContent(sourceCell);
    if (!spanCell.ok) return spanCell;
    if (spanCell.hasSpan && context?.documentVersion !== 'v2') {
      return { ok: false, errorCode: 'invalid_table_span', column: sourceCell.rawStart };
    }
    const cellOffset = lineOffset + spanCell.cell.start;
    const inline = parseInline(spanCell.cell.text, options, cellOffset, context);
    if (!inline.ok) return withOffset(inline, cellOffset);
    parsedCells.push({
      children: inline.nodes,
      ...(spanCell.colSpan > 1 ? { colSpan: spanCell.colSpan } : {}),
    });
    logicalWidth += spanCell.colSpan;
    hasSpan ||= spanCell.hasSpan;
  }
  return { ok: true, cells: parsedCells, logicalWidth, hasSpan };
}

function parseTable(lines, start, options, context) {
  const headerCells = splitTableRow(lines[start]);
  const separatorCells = splitTableRow(lines[start + 1]);
  if (headerCells === null || separatorCells === null) {
    return failAt('invalid_table_shape', context.lineOffset + start, 0);
  }
  const separator = parseSeparatorCells(separatorCells, context.documentVersion);
  if (!separator.ok) return failAt(separator.errorCode, context.lineOffset + start + 1, 0);
  const logicalColumnCount = separatorCells.length;

  const maxTableColumns = options?.budgets?.maxTableColumns;
  if (typeof maxTableColumns === 'number' && logicalColumnCount > maxTableColumns) {
    return failAt('nd_budget_exceeded', context.lineOffset + start, 0);
  }

  const header = parseTableCells(headerCells, options, context.lineStartOffsets[start], context);
  if (!header.ok) return withLine(header, context.lineOffset + start, header.column ?? 0);
  if (header.logicalWidth !== logicalColumnCount) {
    return failAt(header.hasSpan ? 'invalid_table_span' : 'invalid_table_shape', context.lineOffset + start, 0);
  }

  const rows = [];
  let index = start + 2;
  while (index < lines.length && lines[index].trim().startsWith('|')) {
    if (tableCaptionLine(lines[index]) !== null) break;
    const cells = splitTableRow(lines[index]);
    if (cells === null) {
      return failAt('invalid_table_shape', context.lineOffset + index, 0);
    }
    const row = parseTableCells(cells, options, context.lineStartOffsets[index], context);
    if (!row.ok) return withLine(row, context.lineOffset + index, row.column ?? 0);
    if (row.logicalWidth !== logicalColumnCount) {
      return failAt(row.hasSpan ? 'invalid_table_span' : 'invalid_table_shape', context.lineOffset + index, 0);
    }
    rows.push(row.cells);
    index += 1;
  }

  if (rows.length === 0) {
    return failAt('invalid_table_shape', context.lineOffset + start + 1, 0);
  }

  let caption;
  const captionLine = tableCaptionLine(lines[index] ?? '');
  if (captionLine !== null) {
    if (context.documentVersion !== 'v2') {
      return failAt('block_caption_requires_v2', context.lineOffset + index, 0);
    }
    if (!captionLine.ok) {
      return failAt('invalid_table_caption', context.lineOffset + index, 0);
    }
    const parsedCaption = parseBlockCaption(captionLine, index, options, context);
    if (!parsedCaption.ok) return withLine(parsedCaption, context.lineOffset + index, 0);
    caption = parsedCaption.caption;
    index += 1;
    if (tableCaptionLine(lines[index] ?? '') !== null) {
      return failAt('invalid_table_caption', context.lineOffset + index, 0);
    }
  }

  return {
    ok: true,
    nextIndex: index,
    node: withSpan(
      {
        type: 'table',
        header: header.cells,
        rows,
        ...(separator.alignments.some((alignment) => alignment !== null)
          ? { alignments: separator.alignments }
          : {}),
        ...(caption === undefined ? {} : { caption }),
      },
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
  let listKind = null;

  const todoStates = {
    '[ ]': 'unchecked',
    '[x]': 'checked',
    '[,]': 'in_progress',
    '[;]': 'cancelled',
  };

  function todoPrefix(text) {
    const token = text.slice(0, 3);
    const state = todoStates[token];
    if (!state) return null;
    if (text.length < 5 || text[3] !== ' ' || text.slice(4).trim().length === 0) {
      return { ok: false, errorCode: 'invalid_todo_item' };
    }
    return { ok: true, state, text: text.slice(4), prefixLength: 4 };
  }

  function autoNumberPrefix(text) {
    if (!text.startsWith('[n]')) return null;
    if (text.length < 5 || text[3] !== ' ' || text.slice(4).trim().length === 0) {
      return { ok: false, errorCode: 'invalid_auto_number_item' };
    }
    return { ok: true, text: text.slice(4), prefixLength: 4 };
  }

  function advisoryPrefix(text) {
    const token = text.slice(0, 3);
    const kinds = { '[?]': 'question', '[!]': 'admonition' };
    const kind = kinds[token];
    if (!kind) return null;
    if (text.length < 5 || text[3] !== ' ' || text.slice(4).trim().length === 0) {
      return { ok: false, errorCode: 'invalid_advisory_list_item' };
    }
    return { ok: true, kind, text: text.slice(3), prefixLength: 3 };
  }

  function isImmediateNestedList(line) {
    if (!isV2Document(context) || typeof line !== 'string' || !line.startsWith('  ')) return false;
    const nestedLine = line.slice(2);
    return /^- /.test(nestedLine) || /^\d+\. /.test(nestedLine);
  }

  while (index < lines.length) {
    const itemStart = index;
    const markerMatch = ordered ? lines[index].match(/^(\d+)\. (.*)$/) : lines[index].match(/^- (.*)$/);
    if (!markerMatch) break;

    const itemBudget = recordListItem(options, context, index);
    if (!itemBudget.ok) return itemBudget;

    const itemText = ordered ? markerMatch[2] : markerMatch[1];
    const parsedTodoPrefix = isV2Document(context) ? todoPrefix(itemText) : null;
    const parsedAutoNumberPrefix = isV2Document(context) ? autoNumberPrefix(itemText) : null;
    const parsedAdvisoryPrefix = isV2Document(context) ? advisoryPrefix(itemText) : null;
    if (parsedTodoPrefix && !parsedTodoPrefix.ok) {
      return failAt(parsedTodoPrefix.errorCode, context.lineOffset + index, lines[index].length - itemText.length);
    }
    if (parsedAutoNumberPrefix && !parsedAutoNumberPrefix.ok) {
      return failAt(parsedAutoNumberPrefix.errorCode, context.lineOffset + index, lines[index].length - itemText.length);
    }
    if (parsedAdvisoryPrefix && !parsedAdvisoryPrefix.ok) {
      return failAt(parsedAdvisoryPrefix.errorCode, context.lineOffset + index, lines[index].length - itemText.length);
    }
    if (ordered && parsedTodoPrefix?.ok) {
      return failAt('todo_list_requires_unordered_marker', context.lineOffset + index, 0);
    }
    if (ordered && parsedAutoNumberPrefix?.ok) {
      return failAt('auto_number_list_requires_unordered_marker', context.lineOffset + index, 0);
    }
    if (ordered && parsedAdvisoryPrefix?.ok) {
      return failAt('advisory_list_requires_unordered_marker', context.lineOffset + index, 0);
    }
    const itemKind = parsedTodoPrefix?.ok
      ? 'todo'
      : parsedAutoNumberPrefix?.ok
        ? 'auto_number'
        : 'ordinary';
    if (listKind !== null && itemKind !== listKind) {
      return failAt('mixed_list_item_kinds', context.lineOffset + index, 0);
    }
    listKind = itemKind;

    if (ordered) {
      const actualNumber = Number(markerMatch[1]);
      if (expectedNumber !== null && actualNumber !== expectedNumber) {
        return failAt('invalid_ordered_list_sequence', context.lineOffset + index, 0);
      }
      expectedNumber = actualNumber + 1;
    }

    const item = parsedTodoPrefix?.ok
      ? { type: 'todo_item', state: parsedTodoPrefix.state, children: [] }
      : { type: 'list_item', children: [] };
    const structuralPrefix = parsedTodoPrefix?.ok
      ? parsedTodoPrefix
      : parsedAutoNumberPrefix?.ok
        ? parsedAutoNumberPrefix
        : parsedAdvisoryPrefix?.ok
          ? parsedAdvisoryPrefix
          : null;
    const headText = structuralPrefix ? structuralPrefix.text : itemText;
    const markerLength = lines[index].length - itemText.length + (structuralPrefix?.prefixLength ?? 0);
    const headBaseOffset = context.lineStartOffsets[index] + markerLength;
    const headLines = [headText];
    index += 1;
    while (
      index < lines.length &&
      lines[index].startsWith('  ') &&
      lines[index] !== '' &&
      !isImmediateNestedList(lines[index])
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
    if (parsedAdvisoryPrefix?.ok) {
      const markerStart = context.lineStartOffsets[itemStart] + (ordered ? markerMatch[1].length + 2 : 2);
      head.node.children.unshift(withSpan(
        { type: 'advisory_marker', kind: parsedAdvisoryPrefix.kind },
        context,
        markerStart,
        markerStart + 3
      ));
    }
    const headBlockBudget = recordBlock(options, context, itemStart);
    if (!headBlockBudget.ok) return headBlockBudget;
    item.children.push(head.node);

    const nested = [];
    if (lines[index] === '' || isImmediateNestedList(lines[index])) {
      if (lines[index] === '') index += 1;
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
      listKind === 'todo'
        ? { type: 'todo_list', items }
        : listKind === 'auto_number'
          ? { type: 'auto_number_list', items }
          : { type: 'list', ordered, items },
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
  const inline = parseInline(
    paragraphLines.join('\n'),
    options,
    context.lineStartOffsets[start],
    { ...context, allowStructuralEscape: true }
  );
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

    if (rawFence(line, context.documentVersion) !== null) {
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

    const formattedParagraph = isV2Document(context) ? formattedParagraphFence(line) : null;
    if (formattedParagraph !== null) {
      const parsedFormattedParagraph = parseFormattedParagraphBlock(lines, index, options, context, formattedParagraph);
      if (!parsedFormattedParagraph.ok) return withLine(parsedFormattedParagraph, context.lineOffset + index);
      const blockBudget = recordBlock(options, context, index);
      if (!blockBudget.ok) return blockBudget;
      children.push(parsedFormattedParagraph.node);
      index = parsedFormattedParagraph.nextIndex;
      continue;
    }

    const semanticBlock = isV2Document(context) ? semanticBlockOpener(line) : null;
    if (semanticBlock !== null) {
      if (!semanticBlock.ok) return failAt(semanticBlock.errorCode, context.lineOffset + index, 0);
      const parsedSemanticBlock = parseFormattedParagraphBlock(
        lines,
        index,
        options,
        context,
        semanticBlock.config
      );
      if (!parsedSemanticBlock.ok) return withLine(parsedSemanticBlock, context.lineOffset + index);
      const blockBudget = recordBlock(options, context, index);
      if (!blockBudget.ok) return blockBudget;
      children.push(parsedSemanticBlock.node);
      index = parsedSemanticBlock.nextIndex;
      continue;
    }

    const cardBlock = isV2Document(context) ? cardBlockOpener(line) : null;
    if (cardBlock !== null) {
      if (!cardBlock.ok) return failAt(cardBlock.errorCode, context.lineOffset + index, 0);
      const parsedCardBlock = parseCardBlock(lines, index, options, context, cardBlock);
      if (!parsedCardBlock.ok) return withLine(parsedCardBlock, context.lineOffset + index);
      const blockBudget = recordBlock(options, context, index);
      if (!blockBudget.ok) return blockBudget;
      children.push(parsedCardBlock.node);
      index = parsedCardBlock.nextIndex;
      continue;
    }

    if (isV2Document(context) && (line.startsWith('===') || line.startsWith('***'))) {
      return failAt('unknown_block_type', context.lineOffset + index, 0);
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
        if (!headingText.startsWith('[n] ') || headingText.slice(4).trim().length === 0) {
          return failAt('invalid_heading_auto_number_marker', context.lineOffset + index, match[1].length + 1);
        }
        autoNumber = true;
        headingText = headingText.slice(4);
        markerConsumed = 4;
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

    if (isTableStart(lines, index, context.documentVersion)) {
      const table = parseTable(lines, index, options, context);
      if (!table.ok) return table;
      const blockBudget = recordBlock(options, context, index);
      if (!blockBudget.ok) return blockBudget;
      children.push(table.node);
      index = table.nextIndex;
      continue;
    }

    const orphanTableCaption = tableCaptionLine(line);
    if (orphanTableCaption !== null) {
      return failAt(
        context.documentVersion === 'v2' ? 'invalid_table_caption' : 'block_caption_requires_v2',
        context.lineOffset + index,
        0,
      );
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

function validateLocalAnchors(semanticState) {
  const anchors = new Set();
  for (const anchor of semanticState.anchors) {
    if (anchors.has(anchor.id)) {
      return {
        ok: false,
        errorCode: 'duplicate_anchor',
        diagnostic: { code: 'duplicate_anchor', offset: anchor.offset },
      };
    }
    anchors.add(anchor.id);
  }

  for (const link of semanticState.localLinks) {
    if (!anchors.has(link.target)) {
      return {
        ok: false,
        errorCode: 'unresolved_local_anchor',
        diagnostic: { code: 'unresolved_local_anchor', offset: link.offset },
      };
    }
  }

  return { ok: true };
}

function validateFootnotes(semanticState) {
  const definitions = new Set();
  const events = [...semanticState.footnotes].sort((left, right) => left.offset - right.offset);

  for (const event of events) {
    if (event.type === 'definition') {
      if (definitions.has(event.id)) {
        return {
          ok: false,
          errorCode: 'duplicate_footnote',
          diagnostic: { code: 'duplicate_footnote', offset: event.offset },
        };
      }
      definitions.add(event.id);
      continue;
    }
    if (!definitions.has(event.id)) {
      return {
        ok: false,
        errorCode: 'unresolved_footnote_reference',
        diagnostic: { code: 'unresolved_footnote_reference', offset: event.offset },
      };
    }
  }

  return { ok: true };
}

export function parseAnd(source, options = {}) {
  const scanned = scanDocument(source, options);
  if (!scanned.ok) {
    const lineOffset = scanned.context?.lineOffset ?? scanned.lineOffset ?? 0;
    return publicFailure(finalizeDiagnostic(shiftDiagnosticLines(scanned, lineOffset), scanned.normalized));
  }

  const semanticState = { anchors: [], localLinks: [], footnotes: [] };
  const parsed = parseBlocks(scanned.lines, options, {
    ...scanned.context,
    budgetState: { blockCount: 0, listItemCount: 0 },
    semanticState,
    depth: 0,
  });
  if (!parsed.ok) return publicFailure(finalizeDiagnostic(parsed, scanned.normalized));

  if (scanned.context.documentVersion === 'v2') {
    const anchors = validateLocalAnchors(semanticState);
    if (!anchors.ok) return publicFailure(finalizeDiagnostic(anchors, scanned.normalized));
    const footnotes = validateFootnotes(semanticState);
    if (!footnotes.ok) return publicFailure(finalizeDiagnostic(footnotes, scanned.normalized));
  }

  const document = {
    type: 'document',
    children: parsed.children,
  };

  return {
    ok: true,
    version: scanned.context.documentVersion,
    document: withSpan(
      document,
      scanned.context,
      0,
      scanned.normalized.endsWith('\n') ? scanned.normalized.length - 1 : scanned.normalized.length
    ),
  };
}
