# Reference HTML Renderer

This package contains the first reference projection from the `&ND` AST contract to inert HTML.

The renderer is intentionally not part of `&ND Core v1` parsing semantics. It exists so tools such
as the playground can preview documents through a stable projection boundary instead of embedding
ad-hoc DOM rendering logic.

## Contract

Input:

* an `NdDocument` AST following the v1 or proposal-v2 AST contract

Output:

* escaped HTML text
* either a fragment or a complete HTML document

The renderer MUST escape text, code, raw block payloads, extension payloads, and table cells. Link
targets are escaped as attributes and, by default, only web, mail, root-relative, path-relative, and
fragment URLs are emitted as clickable `href` values.

If an extension block includes parsed fallback content, the reference renderer emits that fallback
instead of the opaque primary extension payload. If an extension block has no fallback, the
reference renderer emits an explicit HTML diagnostic block naming the unsupported extension and
showing the opaque payload in escaped form.

Unsupported AST node types fail closed with stable error codes.

The proposal-v2 projection includes inert representations for scalar metadata tags, rich inline
tags, typed values, inline images, first-class todo and auto-number lists, direction markers,
explicit line breaks, heading auto-number intent, and footnote definitions/references,
highlighted paragraphs, header text, and disclaimers. Projection preserves nested inline structure
and emits inherited `#id` links as browser-native fragment links. The parser and canonical emitter
validate the v2 local-anchor and footnote graphs. The reference projection visibly numbers
auto-number headings and renders footnotes as linked numeric superscripts followed by an endnote
section with backlinks. These are renderer choices; Core records intent and reference structure but
does not calculate display labels. Projection does not perform external resource resolution,
custom-datatype interpretation, or extension execution. Reserved AEON datatype/literal
compatibility is already enforced by parsing and canonical emission. Image projection accepts only HTTP(S) and
relative sources, carries mandatory alt text, and exposes the resolved display mode through stable
classes and attributes.

Semantic `[(id) content]` and `~~~(id)` wrappers project as ordinary inline content and paragraphs.
Their IDs remain available to AST consumers but are intentionally absent from reference HTML text,
IDs, classes, and attributes.

For inherited unordered lists, a directional marker in the first inline position suppresses that
item's ordinary bullet and becomes an arrow list marker. Later directional markers remain inline.
The AST and canonical emitter preserve the same generic list and inline-marker structure.

Leading `- [?]` and `- [!]` markers use the same per-item bullet replacement while their content
stays visible. Inline rich question/admonition tags project as focusable icon callouts, while
`~~~?` and `~~~!` project as always-visible advisory paragraphs.
Rich `~~~'` block comments are preserved in inert HTML with the `hidden` attribute.

Formatted paragraph blocks project `~~~=` to `<mark>` semantics, `~~~*` to `<strong>`, `~~~/` to
`<em>`, and `~~~_` to `<u>` across the entire rich inline payload. Plain `~~~` remains ordinary
paragraph text rather than a block node.

Relative image sources are preserved by default. Consumers can pass
`{ imageBaseUrl: "https://example.test/path/document.and" }` to resolve them deterministically with
the WHATWG URL algorithm. The base must be an absolute credential-free HTTP(S) URL. Resolved output
retains the authored source in `data-and-source`; absolute HTTP(S) sources are left unchanged.
Protocol-relative, credentialed, and non-HTTP(S) sources are omitted while alt text is preserved.
