# `&ND` Playground

The `&ND` playground makes the language easier to learn, test, and integrate. Its shape is similar
to the AEON playground: editable source on the left, processed views on the right.

## Current Prototype

The first prototype is a static browser app in [`playground/`](../../playground/). It uses the
reference parser and canonical emitter directly as ES modules, so it does not need a bundler.

Run it locally with:

```sh
npm run playground
```

Then open:

```text
http://localhost:4173/playground/
```

The smoke check verifies that the page is wired to the parser and canonical emitter:

```sh
npm run playground:check
```

The source header includes an explicit parser selector. `v1` remains the default; selecting the
`v2 proposal` enables v2 capability and supplies v2 as the effective version for headerless input.
The adjacent example selector provides version-aware v1 and v2 documents. Choosing an example loads
its source and parser version together, and Reset restores the currently selected example.

## Parser Budgets

The source pane includes optional parser-budget controls for hostile-input and agent workflow
testing. These fields map directly to the reference parser budget names:

* `Line` → `maxLineLength`
* `Doc` → `maxDocumentSize`
* `Blocks` → `maxBlockCount`
* `Items` → `maxListItemCount`
* `Depth` → `maxNestingDepth`
* `Inline` → `maxInlineDepth`
* `Columns` → `maxTableColumns`
* `Raw` → `maxBlockSize`
* `Link` → `maxLinkTargetLength`

Leaving a field empty means no explicit playground limit for that budget. Setting a field passes the
configured value into `parseAnd(source, { budgets })`, and budget exhaustion is surfaced as
`nd_budget_exceeded` in the diagnostics tab.

Budgets are intentionally a parser guardrail, not a formatting feature. They are useful when testing
resource boundaries, validating CTS budget fixtures, or checking that agent-generated documents fail
closed before expensive parsing or rendering work begins.

## Goals

* give authors immediate feedback while writing `&ND`
* expose strict parser diagnostics with line and column locations
* show canonical `&ND` output for stable formatting and diffing
* show AST and span metadata for implementers and editor tooling
* eventually preview rendered output such as HTML without making HTML part of the core language

## Layout

The left pane is an `&ND` editor.

The right pane uses tabs:

* `Canonical`: canonical `&ND` text emitted from the parsed AST
* `AST`: parsed document JSON, optionally including spans
* `Diagnostics`: parse result, error code, line, and column
* `HTML`: escaped HTML fragment emitted by the reference renderer
* `Preview`: HTML projection for author feedback

## Processing Pipeline

The playground should keep the same separation as the repository:

1. Parse source with the selected effective version and any explicit playground budgets.
2. If parsing succeeds, emit canonical text with the canonical emitter.
3. Optionally show AST/spans for debugging and editor-tooling work.
4. Optionally pass the AST to a renderer for HTML preview.

Rendering should be treated as a projection, not as part of `&ND Core v1`. This keeps the core
document language deterministic and non-executable while still supporting useful product surfaces.

## Implementation Notes

The current implementation is client-side and intentionally small. The local server serves the repo
root because the playground imports parser and emitter modules from sibling implementation folders.
A server-backed implementation is still acceptable later if renderers need heavier dependencies.

The first version should prioritize:

* strict-mode parsing
* explicit parser-budget testing
* stable diagnostics
* canonical output
* AST/spans inspection

The current preview uses the reference HTML renderer documented in
[`html-renderer.md`](./html-renderer.md). Rendering remains outside `&ND Core v1`.
