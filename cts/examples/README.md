# CTS Adapter Examples

This directory contains copyable CTS adapter examples.

## Baseline Adapter

[`baseline-adapter.mjs`](./baseline-adapter.mjs) demonstrates the smallest useful adapter shape.
It checks parse outcome and stable error codes only. It does not declare `document` or `spans`
capabilities, so semantic AST and metadata lanes are reported as skipped.

Run it with:

```sh
npm run cts:run:example
```

This example imports the in-repository reference parser only to keep the sample runnable. A
third-party implementation would replace that import with its own parser.
