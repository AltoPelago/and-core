// These are ordinary SANSA queries over the SDK's portable AES namespace.
// NodeHead carries the tag as its scalar value and owns head attributes.
export const queries = [
  { name: 'Headings', query: 'from $.doc.**%NodeHead where . == "heading" select { level = .@.level }' },
  { name: 'Level-two headings', query: 'from $.doc.**%NodeHead where . == "heading" and .@.level == 2 select { level = .@.level }' },
  { name: 'Prose strings', query: 'from $.doc.**%StringLiteral select .' },
  { name: 'Link destinations', query: 'from $.doc.**%NodeHead where . == "link" select .@.href' },
  { name: 'Incomplete tasks', query: 'from $.doc.**%NodeHead where . == "todo_item" and (.@.state == |unchecked| or .@.state == |in_progress|) select .@.state' },
  { name: 'Footnote definitions', query: 'from $.doc.**%NodeHead where . == "footnote_definition" select .' },
  { name: 'Footnote references', query: 'from $.doc.**%NodeHead where . == "footnote_reference" select .@.id' },
  { name: 'Chart extensions', query: 'from $.doc.**%NodeHead where . == "extension_block" and .@.name == "chart/pie" select .@.name' },
  { name: 'Native inline values', query: 'from $.doc.**%NodeHead where . == "typed_value" select .@.value' },
  { name: 'Fallback fragments', query: 'from $.doc.**%NodeHead where . == "document_fragment" select .' },
];

export function queryDocument(source, { readAeonNamespace, evaluateQuery }) {
  const { namespace } = readAeonNamespace(source);
  return queries.map(({ name, query }) => {
    const result = evaluateQuery(query, namespace);
    if (!result.ok) throw new Error(`${name}: ${JSON.stringify(result.errors)}`);
    return { name, query, results: result.results };
  });
}
