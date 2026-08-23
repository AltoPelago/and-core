import { emitAeonInlineTypedValue } from '../shared/aeon-inline-scalar.mjs';
import { isNdV2Identifier } from '../shared/v2-identifier.mjs';

function normalizeRawText(text) {
  return text.replaceAll('\r\n', '\n');
}

function fail(errorCode, detail) {
  const error = new Error(detail ?? errorCode);
  error.code = errorCode;
  return error;
}

function requireV2Identifier(value, errorCode, nodeType) {
  if (!isNdV2Identifier(value)) {
    throw fail(errorCode, `${nodeType} requires a valid v2 identifier.`);
  }
  return value;
}

function validateLocalAnchorGraph(document) {
  const anchors = new Set();
  const localTargets = [];

  function visit(value) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;

    if (value.type === 'anchor_tag') {
      const id = requireV2Identifier(value.id, 'invalid_anchor_tag', 'anchor_tag');
      if (anchors.has(id)) {
        throw fail('duplicate_anchor', `Duplicate local anchor: ${id}`);
      }
      anchors.add(id);
    } else if (
      value.type === 'link'
      && typeof value.href === 'string'
      && value.href.startsWith('#')
      && value.href.length > 1
    ) {
      localTargets.push(requireV2Identifier(value.href.slice(1), 'invalid_local_anchor_target', 'link'));
    }

    for (const [key, child] of Object.entries(value)) {
      if (key !== 'span') visit(child);
    }
  }

  visit(document);
  for (const target of localTargets) {
    if (!anchors.has(target)) {
      throw fail('unresolved_local_anchor', `Unresolved local anchor: ${target}`);
    }
  }
}

function requireFootnoteId(value, nodeType) {
  return requireV2Identifier(value, 'invalid_footnote_id', nodeType);
}

function hasInlineAstContent(nodes) {
  return Array.isArray(nodes) && nodes.some((node) => {
    if (node?.type === 'text') return typeof node.value === 'string' && node.value.trim().length > 0;
    if (Array.isArray(node?.children)) return hasInlineAstContent(node.children);
    return Boolean(node && typeof node === 'object');
  });
}

function validateFootnoteGraph(document) {
  const definitions = new Set();

  function visit(value, insideFootnote = false) {
    if (Array.isArray(value)) {
      value.forEach((child) => visit(child, insideFootnote));
      return;
    }
    if (!value || typeof value !== 'object') return;

    if (value.type === 'footnote_definition') {
      if (insideFootnote) throw fail('nested_footnote', 'Footnote content cannot contain another footnote.');
      if (!hasInlineAstContent(value.children)) {
        throw fail('invalid_footnote', 'footnote_definition requires non-empty inline content.');
      }
      if (value.id !== undefined) {
        const id = requireFootnoteId(value.id, value.type);
        if (definitions.has(id)) throw fail('duplicate_footnote', `Duplicate footnote definition: ${id}`);
        definitions.add(id);
      }
      visit(value.children, true);
      return;
    }

    if (value.type === 'footnote_reference') {
      if (insideFootnote) throw fail('nested_footnote', 'Footnote content cannot contain another footnote.');
      const id = requireFootnoteId(value.id, value.type);
      if (!definitions.has(id)) {
        throw fail('unresolved_footnote_reference', `Unresolved footnote reference: ${id}`);
      }
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      if (key !== 'span') visit(child, insideFootnote);
    }
  }

  visit(document);
}

function escapeText(value, context = {}) {
  const normalizedValue = context.preserveNewlines
    ? value.replaceAll('\r\n', '\n')
    : value.replaceAll('\r\n', '\n').replaceAll('\n', ' ');
  let output = '';
  for (const char of normalizedValue) {
    if (char === '[' || char === ']' || char === '\\' || (context.tableCell && char === '|')) {
      output += `\\${char}`;
    } else {
      output += char;
    }
  }
  return output;
}

