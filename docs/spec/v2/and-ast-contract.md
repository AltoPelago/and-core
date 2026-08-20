# &ND Core v2 AST Contract (Proposal)

This document defines the proposal-stage AST additions used by the executable `&ND Core v2` fixture
lane. v2 inherits every v1 node in [`../v1/and-ast-contract.md`](../v1/and-ast-contract.md) without
changing its structural meaning.

## Parse Result And Effective Version

A successful document parse reports the effective grammar version beside the document AST:

```ts
interface NdParseSuccess {
  readonly ok: true;
  readonly version: "v1" | "v2";
  readonly document: NdDocument;
}
```

The version is parse metadata rather than a document child. Standalone input obtains it from the
`&ND v1` or `&ND v2` declaration. Headerless embedded input obtains it from an explicit typed parser
option. The parser MUST NOT infer v2 from body syntax.

Canonical emitters receive the effective version explicitly. This preserves the existing v1 AST
shape while allowing a v2 document containing only inherited v1 nodes to retain its v2 declaration.

### Host-Controlled Embedded Version Selection

Only the host of a headerless typed channel may supply an effective v2 version. It MUST explicitly
provide both v2 reader capability and `version: "v2"`; capability alone does not select v2, and a
version request without capability fails with `unsupported_version`. Missing version selection
defaults to v1. Unknown version values fail with `invalid_version_option`.

A source declaration always takes precedence over an external version option. Declared-v1 input
remains v1 even when the host requests v2, and declared-v2 input remains v2 even when the host passes
`version: "v1"`. A declared-v2 document still requires a v2-capable reader. Implementations MUST NOT
infer capability or effective version from document content. Registries of named embedding profiles
are outside this first-draft Core boundary.

## Inherited Nodes

The complete v1 block and inline node unions remain valid in v2. A v2-capable reader MUST preserve
the same fields and containment relationships for inherited syntax.

`NdInlineNode` gains the nodes below. `NdBlockNode` gains `NdTodoList`, `NdAutoNumberList`, and the
paired-block nodes below, and `NdHeading` gains the optional `autoNumber` field.

## Capability Disposition

The first-draft candidate surface is divided by ownership, not by parser gates:

| Forms | Disposition | Contract boundary |
| :---- | :---------- | :---------------- |
| `[# ...]` and inherited `[@ #id | label]` | Core | Case-sensitive document-local anchors and resolved fragment links. |
| `[- ...]`, `[" ...]`, `[' ...]`, `[= ...]`, `[_ ...]` | Core | Rich inline content with stable structural meaning. |
| `[! ...]`, `[? ...]` | Core syntax + convention | Rich inline content; presentation and product workflow are consumer-defined. |
| `[+ ...]` | Core syntax + convention | Scalar consumer tag; vocabulary and behavior remain consumer-defined. |
| `[~ source | alt | mode]` | Core | Inline image with required source and alt text; mode is `inline`, `half`, or `full`. |
| `[:type = scalar]` | Core syntax + convention | Exact AEON type-assignment syntax over a closed inline-scalar subset. |
| `- [ ] content`, `- [x] content`, `- [,] content`, `- [;] content` | Core | First-class todo list and item states; workflow and presentation are projections. |
| `[>]`, `[<]`, `[.]` | Core | Stable inline author-intent markers; a leading direction marker replaces an unordered-list bullet in projection. |
| heading `[n]` and `- [n] content` | Core | Contextual heading field and first-class auto-number list; number calculation is outside Core. |
| `[% content]`, `[% (id) content]`, `[% (id)]` | Core structure + consumer projection | Footnote definitions and backward references; displayed labels and placement are consumer-defined. |
| `~~~=`, `~~~*`, `~~~/`, `~~~_`, `===`, `***` paired blocks | Core | Highlight, strong, emphasis, underline, header, and disclaimer block structure. |
| `[^ ...]` and all other unpromoted reserved forms | Deferred | Rejected by v2 strict mode. |

