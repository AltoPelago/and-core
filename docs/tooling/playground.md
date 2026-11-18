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

## Semantic &ND ↔ Aeon and SANSA playground

A second workspace at [`playground/semantic/`](../../playground/semantic/index.html)
uses the compact local header, toolbar, full-height panes, and bottom diagnostics
layout shared by the AEON and SANSA repo playgrounds. **Convert** shows editable
&ND and Aeon panes side by side. **Query** keeps Aeon on the left and places the
SANSA editor above results on the right. Narrow screens stack the active panes.
Switching views retains both documents, the query, and current results; the active
view is restored with the browser-local draft.

Install the isolated semantic runtime once, then start the existing local server:

```sh
npm ci --prefix examples/v2-aeon-roundtrip
npm run playground
```

Open `http://localhost:4173/playground/semantic/`. The parser playground links to
this workspace too. An alternate port can be selected with `npm run playground -- 4174`.

- **&ND → Aeon** updates the Aeon editor using the semantic vocabulary.
- **Aeon → &ND** updates the &ND editor with canonical v2 text.
- Each conversion verifies the semantic round trip. Editing either pane does not
  automatically overwrite the other pane.
- All three editors have live syntax highlighting and synchronized line numbers.
  AEON uses the shared lexer-backed renderer; standalone &ND v2 and SANSA add
  language-specific presentation. Incomplete text stays editable and highlighted;
  validation continues to use the actual parsers.
- **Run query** evaluates the current Aeon editor with the real SDK/SANSA runtime,
  without silently normalizing it. Source-free native AEON can also be queried.
- Presets cover headings, prose, links, task symbols, footnotes, extensions,
  typed values, and fallbacks. The 19 presets include descriptions explaining text
  traversal and property boundaries. Ctrl/Cmd+Enter runs the query.
- Successful query results are displayed as highlighted Aeon,
  including native numbers, dates, symbols, null reasons, and selected subtrees.
  **Values-only** is the default. Both views always use a standalone AEON document
  with a `results = [...]` list: zero, one and many values have the same shape.
  Each selected binding contributes one element; empty selections contribute none.
  Actual selected lists and node subtrees remain intact. Ordering and duplicate
  occurrences are retained. **Show metadata** adds address/kind/value records for
  those same elements. The count reports selected values, not candidate nodes.
  The toggle redraws cached results without rerunning the query, and its preference
  is saved with the local draft. Source/query edits or errors invalidate the cache.
  Intrinsic document fields named `address`, `kind`, or `value` remain data in both
  views. Significant native annotations remain on the value assignment.
  A selected `NodeHead` displays its tagged content with `kind="NodeHead"` in
  metadata view. Computed projections use their candidate address and kind
  `scalar` or `object`. Projected objects use AEON assignments rather than JSON.
- Query diagnostics and empty results appear separately from conversion status.
  Results become stale when the Aeon or query text changes.
- Drafts are retained in this browser's local storage. **Restore example** replaces
  the editors with the bundled sample and initial query.

The semantic workspace uses local JSON endpoints under `/api/semantic/`, reusing
[`bridge.mjs`](../../examples/v2-aeon-roundtrip/bridge.mjs) and the pinned native
runtime. It requires the Node server; opening the HTML directly or using an
unrelated static server does not provide those endpoints. The server binds only
to loopback. No external hosting or document persistence service is required.
Inputs are bounded to 262,144 characters; queries to 16,384 characters.
Highlighted markup is produced only by source-escaping renderers, and cross-origin
API requests are rejected. Native query values are formatted before JSON transport,
so large numeric lexemes, non-finite values, and symbol types are not lost in it.
The result adapter uses public `@altopelago/sansa/query-metadata` accessors and original parser
spans for source-backed selections. References remain references; displayed
selection results do not automatically include all external reference targets.

The shared AEON highlighter is currently unpublished. Its small MIT renderer is
vendored with an exact source revision and license under
[`playground/semantic/vendor/`](../../playground/semantic/vendor/README.md), and uses
the example's pinned lexer. No sibling checkout or browser CDN is required.

Run the runtime/integration checks with:

```sh
npm run playground:semantic:check
node scripts/check-semantic-playground.mjs --http
```

The HTTP checks require permission to open a temporary listening socket. These
checks complement the semantic example's fixture suite and run after dependency
installation in CI.

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

The original parser workspace is client-side and intentionally small. The local server serves the repo
root because the playground imports parser and emitter modules from sibling implementation folders.
The semantic workspace uses the same server for its heavier AEON/SANSA runtime.

The first version should prioritize:

* strict-mode parsing
* explicit parser-budget testing
* stable diagnostics
* canonical output
* AST/spans inspection

The current preview uses the reference HTML renderer documented in
[`html-renderer.md`](./html-renderer.md). Rendering remains outside `&ND Core v1`.


### Relationship to the SANSA repository playground

The source playground in `AltoPelago/sansa` separates evaluation from its
`queryValueText` / `renderQueryResults` presentation functions. Its current query
view always prefixes candidate addresses; binding sets show `address = value`,
scalar results display values, and object projections use JSON. Its resolve view
also displays the binding kind. It has no values-only/metadata toggle.

This workspace follows the same evaluation/presentation boundary while adding an
explicit metadata toggle and retaining native Aeon formatting for all result views.
No SANSA query syntax, traversal, selection, or comparison rule is changed.


### Versioned semantic and result contracts

The [semantic vocabulary](../../examples/v2-aeon-roundtrip/SEMANTIC-PROFILE.md)
is frozen as candidate `and-document-semantic-example-2`, with a machine-readable
node/property/containment manifest and fail-closed decoding. The source &ND v2
language remains proposal-stage. Breaking vocabulary changes need a new identifier.

The [query cookbook](../../examples/v2-aeon-roundtrip/QUERIES.md) is generated from
the actual presets; executable checks assert representative content and counts.
Presentation format `and-query-results-v1` exposes `valueCount` and `candidateCount`
and stable list-shaped AEON output in both views. It flattens engine Binding Sets,
not native selected collections. Raw engine result grouping remains available in
the response. A query over every ancestor can still return overlapping text.

The new public SANSA metadata API is included through an integrity-pinned local
[package snapshot](../../examples/v2-aeon-roundtrip/vendor/README.md), not a
published release. The example no longer inspects private SANSA properties.
