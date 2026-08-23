# Reference Parser

This is the reference parser for `&ND Core v1` and the executable `&ND Core v2` proposal lane.

Repository consumers that want the stable package boundary should now prefer importing from the
repo root entrypoint at [`index.mjs`](../../index.mjs). This folder remains the implementation home
for that public surface.

It is still deliberately small, but unlike the bootstrap subset adapter it exposes parser-facing
entrypoints:

* `parseAnd(source, options)`
* `parseInline(text, options)`

Current scope:

* strict-mode line normalization
* document AST output for the currently covered block forms
* inline scanning for `strong`, `emphasis`, `link`, and `inline code`
* inline AST output for text, strong, emphasis, link, and code nodes
* adjacent `+++fallback` blocks for extension fallback content
* escape validation
* compact strict-mode diagnostics with `code`, `line`, `column`, and inline `offset` when available
* opt-in source spans for document, block, and inline nodes via `parseAnd(source, { includeSpans: true })`
* normative resource budget enforcement for document size, line length, block count, block payload size,
  list item count, nesting depth, inline depth, table columns, and link target length
* raw code block margin checks
* inherited triple/quadruple backtick code fences, v1/v2 `~~~$` code fences, and v2-only `[n]`
  dollar-fence numbering
* the initial block-boundary and indentation rules covered by the CTS
* explicit v2 capability and effective-version selection through `allowV2` and `version`
* proposal-v2 scalar metadata tags, inline images, rich nested inline tags, compact directional and
  advisory list markers, footnote definitions/references, first-class todo and auto-number lists,
  heading auto-numbering, semantic wrappers, block-content cards, formatted/advisory paragraph blocks, and paired blocks
* exact AEON `:type = scalar` syntax for the closed v2 inline typed-value subset, including
  literal-family compatibility, structured datatype adornments, and custom labels
* proposal-v2 document-local anchor uniqueness and case-sensitive `[@ #id | label]` resolution
* effective-version metadata on successful document parse results
* v2-only structural escapes for literal block-command text at block-open positions

Run it against the CTS with:

```sh
node scripts/run-cts.mjs --adapter ./implementations/reference-parser/adapter.mjs
```

The implementation is now AST-producing for the fixture-covered subset.
It is not yet a complete parser, but the current CTS is its behavioral guardrail as the supported
grammar expands.

The emitted document shape follows the CTS AST contracts in
[`docs/spec/v1/and-ast-contract.md`](../../docs/spec/v1/and-ast-contract.md) and
[`docs/spec/v2/and-ast-contract.md`](../../docs/spec/v2/and-ast-contract.md). Table output uses
structured header/body cells with inline children; v2 adds optional logical-column alignments,
horizontal cell `colSpan`, and a rich inline table `caption` from an immediate `|~ caption` line.

The default remains v1-only. Standalone v2 input requires `&ND v2` plus `{ allowV2: true }`.
Headerless v2 input and standalone inline parsing require
`{ allowV2: true, version: "v2" }`. A successful `parseAnd` result includes a `version` field with
the value `"v1"` or `"v2"` beside the document AST.

For v2 input, `parseInline` validates the portable `#id` link-target grammar but cannot resolve it
without a document namespace. `parseAnd` accepts forward fragment links and rejects duplicate anchors
or unresolved local targets across the entire document, including nested blocks. V2 image tags use
`[~ source | alt | mode]`, default omitted modes to `inline`, and require `inline`, `half`, or `full`.
Named v2 footnote references resolve case-sensitively against one earlier shared v2-ID declaration;
duplicate, forward, unresolved, and nested footnotes fail closed.

Strict-mode failures currently return:

```json
{
  "ok": false,
  "errorCode": "invalid_header",
  "diagnostic": {
    "code": "invalid_header",
    "line": 1,
    "column": 1
  }
}
```

This is the reference parser's compact diagnostic shape. The broader spec error model may grow into
an array form once recovery mode and multi-diagnostic editor adapters exist.