“Core syntax + convention” remains part of the single v2 strict grammar. It means Core guarantees
the parse shape and canonical spelling while deliberately declining to standardize a consumer
vocabulary, workflow, or visual treatment. The complete ownership boundary is defined in
[`and-consumer-conventions.md`](./and-consumer-conventions.md).

## Inline Content Models

```ts
interface NdAnchorTag {
  readonly type: "anchor_tag";
  readonly id: string;
}

interface NdPlusTag {
  readonly type: "plus_tag";
  readonly value: string;
}

interface NdImageTag {
  readonly type: "image_tag";
  readonly src: string;
  readonly alt: string;
  readonly mode: "inline" | "half" | "full";
}

interface NdTypedValue {
  readonly type: "typed_value";
  readonly datatype: NdAeonDatatype;
  readonly value: NdAeonInlineScalar;
}

interface NdAeonDatatype {
  readonly name: string;
  readonly genericArgs: string[];
  readonly clarifiers: (string | number)[];
}

type NdAeonInlineScalar =
  | { readonly type: "StringLiteral"; readonly value: string }
  | { readonly type: "NumberLiteral"; readonly value: string }
  | { readonly type: "InfinityLiteral"; readonly value: "Infinity" | "-Infinity" }
  | { readonly type: "NaNLiteral"; readonly value: "NaN" | "-NaN" }
  | { readonly type: "NullLiteral"; readonly mode: "reserved" | "reason"; readonly value: string }
  | { readonly type: "BooleanLiteral"; readonly value: boolean }
  | { readonly type: "ToggleLiteral"; readonly value: "yes" | "no" | "on" | "off" }
  | { readonly type: "HexLiteral" | "RadixLiteral" | "EncodingLiteral"; readonly value: string }
  | { readonly type: "DateLiteral" | "TimeLiteral"; readonly value: string }
  | { readonly type: "DateTimeLiteral"; readonly value: string; readonly temporalKind: "datetime" | "wtc" }
  | { readonly type: "SeparatorLiteral" | "SansaAddressLiteral"; readonly value: string };

interface NdRichV2Tag {
  readonly type:
    | "admonition_tag"
    | "question_tag"
    | "strike_tag"
    | "quoted_tag"
    | "comment_tag"
    | "highlight_tag"
    | "underline_tag";
  readonly children: NdInlineNode[];
}

interface NdFootnoteDefinition {
  readonly type: "footnote_definition";
  readonly id?: string;
  readonly children: NdInlineNode[];
}

interface NdFootnoteReference {
  readonly type: "footnote_reference";
  readonly id: string;
}
```

Identifiers, consumer tags, and image fields are normalized scalars. AEON typed values preserve a
structured datatype annotation and literal-family-aware scalar node. Content-bearing
tags preserve nested inline structure through `children`. Whitespace at a rich tag's outer content
boundary is insignificant; whitespace inside its child sequence remains
content. Rich tags participate in the inherited inline-depth budget.

## AEON Inline Typed Values

The typed-value form wraps one AEON anonymous typed scalar:

```text
[:TypeAnnotation = ScalarLiteral]
```

The `=` is mandatory. The earlier proposal spelling `[:date 2026-08-20]` is invalid. &ND uses AEON
type-annotation syntax, string escapes, literal recognition, reserved datatype aliases, compatibility
rules, and canonical scalar spelling. Reserved datatype names MUST match their AEON literal family.
Custom datatype names are accepted and their meaning remains consumer-defined.

The supported inline subset is closed:

