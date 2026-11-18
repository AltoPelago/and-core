import { parseAnd, emitCanonical } from '../../index.mjs';
import {
  emitAeonInlineTypedValue, formatAeonDatatype, parseAeonInlineTypedValue,
} from '../../implementations/shared/aeon-inline-scalar.mjs';

export const profile = 'and-document-semantic-example-2';

const tagNames = new Map([
  'anchor_tag', 'image_tag', 'underline_tag', 'highlight_tag', 'admonition_tag',
  'question_tag', 'strike_tag', 'quoted_tag', 'comment_tag', 'disclaimer_tag',
  'semantic_tag', 'plus_tag',
].map((type) => [type, type.slice(0, -4)]));
const astNames = new Map([...tagNames].map(([type, tag]) => [tag, type]));
const taskStates = new Set(['unchecked', 'checked', 'in_progress', 'cancelled']);

function scalarValue(value) {
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (value === null) return '!none';
  if (Array.isArray(value)) return `[${value.map(scalarValue).join(', ')}]`;
  throw new Error('Unsupported scalar in &ND AST');
}

function node(tag, attributes, children, depth) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tag)) throw new Error(`Invalid node tag: ${tag}`);
  const head = `<${tagNames.get(tag) ?? tag}${attributes.length ? `@{${attributes.join(', ')}}` : ''}`;
  if (!children.length) return `${head}>`;
  const indent = '  '.repeat(depth);
  return `${head}(\n${children.map((child) => `${indent}  ${child}`).join(',\n')}\n${indent})>`;
}

// This profile owns the containment schema. Ordinary child sequences are
// implicit in the parent tag; only distinct roles need named nodes.
const containers = new Set([
  'document', 'document_fragment', 'paragraph', 'heading', 'list_item', 'todo_item',
  'blockquote', 'strong', 'emphasis', 'link', 'admonition_tag', 'question_tag',
  'strike_tag', 'quoted_tag', 'comment_tag', 'highlight_tag', 'underline_tag',
  'disclaimer_tag', 'footnote_definition', 'semantic_tag', 'semantic_block',
  'highlight_paragraph_block', 'strong_paragraph_block', 'emphasis_paragraph_block',
  'underline_paragraph_block', 'header_text_block', 'disclaimer_block',
  'question_paragraph_block', 'admonition_paragraph_block', 'comment_block', 'card_block',
]);
const lists = new Set(['list', 'todo_list', 'auto_number_list']);
const leaves = new Set([
  'code', 'horizontal_rule', 'anchor_tag', 'plus_tag', 'directional_marker',
  'advisory_marker', 'line_break', 'image_tag', 'footnote_reference', 'code_block',
  'extension_block',
]);
const captioned = new Set([
  'table', 'code_block', 'extension_block', 'card_block', 'semantic_block',
  'highlight_paragraph_block', 'strong_paragraph_block', 'emphasis_paragraph_block',
  'underline_paragraph_block', 'header_text_block', 'disclaimer_block',
  'question_paragraph_block', 'admonition_paragraph_block', 'comment_block',
]);

// Native strings denote prose only in inline-content positions. Attribute
// strings (href, alt, code text, extension payload, etc.) remain properties.
const inlineContainers = new Set([...containers].filter((type) => ![
  'document', 'document_fragment', 'list_item', 'todo_item', 'blockquote', 'card_block',
].includes(type)).concat(['table_cell', 'title', 'caption']));

function childField(type) {
  if (containers.has(type)) return 'children';
  if (lists.has(type)) return 'items';
  if (leaves.has(type) || ['table', 'typed_value'].includes(type)) return null;
  throw new Error(`Unsupported &ND node: ${type}`);
}

function auxiliaryAllowed(type, role) {
  return role === 'title' ? type === 'card_block' : captioned.has(type);
}

function encode(value, depth = 0, tag = value.type) {
  if (tag === 'text') return JSON.stringify(value.value);
  if (tag === 'typed_value') {
    return node(tag, [`value:${emitAeonInlineTypedValue(value.datatype, value.value)}`], [], depth);
  }
  const primary = tag === 'table_cell' ? 'children' : childField(tag);
  const attributes = tag === 'document' ? [`vocabulary=${JSON.stringify(profile)}`] : [];
  const children = [];
  for (const [key, field] of Object.entries(value)) {
    if (['type', 'span', primary].includes(key)) continue;
    if (['title', 'caption'].includes(key) && auxiliaryAllowed(tag, key)) continue;
    if (tag === 'table' && ['header', 'rows'].includes(key)) continue;
    if (tag === 'extension_block' && key === 'fallback') continue;
    if (tag === 'todo_item' && key === 'state') {
      if (!taskStates.has(field)) throw new Error(`Unknown task state: ${field}`);
      attributes.push(`state=|${field}|`);
    } else {
      attributes.push(`${key}=${scalarValue(field)}`);
    }
  }
  if (value.title !== undefined && tag === 'card_block') {
    children.push(node('title', [], value.title.map((entry) => encode(entry, depth + 2)), depth + 1));
  }
  for (const entry of primary ? value[primary] : []) children.push(encode(entry, depth + 1));
  if (tag === 'table') {
    children.push(node('table_header', [], value.header.map((cell) => encode(cell, depth + 2, 'table_cell')), depth + 1));
    for (const row of value.rows) {
      children.push(node('table_row', [], row.map((cell) => encode(cell, depth + 2, 'table_cell')), depth + 1));
    }
  }
  if (tag === 'extension_block' && value.fallback !== undefined) children.push(encode(value.fallback, depth + 1));
  if (value.caption !== undefined && captioned.has(tag)) {
    children.push(node('caption', [], value.caption.map((entry) => encode(entry, depth + 2)), depth + 1));
  }
  return node(tag, attributes, children, depth);
}

