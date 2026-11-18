# &ND semantic document example profile

Status: **frozen candidate vocabulary, revision 2**, implementing the supplied **&ND v2 — AES-Native
Semantic Representation** proposal and its follow-up revisions. This does not
promote the &ND v2 language proposal or publish an Aeonite vocabulary/CTS standard.

## Contract and versioning

The `document` root carries
`vocabulary="and-document-semantic-example-2"`, identifying this semantic vocabulary
and mapping revision. An extracted document subtree retains that identifier.
`and_version="v2"` is separate envelope metadata selecting the source/target &ND
syntax version. The root's vocabulary does not depend on the syntax version.
The identifier denotes this versioned experimental semantic contract for any
conforming document; it is not the identity of `input.and` or another fixture.
The machine-readable [vocabulary.json](./vocabulary.json) pins all node names,
containment models, required and optional property types, role placement, and task
symbols. [vocabulary.mjs](./vocabulary.mjs) validates this contract during decoding;
the &ND emitter additionally validates content constraints and reference integrity.
Unknown nodes/properties, missing required properties, wrong native types and
invalid containment fail before conversion rather than being silently discarded.

This identifier is now frozen for this candidate: changing node names, containment,
attribute types, required fields, enum membership, or normalization requires a new
vocabulary identifier and explicit migration. Documentation fixes and diagnostics
may evolve without changing the accepted document semantics. Native equivalent
literal spellings may normalize; custom annotations on ordinary structural
properties are not part of this contract. Custom inline types belong in
`typed_value.value`, where their full supported annotation is preserved.

A future normative identifier (for example, `and.document.v1`) requires an agreed
release decision. Freezing this candidate does not promote the source language
proposal or claim an Aeonite standard.
The old redundant envelope `and_profile` binding is no longer emitted.

A document authored directly in AEON can omit `and_version`: AES compilation and
SANSA queries require no fabricated &ND source history. The example's reverse
converter requires it as an explicit &ND syntax selection when conversion is
requested. It does not become intrinsic document content.

This revision changes semantic topology (native prose instead of `text` nodes),
node names, task attribute types, and metadata location. Earlier example profiles
are rejected rather than silently interpreted under the new vocabulary. To use
an extracted root with the example decoder, bind it as `doc` and supply the
supported `and_version` in the conversion envelope.

The governing invariant remains semantic preservation:

```text
&ND → native AEON/AES → canonical &ND → native AEON/AES
```

Tests compare native AES-backed namespace snapshots without source locators or
provenance. The real AEON SDK compiles both emitted representations; ordinary
SANSA queries evaluate their namespaces. Source bytes, parser AST identity,
redundant declaration spelling, and insignificant text segmentation are not
part of equivalence.

## Representation

- Plain prose is a native string child, e.g.
  `<paragraph("Read ", <strong("the docs")>, " first.")>`.
  Content order and formatting boundaries remain explicit. No `text` node is
  emitted. Strings are allowed only in inline-content positions: headings,
  paragraphs, rich inline nodes, formatted blocks, titles, captions, and table
  cells. Strings directly under block-only containers, numbers as prose children,
  and legacy `text` nodes fail explicitly.
- Semantic node names omit parser `_tag` suffixes: `anchor`, `image`, `underline`,
  `highlight`, `admonition`, `question`, `strike`, `quoted`, `comment`, `disclaimer`,
  `semantic`, and `plus`. The mapping back to &ND AST names is private to the bridge.
  Distinct block names such as `comment_block` remain distinct.
- Ordered nodes nest directly. Their parent tags determine `children` versus
  `items`; tables retain `table_header`, `table_row`, and `table_cell` roles.
- Childless nodes omit empty parentheses (`<line_break>`, `<anchor@{id="guide"}>`).
  Explicit empty child lists are accepted with the same semantics.
- Ordinary properties use inferred native literals: `level=2`, `autoNumber=true`,
  `href="#details"`, `alignments=["left", !none]`.
- A `todo_item` has one native symbol `state` from the closed set below. Strings,
  Booleans, and unknown symbols are rejected. The internal &ND AST's string enum
  is an implementation detail, not the emitted attribute type.
- `typed_value` has exactly one native scalar attribute:
  `<typed_value@{value:date = 2026-08-20}>`. Datatype annotations, generics,
  clarifiers, null reasons, temporal kinds, radix and encoding values remain native
  AEON constructs. The wrapper preserves the inline value's role and position.