| Literal family | Accepted datatype names |
| :------------- | :---------------------- |
| string | `string` |
| finite number | `number`, `n`, `int`, `int8`, `int16`, `int32`, `int64`, `uint`, `uint8`, `uint16`, `uint32`, `uint64`, `float`, `float32`, `float64` |
| non-finite number | `infinity`, `nan` |
| null | `null`, including generic domain claims such as `null<datetime>` |
| Boolean | `boolean`, `bool` |
| toggle | `toggle` |
| hex | `hex` |
| radix | `radix`, `decimal`, `radix2`, `radix6`, `radix8`, `radix12` |
| encoding | `encoding`, `base64`, `embed`, `inline` |
| temporal | `date`, `time`, `datetime`, `wtc` |
| separator | `sep`, `kadot` |
| SANSA address | `sansa` |
| supported scalar with consumer meaning | any valid custom AEON datatype name |

Applicable AEON generic arguments and clarifiers remain structured, including `null<datetime>`,
`radix[2]`, `encoding["base58"]`, and `sep["x"]`. Objects, lists, tuples, nodes, clone references,
pointer references, bindings, attributes, structural identities, nested typed values, trimticks,
`prose`, and multiline strings are not valid in this inline context. Canonical &ND output delegates
the enclosed annotation and scalar to these AEON canonical rules.
Generic datatype nesting uses AEON's default depth lock of one in the v2 reference parser.

The executable compatibility boundary is contract `and-v2-aeon-inline-scalar-v1` in
`cts/contracts/aeon-inline-scalar-v1.json`. It pins the accepted datatype names and aliases,
literal-family AST shapes, canonical &ND spelling, HTML projection, and exclusions against AEON
TypeScript package version `0.12.0`. The contract check is mandatory and dependency-free. A separate
drift check compares the same cases with the sibling AEON lexer, parser, and canonicalizer when those
built packages are available; an unavailable sibling checkout does not weaken or fail the standalone
&ND conformance check.

## Local Anchors and Fragment Links

Anchor identifiers and the identifier portion of local fragment-link targets use one portable grammar:

```text
local-id ::= [A-Za-z][A-Za-z0-9._:-]*
```

Matching is exact and case-sensitive. `[# id]` defines `id` in one document-wide namespace, including
inside nested blocks and extension fallbacks. A document MUST NOT define the same ID twice. An inherited
link whose target is `#id`, written `[@ #id | label]`, MUST resolve to an anchor in the same declared-v2
document; forward links are allowed. The link retains the inherited `NdLink` AST shape with
`href: "#id"` and rich label `children`. Canonical emission preserves the target and label exactly,
and HTML projection already emits the browser-native fragment link.

A standalone `parseInline` operation validates the `#id` target grammar but cannot resolve it without
a document namespace. Full duplicate and resolution checks occur during declared-v2 document parsing
and canonical emission. Declared-v1 documents retain their existing generic link behavior. Webpages
and external resources continue to use inherited targets such as
`[@ https://example.com | Example]`.

## Inline Images

The image form is:

```text
[~ source | alt]
[~ source | alt | mode]
```

`source` and `alt` are required, non-empty scalar fields. An escaped `\|` is data rather than a
field separator. The optional mode defaults to `inline`; when present it MUST be exactly `inline`,
`half`, or `full`. Canonical output always includes the resolved mode.

`inline` requests a height matched to the surrounding font size. `half` requests one half of the
image's intrinsic height and proportional width. `full` requests the intrinsic dimensions. These
are display intents: Core does not fetch, decode, inspect, or validate the referenced image and
therefore does not record pixel dimensions in the AST. Consumers remain responsible for source
resolution, loading policy, layout constraints, and failure presentation. Alt text is mandatory so
every conforming AST carries an accessible text alternative.
Image sources participate in the inherited `maxLinkTargetLength` resource budget.

The AST and canonical form retain the authored, escape-decoded `src`; Core never resolves it against
a filesystem path, process working directory, page URL, or document URL. The reference HTML renderer
accepts an optional explicit `imageBaseUrl`. Without it, safe relative references are emitted unchanged
and resolution belongs to the embedding HTML document. With it, relative and root-relative references
are resolved using the WHATWG URL algorithm. The base MUST be an absolute credential-free HTTP(S) URL;
an invalid base fails with `invalid_image_base_url`. Absolute HTTP(S) sources remain unchanged.

