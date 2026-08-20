# &ND Core v1 to v2 Migration Guide

## Status And Scope

This guide describes migration to the `&ND Core v2` first-draft candidate. v2 remains proposal-stage;
the guide records the executable compatibility contract rather than announcing publication.

The central rule is asymmetric:

- a v1 parser rejects a document declared as `&ND v2`;
- a v2-capable parser accepts valid v1 documents without changing their v1 meaning;
- a document declaration selects its grammar, even when the parser supports both versions.

## Compatibility Matrix

| Source | v1 parser | v2-capable parser |
| :----- | :-------- | :---------------- |
| `&ND v1` with v1 syntax | Accept as v1 | Accept as v1 |
| `&ND v1` with v2-only syntax | Reject | Reject as v1 |
| `&ND v2` with only inherited v1 syntax | Reject unsupported declaration | Accept as v2 |
| `&ND v2` with v2 syntax | Reject unsupported declaration | Accept as v2 |

A v2-capable parser does not infer v2 from body syntax. Changing the declaration is therefore the
explicit migration boundary.

## Minimal Document Upgrade

A valid standalone v1 document that uses no v2-only syntax can be upgraded mechanically by changing
only its declaration:

```and
&ND v1

# Existing document
```

becomes:

```and
&ND v2

# Existing document
```

The inherited blocks and inline nodes retain the same AST meaning. Keep the v1 declaration if the
document must remain readable by v1-only consumers.

## Parser And Embedding Upgrade

Standalone input obtains its grammar from the declaration:

```js
parseAnd(source, { allowV2: true });
```

Headerless input has no declaration channel. Only its host-controlled typed channel may select v2,
and it must provide both capability and effective version:

```js
parseAnd(fragment, { allowV2: true, version: "v2" });
parseInline(text, { allowV2: true, version: "v2" });
```

`allowV2: true` alone leaves headerless input under v1. `version: "v2"` without capability fails with
`unsupported_version`. A source declaration takes precedence over a conflicting host option.

## Canonical Output Upgrade

Retain the successful parse result's version when emitting canonical text:

```js
const result = parseAnd(source, { allowV2: true });
if (result.ok) {
  const text = emitCanonical(result.document, {
    profile: "standalone",
    version: result.version,
  });
}
```

The `standalone` profile emits `&ND v2`; the `embedded` profile omits the declaration. Emitting a
v2-only AST node with `version: "v1"` fails closed. Canonical output also makes default image mode
explicit and applies the closed AEON scalar canonicalization rules.

## Local Navigation

v1 has no Core local-anchor contract. v2 uses a dedicated anchor plus the inherited link tag:

```and
[# installation]
[@ #installation | Installation]
```

Anchor identifiers are case-sensitive and document-wide. Forward links are allowed; duplicates and
unresolved local targets are rejected. External resources continue to use ordinary links:

```and
[@ https://example.com/guide | External guide]
```

Early experimental spellings such as `[~ installation]` or `[@ anchor:installation | ...]` were
never published. Migrate them to `[# installation]` and `[@ #installation | ...]`. The `~` tag is now
owned by inline images.

## Inline Images

Use:

```and
[~ image.jpg | Descriptive alternative text]
[~ diagram.png | System diagram | half]
```

Source and alt text are mandatory. Mode is `inline`, `half`, or `full`; omission means `inline`, and
canonical output spells the resolved mode. Consequently, the first canonicalization expands an
omitted mode to `| inline`; this is intentional formatter churn and subsequent canonicalization is
byte-stable. An explicit empty mode is invalid. Core preserves the authored source and does not fetch
the resource. Consumers own resolution, loading, MIME checks, intrinsic sizing, and failure UI.

## AEON Typed Scalars

The final proposal syntax is exact AEON anonymous typed-scalar assignment:

```and
[:date = 2026-08-20]
[:number = 1000.5]
[:radix[2] = %1011]
```

Replace the earlier equals-free experimental form:

```text
[:date 2026-08-20]  ->  [:date = 2026-08-20]
```

