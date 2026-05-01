# fmt.and Reference

## 1. Status

This document is a **non-normative proposal reference** for the future `fmt.and.aes` /
`fmt.and.aeon` ecosystem profile.

It is intended to play the same role for `&ND` that `FMT_MD_REFERENCE.md` currently plays for
`fmt-md-model`: define the semantic node vocabulary that an AES-facing model package would own.

The normative source of language truth remains:

- [`and-core-proposal.md`](./and-core-proposal.md)
- [`and-canonical-rules.md`](./and-canonical-rules.md)
- [`and-ast-contract.md`](./and-ast-contract.md)

---

## 2. Purpose

`fmt.and` exists to bridge the `&ND` document language into the AES ecosystem without forcing each
consumer to invent its own ad hoc AEON node shape.

The intended split is:

1. `and-core` parses `&ND` text and emits canonical `&ND`
2. a future `fmt.and` model package projects between AES and a typed `&ND` document model
3. downstream tools such as AEOS or other materialisers consume that exported AES

This keeps:

- text parsing in `and-core`
- semantic document modeling in the tonic/model package
- presentation rendering in separate projectors

---

## 3. Pipeline

Recommended long-term pipeline:

1. standalone or embedded `&ND` text parses into `NdDocument` via `and-core`
2. `NdDocument` projects into a typed `FmtAndDocument`
3. `FmtAndDocument` exports to AES or minimized AEON
4. separate tools may emit canonical `&ND`, HTML, or other projections from the document model

Alternative AES-first pipeline:

1. AES is projected directly into `FmtAndDocument`
2. the document model exports back to AES
3. `and-core` canonical emission is used only when textual `&ND` is needed

This is analogous to the `fmt-md-model` design:

- the model owns semantic projection
- text and HTML projection remain separate concerns

---

## 4. Root

The root should be a top-level AEON `node` binding with tag `document`.

Example:

```aeon
doc:node = <document(
  <heading@{level:number=1}("Hello World")>,
  <paragraph("This is ", <strong("important")>, ".")>
)>
```

If no explicit root key is provided, a future `fmt.and` model package should select the first
top-level `document` node not under reserved `aeon:` bindings.

---

## 5. Recommended Vocabulary

The first `fmt.and` vocabulary should stay as close as possible to the strict `and-core` AST
contract.

That reduces impedance between:

- parsed `&ND`
- typed model objects
- exported AES

### 5.1 Root

```ts
interface FmtAndDocumentNode {
  readonly type: 'document';
  children: FmtAndBlockNode[];
}
```

### 5.2 Block Nodes

```ts
interface FmtAndParagraphNode {
  readonly type: 'paragraph';
  children: FmtAndInlineNode[];
}

interface FmtAndHeadingNode {
  readonly type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: FmtAndInlineNode[];
}

interface FmtAndListNode {
  readonly type: 'list';
  ordered: boolean;
  children: FmtAndListItemNode[];
}

interface FmtAndListItemNode {
  readonly type: 'list_item';
  children: FmtAndBlockNode[];
}

interface FmtAndBlockquoteNode {
  readonly type: 'blockquote';
  children: FmtAndBlockNode[];
}

interface FmtAndCodeBlockNode {
  readonly type: 'code_block';
  language?: string;
  ordered: boolean;
  text: string;
}

interface FmtAndExtensionBlockNode {
  readonly type: 'extension_block';
  name: string;
  text: string;
  fallback?: FmtAndDocumentFragmentNode;
}

interface FmtAndDocumentFragmentNode {
  readonly type: 'document_fragment';
  children: FmtAndBlockNode[];
}

interface FmtAndTableNode {
  readonly type: 'table';
  header: FmtAndTableCellNode[];
  rows: FmtAndTableCellNode[][];
}

interface FmtAndTableCellNode {
  children: FmtAndInlineNode[];
}

interface FmtAndHorizontalRuleNode {
  readonly type: 'horizontal_rule';
}
```

### 5.3 Inline Nodes

