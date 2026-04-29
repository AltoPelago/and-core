# `&ND` Playground Proposal

An `&ND` playground would make the language easier to learn, test, and integrate. The likely shape
is similar to the AEON playground: editable source on the left, processed views on the right.

## Goals

* give authors immediate feedback while writing `&ND`
* expose strict parser diagnostics with line and column locations
* show canonical `&ND` output for stable formatting and diffing
* show AST and span metadata for implementers and editor tooling
* eventually preview rendered output such as HTML without making HTML part of the core language

## Suggested Layout

The left pane is an `&ND` editor.

The right pane uses tabs:

* `Canonical`: canonical `&ND` text emitted from the parsed AST
* `AST`: parsed document JSON, optionally including spans
* `Diagnostics`: parse result, error code, line, and column
* `Preview`: processed HTML or another renderer output once rendering tools exist

## Processing Pipeline

The playground should keep the same separation as the repository:

1. Parse source with the reference parser.
2. If parsing succeeds, emit canonical text with the canonical emitter.
3. Optionally show AST/spans for debugging and editor-tooling work.
4. Optionally pass the AST to a renderer for HTML preview.

Rendering should be treated as a projection, not as part of `&ND Core v1`. This keeps the core
document language deterministic and non-executable while still supporting useful product surfaces.

## Implementation Notes

Initial implementation can be client-side if the reference parser and canonical emitter are bundled
for the browser. A server-backed implementation is also fine if future renderers need heavier
dependencies.

The first version should prioritize:

* strict-mode parsing
* stable diagnostics
* canonical output
* AST/spans inspection

HTML preview can follow once a renderer contract exists.