Only the documented inline-scalar families are accepted. Structured AEON values, references,
multiline strings, nested typed values, and `prose` remain outside this v2 Core subset.

## Newly Available v2 Forms

| Form | Core result |
| :--- | :---------- |
| `[# id]` | Local anchor |
| `[@ #id | label]` | Resolved local link using the inherited link node |
| `[! ...]`, `[? ...]` | Rich advisory/question nodes |
| `[+ value]` | Scalar consumer tag |
| `[~ source | alt | mode]` | Inline image |
| `[- ...]`, `[" ...]`, `[' ...]`, `[= ...]`, `[_ ...]` | Rich strike, quote, comment, highlight, and underline nodes |
| `[:type = scalar]` | AEON typed scalar |
| `- [ ] content`, `- [x] content`, `- [,] content`, `- [;] content` | First-class todo list and item states |
| `[>]`, `[<]` | Direction markers; leading list-item arrows replace bullets |
| `[.]` | Explicit inline line break, never a direction marker |
| `- [?] content`, `- [!] content` | Hint/attention markers replacing unordered-item bullets while content stays visible |
| heading `[n]` | Heading auto-number intent |
| `- [n] content` | First-class auto-number list |
| `~~~$`, `~~~$ language`, `~~~$ [n]`, `~~~$ [n] language` | Code block with optional language and numbered-line intent |
| `[% content]`, `[% (id) content]`, `[% (id)]` | Anonymous/named footnote definitions and named references |
| `~~~=`, `~~~*`, `~~~/`, `~~~_`, `~~~?`, `~~~!`, `~~~'` | Highlight, strong, emphasis, underline, hint, attention, and comment blocks |
| `~~~#` … `~~~#` | Header-text block |
| `~~~^` … `~~~` | Disclaimer block |
| `[^ ...]` | Inline disclaimer |
| `[(id) content]` | Inline semantic wrapper; ID is retained for consumers but hidden by default projection |
| `~~~(id)` … `~~~` | Semantic block; content projects as an ordinary paragraph by default |
| `\` before a block opener | Literal block-command text, decoded into an ordinary paragraph |

The consumer-owned meaning of advisory tags, semantic IDs, custom tags and datatypes, numbering,
disclaimer presentation, image behavior, and external navigation is defined in
[`and-consumer-conventions.md`](./and-consumer-conventions.md).

## Structural Escaping

V2 can quote a block command at a block-open position without turning `#`, `~`, digits, or other
ordinary characters into global inline escapes:

```and
\# this is paragraph text, not a heading

\~~~(note)
```

The same rule covers list, blockquote, rule, extension, inherited backtick fences, v2 dollar-code
fences, removed tilde-language openers, and other v2 fence openers. The escape is not valid mid-line and is not permitted when the following text is
already non-structural. Plain `~~~`, for example, remains ordinary text and must not be escaped.
Core v1 does not gain this rule.

## Code Blocks

Backtick code fences are v1 syntax and remain fully supported by v2 readers:

````and
```aeon
title = "compatible"
```
````

V2 additionally provides an explicit tilde-dollar family:

```and
~~~$
untyped code
~~~$

~~~$ aeon
typed code
~~~$

~~~$ [n]
numbered code
~~~$

~~~$ [n] aeon
numbered typed code
~~~$
```

`[n]` requests numbered lines and an optional language follows it. Every form closes with bare
`~~~$`. Canonical v2 output uses this family even when the source used backticks; canonical v1 output
continues to use backticks. The briefly introduced `~~~language` and `~~~~language` forms should be
replaced with either backticks or `~~~$ language`; they are rejected with `deprecated_code_fence`.

## Formatted Paragraphs

V2 provides four exact matching-fence paragraph forms:

```and
~~~=
Highlighted paragraph
~~~=

~~~*
Strong paragraph
~~~*

~~~/
Emphasized paragraph
~~~/

~~~_
Underlined paragraph
~~~_
```

Each requires non-empty rich inline content. The opening and closing fence must match. Plain `~~~`
is not a fence and remains ordinary paragraph text in both v1 and v2; canonicalization therefore
treats its line breaks as inherited soft wraps.