- `title`, `caption`, and fallback `document_fragment` nodes distinguish content
  roles. Code/extension payloads remain opaque `text` attributes. Extension names,
  image alt text, link destinations, and other attribute strings are properties,
  not prose children. No payload is automatically parsed into AES.

| &ND item marker | Semantic `state` |
| --- | --- |
| `[ ]` | `|unchecked|` |
| `[x]` | `|checked|` |
| `[,]` | `|in_progress|` |
| `[;]` | `|cancelled|` |

State meanings and membership belong to this document vocabulary. AES and its
parser accept an otherwise valid symbol such as `|blocked|`; the current document
vocabulary rejects it as an unsupported task state. Extending this enum requires
a vocabulary compatibility/versioning decision, not a new fundamental AES type.

An incomplete-task query includes `unchecked` and `in_progress`, excluding both
`checked` and `cancelled`. Symbols retain their native AES type and are not equal
to similarly spelled strings through an invented coercion.

## Document-wide reference rules

Anchor IDs are case-sensitive and document-wide, including nodes inside cards,
blockquotes, lists, and extension fallbacks. Anchor IDs must be unique and local
fragment links must resolve. Forward links are allowed by the &ND v2 contract.

Named footnote IDs are also case-sensitive, unique, and document-wide, in their
own namespace. A definition remains at its authored tree position; container
nesting does not hide it from later references elsewhere in the document.
References must follow their definition in document traversal order; unresolved
or forward references fail. Anonymous definitions have no reusable ID. Footnotes
cannot nest. These are existing &ND v2 rules, not new SANSA scoping behavior.

The &ND emitter validates reconstructed trees and these relationships. Structurally
valid AES alone does not establish document-level reference integrity. No links
are rewritten as AEON clone/pointer references.

## Normalization and its boundaries

`normalizeAeon(source, runtime)` validates the semantic document, emits canonical
&ND, and lowers that document back to this profile. It is idempotent. `toAeon`
also normalizes &ND before lowering.

Normalization follows the existing canonical/scalar contracts: line endings,
soft wraps, escapes, number separators, and equivalent fence spellings normalize.
Document normalization concatenates adjacent native prose strings, in order,
within the same inline-content parent. For example, `"Hello ", "world"` becomes
`"Hello world"`. It does not cross an intervening formatting node, explicit line
break, inline value, or other semantic child, and does not collapse meaningful
spaces. Opaque attribute strings remain outside this prose normalization.

This is a document-specific equivalence rule, not a change to AES equality or
SANSA traversal semantics. Before normalization, two strings are two AES children
and SANSA returns two bindings; afterward, the merged string is one child and one
binding. Query consumers seeking segmentation-independent results should normalize
first. Raw structural AES comparison can therefore differ while normalized
document semantics agree.

Ordinary multiple spaces, explicit
line breaks, formatting boundaries, content order, native scalar families, large
number precision, radix scale, null reasons, task states, and opaque payloads
remain significant. Inline numbers never pass through JavaScript floating point.
No extra arithmetic, time-zone, custom datatype, or radix equivalences are invented.

This does not expand &ND's closed inline typed-scalar grammar. Unsupported native
AES objects, lists, nodes, references, and symbols in `typed_value` fail explicitly.
Task-state symbols are a document property convention with an existing &ND
spelling, not a new &ND inline fundamental value type.

## SANSA interoperability

The published SDK exposes portable AES topology: a `NodeLiteral` owns a `NodeHead`,
which owns its content and head attribute space. The `NodeHead` scalar value is
its tag. Native text content has representation kind `StringLiteral`.

```text
from $.doc.**%StringLiteral select .

from $.doc.**%NodeHead where . == "heading" select { level = .@.level }

from $.doc.**%NodeHead
where . == "heading" and .@.level == 2
select .

from $.doc.**%NodeHead where . == "link" select .@.href

from $.doc.**%NodeHead
where . == "todo_item" and (.@.state == |unchecked| or .@.state == |in_progress|)
select .@.state
```

Structural `**` traversal does not enter attribute spaces. Prose selection thus
excludes link destinations, image alt text, opaque code/extension payloads, the
vocabulary identifier, and a `typed_value`'s native string attribute. Attribute
selection remains explicit through `.@`. Tests verify that boundary.

