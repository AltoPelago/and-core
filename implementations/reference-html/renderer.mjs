import {
  displayAeonScalar,
  emitAeonScalar,
  formatAeonDatatype,
} from '../shared/aeon-inline-scalar.mjs';
import { isNdV2Identifier } from '../shared/v2-identifier.mjs';

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

function requireV2Identifier(value, errorCode, nodeType) {
  if (!isNdV2Identifier(value)) {
    throw fail(errorCode, `${nodeType} requires a valid v2 identifier.`);
  }
  return value;
}

function requireFootnoteId(value, nodeType) {
  return requireV2Identifier(value, 'invalid_footnote_id', nodeType);
}

function requireSemanticId(value, nodeType) {
  return requireV2Identifier(value, 'invalid_semantic_id', nodeType);
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

function renderInlineCallout(kind, children, options) {
  const definitions = {
    question: { glyph: '?', label: 'Hint', className: 'and-question' },
    admonition: { glyph: '!', label: 'Attention', className: 'and-admonition' },
  };
  const definition = definitions[kind];
  const content = renderInlineNodes(children, options);
  return `<span class="and-callout ${definition.className}" tabindex="0"><span class="and-callout-icon" aria-hidden="true">${definition.glyph}</span><span class="and-callout-content" role="note" aria-label="${definition.label}">${content}</span></span>`;
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
      return renderInlineCallout('admonition', node.children, options);
    case 'question_tag':
      return renderInlineCallout('question', node.children, options);
    case 'footnote_definition': {
      const number = options.footnoteState.definitions.length + 1;
      const definition = {
        number,
        id: node.id,
        children: node.children,
        referenceIds: [],
      };
      options.footnoteState.definitions.push(definition);
      if (node.id !== undefined) {
        options.footnoteState.named.set(requireFootnoteId(node.id, node.type), definition);
      }
      return renderFootnoteReference(definition);
    }
    case 'footnote_reference': {
      const id = requireFootnoteId(node.id, node.type);
      const definition = options.footnoteState.named.get(id);
      if (!definition) throw fail('unresolved_footnote_reference', `Unresolved footnote reference: ${id}`);
      return renderFootnoteReference(definition);
    }
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
    case 'disclaimer_tag':
      return `<small class="and-disclaimer-inline">${renderInlineNodes(node.children, options)}</small>`;
    case 'semantic_tag':
      requireSemanticId(node.id, node.type);
      return renderInlineNodes(node.children, options);
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
    case 'directional_marker': {
      const direction = requireDirection(node.direction);
      return `<span class="and-directional-marker" data-direction="${node.direction}" role="img" aria-label="${direction.label}">${direction.glyph}</span>`;
    }
    case 'advisory_marker':
      throw fail('invalid_advisory_marker_context', 'advisory_marker is valid only as the leading marker of an unordered list item.');
    case 'line_break':
      return '<br>';
    default:
      throw fail('unsupported_inline_node', `Unsupported inline node type: ${node.type}`);
  }
}

function requireDirection(direction) {
  const directions = {
    forward: { glyph: '→', label: 'Forward' },
    backward: { glyph: '←', label: 'Backward' },
  };
  const resolved = directions[direction];
  if (!resolved) {
    throw fail('invalid_directional_marker_direction', `Unsupported direction: ${direction}`);
  }
  return resolved;
}