## Todo Lists

Todo state is structural in v2:

```and
- [ ] draft
- [x] parser
- [,] documentation
- [;] discarded
```

This parses as `todo_list` containing `todo_item` nodes, not as an unordered list containing inline
markers. The `- ` prefix is mandatory, each item requires content, and all items in one list block
must be todo items. Bare `[x] parser`, ordered `1. [x] parser`, and mixed ordinary/todo list blocks are
rejected. `[.]` remains an explicit inline line break and is not a todo-item terminator.

## Auto-Numbering

`[n]` is contextual structural metadata in v2:

```and
# [n] Numbered title

- [n] first item
- [n] second item
```

The heading receives `autoNumber: true`; the list parses as `auto_number_list` containing inherited
`list_item` nodes. Both forms require a separator space and non-empty content. Every item in one list
block must be the same kind. Bare `[n]`, `# [n]Title`, `- [n]item`, explicit `1. [n] item`, and mixed
ordinary/todo/auto-number blocks are rejected.

Unlike v1 strict mode, v2 permits an immediately nested list at the exact two-space margin without a
blank separator. This applies consistently to ordinary, todo, and auto-number lists. Canonical output
may insert the inherited blank separator while preserving the same AST.

## Footnotes

V2 promotes `[% ...]` as footnote syntax:

```and
hello [% supporting context]
hello [% (A1) reusable context], again [% (A1)]
```

The first form is an anonymous definition at its reference position. The second declares the
case-sensitive v2 ID `A1`; later `[% (A1)]` forms reference it. Named footnotes, anchors, and
semantic wrappers all use `[A-Za-z0-9][A-Za-z0-9._:-]*`. A named reference must
follow its single declaration. Empty definitions, malformed IDs, duplicates, unresolved or forward
references, and nested footnotes are rejected. The authored ID is not a forced display number;
processors choose numbers, symbols, hover cards, callouts, or endnotes.

## Directional List Markers

`[>]` and `[<]` remain inline direction markers. When one is the first inline child after an
unordered-list prefix, its arrow replaces that item's bullet in projection:

```and
- [>] advance while [<] remains inline
- ordinary item with [>] inline
```

The list remains an ordinary unordered list and the leading marker remains in its paragraph AST.
This permits ordinary and directional items to coexist. Only the leading position is contextual;
later markers and markers in paragraphs or ordered lists retain their inline behavior.

The exact leading forms `- [?] content` and `- [!] content` follow the same contextual rule, but
their list content remains visible. Use rich `[? ...]` or `[! ...]` for inline callout content.

## Tooling Checklist

1. Enable v2 reader capability explicitly.
2. Change standalone declarations only when dropping v1-reader compatibility is acceptable.
3. Supply both v2 options for headerless typed channels.
4. Forward the effective version into canonical emission.
5. Replace experimental anchor, link, and typed-value spellings.
6. Validate anchors and local links at full-document scope.
7. Convert inline experimental todo markers into homogeneous `- [state] content` blocks.
8. Convert contextual numbering to exact heading or `- [n] content` prefixes.
9. Convert footnotes to anonymous definitions or declare a valid shared v2 ID before every shorthand
   reference; remove forward references and nesting.
10. Place a direction marker first after `- ` only when it should replace that item's bullet.
11. Keep inherited backtick code fences or migrate code to `~~~$`, adding optional `[n]` and language
    metadata after the opener; replace removed `~~~language` / `~~~~language` forms.
12. Convert paragraph-wide formatting, advisory content, or block comments to the exact matching `~~~=`, `~~~*`, `~~~/`, `~~~_`, `~~~?`, `~~~!`, or `~~~'` fence;
    do not treat plain `~~~` as a block delimiter.
13. Treat consumer conventions after Core parsing; do not use them to alter grammar acceptance.
14. Run `npm run and -- check document.and --version v2` and canonicalize once to expose normalized
   image modes and AEON scalar spellings.

There is no automatic downgrade for v2-only syntax. To return a document to v1, remove every v2-only
construct, change the declaration to `&ND v1`, and validate it with a v1 parser.
