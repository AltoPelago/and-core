import { readFileSync } from 'node:fs';

function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export const vocabulary = freeze(JSON.parse(readFileSync(new URL('./vocabulary.json', import.meta.url), 'utf8')));

function matches(value, type) {
  const string = value.type === 'StringLiteral';
  const number = value.type === 'NumberLiteral' ? Number(value.value) : NaN;
  switch (type) {
    case 'string': return string;
    case 'nullable-string': return string || (value.type === 'NullLiteral' && value.mode === 'reserved' && value.value === 'none');
    case 'boolean': return value.type === 'BooleanLiteral';
    case 'true': return value.type === 'BooleanLiteral' && value.value === true;
    case 'heading-level': return Number.isInteger(number) && number >= 1 && number <= 6;
    case 'column-span': return Number.isSafeInteger(number) && number > 1;
    case 'vocabulary-id': return string && value.value === vocabulary.id;
    case 'task-state': return value.type === 'SymbolicLiteral' && vocabulary.taskStates.includes(value.value);
    case 'image-mode': return string && ['inline', 'half', 'full'].includes(value.value);
    case 'direction': return string && ['forward', 'backward'].includes(value.value);
    case 'advisory-kind': return string && ['question', 'admonition'].includes(value.value);
    case 'alignments': return value.type === 'ListNode' && value.elements.every((item) =>
      (item.type === 'StringLiteral' && ['left', 'center', 'right'].includes(item.value)) ||
      (item.type === 'NullLiteral' && item.mode === 'reserved' && item.value === 'none'));
    // The closed &ND inline scalar decoder validates datatype compatibility.
    case 'inline-scalar': return true;
    default: throw new Error(`Unknown vocabulary attribute type: ${type}`);
  }
}

export function validateVocabularyNode(node) {
  const definition = Object.hasOwn(vocabulary.nodes, node.tag) ? vocabulary.nodes[node.tag] : undefined;
  if (!definition) throw new Error(`Unsupported document vocabulary node: ${node.tag}`);
  if (node.tag === 'typed_value') return; // Validated by the closed native scalar decoder.
  const fields = new Map();
  for (const group of node.attributes) for (const [name, entry] of group.entries) {
    if (fields.has(name)) throw new Error(`Duplicate attribute on ${node.tag}: ${name}`);
    fields.set(name, entry);
    const type = Object.hasOwn(definition.required, name) ? definition.required[name]
      : Object.hasOwn(definition.optional, name) ? definition.optional[name] : undefined;
    if (!type) throw new Error(`Unknown attribute on ${node.tag}: ${name}`);
    if (!matches(entry.value, type)) {
      if (type === 'vocabulary-id') throw new Error('Unsupported document vocabulary');
      if (type === 'task-state') throw new Error('Task state requires a supported symbol');
      throw new Error(`Invalid ${node.tag}.${name}: expected ${type}`);
    }
    // Ordinary document properties have vocabulary-defined types. Custom native
    // annotations belong to typed_value, where the scalar decoder preserves them.
    if (type !== 'inline-scalar' && (entry.attributes?.length || entry.datatype &&
      (entry.datatype.genericArgs?.length || entry.datatype.clarifiers?.length ||
       !['string', 'number', 'boolean', 'bool', 'int', 'null', 'symbol', 'list'].includes(entry.datatype.name)))) {
      throw new Error(`Unsupported annotation on ${node.tag}.${name}`);
    }
  }
  for (const name of Object.keys(definition.required)) {
    if (!fields.has(name)) throw new Error(`Missing ${node.tag}.${name}`);
  }
  for (const child of node.children) {
    if (child.type === 'StringLiteral' && definition.children === 'inline') continue;
    if (child.type === 'StringLiteral') throw new Error(`Native text is not allowed under ${node.tag}`);
    if (child.type !== 'NodeLiteral') throw new Error(`Expected an AEON node under ${node.tag}`);
    if (!Object.hasOwn(vocabulary.nodes, child.tag)) throw new Error(`Unsupported document vocabulary node: ${child.tag}`);
    const role = vocabulary.roles[child.tag];
    if (role?.parents.includes(node.tag)) continue;
    const category = vocabulary.nodes[child.tag]?.category;
    if (definition.children === 'inline' && category === 'inline') continue;
    if (definition.children === 'blocks' && category === 'block') continue;
    if (definition.children === 'list-items' && child.tag === 'list_item') continue;
    if (definition.children === 'todo-items' && child.tag === 'todo_item') continue;
    if (definition.children === 'table' && ['table_header', 'table_row'].includes(child.tag)) continue;
    if (definition.children === 'cells' && child.tag === 'table_cell') continue;
    throw new Error(`Unexpected ${child.tag} child of ${node.tag}`);
  }
}
