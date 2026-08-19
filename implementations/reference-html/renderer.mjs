import {
  displayAeonScalar,
  emitAeonScalar,
  formatAeonDatatype,
} from '../shared/aeon-inline-scalar.mjs';

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

function isExternalWebHref(href) {
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseSafeHttpUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:')
      || url.username.length > 0
      || url.password.length > 0
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function isSafeRelativeImageReference(src) {
  try {
    const sentinel = new URL('https://and.invalid/document.and');
    const resolved = new URL(src, sentinel);
    return resolved.origin === sentinel.origin;
  } catch {
    return false;
  }
}

function normalizeRenderOptions(options) {
  if (options.imageBaseUrl === undefined) return { ...options, imageBaseUrl: null };
  if (typeof options.imageBaseUrl !== 'string' || options.imageBaseUrl.trim().length === 0) {
    throw fail('invalid_image_base_url', 'imageBaseUrl must be an absolute HTTP(S) URL.');
  }
  const imageBaseUrl = parseSafeHttpUrl(options.imageBaseUrl);
  if (!imageBaseUrl) {
    throw fail('invalid_image_base_url', 'imageBaseUrl must be an absolute HTTP(S) URL without credentials.');
  }
  return { ...options, imageBaseUrl };
}

function resolveImageSource(src, imageBaseUrl) {
  const absolute = parseSafeHttpUrl(src);
  if (absolute) return { ok: true, src, resolved: false };
  if (!isSafeRelativeImageReference(src)) return { ok: false };
  if (!imageBaseUrl) return { ok: true, src, resolved: false };

  const resolved = new URL(src, imageBaseUrl);
  if (!parseSafeHttpUrl(resolved.href)) return { ok: false };
  return { ok: true, src: resolved.href, resolved: resolved.href !== src };
}

function renderInlineNodes(nodes, options) {
  return nodes.map((node) => renderInlineNode(node, options)).join('');
}

function renderInlineNode(node, options) {
  switch (node.type) {
    case 'text':
      return escapeHtml(normalizeText(node.value));
    case 'strong':
      return `<strong>${renderInlineNodes(node.children, options)}</strong>`;
    case 'emphasis':
      return `<em>${renderInlineNodes(node.children, options)}</em>`;
    case 'code':
      return `<code>${escapeHtml(normalizeText(node.text))}</code>`;
    case 'link': {
      const label = renderInlineNodes(node.children, options);
      if (!isSafeHref(node.href)) {
        return `<a aria-disabled="true" title="Unsafe link target omitted">${label}</a>`;
      }
      const href = escapeAttribute(node.href);
      const externalAttributes = isExternalWebHref(node.href)
        ? ' target="_blank" rel="noopener noreferrer nofollow" referrerpolicy="no-referrer"'
        : '';
      return `<a href="${href}"${externalAttributes}>${label}</a>`;
    }
    case 'anchor_tag':
      return `<span class="and-anchor" id="${escapeAttribute(node.id)}" aria-hidden="true"></span>`;
    case 'admonition_tag':
      return `<span class="and-admonition">${renderInlineNodes(node.children, options)}</span>`;
    case 'question_tag':
      return `<span class="and-question">${renderInlineNodes(node.children, options)}</span>`;
    case 'plus_tag':
      return `<span class="and-consumer-tag" data-value="${escapeAttribute(node.value)}">${escapeHtml(node.value)}</span>`;
    case 'image_tag': {
      if (!['inline', 'half', 'full'].includes(node.mode)) {
        throw fail('invalid_image_tag', `Unsupported image display mode: ${node.mode}`);
      }
      if (
        typeof node.src !== 'string'
        || node.src.trim().length === 0
        || typeof node.alt !== 'string'
        || node.alt.trim().length === 0
      ) {
        throw fail('invalid_image_tag', 'image_tag requires a non-empty source and alt text.');
      }
      const className = `and-image and-image-${node.mode}`;
      const alt = escapeAttribute(node.alt);
      const resolvedSource = resolveImageSource(node.src, options.imageBaseUrl);
      if (!resolvedSource.ok) {
        return `<img class="${className}" alt="${alt}" data-size="${node.mode}" data-and-src-omitted="unsafe" title="Unsafe image source omitted">`;
      }
      const src = escapeAttribute(resolvedSource.src);
      const sourceAttribute = node.mode === 'half' ? `srcset="${src} 2x"` : `src="${src}"`;
      const originalSourceAttribute = resolvedSource.resolved
        ? ` data-and-source="${escapeAttribute(node.src)}"`
        : '';
      const modeAttributes = node.mode === 'inline'
        ? ' style="height:1em;width:auto;vertical-align:-0.125em"'
        : '';
      return `<img class="${className}" ${sourceAttribute}${originalSourceAttribute} alt="${alt}" data-size="${node.mode}" loading="lazy" decoding="async" referrerpolicy="no-referrer"${modeAttributes}>`;
    }
    case 'strike_tag':
      return `<s>${renderInlineNodes(node.children, options)}</s>`;
    case 'quoted_tag':
      return `<q>${renderInlineNodes(node.children, options)}</q>`;
    case 'comment_tag':
      return `<span class="and-comment" hidden>${renderInlineNodes(node.children, options)}</span>`;
    case 'typed_value':
      try {
        return `<data class="and-typed-value" data-type="${escapeAttribute(formatAeonDatatype(node.datatype))}" value="${escapeAttribute(emitAeonScalar(node.value))}">${escapeHtml(displayAeonScalar(node.value))}</data>`;
      } catch {
        throw fail('invalid_typed_value', 'typed_value requires a supported AEON scalar AST.');
      }
    case 'highlight_tag':
      return `<mark>${renderInlineNodes(node.children, options)}</mark>`;
    case 'underline_tag':
      return `<u>${renderInlineNodes(node.children, options)}</u>`;
    case 'todo_marker': {
      const states = {
        unchecked: { glyph: '☐', label: 'Unchecked' },
        checked: { glyph: '☑', label: 'Checked' },
        in_progress: { glyph: '◐', label: 'In progress' },
        cancelled: { glyph: '☒', label: 'Cancelled' },
      };
      const state = states[node.state];
      if (!state) throw fail('invalid_todo_marker_state', `Unsupported todo state: ${node.state}`);
      return `<span class="and-todo-marker" data-state="${node.state}" role="img" aria-label="${state.label}">${state.glyph}</span>`;
    }
    case 'directional_marker': {
      const directions = {
        forward: { glyph: '→', label: 'Forward' },
        backward: { glyph: '←', label: 'Backward' },
      };
      const direction = directions[node.direction];
      if (!direction) {
        throw fail('invalid_directional_marker_direction', `Unsupported direction: ${node.direction}`);
      }
      return `<span class="and-directional-marker" data-direction="${node.direction}" role="img" aria-label="${direction.label}">${direction.glyph}</span>`;
    }
    case 'auto_number_marker':
      return '<span class="and-auto-number-marker" data-auto-number="true" aria-hidden="true"></span>';
    case 'line_break':
      return '<br>';
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
      const autoNumber = block.autoNumber ? ' class="and-auto-numbered" data-auto-number="true"' : '';
      return `<h${level}${autoNumber}>${renderInlineNodes(block.children, options)}</h${level}>`;
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
    case 'highlight_paragraph_block':
      return `<p class="and-highlight-paragraph">${renderInlineNodes(block.children, options)}</p>`;
    case 'header_text_block': {
      const tag = block.tag ? ` data-tag="${escapeAttribute(block.tag)}"` : '';
      return `<header class="and-header-text"${tag}>${renderInlineNodes(block.children, options)}</header>`;
    }
    case 'disclaimer_block': {
      const tag = block.tag ? ` data-tag="${escapeAttribute(block.tag)}"` : '';
      return `<aside class="and-disclaimer"${tag}>${renderInlineNodes(block.children, options)}</aside>`;
    }
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
    `<p>Unsupported extension: <code>${escapeHtml(block.name)}</code>. Opaque extension payload.</p>`,
    payload === ''
      ? '<p>No fallback content was provided for this extension block.</p>'
      : `<details><summary>Open payload</summary>\n\n<pre><code>${escapeHtml(payload)}</code></pre>\n</details>`,
    '</aside>',
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

  const normalizedOptions = normalizeRenderOptions(options);
  const body = renderBlocks(document.children, normalizedOptions);
  return normalizedOptions.fragment === false ? renderFullDocument(body) : body;
}