export function toAeon(source) {
  const parsed = parseAnd(source, { allowV2: true });
  if (!parsed.ok) throw new Error(`Invalid &ND: ${parsed.errorCode}`);
  if (parsed.version !== 'v2') throw new Error('This example requires &ND v2');
  // Normalize with the existing &ND canonical contract: soft wraps, escapes,
  // and equivalent fence spellings have one representation; opaque code and
  // extension payloads and explicit line breaks remain intact.
  const canonical = emitCanonical(parsed.document, { profile: 'standalone', version: 'v2' });
  const normalized = parseAnd(canonical, { allowV2: true });
  if (!normalized.ok) throw new Error(`Invalid canonical &ND: ${normalized.errorCode}`);
  return `and_version = "v2"\n\ndoc:node = ${encode(normalized.document)}\n`;
}

function literal(value) {
  if (value.type === 'TypedValue') return literal(value.value);
  switch (value.type) {
    case 'ListNode': return value.elements.map(literal);
    case 'StringLiteral':
    case 'BooleanLiteral': return value.value;
    case 'NumberLiteral': {
      const number = Number(value.value);
      if (!Number.isFinite(number)) throw new Error('Expected finite number');
      return number;
    }
    case 'NullLiteral':
      if (value.mode === 'reserved' && value.value === 'none') return null;
      break;
  }
  throw new Error(`Unsupported AEON scalar: ${value.type}`);
}

function attributes(value) {
  const result = new Map();
  for (const group of value.attributes ?? []) {
    for (const [key, entry] of group.entries) {
      if (result.has(key)) throw new Error(`Duplicate attribute: ${key}`);
      if (value.tag === 'todo_item' && key === 'state') {
        if (entry.value.type !== 'SymbolicLiteral' || !taskStates.has(entry.value.value)) {
          throw new Error('Task state must be a supported symbol');
        }
        result.set(key, entry.value.value);
      } else {
        result.set(key, literal(entry.value));
      }
    }
  }
  return result;
}

function assign(object, key, value) {
  if (['__proto__', 'prototype', 'constructor', 'span'].includes(key) || Object.hasOwn(object, key)) {
    throw new Error(`Duplicate or reserved field: ${key}`);
  }
  object[key] = value;
}

function requireNode(value, tag) {
  if (value?.type !== 'NodeLiteral' || (tag !== undefined && value.tag !== tag)) {
    throw new Error(`Expected ${tag ?? 'an AEON'} node`);
  }
}

function roleChildren(value, tag) {
  requireNode(value, tag);
  if (value.attributes.length) throw new Error(`Unexpected attributes on ${tag}`);
  return value.children;
}

// Re-enter the existing closed &ND scalar contract from the parsed AEON
// attribute. The scalar itself is native AEON, never an encoded AST or JS float.
function decodeTypedValue(value, source) {
  const entries = value.attributes.flatMap((group) => [...group.entries]);
  if (value.children.length || entries.length !== 1 || entries[0][0] !== 'value') {
    throw new Error('typed_value requires exactly one native value attribute and no children');
  }
  const entry = entries[0][1];
  const inferred = {
    StringLiteral: 'string', NumberLiteral: 'number', InfinityLiteral: 'infinity',
    NaNLiteral: 'nan', NullLiteral: 'null', BooleanLiteral: 'boolean',
    ToggleLiteral: 'toggle', HexLiteral: 'hex', RadixLiteral: 'radix',
    EncodingLiteral: 'encoding', DateLiteral: 'date', TimeLiteral: 'time',
    DateTimeLiteral: 'datetime', WTCDateTimeLiteral: 'wtc',
    SeparatorLiteral: 'sep', SansaAddressLiteral: 'sansa',
  };
  const datatype = entry.datatype ? {
    name: entry.datatype.name,
    genericArgs: [...entry.datatype.genericArgs],
    clarifiers: entry.datatype.clarifiers.map((item) => typeof item === 'object' ? literal(item) : item),
  } : { name: inferred[entry.value.type], genericArgs: [], clarifiers: [] };
  const span = entry.value.span;
  const scalarText = source.slice(span.start.offset, span.end.offset);
  const parsed = parseAeonInlineTypedValue(`${formatAeonDatatype(datatype)} = ${scalarText}`);
  if (!parsed.ok) throw new Error('Unsupported native &ND inline value');
  return { type: 'typed_value', datatype: parsed.datatype, value: parsed.value };
}

