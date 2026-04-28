# Reference Canonical Emitter

This is the first canonical-emission scaffold for `&ND Core v1`.

It emits canonical text from the CTS AST contract shape documented in
[`docs/spec/v1/and-ast-contract.md`](../../docs/spec/v1/and-ast-contract.md).

Current scope:

* paragraphs, including soft-wrapped paragraph text
* headings
* lists with paragraph heads and nested block children
* blockquotes
* code blocks
* extension blocks
* tables
* horizontal rules
* inline text, strong, emphasis, links, and inline code

Paragraph line breaks preserved in parser AST text nodes are treated as soft wraps during canonical
emission and serialized as a single space. The canonical-emitter check therefore verifies canonical
fixed-point stability: AST -> canonical text -> AST -> canonical text.

The default output omits the standalone `&ND v1` header so emitted text can be reparsed by the
current reference parser. Pass `{ header: true }` to emit a standalone-style header once parser
support for headers exists.
