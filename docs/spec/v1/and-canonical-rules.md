# &ND Core v1 — Canonical Form Rules

## 1. Purpose

Canonical &ND defines:

> same document tree → same serialized text

This property is required for diffing, hashing, signing, testing, and stable rendering pipelines.

---

## 2. Header

Canonical emitters MUST require a profile choice before emitting text. The profile determines
whether the `&ND v1` file header is required or forbidden.

For standalone &ND files, emit:

```text
&ND v1
```

Followed by exactly one blank line.

For embedded contexts (e.g., `fmt.and.aeon` annotation payloads or doc-comment channels),
the header MUST be omitted. The embedding profile governs whether the header is required,
optional, or forbidden (see §3.3 of the core spec).

---

## 3. Line endings

Canonical line ending:

```text
\n
```

No `\r\n`.

---

## 4. Final newline

Canonical documents MUST end with exactly one trailing newline.

---

## 5. Blank lines

Use exactly **one blank line** between top-level blocks.

No multiple blank lines.

Canonical:

```text
# Title

Paragraph.

- Item
```

Not canonical:

```text
# Title


Paragraph.
```

---

## 6. Headings

Use exactly one space after heading marker.

```text
# Heading
## Heading
### Heading
```

No trailing spaces.

Heading content is inline-canonicalized.

---

## 7. Paragraphs

Paragraphs are emitted as a single logical line.
Canonical form therefore collapses any valid multi-line paragraph input into one logical line.
Each normalized paragraph line break is treated as an authoring soft wrap and emitted as a single
U+0020 space.

Any wrapped form is non-canonical, even if produced by a human-friendly pretty-printer.

Canonical:

```text
This is a paragraph with [* strong] text.
```

Not canonical:

```text
This is a paragraph
with [* strong] text.
```

Hard wrapping creates ambiguity and diff noise and is therefore non-canonical.

Inline content within a paragraph is inline-canonicalized (see §8).

Parser ASTs MAY preserve normalized paragraph line breaks as `\n` text content for diagnostics and
editor tooling. Canonical emitters MUST NOT re-emit those paragraph line breaks; they MUST apply the
single-space soft-wrap collapse described above.

---

## 8. Inline elements

Canonical inline forms:

```text
[* strong]
[/ emphasis]
[@ https://example.com | label]
[$ render()]
```

Rules:

* exactly one space after inline tag
* links use exactly one space around `|`
* shorthand combinations MUST NOT be emitted

Core v1 does not define dedicated inline atoms for non-breaking spaces or forced line breaks.

Canonical:

```text
[* [/ strong emphasis]]
```

Not canonical:

```text
[*/ strong emphasis]
```

---

## 9. Inline nesting

Emit the actual tree structure. Do not flatten or reorder.

Canonical:

```text
[* strong [/ strong emphasis]]
```

If the AST is emphasis containing strong, canonical form is different:

```text
[/ emphasis [* emphasis strong]]
```

Tree order is semantically significant for canonical output.

---

## 10. Escaping

Escape only when required.

Required escapes:

```text
\[  literal [
\]  literal ]
\|  literal | where pipe is syntactically active
\\  literal \
```

Do not escape ordinary characters.

Canonical:

```text
This is \[not strong\].
```

Not canonical:

```text
This \i\s overly escaped.
```

Escaping non-escapable characters is invalid in Core v1.

Escape handling is lexical, not a later rewrite pass.
Canonical emitters therefore emit only the minimal escapes required by the inline grammar.

---

## 11. Lists

Canonical nested content uses two-space indentation.

Unordered:

```text
- First
- Second
```

Ordered:

```text
1. First
2. Second
3. Third
```

Rules:

* ordered list numbers MUST be emitted as monotonic `1, 2, 3...` regardless of source
  numbering (the canonical emitter normalizes any valid source sequence to `1, 2, 3...`)
* exactly one space after marker
* no blank line between sibling simple items
* nested block requires one blank line before the nested block and two-space indentation
* no blank line after the last nested item before the next sibling item at the parent level

Example:

```text
- Parent

  - Child
  - Child
- Next parent
```

---

## 12. Blockquotes

Canonical blockquote lines use:

```text
> Quote text
```

Emit one space after `>` when content exists.

Blank quote paragraph separator:

```text
> First paragraph
>
> Second paragraph
```

Inline content is canonicalized inside quote lines.

---

## 13. Code blocks

Plain:

````text
```js
const x = 1
```
````

Rules:

* opening fence at the current block margin
* closing fence at the same block margin as the opener
* language identifier lowercase if known
* no trailing spaces on fence lines
* raw content preserved exactly except line endings normalized to `\n`

If no language:

````text
```
raw
```
````

Ordered:

`````text
````aeon
title = "Hello World"
mode = "ordered"
````
`````

Ordered code blocks keep the same payload and language rules as plain code blocks, but canonical
form preserves the quadruple fence to represent explicit line ordering intent.

---

## 14. Extension blocks

Canonical:

```text
+++chart/pie
apples: 30
bananas: 20
+++
```

Rules:

* opening `+++` at the current block margin
* no space between `+++` and the extension name in canonical form
* closing `+++` at the same block margin as the opener
* extension name lowercase
* primary extension content preserved exactly except line endings normalized to `\n`
* if fallback content is present, emit an immediately adjacent `+++fallback` block after the
  extension block
* fallback block content is canonicalized as ordinary `&ND` block content
* no nesting
* no parsing inside primary extension content

Opaque preservation means:

* preserve the extension block boundary
* preserve the extension name
* preserve primary payload bytes exactly, except for line-ending normalization to `\n`
* do not inspect, reinterpret, or canonicalize primary payload content

---

## 15. Tables

Canonical table:

```text
| Name | Type | Notes |
| --- | --- | --- |
| title | string | Required |
| count | number | Optional |
```

Rules:

* emit exactly one blank line before the table block
* one leading and trailing pipe
* exactly one space around cell content
* separator cells are exactly `---`
* no alignment markers
* all rows same column count
* inline content canonicalized inside cells
* pipes inside cells escaped as `\|`

Column padding for visual alignment is non-canonical.

Not canonical:

```text
| Name  | Type   |
| ----- | ------ |
| title | string |
```

---

## 16. Horizontal rule

Canonical:

```text
---
```

Standalone line only.

---

## 17. Attribute/order rules

Core v1 has no attributes, IDs, footnotes, references, or metadata fields.
Canonical emitters therefore have:

* no metadata sorting behavior
* no hidden global state
* no generated IDs

---

## 18. Invalid constructs

Canonical emitters MUST NOT emit:

* unknown inline tags
* `[*/ ...]` (shorthand combinations)
* HTML
* unclosed spans
* unclosed raw blocks
* table alignment
* task lists
* footnotes
* implicit links
* autolinks

---

## 19. Canonical output rule

A canonical emitter MUST:

```text
AST → canonical &ND
```

It MUST NOT:

* infer meaning
* rewrite extension content — the one permitted exception is that line endings inside
  raw blocks (code blocks and extension blocks) are normalized to `\n`; this is a
  byte-level normalization only and does not alter the content's semantics
* normalize prose
* wrap paragraphs
* add renderer-specific features

---

## 20. Mental model

> Canonical &ND normalizes structure, not authorial prose.
> It cleans syntax, spacing, and delimiters.
> It does not reinterpret content.
