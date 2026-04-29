function normalizeRawText(text) {
  return text.replaceAll('\r\n', '\n');
}

function fail(errorCode, detail) {
  const error = new Error(detail ?? errorCode);
  error.code = errorCode;
  return error;
}

function escapeText(value, context = {}) {
  const normalizedValue = value.replaceAll('\r\n', '\n').replaceAll('\n', ' ');
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

function emitInlineNode(node, context) {
  switch (node.type) {
    case 'text':
      return escapeText(node.value, context);
    case 'nbsp':
      return '[_]';
    case 'strong':
      return `[* ${emitInlineNodes(node.children, context)}]`;
    case 'emphasis':
      return `[/ ${emitInlineNodes(node.children, context)}]`;
    case 'link':
      return `[@ ${escapeLinkTarget(node.href)} | ${emitInlineNodes(node.children, context)}]`;
    case 'code':
      return `[$ ${escapeInlineCode(node.text)}]`;
    case 'line_break':
      return '[<]';
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

function emitTableRow(cells) {
  return `| ${cells.map((cell) => emitInlineNodes(cell.children, { tableCell: true })).join(' | ')} |`;
}

function emitList(node) {
  return node.items
    .map((item, index) => {
      const marker = node.ordered ? `${index + 1}.` : '-';
      const [firstChild, ...nestedChildren] = item.children;
      if (!firstChild || firstChild.type !== 'paragraph') {
        throw fail('unsupported_list_item_shape', 'Canonical list items currently require a paragraph head.');
      }

      const head = `${marker} ${emitInlineNodes(firstChild.children)}`;
      if (nestedChildren.length === 0) return head;

      const nested = emitBlocks(nestedChildren);
      return `${head}\n\n${indentLines(nested, '  ')}`;
    })
    .join('\n');
}

function emitBlockquote(node) {
  const inner = emitBlocks(node.children);
  return inner
    .split('\n')
    .map((line) => (line === '' ? '>' : `> ${line}`))
    .join('\n');
}

function emitBlock(node) {
  switch (node.type) {
    case 'paragraph':
      return emitInlineNodes(node.children);
    case 'heading':
      return `${'#'.repeat(node.level)} ${emitInlineNodes(node.children)}`;
    case 'horizontal_rule':
      return '---';
    case 'list':
      return emitList(node);
    case 'blockquote':
      return emitBlockquote(node);
    case 'code_block': {
      const language = node.language ? node.language.toLowerCase() : '';
      const fence = node.ordered ? '````' : '```';
      const payload = emitRawBlockFencePayload(node.text, fence, 'unsupported_code_fence_payload');
      return `${fence}${language}\n${payload}\n${fence}`;
    }
    case 'extension_block': {
      const payload = emitExtensionPayload(node.text);
      if (node.fallback) {
        return `+++${node.name}\n${payload}\n+++\n+++fallback\n${emitBlocks(node.fallback.children)}\n+++`;
      }
      return `+++${node.name}\n${payload}\n+++`;
    }
    case 'table':
      return [
        emitTableRow(node.header),
        emitTableRow(node.header.map(() => ({ children: [{ type: 'text', value: '---' }] }))),
        ...node.rows.map((row) => emitTableRow(row)),
      ].join('\n');
    default:
      throw fail('unsupported_block_node', `Unsupported block node type: ${node.type}`);
  }
}

function emitBlocks(children) {
  return children.map((child) => emitBlock(child)).join('\n\n');
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

export function emitCanonical(document, options = {}) {
  if (document.type !== 'document') {
    throw fail('invalid_document', 'Canonical emission requires a document node.');
  }

  const profile = resolveProfile(options);
  const body = emitBlocks(document.children);
  const prefix = profile === 'standalone' ? '&ND v1\n\n' : '';
  return `${prefix}${body}\n`;
}
