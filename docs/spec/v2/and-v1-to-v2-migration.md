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
canonical output spells the resolved mode. Core preserves the authored source and does not fetch the
resource. Consumers own resolution, loading, MIME checks, intrinsic sizing, and failure UI.

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
| `[>]`, `[<]`, `[.]` | Direction and explicit line break |
| heading `[n]` | Heading auto-number intent |
| `- [n] content` | First-class auto-number list |
| `[% content]`, `[% (id) content]`, `[% (id)]` | Anonymous/named footnote definitions and named references |
| `~~~=`, `===`, `***` paired blocks | Highlight paragraph, header text, and disclaimer blocks |

The consumer-owned meaning of advisory tags, custom tags and datatypes, numbering, optional block
tags, image behavior, and external navigation is defined in
[`and-consumer-conventions.md`](./and-consumer-conventions.md).

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

## Footnotes

V2 promotes `[% ...]` as footnote syntax:

```and
hello [% supporting context]
hello [% (A1) reusable context], again [% (A1)]
```

The first form is an anonymous definition at its reference position. The second declares the
case-sensitive alphanumeric ID `A1`; later `[% (A1)]` forms reference it. A named reference must
follow its single declaration. Empty definitions, malformed IDs, duplicates, unresolved or forward
references, and nested footnotes are rejected. The authored ID is not a forced display number;
processors choose numbers, symbols, hover cards, callouts, or endnotes.

Unlike v1 strict mode, v2 permits an immediately nested list at the exact two-space margin without a
blank separator. This applies consistently to ordinary, todo, and auto-number lists. Canonical output
may insert the inherited blank separator while preserving the same AST.

## Tooling Checklist

1. Enable v2 reader capability explicitly.
2. Change standalone declarations only when dropping v1-reader compatibility is acceptable.
3. Supply both v2 options for headerless typed channels.
4. Forward the effective version into canonical emission.
5. Replace experimental anchor, link, and typed-value spellings.
6. Validate anchors and local links at full-document scope.
7. Convert inline experimental todo markers into homogeneous `- [state] content` blocks.
8. Convert contextual numbering to exact heading or `- [n] content` prefixes.
9. Convert footnotes to anonymous definitions or declare an alphanumeric ID before every shorthand
   reference; remove forward references and nesting.
10. Treat consumer conventions after Core parsing; do not use them to alter grammar acceptance.
11. Run `npm run and -- check document.and --version v2` and canonicalize once to expose normalized
   image modes and AEON scalar spellings.

There is no automatic downgrade for v2-only syntax. To return a document to v1, remove every v2-only
construct, change the declaration to `&ND v1`, and validate it with a v1 parser.
