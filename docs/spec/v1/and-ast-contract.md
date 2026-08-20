# &ND Core v1 AST Contract

This document defines the AST interchange shape currently used by the `&ND Core v1` CTS
`expected.document` fixtures.

The contract is intentionally smaller than a full implementation AST. Implementations MAY keep
additional metadata internally, but CTS document comparison only relies on the fields defined here.

## Stability

The following parts are normative for CTS fixtures that contain `expected.document`:

- node `type` strings
- child containment fields
- inline text/code payload fields
- block-specific fields listed below
- array order

The following parts are provisional and MAY be revised before `v1` is frozen:

- source location metadata
- diagnostics attached to AST nodes
- recovery-mode partial AST shape

Strict-mode parse failures MUST NOT produce a document AST.

## Root

```ts
interface NdDocument {
  readonly type: "document";
  readonly children: NdBlockNode[];
}
```

`children` preserves source order after line-ending normalization.

## Block Nodes

### Paragraph

```ts
interface NdParagraph {
  readonly type: "paragraph";
  readonly children: NdInlineNode[];
}
```

Paragraph content is represented as inline children.

### Heading

```ts
interface NdHeading {
  readonly type: "heading";
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  readonly children: NdInlineNode[];
}
```

`level` is the number of heading marker characters.

### List

```ts
interface NdList {
  readonly type: "list";
  readonly ordered: boolean;
  readonly items: NdListItem[];
}

interface NdListItem {
  readonly type: "list_item";
  readonly children: NdBlockNode[];
}
```

List item `children` are block nodes. A simple text item is represented as a paragraph child.

### Blockquote

```ts
interface NdBlockquote {
  readonly type: "blockquote";
  readonly children: NdBlockNode[];
}
```

The `>` marker is structural syntax, not a child node. Quoted content is parsed as an inner block
context.

### Code Block

```ts
interface NdCodeBlock {
  readonly type: "code_block";
  readonly language: string | null;
  readonly ordered: boolean;
  readonly text: string;
}
```

`text` is the raw payload after line-ending normalization and margin removal. It does not include
opening or closing fences. `ordered` is `true` when the block was opened with a quadruple backtick
and requests explicit line ordering in downstream projections. V1 accepts triple/quadruple backtick
fences plus unnumbered `~~~$` and `~~~$ language` fences. Dollar fences always produce
`ordered: false`; `[n]` after `~~~$` is v2-only and invalid in v1. Canonical v1 output prefers
backticks and uses `~~~$` when a plain-code payload contains an exact triple-backtick line. The removed `~~~language` / `~~~~language` alternatives reject with
`deprecated_code_fence`; bare `~~~` remains paragraph text.

### Extension Block

```ts
interface NdExtensionBlock {
  readonly type: "extension_block";
  readonly name: string;
  readonly text: string;
  readonly fallback?: NdDocumentFragment;
}

interface NdDocumentFragment {
  readonly type: "document_fragment";
  readonly children: NdBlockNode[];
}
```

`name` is the validated extension name from the opening fence, excluding the `+++` marker. `text`
is the opaque primary payload after line-ending normalization and margin removal. It does not
include opening or closing fences, and no inline or block parsing occurs inside it.

When present, `fallback` contains ordinary parsed `&ND` block nodes from an immediately adjacent
reserved `+++fallback` block.

### Table

```ts
interface NdTable {
  readonly type: "table";
  readonly header: NdTableCell[];
  readonly rows: NdTableCell[][];
}

interface NdTableCell {
  readonly children: NdInlineNode[];
}
```

`header` contains the parsed header cells. `rows` contains body rows only; the separator row is
syntax and MUST NOT appear in the AST. Cell content is represented as inline children after normal
inline parsing and escape handling.

When source spans are exposed, inline spans inside table cells SHOULD point at the trimmed cell
content, excluding table delimiter pipes and surrounding cell padding. The table block span SHOULD
still cover the full table source range.

### Horizontal Rule

```ts
interface NdHorizontalRule {
  readonly type: "horizontal_rule";
}
```

## Inline Nodes

### Text

```ts
interface NdText {
  readonly type: "text";
  readonly value: string;
}
```

`value` is escaped text after escape resolution.
For multiline paragraphs, normalized line breaks are preserved as `\n` inside text values.
Canonical emitters treat those line breaks as paragraph soft wraps and emit each as a single space.

### Strong

```ts
interface NdStrong {
  readonly type: "strong";
  readonly children: NdInlineNode[];
}
```

`strong` marks stronger importance or prominence. It does not prescribe visual styling.

### Emphasis

```ts
interface NdEmphasis {
  readonly type: "emphasis";
  readonly children: NdInlineNode[];
}
```

`emphasis` marks emphasized content. It does not prescribe visual styling.

### Link

```ts
interface NdLink {
  readonly type: "link";
  readonly href: string;
  readonly children: NdInlineNode[];
}
```

`href` is the resolved link target after escape handling.

### Inline Code

```ts
interface NdInlineCode {
  readonly type: "code";
  readonly text: string;
}
```

`text` is delimiter-opaque payload after inline-code escape handling. Nested inline nodes are not
parsed inside inline code.

## Metadata

Implementations SHOULD track source spans for diagnostics and editor integrations, but source spans
are not included in CTS `expected.document` fixtures yet.

The reference parser currently exposes spans only when explicitly requested. Its span-bearing
surface covers the document node, block nodes, and inline nodes.

Recommended metadata:

```ts
interface NdSpan {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}
```

Span ranges use inclusive starts and exclusive ends. `startLine`, `startColumn`, `endLine`, and
`endColumn` are one-based. Offsets are measured in the normalized source consumed by the parser.

## Span Guarantees

When an implementation exposes spans publicly, the following guarantees SHOULD be treated as stable:

* node spans refer to the normalized strict-mode source consumed by the parser
* `startOffset` is inclusive and `endOffset` is exclusive
* line/column coordinates are one-based
* block node spans cover the structural source owned by that block
* inline node spans cover the exact inline source that produced that node after trimming any
  enclosing structural delimiters
* nested block spans exclude blank separator lines that belong to an enclosing structure rather than
  to the nested block itself

Current CTS metadata fixtures specifically pin:

* trimmed table-cell inline spans
* attached extension-fallback paragraph and inline spans
* nested list-item and blockquote paragraph spans

Implementations still have some latitude:

* spans are optional unless the implementation chooses to expose them
* additive metadata beyond `span` remains implementation-defined
* internal span-tracking strategy is unconstrained as long as the exposed results obey the stable
  guarantees above

If exposed publicly, metadata SHOULD be additive and MUST NOT alter the semantic node fields above.

## CTS Comparison

CTS document comparison is exact JSON structural comparison for adapters that declare document
capability.

Adapters that do not declare document capability may still run the same fixtures, but
`expected.document` checks are reported as skipped.

Adapters that declare document capability MUST return the contract shape above for all fixture
fields currently covered by `expected.document`.
