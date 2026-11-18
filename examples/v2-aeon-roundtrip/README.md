# &ND v2 → native AEON/AES → &ND v2

This runnable example lowers &ND into ordinary AEON nodes, native string children,
and native attribute values. It compiles the result into an AES-backed SANSA
namespace, queries it, and reconstructs canonical &ND. The round-trip contract is
**semantic equivalence**.

Inspect the three stages:

- [input.and](./input.and): authored v2 input with a card, todo list, blockquote,
  rich content, links, typed date, image, footnote, table, code, and extension fallback.
- [document.aeon](./document.aeon): the semantic document, with directly nested content.
- [roundtrip.and](./roundtrip.and): canonical &ND recovered from that document.

## Run

From the `and-core` repository root, using Node.js 22 or newer:

```sh
npm ci --prefix examples/v2-aeon-roundtrip
npm run example:aeon-roundtrip
npm run check:example-aeon-roundtrip
```

The runner prints AEON, recovered &ND, a semantic round-trip result, and the SANSA
queries with match counts. To regenerate the checked-in outputs:

```sh
npm run example:aeon-roundtrip -- --write
```

Dependencies are isolated to this example and pinned in its lockfile. The core
&ND package and public API remain dependency-free. To select a built AEON
TypeScript checkout for lexer/parser/SDK, set `AND_AEON_TYPESCRIPT_ROOT` relative
to the working directory; the example's installed SANSA package is still used.
Missing dependencies fail explicitly.

## Semantic representation

```aeon
and_version = "v2"

doc:node = <document@{vocabulary="and-document-semantic-example-2"}(
  <heading@{level=1}("Hello")>,
  <paragraph("Read ", <strong("the docs")>, " first.")>,
  <todo_list(
    <todo_item@{state=|unchecked|}(<paragraph("Review this.")>)>
  )>,
  <paragraph("Published ", <typed_value@{value:date = 2026-08-20}>)>
)>
```

Plain text uses native string children, with no `text` nodes or `value` attributes.
Formatting and other inline roles remain nodes in the ordered content sequence.
Checklist states are native symbols: `|unchecked|`, `|checked|`, `|in_progress|`,
and `|cancelled|`. Parser-derived `_tag` suffixes are removed (`anchor`, `image`,
`underline`, `highlight`, etc.). Childless nodes omit empty parentheses.

The document root carries its semantic vocabulary identifier. `and_version`
separately selects the &ND syntax version; it does not change the vocabulary.
Properties use native values and inferred types. Inline values keep their native
annotation and scalar. Titles, captions, table rows, and fallbacks retain distinct
roles; opaque code and extension payloads remain attributes.

`bridge.mjs` exposes `toAeon(source)`, `fromAeon(source, runtime)`, and idempotent
`normalizeAeon(source, runtime)`. Normalization follows &ND canonical rules while
retaining significant spaces, explicit line breaks, formatting boundaries,
reference relationships, native scalar semantics, and opaque code/extension text.

## Query with SANSA

The SDK's portable AES namespace exposes node tags as `NodeHead` values, with
attributes in their head attribute space. Native content strings are selected
through ordinary `StringLiteral` traversal, without entering attribute spaces:

```text
from $.doc.**%StringLiteral select .

from $.doc.**%NodeHead
where . == "todo_item" and .@.state == |unchecked|
select .

from $.doc.**%NodeHead
where . == "heading" and .@.level == 2
select { level = .@.level }
```

[queries.mjs](./queries.mjs) also queries links, footnotes, extensions, native values,
and fallback fragments. Tests compare query results from equivalent hand-authored
AEON and &ND-derived documents, including native prose and all four task symbols.
They also verify the exact example's mixed string/node ordering, the distinction
between node containers and heads, and adjacent-string normalization. Raw AES
segmentation remains observable; normalize first for segmentation-independent
prose query results.

See [SEMANTIC-PROFILE.md](./SEMANTIC-PROFILE.md) for vocabulary/versioning decisions,
normalization boundaries, identity rules, and implementation limits. This is an
frozen candidate profile, not a published Aeonite standard. It uses the existing &ND
inline scalar subset and adds no document-specific SANSA query language.


The [machine-readable vocabulary](./vocabulary.json) pins the accepted nodes,
attributes and containment; incompatible changes require a new vocabulary ID.
The [query cookbook](./QUERIES.md) contains all 19 playground presets.
Both result views use the stable `and-query-results-v1` list envelope.
The example uses a [pinned unpublished SANSA snapshot](./vendor/README.md) for
its public query metadata API; no private SANSA properties are read by the adapter.
