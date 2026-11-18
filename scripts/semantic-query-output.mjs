// Presentation adapter using the public SANSA metadata accessors. Serialize
// before JSON transport to preserve native types, exact numbers and null reasons.
const quote = JSON.stringify;
const key = (name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : quote(name);
const symbol = (value) => `|${String(value).replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('\n', '\\n').replaceAll('\r', '\\r').replaceAll('\t', '\\t').replace(/[\u0000-\u001f]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)}|`;

function annotation(datatype) {
  if (!datatype) return '';
  const generics = datatype.genericArgs?.length ? `<${datatype.genericArgs.join(', ')}>` : '';
  const clarifiers = datatype.clarifiers?.length ? `[${datatype.clarifiers.map((item) => typeof item === 'string' ? quote(item) : typeof item === 'number' ? String(item) : item.raw ?? item.value).join(', ')}]` : '';
  return `:${datatype.name}${generics}${clarifiers}`;
}

function sourceValues(source, { tokenize, parse }) {
  const parsed = parse(tokenize(source).tokens);
  if (parsed.errors.length) throw new Error('Cannot render invalid AEON source.');
  const offsets = new Uint32Array(source.length + 1);
  let utf16 = 0, utf8 = 0;
  for (const character of source) {
    offsets[utf16] = utf8;
    if (character.length === 2) offsets[utf16 + 1] = utf8;
    utf16 += character.length; utf8 += Buffer.byteLength(character); offsets[utf16] = utf8;
  }
  const values = new Map();
  const spanKey = (span) => `${offsets[span.start.offset]}:${offsets[span.end.offset]}`;
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value instanceof Map) { for (const entry of value.values()) visit(entry); return; }
    for (const [name, child] of Object.entries(value)) if (!['span', 'headSpan'].includes(name)) visit(child);
    if (value.span && (value.type?.endsWith('Literal') || ['ObjectNode', 'ListNode', 'TypedValue'].includes(value.type))) {
      values.set(spanKey(value.span), { value });
    }
    if (value.type === 'NodeLiteral' && value.headSpan) values.set(spanKey(value.headSpan), { value });
    if (value.span && value.value && typeof value.value === 'object' && 'datatype' in value) {
      values.set(spanKey(value.span), value);
    }
  }
  visit(parsed.document);
  return { values, slice: (span) => source.slice(span.start.offset, span.end.offset) };
}

function scalar(value, metadata = {}, engine) {
  switch (metadata.kind) {
    case 'number': return metadata.numericLexeme ?? String(value);
    case 'symbol': return symbol(value);
    case 'hex': return `#${value}`;
    case 'radix': return `%${value}`;
    case 'encoding': return `&${value}`;
    case 'separator': return `^${value}`;
    case 'date': case 'time': case 'datetime': case 'wtc': return String(value);
    case 'toggle': return String(value);
    case 'null': return metadata.nullReason && ['none', 'notSet', 'notApplicable', 'tombstone'].includes(metadata.nullReason)
      ? `!${metadata.nullReason}` : metadata.nullReason ? `!${quote(metadata.nullReason)}` : '!none';
    case 'sansa': return value?.canonical ?? value?.address ?? String(value);
    case 'nan': return 'NaN';
    case 'infinity': return value < 0 ? '-Infinity' : 'Infinity';
  }
  if (value === null) return '!none';
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return Number.isNaN(value) ? 'NaN' : String(value);
  if (Array.isArray(value)) return `[${value.map((entry) => scalar(entry, {}, engine)).join(', ')}]`;
  if (value && typeof value === 'object') {
    const fields = engine.getQueryObjectFieldMetadata(value);
    return `{ ${Object.entries(value).map(([name, entry]) => `${key(name)}${metadataAnnotation(fields[name])} = ${scalar(entry, fields[name], engine)}`).join(', ')} }`;
  }
  throw new Error('Unsupported query result value.');
}
function metadataAnnotation(metadata) {
  if (!metadata?.semanticType) return '';
  const builtins = new Set(['string', 'number', 'boolean', 'symbol', 'date', 'time', 'datetime', 'wtc', 'null', 'hex', 'encoding', 'separator', 'toggle', 'nan', 'infinity']);
  if (builtins.has(metadata.semanticType)) return '';
  if (metadata.semanticType === 'radix' && metadata.radixBase) return `:radix[${metadata.radixBase}]`;
  return `:${metadata.semanticType}`;
}

export function renderQueryViews(evaluation, source, engine) {
  if (!evaluation.ok) throw new Error('Only successful queries have AEON output.');
  const index = sourceValues(source, engine);
  function bindingValue(binding) {
    const descriptor = index.values.get(binding.span);
    if (descriptor) {
      const attrs = (descriptor.attributes ?? []).map((group) => index.slice(group.span)).join('');
      return { head: attrs + annotation(descriptor.datatype), text: index.slice(descriptor.value.span) };
    }
    // Computed binding sets may not have source provenance. Retain their exposed
    // native kinds rather than guessing from displayed strings.
    const kind = binding.scalarKind ?? ({ StringLiteral: 'string', NumberLiteral: 'number', BooleanLiteral: 'boolean', SymbolicLiteral: 'symbol', NodeHead: 'string' }[binding.representationKind]);
    if (kind) return { head: metadataAnnotation(binding), text: scalar(binding.value, { ...binding, kind }, engine) };
    if (['ListNode', 'TupleLiteral', 'ObjectNode'].includes(binding.representationKind)) {
      const children = binding.children ?? [];
      const parts = children.map((child) => {
        const value = bindingValue(child);
        return binding.representationKind === 'ObjectNode' ? `${key(child.name)}${value.head} = ${value.text}` : value.head ? `${value.head} = ${value.text}` : value.text;
      });
      const [open, close] = binding.representationKind === 'ObjectNode' ? ['{', '}'] : binding.representationKind === 'TupleLiteral' ? ['(', ')'] : ['[', ']'];
      return { head: '', text: `${open}${parts.join(', ')}${close}` };
    }
    throw new Error(`Cannot render selected ${binding.representationKind} without source provenance.`);
  }
  // Both views contain one entry per selected value. Flatten only the engine's
  // Binding Set wrapper, never an actual selected AEON list/tuple/object.
  const rows = [];
  for (const entry of evaluation.results) {
    if (entry.value.type === 'bindingSet') {
      for (const binding of entry.value.bindings) {
        rows.push({ address: binding.address, kind: binding.representationKind, ...bindingValue(binding) });
      }
    } else {
      const metadata = engine.getQueryValueMetadata(entry.value);
      rows.push({ address: entry.candidateAddress ?? '$', kind: entry.value.type,
        head: metadataAnnotation(metadata), text: scalar(entry.value.value, metadata, engine) });
    }
  }
  const document = (values) => `results = [${values.length ? `\n  ${values.join(',\n  ')}\n` : ''}]\n`;
  return {
    resultFormat: 'and-query-results-v1',
    valueCount: rows.length,
    candidateCount: evaluation.results.length,
    aeon: document(rows.map(({ address, kind, head, text }) =>
      `{ address = ${quote(address)}, kind = ${quote(kind)}, value${head} = ${text} }`)),
    aeonValues: document(rows.map(({ head, text }) => head ? `${head} = ${text}` : text)),
  };
}

export function renderQueryAeon(evaluation, source, engine) {
  return renderQueryViews(evaluation, source, engine).aeon;
}
