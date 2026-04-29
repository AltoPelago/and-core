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

1. Parse source with the reference parser.
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
* stable diagnostics
* canonical output
* AST/spans inspection

The current preview uses the reference HTML renderer documented in
[`html-renderer.md`](./html-renderer.md). Rendering remains outside `&ND Core v1`.
