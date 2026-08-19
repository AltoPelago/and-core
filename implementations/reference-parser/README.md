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
* the initial block-boundary and indentation rules covered by the CTS
* explicit v2 capability and effective-version selection through `allowV2` and `version`
* proposal-v2 inline tags, compact markers, heading auto-numbering, and paired blocks
* effective-version metadata on successful document parse results

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
structured header/body cells with inline children, matching the current CTS contract.

The default remains v1-only. Standalone v2 input requires `&ND v2` plus `{ allowV2: true }`.
Headerless v2 input and standalone inline parsing require
`{ allowV2: true, version: "v2" }`. A successful `parseAnd` result includes a `version` field with
the value `"v1"` or `"v2"` beside the document AST.

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