function renderListItem(item, ordered, options) {
  const [firstChild, ...nestedChildren] = item.children;
  const leadingMarker = !ordered
    && firstChild?.type === 'paragraph'
    && ['directional_marker', 'advisory_marker'].includes(firstChild.children?.[0]?.type)
    ? firstChild.children[0]
    : null;

  if (!leadingMarker) return `<li>${renderBlocks(item.children, options)}</li>`;

  const content = renderInlineNodes(firstChild.children.slice(1), options);
  let marker;
  let itemAttributes;
  if (leadingMarker.type === 'directional_marker') {
    const direction = requireDirection(leadingMarker.direction);
    marker = `<span class="and-directional-list-marker" data-direction="${leadingMarker.direction}" role="img" aria-label="${direction.label}">${direction.glyph}</span>`;
    itemAttributes = `class="and-directional-list-item" data-direction="${leadingMarker.direction}"`;
  } else {
    const definitions = {
      question: { glyph: '?', label: 'Hint' },
      admonition: { glyph: '!', label: 'Attention' },
    };
    const definition = definitions[leadingMarker.kind];
    if (!definition) throw fail('invalid_advisory_marker_kind', `Unsupported advisory marker kind: ${leadingMarker.kind}`);
    marker = `<span class="and-advisory-list-marker" data-kind="${leadingMarker.kind}" role="img" aria-label="${definition.label}">${definition.glyph}</span>`;
    itemAttributes = `class="and-advisory-list-item" data-kind="${leadingMarker.kind}"`;
  }
  const paragraph = `<p>${marker}${content}</p>`;
  const nested = nestedChildren.length > 0 ? `\n${renderBlocks(nestedChildren, options)}` : '';
  return `<li ${itemAttributes} style="list-style:none">${paragraph}${nested}</li>`;
}

function renderAdvisoryParagraph(kind, children, options) {
  const definitions = {
    question: { glyph: '?', label: 'Hint', className: 'and-question-paragraph' },
    admonition: { glyph: '!', label: 'Attention', className: 'and-admonition-paragraph' },
  };
  const definition = definitions[kind];
  return `<aside class="and-advisory-paragraph ${definition.className}" aria-label="${definition.label}"><span class="and-advisory-paragraph-icon" aria-hidden="true">${definition.glyph}</span><p>${renderInlineNodes(children, options)}</p></aside>`;
}

function renderFootnoteReference(definition) {
  const occurrence = definition.referenceIds.length + 1;
  const referenceId = `and-footnote-ref-${definition.number}-${occurrence}`;
  definition.referenceIds.push(referenceId);
  const authoredId = definition.id === undefined
    ? ''
    : ` data-footnote-id="${escapeAttribute(definition.id)}"`;
  return `<sup class="and-footnote-reference" id="${referenceId}"${authoredId}><a href="#and-footnote-${definition.number}" aria-label="Footnote ${definition.number}">${definition.number}</a></sup>`;
}

function renderFootnoteSection(options) {
  if (options.footnoteState.definitions.length === 0) return '';

  const items = options.footnoteState.definitions.map((definition) => {
    const authoredId = definition.id === undefined
      ? ''
      : ` data-footnote-id="${escapeAttribute(definition.id)}"`;
    const backlinks = definition.referenceIds.map((referenceId, index) => {
      const suffix = definition.referenceIds.length > 1 ? ` ${index + 1}` : '';
      return `<a class="and-footnote-backref" href="#${referenceId}" aria-label="Back to footnote ${definition.number} reference ${index + 1}">↩${suffix}</a>`;
    }).join(' ');
    return `<li id="and-footnote-${definition.number}"${authoredId}><span class="and-footnote-content">${renderInlineNodes(definition.children, options)}</span> ${backlinks}</li>`;
  }).join('\n');

  return `<section class="and-footnotes" aria-label="Footnotes">\n<hr>\n<ol>\n${items}\n</ol>\n</section>`;
}

function renderBlocks(blocks, options) {
  return blocks.map((block) => renderBlock(block, options)).join('\n');
}

function renderCaptionedBlock(block, body, options, extraAttributes = '') {
  if (block.caption === undefined) return body;
  if (!hasInlineAstContent(block.caption)) {
    throw fail('invalid_block_caption', `${block.type} caption must not be empty.`);
  }
  const typeClass = block.type.replaceAll('_', '-');
  return [
    `<figure class="and-captioned-block and-captioned-${typeClass}"${extraAttributes}>`,
    body,
    `<figcaption class="and-block-caption">${renderInlineNodes(block.caption, options)}</figcaption>`,
    '</figure>',
  ].join('\n');
}