Nested navigation also uses ordinary queries: first select a card's `NodeHead`,
then query `<returned-card-address>.**%NodeHead` for headings beneath that card.
Tests exercise this sequence without a document-specific selector language.
`queries.mjs` also demonstrates footnotes, extensions, native values, and fallbacks.

Results are bindings/subtrees with current structural addresses, not automatically
standalone &ND sections. Heading-based range extraction and mutation workflows
remain outside this example. Addresses can move after edits. Native text changes
can target returned string bindings; no fabricated `text` node interface is needed.
Numeric query results use the SDK's lossless materialization and exact comparison
metadata, even when displayed as lexeme strings.

## Follow-up decisions

The user's explicit request for native string children supersedes the red team's
suggestion to retain explicit text nodes temporarily. The user's symbol proposal
also supersedes its binary-Boolean suggestion: all four existing states survive.
The suggested semantic names, root vocabulary identifier, syntax/vocabulary
separation, opaque extension boundaries, and documented identity rules are applied.

Formal AEOS schemas, extension-specific structured payload contracts, section
extraction, and mutation tooling remain future work. Existing procedural validation
continues to enforce the example's document constraints.

The executable checks cover every accepted v2 fixture and projection combination,
native values and all task states, normalization idempotence, significant text
boundaries, cross-source equivalence, query results, and reference integrity.
These example checks complement the language CTS and run separately in CI.


## Verification of the reviewed representation

The tests use published AEON lexer/parser/SDK 0.16.0 and the pinned local SANSA
0.15.0-rc.1 snapshot described in [vendor/README.md](./vendor/README.md). It adds
public presentation accessors without changing parsers, namespaces, equality,
or traversal. The snapshot is unpublished; it makes a clean install reproducible
until a SANSA release exports `@altopelago/sansa/query-metadata`.
The optional checkout lane repeats these tests against the selected built AEON
packages. Tests cover the exact checked-in `document.aeon`, not only synthetic trees.

Focused interoperability assertions establish that:

- Raw split and joined prose have different native AES topology and different
  raw SANSA string selections, but the same normalized document and query results.
- The example's first paragraph retains this direct child sequence:
  string, link node, string, typed-value node, string, image node, string.
- A `NodeLiteral` container and its `NodeHead` are distinct occurrences. The head
  owns the ordered content; SANSA selects native strings and node containers by
  their existing representation kinds without synthetic text nodes.
- AES accepts an unknown task symbol while vocabulary validation rejects it.
- A native AEON-authored document can compile and query without `and_version`;
  adding a supported conversion target permits canonical &ND emission.

These checks provide implementation evidence for candidate semantic-model review.
They are example interoperability tests alongside the existing language CTS,
not a claim of normative Aeonite semantic-model CTS certification or publication.

## Query cookbook and result contract

The playground loads [queries.mjs](./queries.mjs) directly. See the executable
[query cookbook](./QUERIES.md) for common document questions and traversal limits.
Queries operate on the current native AEON source; querying does not implicitly
validate or normalize it into this vocabulary.

Presentation contract `and-query-results-v1` always emits a standalone AEON
document with one `results` list, in both values-only and metadata views:

```aeon
results = ["a reusable footnote"]
```

Each selected binding contributes one element. Computed scalar/object projections
contribute one element per candidate. Empty Binding Sets contribute no elements.
Actual selected lists, tuples, objects and node subtrees remain native values;
they are never flattened. Ordering and duplicate occurrences are retained. No
scalar unwrapping, automatic concatenation, deduplication or null substitution
occurs. Empty, single and multiple results therefore share one outer shape.

Metadata view has an address/kind/value record for each of the same elements.
Binding addresses identify selected occurrences; computed projections use their
candidate address and kind `scalar` or `object`, not a fabricated source span.
Intrinsic data fields named address/kind/value remain unchanged inside the value.
Annotations are carried on the native value assignment when significant.

The HTTP response reports `resultFormat`, `valueCount` (displayed elements), and
`candidateCount` (engine result records). Raw `results` retain SANSA's grouping;
the two AEON strings are the lossless presentation/transport representations.
JSON numeric transport alone cannot preserve all native scalar information.
The formatter obtains derived metadata through SANSA's supported public accessors
before JSON transport, and uses AEON parser spans for selected source values.
The metadata toggle redraws this cached evaluation without querying again.
