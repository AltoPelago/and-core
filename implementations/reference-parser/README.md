# Reference Parser

This is the first parser-shaped `&ND Core v1` implementation.

It is still deliberately small, but unlike the bootstrap subset adapter it exposes parser-facing
entrypoints:

* `parseAnd(source, options)`
* `parseInline(text, options)`

Current scope:

* strict-mode line normalization
* document AST output for the currently covered block forms
* inline scanning for `strong`, `emphasis`, `link`, and `inline code`
* inline AST output for text, strong, emphasis, link, and code nodes
* escape validation
* compact strict-mode diagnostics with `code`, `line`, `column`, and inline `offset` when available
* opt-in source spans for document, block, and inline nodes via `parseAnd(source, { includeSpans: true })`
* link-target budget enforcement
* raw code block margin checks
* the initial block-boundary and indentation rules covered by the CTS

Run it against the CTS with:

```sh
node scripts/run-cts.mjs --adapter ./implementations/reference-parser/adapter.mjs
```

The implementation is now AST-producing for the fixture-covered subset.
It is not yet a complete parser, but the current CTS is its behavioral guardrail as the supported
grammar expands.

The emitted document shape follows the CTS AST contract in
[`docs/spec/v1/and-ast-contract.md`](../../docs/spec/v1/and-ast-contract.md). Table output uses
structured header/body cells with inline children, matching the current CTS contract.

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
