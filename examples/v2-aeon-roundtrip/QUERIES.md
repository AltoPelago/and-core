# Common document queries

These are the playground presets from `queries.mjs`. Queries inspect the current
AEON document without implicit normalization. Run from the Query view.

## Headings

Heading levels as native numeric fields.

```sansa
from $.doc.**%NodeHead
where . == "heading"
select { level = .@.level }
```

## Level-two headings

Filter heading nodes by their native numeric level.

```sansa
from $.doc.**%NodeHead
where . == "heading" and .@.level == 2
select { level = .@.level }
```

## Prose strings

Every structural prose string once; excludes attributes such as alt text, links and code payloads.

```sansa
from $.doc.**%StringLiteral
select .
```

## Link destinations

Link targets are properties, selected explicitly through the attribute space.

```sansa
from $.doc.**%NodeHead
where . == "link"
select .@.href
```

## Incomplete tasks

Unchecked and in-progress task states; checked and cancelled are excluded.

```sansa
from $.doc.**%NodeHead
where . == "todo_item" and (.@.state == |unchecked| or .@.state == |in_progress|)
select .@.state
```

## Footnote definitions

Complete definition subtrees, including rich inline content.

```sansa
from $.doc.**%NodeHead
where . == "footnote_definition"
select .
```

## Footnote references

Reusable footnote IDs; definitions retain their authored positions.

```sansa
from $.doc.**%NodeHead
where . == "footnote_reference"
select .@.id
```

## Chart extensions

Filter extensions by name; their text payloads remain opaque.

```sansa
from $.doc.**%NodeHead
where . == "extension_block" and .@.name == "chart/pie"
select .@.name
```

## Native inline values

Native inline values retain their types and annotations.

```sansa
from $.doc.**%NodeHead
where . == "typed_value"
select .@.value
```

## Fallback fragments

Structured extension fallback documents, separate from opaque payload text.

```sansa
from $.doc.**%NodeHead
where . == "document_fragment"
select .
```

## Heading text

Text fragments within each heading, including nested formatting; fragments are not concatenated.

```sansa
from $.doc.**%NodeHead
where . == "heading"
select .**%StringLiteral
```

## Footnote text

Only prose inside footnote definitions, including formatted descendants.

```sansa
from $.doc.**%NodeHead
where . == "footnote_definition"
select .**%StringLiteral
```

## Incomplete task content

Complete unfinished task subtrees, preserving state and nested document structure.

```sansa
from $.doc.**%NodeHead
where . == "todo_item" and (.@.state == |unchecked| or .@.state == |in_progress|)
select .
```

## Images

Image source, accessible description and display intent as a native object.

```sansa
from $.doc.**%NodeHead
where . == "image"
select { src = .@.src alt = .@.alt mode = .@.mode }
```

## Code payloads

Opaque inline and block code text; prose traversal deliberately excludes these attributes.

```sansa
from $.doc.**%NodeHead
where . == "code_block" or . == "code"
select .@.text
```

## Anchor IDs

Case-sensitive document-wide anchor identifiers.

```sansa
from $.doc.**%NodeHead
where . == "anchor"
select .@.id
```

## Table cell text

Header and body cell prose in traversal order, including rich inline descendants.

```sansa
from $.doc.**%NodeHead
where . == "table_cell"
select .**%StringLiteral
```

## Card text

Prose within cards, including title, nested blocks and caption.

```sansa
from $.doc.**%NodeHead
where . == "card_block"
select .**%StringLiteral
```

## Nodes containing prose

Use exists(selector) to exclude nodes without prose; ancestor nodes overlap.

```sansa
from $.doc.**%NodeHead
where exists(.**%StringLiteral)
select .
```

## Avoiding empty selections and repeated text

`exists(.**%StringLiteral)` checks whether a node has prose descendants.
`exists()` needs an argument. `isValue(.)` tests the current node, not its
descendant selection; `isValue(.**%StringLiteral)` requires at most one match
and errors on multiple strings. Use `exists` for a multi-match selection.

For all prose once, select strings in the `from` clause. Selecting every node
and then its descendant strings repeats content for each ancestor. An empty
selection contributes no displayed values; a selected native empty list remains
`[]` as a value within the results list.

Structural `**` does not enter `.@` attribute spaces. Prose excludes image alt
text, link targets, inline typed string values and opaque code/extension payloads.
Those need explicit attribute queries. Text fragments are not automatically
concatenated, and formatting boundaries remain meaningful.

## Scope and sections

A heading is a block alongside the following paragraphs, not their parent.
Descendants of a heading contain its title only. Heading-to-next-heading section
ranges require a separate document operation and are not implied by `**`.
To query a structural container, select its metadata address and use
`from <returned-address>.**%StringLiteral select .` in a subsequent query.
Addresses refer to the current document and can change after edits.

Both output views follow [and-query-results-v1](./SEMANTIC-PROFILE.md#query-cookbook-and-result-contract).