function decodeContent(value, parent, source) {
  if (value.type === 'StringLiteral') {
    if (!inlineContainers.has(parent)) throw new Error(`Native text is not allowed under ${parent}`);
    return { type: 'text', value: value.value };
  }
  return decode(value, undefined, source);
}

function decode(value, wireTag = value?.tag, source) {
  requireNode(value, wireTag);
  if (tagNames.has(wireTag)) throw new Error(`Unsupported parser-derived tag: ${wireTag}`);
  const tag = astNames.get(wireTag) ?? wireTag;
  if (tag === 'typed_value') return decodeTypedValue(value, source);
  const record = tag === 'table_cell';
  const result = record ? {} : { type: tag };
  const primary = tag === 'table_cell' ? 'children' : childField(tag);
  const fields = attributes(value);
  if (tag === 'document') {
    if (fields.get('vocabulary') !== profile) throw new Error('Unsupported document vocabulary');
    fields.delete('vocabulary');
  }
  for (const [key, field] of fields) assign(result, key, field);
  if (primary) assign(result, primary, []);
  if (tag === 'table') assign(result, 'rows', []);
  for (const child of value.children) {
    if (child.type === 'StringLiteral') {
      if (!primary) throw new Error(`Unexpected string child of ${tag}`);
      result[primary].push(decodeContent(child, tag, source));
      continue;
    }
    requireNode(child);
    if (['title', 'caption'].includes(child.tag) && auxiliaryAllowed(tag, child.tag)) {
      assign(result, child.tag, roleChildren(child, child.tag).map((entry) => decodeContent(entry, child.tag, source)));
    } else if (tag === 'table' && child.tag === 'table_header') {
      if (result.rows.length) throw new Error('Table header must precede rows');
      assign(result, 'header', roleChildren(child, 'table_header').map((cell) => decode(cell, 'table_cell', source)));
    } else if (tag === 'table' && child.tag === 'table_row') {
      if (!Object.hasOwn(result, 'header')) throw new Error('Table row requires a preceding header');
      result.rows.push(roleChildren(child, 'table_row').map((cell) => decode(cell, 'table_cell', source)));
    } else if (tag === 'extension_block' && child.tag === 'document_fragment') {
      assign(result, 'fallback', decode(child, undefined, source));
    } else if (primary) {
      result[primary].push(decodeContent(child, tag, source));
    } else {
      throw new Error(`Unexpected ${child.tag} child of ${tag}`);
    }
  }
  if (tag === 'table' && !Object.hasOwn(result, 'header')) throw new Error('Table requires a header');
  return result;
}

// Use the real AEON lexer/parser, supplied by the runner. No JSON sidecar or
// retained &ND source participates in this direction of the conversion.
export function fromAeon(source, { tokenize, parse }) {
  const lexed = tokenize(source);
  if (lexed.errors.length) throw new Error(`Invalid AEON tokens: ${JSON.stringify(lexed.errors)}`);
  const parsed = parse(lexed.tokens);
  if (parsed.errors.length) throw new Error(`Invalid AEON: ${JSON.stringify(parsed.errors)}`);
  const bindings = parsed.document.bindings;
  if (bindings.length !== 2 || !bindings.some((binding) => binding.key === 'and_version') || !bindings.some((binding) => binding.key === 'doc')) {
    throw new Error('Expected exactly and_version and doc bindings');
  }
  const values = new Map(bindings.map((binding) => [binding.key, binding.value]));
  if (literal(values.get('and_version') ?? {}) !== 'v2') {
    throw new Error('Unsupported example profile or &ND version');
  }
  const document = decode(values.get('doc'), undefined, source);
  if (document.type !== 'document') throw new Error('Expected a document root');
  // The &ND emitter validates the reconstructed tree, including v2 anchors.
  const canonical = emitCanonical(document, { profile: 'standalone', version: 'v2' });
  return { version: 'v2', document, canonical };
}

// Idempotent normalization of this document vocabulary, independent of source
// spelling. Validation happens before serialization; unsupported AES values
// are rejected rather than coerced into the narrower &ND inline grammar.
export function normalizeAeon(source, runtime) {
  return toAeon(fromAeon(source, runtime).canonical);
}
