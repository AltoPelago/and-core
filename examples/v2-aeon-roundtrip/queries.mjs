// These are ordinary SANSA queries over the SDK's portable AES namespace.
// NodeHead carries the tag as its scalar value and owns head attributes.
export const queries = [
  {"name": "Headings", "query": "from $.doc.**%NodeHead where . == \"heading\" select { level = .@.level }", "description": "Heading levels as native numeric fields.", "exampleCandidateCount": 2},
  {"name": "Level-two headings", "query": "from $.doc.**%NodeHead where . == \"heading\" and .@.level == 2 select { level = .@.level }", "description": "Filter heading nodes by their native numeric level.", "exampleCandidateCount": 1},
  {"name": "Prose strings", "query": "from $.doc.**%StringLiteral select .", "description": "Every structural prose string once; excludes attributes such as alt text, links and code payloads.", "exampleCandidateCount": 30},
  {"name": "Link destinations", "query": "from $.doc.**%NodeHead where . == \"link\" select .@.href", "description": "Link targets are properties, selected explicitly through the attribute space.", "exampleCandidateCount": 1},
  {"name": "Incomplete tasks", "query": "from $.doc.**%NodeHead where . == \"todo_item\" and (.@.state == |unchecked| or .@.state == |in_progress|) select .@.state", "description": "Unchecked and in-progress task states; checked and cancelled are excluded.", "exampleCandidateCount": 1},
  {"name": "Footnote definitions", "query": "from $.doc.**%NodeHead where . == \"footnote_definition\" select .", "description": "Complete definition subtrees, including rich inline content.", "exampleCandidateCount": 1},
  {"name": "Footnote references", "query": "from $.doc.**%NodeHead where . == \"footnote_reference\" select .@.id", "description": "Reusable footnote IDs; definitions retain their authored positions.", "exampleCandidateCount": 1},
  {"name": "Chart extensions", "query": "from $.doc.**%NodeHead where . == \"extension_block\" and .@.name == \"chart/pie\" select .@.name", "description": "Filter extensions by name; their text payloads remain opaque.", "exampleCandidateCount": 1},
  {"name": "Native inline values", "query": "from $.doc.**%NodeHead where . == \"typed_value\" select .@.value", "description": "Native inline values retain their types and annotations.", "exampleCandidateCount": 1},
  {"name": "Fallback fragments", "query": "from $.doc.**%NodeHead where . == \"document_fragment\" select .", "description": "Structured extension fallback documents, separate from opaque payload text.", "exampleCandidateCount": 1},
  {"name": "Heading text", "query": "from $.doc.**%NodeHead where . == \"heading\" select .**%StringLiteral", "description": "Text fragments within each heading, including nested formatting; fragments are not concatenated.", "exampleCandidateCount": 2},
  {"name": "Footnote text", "query": "from $.doc.**%NodeHead where . == \"footnote_definition\" select .**%StringLiteral", "description": "Only prose inside footnote definitions, including formatted descendants.", "exampleCandidateCount": 1},
  {"name": "Incomplete task content", "query": "from $.doc.**%NodeHead where . == \"todo_item\" and (.@.state == |unchecked| or .@.state == |in_progress|) select .", "description": "Complete unfinished task subtrees, preserving state and nested document structure.", "exampleCandidateCount": 1},
  {"name": "Images", "query": "from $.doc.**%NodeHead where . == \"image\" select { src = .@.src alt = .@.alt mode = .@.mode }", "description": "Image source, accessible description and display intent as a native object.", "exampleCandidateCount": 1},
  {"name": "Code payloads", "query": "from $.doc.**%NodeHead where . == \"code_block\" or . == \"code\" select .@.text", "description": "Opaque inline and block code text; prose traversal deliberately excludes these attributes.", "exampleCandidateCount": 1},
  {"name": "Anchor IDs", "query": "from $.doc.**%NodeHead where . == \"anchor\" select .@.id", "description": "Case-sensitive document-wide anchor identifiers.", "exampleCandidateCount": 2},
  {"name": "Table cell text", "query": "from $.doc.**%NodeHead where . == \"table_cell\" select .**%StringLiteral", "description": "Header and body cell prose in traversal order, including rich inline descendants.", "exampleCandidateCount": 4},
  {"name": "Card text", "query": "from $.doc.**%NodeHead where . == \"card_block\" select .**%StringLiteral", "description": "Prose within cards, including title, nested blocks and caption.", "exampleCandidateCount": 1},
  {"name": "Nodes containing prose", "query": "from $.doc.**%NodeHead where exists(.**%StringLiteral) select .", "description": "Use exists(selector) to exclude nodes without prose; ancestor nodes overlap."},
];

export function queryDocument(source, { readAeonNamespace, evaluateQuery }) {
  const { namespace } = readAeonNamespace(source);
  return queries.map(({ name, query }) => {
    const result = evaluateQuery(query, namespace);
    if (!result.ok) throw new Error(`${name}: ${JSON.stringify(result.errors)}`);
    return { name, query, results: result.results };
  });
}