```ts
interface FmtAndTextNode {
  readonly type: 'text';
  text: string;
}

interface FmtAndStrongNode {
  readonly type: 'strong';
  children: FmtAndInlineNode[];
}

interface FmtAndEmphasisNode {
  readonly type: 'emphasis';
  children: FmtAndInlineNode[];
}

interface FmtAndCodeNode {
  readonly type: 'code';
  text: string;
}

interface FmtAndLinkNode {
  readonly type: 'link';
  href: string;
  children: FmtAndInlineNode[];
}
```

Suggested unions:

```ts
type FmtAndBlockNode =
  | FmtAndParagraphNode
  | FmtAndHeadingNode
  | FmtAndListNode
  | FmtAndBlockquoteNode
  | FmtAndCodeBlockNode
  | FmtAndExtensionBlockNode
  | FmtAndTableNode
  | FmtAndHorizontalRuleNode;

type FmtAndInlineNode =
  | FmtAndTextNode
  | FmtAndStrongNode
  | FmtAndEmphasisNode
  | FmtAndCodeNode
  | FmtAndLinkNode;
```

---

## 6. Mapping Principles

### 6.1 Prefer Semantic Fidelity Over Source Fidelity

The model should preserve the document structure and meaning, not the author's original wrapping,
spacing, or fence style.

That means:

- paragraph soft wraps are not preserved as authored line boundaries
- code block content is preserved as raw payload text
- extension payload text is preserved as raw payload text
- table structure is preserved as parsed cells, not raw row strings

### 6.2 Stay Close To The AST Contract

Where possible, node names and field names should align with the `and-core` AST contract.

That reduces:

- projection complexity
- test duplication
- cognitive mismatch between parser AST and AES model

### 6.3 Preserve Opaque Payload Boundaries

`extension_block.text` and `code_block.text` should remain raw text payloads.
The model must not reinterpret extension payloads structurally.

### 6.4 Fallback Belongs To The Extension Node

`+++fallback` is not an independent top-level semantic node.
It is a local child property of the immediately preceding `extension_block`.

The model should therefore attach fallback content directly to the extension block node.

---

## 7. What The Future Model Package Should Own

A future package such as `@aeon-tonics/fmt-and-model` should own:

- `createFmtAndDocumentFromAeon(input, options)`
- `createFmtAndDocumentFromAes(events, options)`
- `exportFmtAndAes(document)`
- `exportFmtAndAeon(document, options)`
- typed document node interfaces
- validation that incoming AES matches the supported `fmt.and` vocabulary

Likely convenience helpers:

- `createFmtAndDocumentFromNdDocument(document)`
- `toNdDocument(document)`
- `parseFmtAndDocument(source, options)` using `and-core`
- `emitFmtAndCanonical(document, options)` using `and-core`

That package should not own:

- the normative text parser
- the canonical emitter itself
- HTML rendering rules

Those stay in `and-core` or in separate renderer/projector packages.

---

## 8. Readiness Criteria

Work on the AES-facing `fmt.and` package can start once the following are true:

1. `and-core` has a public root import surface
2. the strict AST contract is considered stable enough for external consumers
3. the node vocabulary in this document is accepted as the initial `fmt.and` profile
4. examples can demonstrate:
   - `&ND text -> AST`
   - `AST -> FmtAndDocument`
   - `FmtAndDocument -> AES`
   - `AES -> FmtAndDocument`

Before that point, the design work can still proceed, but implementation should stay provisional.

---

## 9. Recommendation

Treat `fmt.and` as the first AES-native semantic profile for `&ND`, not as a replacement for
`and-core`.

Recommended sequence:

1. freeze the `and-core` public API
2. finalize the initial `fmt.and` node vocabulary
3. implement `@aeon-tonics/fmt-and-model`
4. later add optional projectors such as:
   - canonical `&ND` text
   - HTML
   - editor/document tooling bridges

This keeps the architecture consistent with the rest of the AEON ecosystem:

- core format implementation first
- tonic/model layer second
- materialisers and projectors third
