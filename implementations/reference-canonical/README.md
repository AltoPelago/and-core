# Reference Canonical Emitter

This is the first canonical-emission scaffold for `&ND Core v1`.

It emits canonical text from the CTS AST contract shape documented in
[`docs/spec/v1/and-ast-contract.md`](../../docs/spec/v1/and-ast-contract.md).

Current scope:

* paragraphs with single-line inline text
* headings
* lists with paragraph heads and nested block children
* blockquotes
* code blocks
* extension blocks
* tables
* horizontal rules
* inline text, strong, emphasis, links, and inline code

Known limitation:

* multiline paragraph text is rejected with `unsupported_multiline_inline_text`

That limitation is intentional for now. The AST contract currently preserves paragraph line breaks,
while canonical form emits paragraphs as one logical line. The emitter should not silently choose a
collapse policy until that bridge is pinned by spec and CTS fixtures.

The default output omits the standalone `&ND v1` header so emitted text can be reparsed by the
current reference parser. Pass `{ header: true }` to emit a standalone-style header once parser
support for headers exists.
