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
tags, typed values, inline images, todo and direction markers, explicit line breaks, auto-number intent,
highlighted paragraphs, header text, and disclaimers. Projection preserves nested inline structure
and emits inherited `#id` links as browser-native fragment links. The parser and canonical emitter
validate the v2 local-anchor graph; projection does not perform numbering, external resource
resolution, datatype validation, or extension execution. Image projection accepts only HTTP(S) and
relative sources, carries mandatory alt text, and exposes the resolved display mode through stable
classes and attributes.
