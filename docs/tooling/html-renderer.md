# `&ND` HTML Renderer

The HTML renderer is a projection from the `&ND` AST contract to escaped HTML. It is tooling, not
core language semantics.

## Boundary

The renderer accepts an `NdDocument` AST and returns HTML text. It does not parse source text, run
canonicalization, recover invalid documents, or define how `&ND` must be styled.

This separation keeps the pipeline explicit:

1. parse `&ND` source into AST
2. optionally canonicalize the AST back to text
3. project the AST to HTML for preview, publishing, or product surfaces

## Current Reference Implementation

The first implementation lives in
[`implementations/reference-html/renderer.mjs`](../../implementations/reference-html/renderer.mjs).

It supports:

* paragraphs, headings, horizontal rules, blockquotes, lists, code blocks, ordered code blocks, extension blocks, and tables
* text, strong, emphasis, inline code, and links
* parsed extension fallback content from adjacent `+++fallback` blocks
* explicit diagnostics for unsupported extension blocks that do not provide fallback content
* escaped fragment output by default
* complete HTML document output with `{ fragment: false }`
* fail-closed errors for unsupported AST nodes

The local CLI exposes the same projection:

```sh
npm run and -- render-html examples/minimal.and
npm run and -- render-html examples/minimal.and --document --out output.html
```

## Safety Behavior

All text-bearing AST payloads are escaped before output. Link targets are attribute-escaped, and the
default renderer only emits clickable `href` values for:

* `http:`
* `https:`
* `mailto:`
* root-relative paths
* path-relative paths
* fragment links

Other link targets are rendered as disabled anchors with their labels preserved.

For `http:` and `https:` links, the reference renderer also emits conservative browser-facing
attributes:

* `target="_blank"`
* `rel="noopener noreferrer nofollow"`
* `referrerpolicy="no-referrer"`

This keeps preview surfaces safer by default and avoids treating presentation-layer links as fully
trusted navigation.

When the renderer encounters an extension block without parsed fallback content, it emits a visible
diagnostic block in the HTML output. The diagnostic names the unsupported extension and preserves
its opaque payload inside escaped `<pre><code>` content so preview surfaces can stay honest without
executing or guessing extension semantics.

Ordered code blocks are projected distinctly from plain code blocks. The reference renderer emits an
ordered list of escaped code lines so preview surfaces can show explicit line numbers without
guessing from styling alone.

This does not make arbitrary downstream HTML usage safe by itself. Consumers that combine rendered
HTML with additional user content, scripts, templates, or framework-specific hydration still need
their own product-level safety checks.
