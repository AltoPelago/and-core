function fail(errorCode, detail) {
  const error = new Error(detail ?? errorCode);
  error.code = errorCode;
  return error;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#96;');
}

function normalizeText(value) {
  return String(value).replaceAll('\r\n', '\n');
}

function isSafeHref(href) {
  if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../') || href.startsWith('#')) {
    return true;
  }

  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
}

function renderInlineNodes(nodes, options) {
  return nodes.map((node) => renderInlineNode(node, options)).join('');
}

function renderInlineNode(node, options) {
  switch (node.type) {
    case 'text':
      return escapeHtml(normalizeText(node.value));
    case 'nbsp':
      return '&nbsp;';
    case 'strong':
      return `<strong>${renderInlineNodes(node.children, options)}</strong>`;
    case 'emphasis':
      return `<em>${renderInlineNodes(node.children, options)}</em>`;
    case 'code':
      return `<code>${escapeHtml(normalizeText(node.text))}</code>`;
    case 'line_break':
      return '<br>';
    case 'link': {
      const label = renderInlineNodes(node.children, options);
      if (!isSafeHref(node.href)) {
        return `<a aria-disabled="true" title="Unsafe link target omitted">${label}</a>`;
      }
      return `<a href="${escapeAttribute(node.href)}">${label}</a>`;
    }
    default:
      throw fail('unsupported_inline_node', `Unsupported inline node type: ${node.type}`);
  }
}

function renderBlocks(blocks, options) {
  return blocks.map((block) => renderBlock(block, options)).join('\n');
}

function renderBlock(block, options) {
  switch (block.type) {
    case 'paragraph':
      return `<p>${renderInlineNodes(block.children, options)}</p>`;
    case 'heading': {
      const level = Math.min(Math.max(Number(block.level), 1), 6);
      return `<h${level}>${renderInlineNodes(block.children, options)}</h${level}>`;
    }
    case 'horizontal_rule':
      return '<hr>';
    case 'blockquote':
      return `<blockquote>\n${renderBlocks(block.children, options)}\n</blockquote>`;
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = block.items.map((item) => `<li>${renderBlocks(item.children, options)}</li>`).join('\n');
      return `<${tag}>\n${items}\n</${tag}>`;
    }
    case 'code_block': {
      return renderCodeBlock(block);
    }
    case 'extension_block': {
      if (block.fallback) {
        return renderBlocks(block.fallback.children, options);
      }
      return renderUnsupportedExtensionDiagnostic(block);
    }
    case 'table':
      return renderTable(block, options);
    default:
      throw fail('unsupported_block_node', `Unsupported block node type: ${block.type}`);
  }
}

function renderCodeBlock(block) {
  const language = block.language ? block.language.toLowerCase() : null;
  const className = language ? ` class="language-${escapeAttribute(language)}"` : '';
  const orderedAttribute = block.ordered ? ' data-ordered="true"' : '';
  const figureClass = block.ordered ? 'and-code-block and-code-block-ordered' : 'and-code-block';
  const body = block.ordered
    ? renderOrderedCodeLines(block.text)
    : `<pre><code${className}>${escapeHtml(normalizeText(block.text))}</code></pre>`;
  return [
    `<figure class="${figureClass}"${language ? ` data-language="${escapeAttribute(language)}"` : ''}${orderedAttribute}>`,
    language ? `<figcaption>${escapeHtml(language)}</figcaption>` : '',
    body,
    '</figure>',
  ].join('\n');
}

function renderOrderedCodeLines(text) {
  const lines = normalizeText(text).split('\n');
  const items = lines.map((line) => `<li><code>${line === '' ? '&nbsp;' : escapeHtml(line)}</code></li>`).join('\n');
  return `<ol class="and-code-lines">\n${items}\n</ol>`;
}

function renderUnsupportedExtensionDiagnostic(block) {
  const payload = normalizeText(block.text);
  return [
    `<aside class="and-diagnostic and-diagnostic-extension" data-and-extension="${escapeAttribute(block.name)}" aria-label="Unsupported extension">`,
    `Unsupported extension: <code>${escapeHtml(block.name)}</code>.`,
    payload === ''
      ? '<p>No fallback content was provided for this extension block.</p>'
      : `<details><summary>Open payload</summary>\n\n<pre><code>${escapeHtml(payload)}</code></pre>\n</details>`,
    '</aside><br>',
  ].join('\n');
}

function renderTable(block, options) {
  const header = block.header
    .map((cell) => `<th>${renderInlineNodes(cell.children, options)}</th>`)
    .join('');
  const rows = block.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInlineNodes(cell.children, options)}</td>`).join('')}</tr>`)
    .join('\n');

  return [
    '<table>',
    '<thead>',
    `<tr>${header}</tr>`,
    '</thead>',
    '<tbody>',
    rows,
    '</tbody>',
    '</table>',
  ].join('\n');
}

function renderFullDocument(body) {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>&amp;ND Document</title>',
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

export function renderHtml(document, options = {}) {
  if (document.type !== 'document') {
    throw fail('invalid_document', 'HTML rendering requires a document node.');
  }

  const body = renderBlocks(document.children, options);
  return options.fragment === false ? renderFullDocument(body) : body;
}
