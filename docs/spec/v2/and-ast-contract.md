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

## Inherited Nodes

The complete v1 block and inline node unions remain valid in v2. A v2-capable reader MUST preserve
the same fields and containment relationships for inherited syntax.

`NdInlineNode` gains the nodes below. `NdBlockNode` gains the three paired-block nodes below, and
`NdHeading` gains the optional `autoNumber` field.

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
| `[ ]`, `[x]`, `[,]`, `[;]`, `[>]`, `[<]`, `[%]`, `[.]` | Core | Stable author-intent markers; display and numbering are projections. |
| heading `[n]` | Core | Stable heading field; number calculation is outside Core. |
| `~~~=`, `===`, `***` paired blocks | Core | Stable block structure; optional tag vocabularies are consumer-defined. |
| `[^ ...]` and all other unpromoted reserved forms | Deferred | Rejected by v2 strict mode. |

“Core syntax + convention” remains part of the single v2 strict grammar. It means Core guarantees
the parse shape and canonical spelling while deliberately declining to standardize a consumer
vocabulary, workflow, or visual treatment.

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

## Compact Inline Markers

```ts
interface NdTodoMarker {
  readonly type: "todo_marker";
  readonly state: "unchecked" | "checked" | "in_progress" | "cancelled";
}

interface NdDirectionalMarker {
  readonly type: "directional_marker";
  readonly direction: "forward" | "backward";
}

interface NdAutoNumberMarker {
  readonly type: "auto_number_marker";
}

interface NdLineBreak {
  readonly type: "line_break";
}
```

Markers record author intent. Core parsing does not calculate display numbers or mutate surrounding
list structure.

## Heading Addition

```ts
interface NdV2Heading extends NdHeading {
  readonly autoNumber?: true;
}
```

The field is present only when a heading begins with the v2 `[n]` marker.

## Paired Blocks

```ts
interface NdHighlightParagraphBlock {
  readonly type: "highlight_paragraph_block";
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

Paired-block payloads are inline content, not nested block documents. Optional tags preserve the
validated suffix from a tagged opener.

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

## Source Spans

When spans are requested, v2 nodes use the same optional `span` field and normalized source-offset
rules as v1 nodes. Spans are metadata and are excluded from structural round-trip comparison.

## Stability

This contract is executable but remains proposal-stage. The scalar-versus-rich-content split and
the capability disposition above are now decisions for the first-draft candidate; lexical
constraints and projection snapshots may still tighten before v2 advances to draft.
