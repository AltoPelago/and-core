# Reference Parser

This is the first parser-shaped `&ND Core v1` implementation.

It is still deliberately small, but unlike the bootstrap subset adapter it exposes parser-facing
entrypoints:

* `parseAnd(source, options)`
* `parseInline(text, options)`

Current scope:

* strict-mode line normalization
* inline scanning for `strong`, `emphasis`, `link`, and `inline code`
* escape validation
* link-target budget enforcement
* raw code block margin checks
* the initial block-boundary and indentation rules covered by the CTS

Run it against the CTS with:

```sh
node scripts/run-cts.mjs --adapter ./implementations/reference-parser/adapter.mjs
```

The implementation is not yet a complete AST-producing parser.
It is the starting point for that parser, with the current CTS as its behavioral guardrail.