function nextHeadingNumber(level, options) {
  const counters = options.headingCounters;
  for (let index = 0; index < level - 1; index += 1) {
    if (counters[index] === 0) counters[index] = 1;
  }
  counters[level - 1] += 1;
  counters.fill(0, level);
  return counters.slice(0, level).join('.');
}

function renderBlock(block, options) {
  switch (block.type) {
    case 'paragraph':
      return `<p>${renderInlineNodes(block.children, options)}</p>`;
    case 'heading': {
      const level = Math.min(Math.max(Number(block.level), 1), 6);
      if (!block.autoNumber) {
        return `<h${level}>${renderInlineNodes(block.children, options)}</h${level}>`;
      }
      const number = nextHeadingNumber(level, options);
      return `<h${level} class="and-auto-numbered" data-auto-number="true" data-number="${number}"><span class="and-heading-number">${number}.</span> ${renderInlineNodes(block.children, options)}</h${level}>`;
    }
    case 'horizontal_rule':
      return '<hr>';
    case 'blockquote':
      return `<blockquote>\n${renderBlocks(block.children, options)}\n</blockquote>`;
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = block.items.map((item) => renderListItem(item, block.ordered, options)).join('\n');
      return `<${tag}>\n${items}\n</${tag}>`;
    }
    case 'todo_list': {
      const states = {
        unchecked: { glyph: '☐', label: 'Unchecked' },
        checked: { glyph: '☑', label: 'Checked' },
        in_progress: { glyph: '◐', label: 'In progress' },
        cancelled: { glyph: '☒', label: 'Cancelled' },
      };
      const items = block.items.map((item) => {
        if (item.type !== 'todo_item') {
          throw fail('invalid_todo_list_item', 'todo_list items must have type todo_item.');
        }
        const state = states[item.state];
        if (!state) throw fail('invalid_todo_item_state', `Unsupported todo state: ${item.state}`);
        const [firstChild, ...nestedChildren] = item.children;
        if (!firstChild || firstChild.type !== 'paragraph') {
          throw fail('unsupported_todo_item_shape', 'HTML todo items require a paragraph head.');
        }
        const marker = `<span class="and-todo-state" role="img" aria-label="${state.label}">${state.glyph}</span>`;
        const content = `<span class="and-todo-content">${renderInlineNodes(firstChild.children, options)}</span>`;
        const nested = nestedChildren.length > 0 ? `\n${renderBlocks(nestedChildren, options)}` : '';
        return `<li class="and-todo-item" data-state="${item.state}">${marker} ${content}${nested}</li>`;
      }).join('\n');
      return `<ul class="and-todo-list" style="list-style:none;padding-inline-start:0">\n${items}\n</ul>`;
    }
    case 'auto_number_list': {
      const items = block.items.map((item) => {
        if (item.type !== 'list_item') {
          throw fail('invalid_auto_number_list_item', 'auto_number_list items must have type list_item.');
        }
        return `<li>${renderBlocks(item.children, options)}</li>`;
      }).join('\n');
      return `<ol class="and-auto-number-list" data-auto-number="true">\n${items}\n</ol>`;
    }
    case 'code_block': {
      return renderCodeBlock(block, options);
    }
    case 'extension_block': {
      const body = block.fallback
        ? renderBlocks(block.fallback.children, options)
        : renderUnsupportedExtensionDiagnostic(block);
      return renderCaptionedBlock(block, body, options);
    }
    case 'table':
      return renderTable(block, options);
    case 'highlight_paragraph_block':
      return renderCaptionedBlock(block, `<p class="and-highlight-paragraph">${renderInlineNodes(block.children, options)}</p>`, options);
    case 'strong_paragraph_block':
      return renderCaptionedBlock(block, `<p class="and-strong-paragraph"><strong>${renderInlineNodes(block.children, options)}</strong></p>`, options);
    case 'emphasis_paragraph_block':
      return renderCaptionedBlock(block, `<p class="and-emphasis-paragraph"><em>${renderInlineNodes(block.children, options)}</em></p>`, options);
    case 'underline_paragraph_block':
      return renderCaptionedBlock(block, `<p class="and-underline-paragraph"><u>${renderInlineNodes(block.children, options)}</u></p>`, options);
    case 'question_paragraph_block':
      return renderCaptionedBlock(block, renderAdvisoryParagraph('question', block.children, options), options);
    case 'admonition_paragraph_block':
      return renderCaptionedBlock(block, renderAdvisoryParagraph('admonition', block.children, options), options);
    case 'comment_block':
      return renderCaptionedBlock(
        block,
        `<aside class="and-comment-block" hidden>${renderInlineNodes(block.children, options)}</aside>`,
        options,
        ' hidden'
      );
    case 'header_text_block': {
      if (block.tag !== undefined) throw fail('invalid_header_text_block', 'header_text_block no longer accepts a tag.');
      return renderCaptionedBlock(block, `<header class="and-header-text">${renderInlineNodes(block.children, options)}</header>`, options);
    }
    case 'disclaimer_block': {
      if (block.tag !== undefined) throw fail('invalid_disclaimer_block', 'disclaimer_block no longer accepts a tag.');
      return renderCaptionedBlock(block, `<aside class="and-disclaimer">${renderInlineNodes(block.children, options)}</aside>`, options);
    }
    case 'semantic_block':
      requireSemanticId(block.id, block.type);
      return renderCaptionedBlock(block, `<p>${renderInlineNodes(block.children, options)}</p>`, options);
    case 'card_block': {
      if (!Array.isArray(block.children) || block.children.length === 0) {
        throw fail('invalid_card_block', 'card_block requires at least one child block.');
      }
      const body = renderBlocks(block.children, options);
      if (block.title === undefined) {
        return renderCaptionedBlock(block, `<aside class="and-card">\n${body}\n</aside>`, options);
      }
      if (!hasInlineAstContent(block.title)) {
        throw fail('invalid_card_block', 'card_block title must not be empty.');
      }
      return renderCaptionedBlock(block, `<details class="and-card and-card-collapsible">\n<summary>${renderInlineNodes(block.title, options)}</summary>\n${body}\n</details>`, options);
    }
    default:
      throw fail('unsupported_block_node', `Unsupported block node type: ${block.type}`);
  }
}

