import { emitAeonInlineTypedValue } from '../shared/aeon-inline-scalar.mjs';

function normalizeRawText(text) {
  return text.replaceAll('\r\n', '\n');
}

function fail(errorCode, detail) {
  const error = new Error(detail ?? errorCode);
  error.code = errorCode;
  return error;
}

const LOCAL_ANCHOR_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]*$/;

function requireLocalAnchorId(value, errorCode, nodeType) {
  if (typeof value !== 'string' || !LOCAL_ANCHOR_ID_PATTERN.test(value)) {
    throw fail(errorCode, `${nodeType} requires a portable local anchor identifier.`);
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
      const id = requireLocalAnchorId(value.id, 'invalid_anchor_tag', 'anchor_tag');
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
      localTargets.push(requireLocalAnchorId(value.href.slice(1), 'invalid_local_anchor_target', 'link'));
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
      return `[# ${requireLocalAnchorId(node.id, 'invalid_anchor_tag', node.type)}]`;
    case 'admonition_tag':
      requireV2(context, node.type);
      return `[! ${emitInlineNodes(node.children, context)}]`;
    case 'question_tag':
      requireV2(context, node.type);
      return `[? ${emitInlineNodes(node.children, context)}]`;
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
    case 'todo_marker': {
      requireV2(context, node.type);
      const markers = { unchecked: '[ ]', checked: '[x]', in_progress: '[,]', cancelled: '[;]' };
      if (!markers[node.state]) throw fail('invalid_todo_marker_state', `Unsupported todo state: ${node.state}`);
      return markers[node.state];
    }
    case 'directional_marker': {
      requireV2(context, node.type);
      const markers = { forward: '[>]', backward: '[<]' };
      if (!markers[node.direction]) {
        throw fail('invalid_directional_marker_direction', `Unsupported direction: ${node.direction}`);
      }
      return markers[node.direction];
    }
    case 'auto_number_marker':
      requireV2(context, node.type);
      return '[%]';
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

function emitRawBlockFencePayload(text, fence, errorCode) {
  const normalized = normalizeRawText(text);
  if (normalized.split('\n').some((line) => line === fence)) {
    throw fail(errorCode, `Raw payload contains an unescaped closing fence line: ${fence}`);
  }
  return normalized;
}

function emitExtensionPayload(text) {
  const normalized = normalizeRawText(text);
  if (normalized.split('\n').some((line) => line === '+++')) {
    throw fail(
      'unsupported_extension_fence_payload',
      'Extension payload contains an unescaped extension closing fence line.'
    );
  }
  return normalized;
}

function emitTableRow(cells, context) {
  return `| ${cells.map((cell) => emitInlineNodes(cell.children, { ...context, tableCell: true })).join(' | ')} |`;
}

function emitList(node, context) {
  return node.items
    .map((item, index) => {
      const marker = node.ordered ? `${index + 1}.` : '-';
      const [firstChild, ...nestedChildren] = item.children;
      if (!firstChild || firstChild.type !== 'paragraph') {
        throw fail('unsupported_list_item_shape', 'Canonical list items currently require a paragraph head.');
      }

      const head = `${marker} ${emitInlineNodes(firstChild.children, context)}`;
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

function emitPairedInlineBlock(opener, closer, children, context) {
  const payload = emitInlineNodes(children, { ...context, preserveNewlines: true });
  if (payload.split('\n').some((line) => line === closer)) {
    throw fail('unsupported_v2_fence_payload', `Paired-block payload contains a closing fence line: ${closer}`);
  }
  return `${opener}\n${payload}\n${closer}`;
}

function emitV2BlockTag(tag) {
  if (tag === undefined) return '';
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(tag)) {
    throw fail('invalid_v2_block_tag', `Invalid v2 paired-block tag: ${tag}`);
  }
  return tag;
}

function emitBlock(node, context) {
  switch (node.type) {
    case 'paragraph':
      return emitInlineNodes(node.children, context);
    case 'heading':
      if (node.autoNumber) requireV2(context, 'heading.autoNumber');
      return `${'#'.repeat(node.level)} ${node.autoNumber ? '[n] ' : ''}${emitInlineNodes(node.children, context)}`;
    case 'horizontal_rule':
      return '---';
    case 'list':
      return emitList(node, context);
    case 'blockquote':
      return emitBlockquote(node, context);
    case 'code_block': {
      const language = node.language ? node.language.toLowerCase() : '';
      const fence = node.ordered ? '````' : '```';
      const payload = emitRawBlockFencePayload(node.text, fence, 'unsupported_code_fence_payload');
      return `${fence}${language}\n${payload}\n${fence}`;
    }
    case 'extension_block': {
      const payload = emitExtensionPayload(node.text);
      if (node.fallback) {
        return `+++${node.name}\n${payload}\n+++\n+++fallback\n${emitBlocks(node.fallback.children, context)}\n+++`;
      }
      return `+++${node.name}\n${payload}\n+++`;
    }
    case 'table':
      return [
        emitTableRow(node.header, context),
        emitTableRow(node.header.map(() => ({ children: [{ type: 'text', value: '---' }] })), context),
        ...node.rows.map((row) => emitTableRow(row, context)),
      ].join('\n');
    case 'highlight_paragraph_block':
      requireV2(context, node.type);
      return emitPairedInlineBlock('~~~=', '~~~=', node.children, context);
    case 'header_text_block': {
      requireV2(context, node.type);
      const tag = emitV2BlockTag(node.tag);
      return emitPairedInlineBlock(`===${tag}`, '===', node.children, context);
    }
    case 'disclaimer_block': {
      requireV2(context, node.type);
      const tag = emitV2BlockTag(node.tag);
      return emitPairedInlineBlock(`***${tag}`, '***', node.children, context);
    }
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
  if (version === 'v2') validateLocalAnchorGraph(document);
  const body = emitBlocks(document.children, { version });
  const prefix = profile === 'standalone' ? `&ND ${version}\n\n` : '';
  return `${prefix}${body}\n`;
}