The reference HTML safety policy rejects non-HTTP(S) absolute schemes, credentialed URLs, and
protocol-relative sources. It preserves alt text while omitting unsafe source attributes. When an
authored relative source is resolved, the emitted `src` or `srcset` is absolute and the original value
is retained in `data-and-source`. The renderer does not emit a `<base>` element, fetch the resource, or
mutate the AST.

## Todo Lists

```ts
interface NdTodoList {
  readonly type: "todo_list";
  readonly items: NdTodoItem[];
}

interface NdTodoItem {
  readonly type: "todo_item";
  readonly state: "unchecked" | "checked" | "in_progress" | "cancelled";
  readonly children: NdBlockNode[];
}
```

The exact item prefixes are `- [ ] `, `- [x] `, `- [,] `, and `- [;] ` followed by non-empty inline
content. A contiguous unordered-list block containing one of these prefixes is a `todo_list`, not a
generic `list`. Its state marker becomes `todo_item.state` and is not retained as an inline child.

Every item in one list block MUST be the same kind. Mixing ordinary `- content` items and todo items
fails with `mixed_list_item_kinds`. Todo states are not accepted after ordered-list markers, and bare
`[x]`-style forms outside the unordered item prefix are rejected rather than parsed as generic inline
nodes. In v2, todo and ordinary lists may begin a two-space-indented nested list immediately after an
item without an intervening blank line. Other child blocks retain inherited boundaries. Canonical
output always spells `- [state] content`.

## Compact Inline Markers

```ts
interface NdDirectionalMarker {
  readonly type: "directional_marker";
  readonly direction: "forward" | "backward";
}

interface NdLineBreak {
  readonly type: "line_break";
}
```

Inline markers record author intent. In an unordered list item, a `directional_marker` that is the
first inline child of the paragraph head replaces that item's ordinary bullet in projection:

```and
- [>] advance while [<] remains inline
- [<] revisit
```

The leading marker remains in the inline AST; the list remains an inherited unordered `list`. This
permits directional and ordinary items to coexist and keeps nesting unchanged. Only the first inline
child has bullet-replacement intent. Later markers and every marker outside that position remain
inline. Ordered-list markers do not receive this behavior. Canonical output preserves the source
shape as `- [direction] content`.

## Footnotes

Footnotes use three exact forms:

```and
hello [% supporting context]
hello [% (A1) reusable context], again [% (A1)]
```

`[% content]` creates an anonymous definition and reference at that position. `[% (id) content]`
creates a named definition and its first reference. `[% (id)]` references the already-declared named
definition. IDs match `[A-Za-z0-9]+`, are case-sensitive, and are unique among named definitions.
A shorthand reference MUST follow its definition; unresolved and forward references are rejected.

Definition content is non-empty rich inline content and participates in the inherited inline-depth
budget. Footnotes cannot nest. An anonymous definition cannot be referenced again because it has no
authored ID. Canonical output preserves the applicable form exactly.

Core retains definition/reference structure and authored IDs. It does not choose superscript numbers,
symbols, hover cards, callouts, endnote placement, or backlinks. Those are projection policy. The
reference HTML renderer demonstrates numeric superscripts with linked endnotes and backlinks.

## Heading Addition

```ts
interface NdV2Heading extends NdHeading {
  readonly autoNumber?: true;
}
```

The field is present only when a heading begins with the exact v2 `[n] ` prefix followed by non-empty
content. `[n]` is contextual metadata rather than an inline node; missing separator space, empty
headings, and paragraph use are rejected.

## Auto-Number Lists

```ts
interface NdAutoNumberList {
  readonly type: "auto_number_list";
  readonly items: NdListItem[];
}
```

The exact item prefix is `- [n] ` followed by non-empty inline content. A contiguous block of these
items becomes `auto_number_list`; `[n]` is consumed as list intent and is not retained as an inline
child. Every item in the block MUST use the same kind. Mixing ordinary, todo, and auto-number items
fails with `mixed_list_item_kinds`. Explicit ordered markers such as `1. [n] item`, bare paragraph
markers, missing separator spaces, and empty items are rejected.