function renderCodeBlock(block, options) {
  const language = block.language ? block.language.toLowerCase() : null;
  const className = language ? ` class="language-${escapeAttribute(language)}"` : '';
  const orderedAttribute = block.ordered ? ' data-ordered="true"' : '';
  const figureClass = block.ordered ? 'and-code-block and-code-block-ordered' : 'and-code-block';
  const body = block.ordered
    ? renderOrderedCodeLines(block.text)
    : `<pre><code${className}>${escapeHtml(normalizeText(block.text))}</code></pre>`;
  if (block.caption !== undefined && !hasInlineAstContent(block.caption)) {
    throw fail('invalid_block_caption', 'code_block caption must not be empty.');
  }
  const caption = block.caption === undefined ? null : renderInlineNodes(block.caption, options);
  let figureCaption = '';
  if (language && caption !== null) {
    figureCaption = `<figcaption><span class="and-code-language">${escapeHtml(language)}</span> <span class="and-block-caption">${caption}</span></figcaption>`;
  } else if (caption !== null) {
    figureCaption = `<figcaption class="and-block-caption">${caption}</figcaption>`;
  } else if (language) {
    figureCaption = `<figcaption>${escapeHtml(language)}</figcaption>`;
  }
  return [
    `<figure class="${figureClass}"${language ? ` data-language="${escapeAttribute(language)}"` : ''}${orderedAttribute}>`,
    figureCaption,
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

const TABLE_ALIGNMENTS = new Set(['left', 'center', 'right']);

function htmlTableCellColSpan(cell) {
  if (cell.colSpan === undefined) return 1;
  if (!Number.isInteger(cell.colSpan) || cell.colSpan < 2) {
    throw fail('invalid_table_span', 'table cell colSpan must be an integer greater than one.');
  }
  return cell.colSpan;
}

function htmlTableRowWidth(row) {
  if (!Array.isArray(row) || row.length === 0) {
    throw fail('invalid_table_shape', 'table rows must contain at least one cell.');
  }
  return row.reduce((width, cell) => width + htmlTableCellColSpan(cell), 0);
}

function htmlTableAlignments(block, logicalWidth) {
  if (block.alignments === undefined) return Array(logicalWidth).fill(null);
  if (!Array.isArray(block.alignments) || block.alignments.length !== logicalWidth) {
    throw fail('invalid_table_alignment', 'table alignments must match the logical column count.');
  }
  const alignments = block.alignments.map((alignment) => {
    if (alignment === null || TABLE_ALIGNMENTS.has(alignment)) return alignment;
    throw fail('invalid_table_alignment', `Unsupported table alignment: ${alignment}`);
  });
  if (alignments.every((alignment) => alignment === null)) {
    throw fail('invalid_table_alignment', 'all-default table alignments must be omitted from the AST.');
  }
  return alignments;
}

function renderTableRow(row, tag, alignments, options) {
  let logicalColumn = 0;
  const cells = row.map((cell) => {
    const colSpan = htmlTableCellColSpan(cell);
    const alignment = alignments[logicalColumn];
    const content = renderInlineNodes(cell.children, options);
    if (colSpan > 1 && content.trim().length === 0) {
      throw fail('invalid_table_span', 'spanning table cells require non-empty content.');
    }
    const attributes = [
      ...(colSpan > 1 ? [`colspan="${colSpan}"`] : []),
      ...(alignment === null ? [] : [`style="text-align:${alignment}"`]),
    ];
    logicalColumn += colSpan;
    return `<${tag}${attributes.length > 0 ? ` ${attributes.join(' ')}` : ''}>${content}</${tag}>`;
  }).join('');
  return `<tr>${cells}</tr>`;
}

function renderTable(block, options) {
  const logicalWidth = htmlTableRowWidth(block.header);
  for (const row of block.rows) {
    if (htmlTableRowWidth(row) !== logicalWidth) {
      throw fail('invalid_table_span', 'every table row must match the logical column count.');
    }
  }
  const alignments = htmlTableAlignments(block, logicalWidth);
  const header = renderTableRow(block.header, 'th', alignments, options);
  const rows = block.rows
    .map((row) => renderTableRow(row, 'td', alignments, options))
    .join('\n');
  let caption = '';
  if (block.caption !== undefined) {
    if (!hasInlineAstContent(block.caption)) {
      throw fail('invalid_block_caption', 'table caption must not be empty.');
    }
    caption = `<caption class="and-block-caption">${renderInlineNodes(block.caption, options)}</caption>`;
  }

  return [
    '<table>',
    ...(caption === '' ? [] : [caption]),
    '<thead>',
    header,
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

  validateFootnoteGraph(document);
  const normalizedOptions = {
    ...normalizeRenderOptions(options),
    headingCounters: Array(6).fill(0),
    footnoteState: { definitions: [], named: new Map() },
  };
  const blocks = renderBlocks(document.children, normalizedOptions);
  const footnotes = renderFootnoteSection(normalizedOptions);
  const body = [blocks, footnotes].filter((part) => part.length > 0).join('\n');
  return normalizedOptions.fragment === false ? renderFullDocument(body) : body;
}
