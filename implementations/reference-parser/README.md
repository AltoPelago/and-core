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