Auto-number lists use the same v2 immediate two-space nesting rule as ordinary and todo lists; other
child blocks retain inherited boundaries. Canonical output preserves `- [n] content`. Core records
participation in a sequence but does not calculate displayed numbers, sequence scope, restart
behavior, or formatting.

## Paired Blocks

```ts
interface NdHighlightParagraphBlock {
  readonly type: "highlight_paragraph_block";
  readonly children: NdInlineNode[];
}

interface NdStrongParagraphBlock {
  readonly type: "strong_paragraph_block";
  readonly children: NdInlineNode[];
}

interface NdEmphasisParagraphBlock {
  readonly type: "emphasis_paragraph_block";
  readonly children: NdInlineNode[];
}

interface NdUnderlineParagraphBlock {
  readonly type: "underline_paragraph_block";
  readonly children: NdInlineNode[];
}

interface NdHeaderTextBlock {
  readonly type: "header_text_block";
  readonly tag?: string;
  readonly children: NdInlineNode[];
}

interface NdDisclaimerBlock {
  readonly type: "disclaimer_block";
  readonly tag?: string;
  readonly children: NdInlineNode[];
}
```

The four formatted paragraph fences are exact and self-closing by matching delimiter:

| Fence | AST node | Paragraph-wide projection |
| :---- | :------- | :------------------------ |
| `~~~=` | `highlight_paragraph_block` | Highlight |
| `~~~*` | `strong_paragraph_block` | Strong |
| `~~~/` | `emphasis_paragraph_block` | Emphasis |
| `~~~_` | `underline_paragraph_block` | Underline |

Their payloads are non-empty rich inline content, not nested block documents. Empty and unclosed
forms reject with family-specific diagnostics. Plain `~~~` has no block meaning: it remains ordinary
paragraph text under both v1 and v2 and follows inherited soft-wrap canonicalization. Optional tags
on header and disclaimer blocks preserve the validated suffix from a tagged opener.

## Canonical Contract

Canonical emission requires both a profile and an effective version:

```js
emitCanonical(document, { profile: "standalone", version: "v2" });
emitCanonical(document, { profile: "embedded", version: "v2" });
```

Standalone v2 output begins with `&ND v2`; embedded output omits the declaration. Every promoted v2
node has a deterministic spelling, and emitting a v2-only node under version v1 MUST fail. The
executable proposal runner checks standalone and embedded parse–emit–parse structural equivalence
and canonical fixed-point stability for every accepted v2 fixture.

Machine-readable contract `and-v2-projection-v1` in `cts/contracts/v2-projection-v1.json` pins exact
standalone and embedded canonical text plus inert HTML for every promoted node family, marker state,
image mode, nested composition boundary, and unsafe-resource case. Its mandatory checker rejects
missing coverage identifiers and any byte-level snapshot drift. The same contract indexes the
required cross-form combinations: each paired block in lists and blockquotes, representative rich
children in each paired block, local links crossing container boundaries, rich resource nesting, and
contextual list-item content, leading directional bullet replacement, heading-number hierarchy, and
rich/reused footnotes, including rich children across every formatted paragraph family.

## Source Spans

When spans are requested, v2 nodes use the same optional `span` field and normalized source-offset
rules as v1 nodes. Spans are metadata and are excluded from structural round-trip comparison.
Contract `and-v2-projection-v1` pins 34 exact span assertions covering every promoted scalar and rich
inline family, heading auto-numbering, all paired blocks, escaped fields, datatype generics and
clarifiers, footnotes, nested rich resources, lists, and blockquotes.

## Stability

This contract is executable but remains proposal-stage. The scalar-versus-rich-content split and
the capability disposition above are now decisions for the first-draft candidate; lexical
constraints and projection snapshots may still tighten before v2 advances to draft.