function requiresV2StructuralEscape(text, context) {
  if (context.version !== 'v2') return false;
  if (/^`{3,4}/.test(text)) return true;
  if (/^~{3,4}[A-Za-z][A-Za-z0-9_-]*$/.test(text)) return true;
  if (/^~~~\$(?: \[n\](?: [A-Za-z][A-Za-z0-9_-]*)?| [A-Za-z][A-Za-z0-9_-]*)?$/.test(text)) return true;
  if (['~~~=', '~~~*', '~~~/', '~~~_', '~~~?', '~~~!', "~~~'", '~~~#', '~~~^'].includes(text)) return true;
  if (text.startsWith('~~~|')) return true;
  const semanticMatch = text.match(/^~~~\(([^)]*)\)$/);
  if (semanticMatch && isNdV2Identifier(semanticMatch[1])) return true;
  if (text.startsWith('===') || text.startsWith('***') || text.startsWith('+++')) return true;
  if (/^#{1,6} /.test(text)) return true;
  if (text === '---') return true;
  if (/^- /.test(text) || /^\d+\. /.test(text)) return true;
  return text.startsWith('>');
}

function looksLikeTableParagraph(text) {
  const lines = text.split('\n');
  if (lines.length < 2 || !/^\s*\|.*\|\s*$/.test(lines[0])) return false;
  return /^\s*\|(?:\s*(?:---|<--|-=-|-->)\s*\|)+\s*$/.test(lines[1]);
}

function emitParagraph(node, context) {
  const preserved = emitInlineNodes(node.children, { ...context, preserveNewlines: true });
  if (context.version === 'v2' && looksLikeTableParagraph(preserved)) {
    return `\\${preserved}`;
  }
  const text = emitInlineNodes(node.children, context);
  return requiresV2StructuralEscape(text, context) ? `\\${text}` : text;
}

function escapeInlineCode(value) {
  if (value.includes('\n')) {
    throw fail('invalid_inline_code_text', 'Inline code cannot contain a line break.');
  }
  return value.replace(/[\\[\]|]/g, (char) => `\\${char}`);
}

function escapeLinkTarget(value) {
  if (value.includes('\n')) {
    throw fail('invalid_link_target', 'Link targets cannot contain a line break.');
  }
  return value.replace(/[\\|]/g, (char) => `\\${char}`);
}

function emitInlineNodes(nodes, context = {}) {
  return nodes.map((node) => emitInlineNode(node, context)).join('');
}

function requireV2(context, nodeType) {
  if (context.version !== 'v2') {
    throw fail('v2_node_in_v1_document', `${nodeType} requires canonical version v2.`);
  }
}

function emitBlockCaption(node, context) {
  if (node.caption === undefined) return '';
  requireV2(context, `${node.type}.caption`);
  if (!hasInlineAstContent(node.caption)) {
    throw fail('invalid_block_caption', `${node.type} caption must not be empty.`);
  }
  const preserved = emitInlineNodes(node.caption, { ...context, preserveNewlines: true });
  if (preserved.includes('\n') || preserved.includes('\r')) {
    throw fail('invalid_block_caption', `${node.type} caption must occupy one physical line.`);
  }
  return ` (${emitInlineNodes(node.caption, context)})`;
}

function emitV2Value(value, context = {}) {
  return escapeText(String(value), context);
}

function emitImageField(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.includes('\n') || value.includes('\r')) {
    throw fail('invalid_image_tag', `image_tag requires a non-empty single-line ${fieldName}.`);
  }
  return value.trim().replace(/[\\[\]|]/g, (char) => `\\${char}`);
}

function emitImageMode(value) {
  if (!['inline', 'half', 'full'].includes(value)) {
    throw fail('invalid_image_tag', `Unsupported image display mode: ${value}`);
  }
  return value;
}

function emitInlineNode(node, context) {
  switch (node.type) {
    case 'text':
      return escapeText(node.value, context);
    case 'strong':
      return `[* ${emitInlineNodes(node.children, context)}]`;
    case 'emphasis':
      return `[/ ${emitInlineNodes(node.children, context)}]`;
    case 'link':
      return `[@ ${escapeLinkTarget(node.href)} | ${emitInlineNodes(node.children, context)}]`;
    case 'code':
      return `[$ ${escapeInlineCode(node.text)}]`;
    case 'anchor_tag':
      requireV2(context, node.type);
      return `[# ${requireV2Identifier(node.id, 'invalid_anchor_tag', node.type)}]`;
    case 'admonition_tag':
      requireV2(context, node.type);
      return `[! ${emitInlineNodes(node.children, context)}]`;
    case 'question_tag':
      requireV2(context, node.type);
      return `[? ${emitInlineNodes(node.children, context)}]`;
    case 'footnote_definition': {
      requireV2(context, node.type);
      const id = node.id === undefined ? '' : `(${requireFootnoteId(node.id, node.type)}) `;
      return `[% ${id}${emitInlineNodes(node.children, context)}]`;
    }
    case 'footnote_reference':
      requireV2(context, node.type);
      return `[% (${requireFootnoteId(node.id, node.type)})]`;
    case 'plus_tag':
      requireV2(context, node.type);
      return `[+ ${emitV2Value(node.value, context)}]`;
    case 'image_tag':
      requireV2(context, node.type);
      return `[~ ${emitImageField(node.src, 'source')} | ${emitImageField(node.alt, 'alt text')} | ${emitImageMode(node.mode)}]`;
    case 'strike_tag':
      requireV2(context, node.type);
      return `[- ${emitInlineNodes(node.children, context)}]`;
    case 'quoted_tag':
      requireV2(context, node.type);
      return `[" ${emitInlineNodes(node.children, context)}]`;
    case 'comment_tag':
      requireV2(context, node.type);
      return `[' ${emitInlineNodes(node.children, context)}]`;
    case 'disclaimer_tag':
      requireV2(context, node.type);
      return `[^ ${emitInlineNodes(node.children, context)}]`;
    case 'semantic_tag':
      requireV2(context, node.type);
      return `[(${requireV2Identifier(node.id, 'invalid_semantic_id', node.type)}) ${emitInlineNodes(node.children, context)}]`;
    case 'typed_value':
      requireV2(context, node.type);
      try {
        return `[:${emitAeonInlineTypedValue(node.datatype, node.value)}]`;
      } catch {
        throw fail('invalid_typed_value', 'typed_value requires a supported AEON scalar and compatible datatype.');
      }
    case 'highlight_tag':
      requireV2(context, node.type);
      return `[= ${emitInlineNodes(node.children, context)}]`;
    case 'underline_tag':
      requireV2(context, node.type);
      return `[_ ${emitInlineNodes(node.children, context)}]`;
    case 'directional_marker': {
      requireV2(context, node.type);
      const markers = { forward: '[>]', backward: '[<]' };
      if (!markers[node.direction]) {
        throw fail('invalid_directional_marker_direction', `Unsupported direction: ${node.direction}`);
      }
      return markers[node.direction];
    }
    case 'advisory_marker':
      throw fail('invalid_advisory_marker_context', 'advisory_marker is valid only as the leading marker of an unordered list item.');
    case 'line_break':
      requireV2(context, node.type);
      return '[.]';
    default:
      throw fail('unsupported_inline_node', `Unsupported inline node type: ${node.type}`);
  }
}

function indentLines(text, prefix) {
  return text
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

function isClosingFenceLine(line, fence, captionClosers) {
  return line === fence
    || (captionClosers && line.startsWith(`${fence} (`) && line.endsWith(')'));
}

function emitRawBlockFencePayload(text, fence, errorCode, captionClosers = false) {
  const normalized = normalizeRawText(text);
  if (normalized.split('\n').some((line) => isClosingFenceLine(line, fence, captionClosers))) {
    throw fail(errorCode, `Raw payload contains an unescaped closing fence line: ${fence}`);
  }
  return normalized;
}

function emitExtensionPayload(text, captionClosers = false) {
  const normalized = normalizeRawText(text);
  if (normalized.split('\n').some((line) => isClosingFenceLine(line, '+++', captionClosers))) {
    throw fail(
      'unsupported_extension_fence_payload',
      'Extension payload contains an unescaped extension closing fence line.'
    );
  }
  return normalized;
}

const TABLE_SEPARATOR_BY_ALIGNMENT = Object.freeze({
  left: '<--',
  center: '-=-',
  right: '-->',
});

function tableCellColSpan(cell, context) {
  if (cell.colSpan === undefined) return 1;
  if (context.version !== 'v2') requireV2(context, 'table cell colSpan');
  if (!Number.isInteger(cell.colSpan) || cell.colSpan < 2) {
    throw fail('invalid_table_span', 'table cell colSpan must be an integer greater than one.');
  }
  return cell.colSpan;
}

function tableRowLogicalWidth(cells, context) {
  if (!Array.isArray(cells) || cells.length === 0) {
    throw fail('invalid_table_shape', 'table rows must contain at least one cell.');
  }
  return cells.reduce((width, cell) => width + tableCellColSpan(cell, context), 0);
}

function tableAlignments(table, logicalWidth, context) {
  if (table.alignments === undefined) return Array(logicalWidth).fill(null);
  if (context.version !== 'v2') requireV2(context, 'table alignments');
  if (!Array.isArray(table.alignments) || table.alignments.length !== logicalWidth) {
    throw fail('invalid_table_alignment', 'table alignments must match the logical column count.');
  }
  const alignments = table.alignments.map((alignment) => {
    if (alignment === null || Object.hasOwn(TABLE_SEPARATOR_BY_ALIGNMENT, alignment)) return alignment;
    throw fail('invalid_table_alignment', `Unsupported table alignment: ${alignment}`);
  });
  if (alignments.every((alignment) => alignment === null)) {
    throw fail('invalid_table_alignment', 'all-default table alignments must be omitted from the AST.');
  }
  return alignments;
}

function emitTableRow(cells, context) {
  const rendered = cells.map((cell) => {
    const colSpan = tableCellColSpan(cell, context);
    const content = emitInlineNodes(cell.children, { ...context, tableCell: true });
    if (colSpan > 1 && content.trim().length === 0) {
      throw fail('invalid_table_span', 'spanning table cells require non-empty content.');
    }
    return colSpan > 1 ? `${'>'.repeat(colSpan - 1)} ${content}` : ` ${content}`;
  });
  return `|${rendered.join(' |')} |`;
}

function emitTableSeparator(alignments) {
  const cells = alignments.map((alignment) => alignment === null ? '---' : TABLE_SEPARATOR_BY_ALIGNMENT[alignment]);
  return `| ${cells.join(' | ')} |`;
}

function emitList(node, context) {
  return node.items
    .map((item, index) => {
      const marker = node.ordered ? `${index + 1}.` : '-';
      const [firstChild, ...nestedChildren] = item.children;
      if (!firstChild || firstChild.type !== 'paragraph') {
        throw fail('unsupported_list_item_shape', 'Canonical list items currently require a paragraph head.');
      }

      const leadingAdvisory = firstChild.children?.[0]?.type === 'advisory_marker'
        ? firstChild.children[0]
        : null;
      if (leadingAdvisory && node.ordered) {
        throw fail('advisory_list_requires_unordered_marker', 'Advisory list markers require an unordered list.');
      }
      const advisoryTokens = { question: '[?]', admonition: '[!]' };
      const advisoryToken = leadingAdvisory ? advisoryTokens[leadingAdvisory.kind] : null;
      if (leadingAdvisory && !advisoryToken) {
        throw fail('invalid_advisory_marker_kind', `Unsupported advisory marker kind: ${leadingAdvisory.kind}`);
      }
      const inlineChildren = leadingAdvisory ? firstChild.children.slice(1) : firstChild.children;
      const head = `${marker} ${advisoryToken ?? ''}${emitInlineNodes(inlineChildren, context)}`;
      if (nestedChildren.length === 0) return head;

      const nested = emitBlocks(nestedChildren, context);
      return `${head}\n\n${indentLines(nested, '  ')}`;
    })
    .join('\n');
}

function emitTodoList(node, context) {
  requireV2(context, node.type);
  const markers = { unchecked: '[ ]', checked: '[x]', in_progress: '[,]', cancelled: '[;]' };
  return node.items
    .map((item) => {
      if (item.type !== 'todo_item') {
        throw fail('invalid_todo_list_item', 'todo_list items must have type todo_item.');
      }
      const marker = markers[item.state];
      if (!marker) throw fail('invalid_todo_item_state', `Unsupported todo state: ${item.state}`);
      const [firstChild, ...nestedChildren] = item.children;
      if (!firstChild || firstChild.type !== 'paragraph') {
        throw fail('unsupported_todo_item_shape', 'Canonical todo items require a paragraph head.');
      }

      const head = `- ${marker} ${emitInlineNodes(firstChild.children, context)}`;
      if (nestedChildren.length === 0) return head;

      const nested = emitBlocks(nestedChildren, context);
      return `${head}\n\n${indentLines(nested, '  ')}`;
    })
    .join('\n');
}

function emitAutoNumberList(node, context) {
  requireV2(context, node.type);
  return node.items
    .map((item) => {
      if (item.type !== 'list_item') {
        throw fail('invalid_auto_number_list_item', 'auto_number_list items must have type list_item.');
      }
      const [firstChild, ...nestedChildren] = item.children;
      if (!firstChild || firstChild.type !== 'paragraph') {
        throw fail('unsupported_auto_number_item_shape', 'Canonical auto-number items require a paragraph head.');
      }

      const head = `- [n] ${emitInlineNodes(firstChild.children, context)}`;
      if (nestedChildren.length === 0) return head;

      const nested = emitBlocks(nestedChildren, context);
      return `${head}\n\n${indentLines(nested, '  ')}`;
    })
    .join('\n');
}

function emitBlockquote(node, context) {
  const inner = emitBlocks(node.children, context);
  return inner
    .split('\n')
    .map((line) => (line === '' ? '>' : `> ${line}`))
    .join('\n');
}

function emitPairedInlineBlock(opener, closer, node, context) {
  const payload = emitInlineNodes(node.children, { ...context, preserveNewlines: true });
  if (payload.split('\n').some((line) => isClosingFenceLine(line, closer, true))) {
    throw fail('unsupported_v2_fence_payload', `Paired-block payload contains a closing fence line: ${closer}`);
  }
  return `${opener}\n${payload}\n${closer}${emitBlockCaption(node, context)}`;
}

function emitCardBlock(node, context) {
  requireV2(context, node.type);
  if (!Array.isArray(node.children) || node.children.length === 0) {
    throw fail('invalid_card_block', 'card_block requires at least one child block.');
  }
  if (node.title !== undefined && !hasInlineAstContent(node.title)) {
    throw fail('invalid_card_block', 'card_block title must not be empty.');
  }
  const title = node.title === undefined
    ? ''
    : ` ${emitInlineNodes(node.title, context)}`;
  const payload = emitBlocks(node.children, context);
  if (payload.split('\n').some((line) => isClosingFenceLine(line, '~~~|', true))) {
    throw fail('unsupported_v2_fence_payload', 'Card payload contains a closing fence line: ~~~|');
  }
  return `~~~|${title}\n${payload}\n~~~|${emitBlockCaption(node, context)}`;
}

function emitBlock(node, context) {
  switch (node.type) {
    case 'paragraph':
      return emitParagraph(node, context);
    case 'heading':
      if (node.autoNumber) requireV2(context, 'heading.autoNumber');
      return `${'#'.repeat(node.level)} ${node.autoNumber ? '[n] ' : ''}${emitInlineNodes(node.children, context)}`;
    case 'horizontal_rule':
      return '---';
    case 'list':
      return emitList(node, context);
    case 'todo_list':
      return emitTodoList(node, context);
    case 'auto_number_list':
      return emitAutoNumberList(node, context);
    case 'blockquote':
      return emitBlockquote(node, context);
    case 'code_block': {
      const language = node.language ? node.language.toLowerCase() : '';
      const payloadLines = normalizeRawText(node.text).split('\n');
      const caption = emitBlockCaption(node, context);
      if (context.version === 'v2') {
        if (!payloadLines.some((line) => isClosingFenceLine(line, '~~~$', true))) {
          const fence = '~~~$';
          const opener = `${fence}${node.ordered ? ' [n]' : ''}${language ? ` ${language}` : ''}`;
          const payload = emitRawBlockFencePayload(node.text, fence, 'unsupported_code_fence_payload', true);
          return `${opener}\n${payload}\n${fence}${caption}`;
        }
        const fallbackFence = node.ordered ? '````' : '```';
        const fallbackPayload = emitRawBlockFencePayload(node.text, fallbackFence, 'unsupported_code_fence_payload', true);
        return `${fallbackFence}${language}\n${fallbackPayload}\n${fallbackFence}${caption}`;
      }
      const fence = node.ordered ? '````' : payloadLines.includes('```') ? '~~~$' : '```';
      const payload = emitRawBlockFencePayload(node.text, fence, 'unsupported_code_fence_payload');
      const opener = fence === '~~~$' && language ? `${fence} ${language}` : `${fence}${language}`;
      return `${opener}\n${payload}\n${fence}${caption}`;
    }
    case 'extension_block': {
      const caption = emitBlockCaption(node, context);
      const payload = emitExtensionPayload(node.text, context.version === 'v2');
      if (node.fallback) {
        return `+++${node.name}\n${payload}\n+++${caption}\n+++fallback\n${emitBlocks(node.fallback.children, context)}\n+++`;
      }
      return `+++${node.name}\n${payload}\n+++${caption}`;
    }
    case 'table': {
      const logicalWidth = tableRowLogicalWidth(node.header, context);
      for (const row of node.rows) {
        if (tableRowLogicalWidth(row, context) !== logicalWidth) {
          throw fail('invalid_table_span', 'every table row must match the logical column count.');
        }
      }
      const alignments = tableAlignments(node, logicalWidth, context);
      return [
        emitTableRow(node.header, context),
        emitTableSeparator(alignments),
        ...node.rows.map((row) => emitTableRow(row, context)),
      ].join('\n');
    }
    case 'highlight_paragraph_block':
      requireV2(context, node.type);
      return emitPairedInlineBlock('~~~=', '~~~=', node, context);
    case 'strong_paragraph_block':
      requireV2(context, node.type);
      return emitPairedInlineBlock('~~~*', '~~~*', node, context);
    case 'emphasis_paragraph_block':
      requireV2(context, node.type);
      return emitPairedInlineBlock('~~~/', '~~~/', node, context);
    case 'underline_paragraph_block':
      requireV2(context, node.type);
      return emitPairedInlineBlock('~~~_', '~~~_', node, context);
    case 'question_paragraph_block':
      requireV2(context, node.type);
      return emitPairedInlineBlock('~~~?', '~~~?', node, context);
    case 'admonition_paragraph_block':
      requireV2(context, node.type);
      return emitPairedInlineBlock('~~~!', '~~~!', node, context);
    case 'comment_block':
      requireV2(context, node.type);
      return emitPairedInlineBlock("~~~'", "~~~'", node, context);
    case 'header_text_block': {
      requireV2(context, node.type);
      if (node.tag !== undefined) throw fail('invalid_header_text_block', 'header_text_block no longer accepts a tag.');
      return emitPairedInlineBlock('~~~#', '~~~#', node, context);
    }
    case 'disclaimer_block': {
      requireV2(context, node.type);
      if (node.tag !== undefined) throw fail('invalid_disclaimer_block', 'disclaimer_block no longer accepts a tag.');
      return emitPairedInlineBlock('~~~^', '~~~', node, context);
    }
    case 'semantic_block':
      requireV2(context, node.type);
      return emitPairedInlineBlock(
        `~~~(${requireV2Identifier(node.id, 'invalid_semantic_id', node.type)})`,
        '~~~',
        node,
        context
      );
    case 'card_block':
      return emitCardBlock(node, context);
    default:
      throw fail('unsupported_block_node', `Unsupported block node type: ${node.type}`);
  }
}

function emitBlocks(children, context) {
  return children.map((child) => emitBlock(child, context)).join('\n\n');
}

function resolveProfile(options) {
  if (options.profile === 'embedded' || options.profile === 'standalone') {
    return options.profile;
  }
  throw fail(
    'missing_canonical_profile',
    'Canonical emission requires options.profile to be "embedded" or "standalone".'
  );
}

function resolveVersion(options) {
  const version = options.version ?? 'v1';
  if (version === 'v1' || version === 'v2') return version;
  throw fail('invalid_version_option', 'Canonical version must be "v1" or "v2".');
}

export function emitCanonical(document, options = {}) {
  if (document.type !== 'document') {
    throw fail('invalid_document', 'Canonical emission requires a document node.');
  }

  const profile = resolveProfile(options);
  const version = resolveVersion(options);
  if (version === 'v2') {
    validateLocalAnchorGraph(document);
    validateFootnoteGraph(document);
  }
  const body = emitBlocks(document.children, { version });
  const prefix = profile === 'standalone' ? `&ND ${version}\n\n` : '';
  return `${prefix}${body}\n`;
}
