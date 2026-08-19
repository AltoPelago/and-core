# Reference Canonical Emitter

This is the reference canonical emitter for `&ND Core v1` and the executable `&ND Core v2`
proposal AST.

It emits canonical text from the CTS AST contract shape documented in
[`docs/spec/v1/and-ast-contract.md`](../../docs/spec/v1/and-ast-contract.md) and
[`docs/spec/v2/and-ast-contract.md`](../../docs/spec/v2/and-ast-contract.md).

Current scope:

* paragraphs, including soft-wrapped paragraph text
* headings
* lists with paragraph heads and nested block children
* blockquotes
* code blocks
* extension blocks
* extension block fallback regions
* tables
* horizontal rules
* inline text, strong, emphasis, links, and inline code
* all promoted v2 scalar tags and compact markers
* v2 heading auto-number intent and paired blocks

Paragraph line breaks preserved in parser AST text nodes are treated as soft wraps during canonical
emission and serialized as a single space. The canonical-emitter check therefore verifies canonical
fixed-point stability: AST -> canonical text -> AST -> canonical text.

Callers must choose an emission profile explicitly:

```js
emitCanonical(document, { profile: "embedded" });
emitCanonical(document, { profile: "standalone" });
emitCanonical(v2Document, { profile: "standalone", version: "v2" });
```

The `embedded` profile omits the version header for typed embedding contexts such as annotation
payloads. The `standalone` profile emits the selected version header followed by one blank line.
The version defaults to v1 for compatibility. Emitting a v2-only node under v1 fails closed.
