# **&ND Core v1 — Normative Specification (Draft)**

---

## **0. Status**

* **Name:** &ND (AEON Native Document)
* **Version:** 1.0
* **Status:** Draft (Normative)
* **Goal:** Deterministic, human-readable, non-executable document format

---

# **1. Core Philosophy**

> &ND describes document structure.
> It does not interpret meaning.
> It does not execute code.
> It fails on ambiguity.

---

# **1.1 Locked Vocabulary**

The following terms are used normatively throughout this specification and SHOULD be interpreted
consistently by implementations and companion documents.

* `strong`: an inline structural node that marks stronger importance or prominence. It does not
  prescribe bold rendering.
* `emphasis`: an inline structural node that marks emphasis. It does not prescribe italic
  rendering.
* `inline code`: an inline raw-like node whose payload suppresses nested inline-node parsing, while
  still honoring delimiter-safe escapes required by the grammar.
* `raw island`: a region whose interior is not recursively parsed as ordinary block or inline
  structure. In Core v1, code blocks and extension blocks are raw islands.
* `canonical`: the single normalized representation required for semantically equivalent documents
  under the canonical rules.
* `strict`: the default normative parse mode. Unknown syntax and malformed Core v1 syntax cause
  failure.
* `recovery`: a non-normative editor-oriented parse mode for partial document recovery from invalid
  current-version input.
* `forward_compat`: a non-normative opt-in parse mode for compatibility with unknown future syntax.
  It is non-conformant and MUST NOT be used where strict semantic agreement is required.

Where editor tooling or theme systems use presentation-oriented terms such as `bold` or `italic`,
those are implementation-layer mappings only and do not change the language semantics above.

---

# **2. Design Principles**

### 2.1 Single Representation

Each feature has exactly one syntax.

### 2.2 Deterministic Parsing

Same input → same output.

### 2.3 Fail-Closed

Invalid input MUST produce an error and no document.

### 2.4 Structural Integrity

* Proper nesting required
* No overlapping inline spans

### 2.5 Non-Executable

No HTML, no scripts, no runtime behavior.

### 2.6 Opaque Extensions

Unknown extension block names MUST be preserved as opaque blocks but not interpreted.

This rule applies to extension blocks only.
Unknown inline tags and invalid core syntax MUST error.

---

# **3. Parsing Modes**

## 3.1 Strict Mode (Normative)

```json
{
  "ok": false,
  "errors": [...]
}
```

* No AST produced
* No partial output

## 3.2 Recovery Mode (Non-Normative)

```json
{
  "ok": false,
  "partial": true,
  "document": {...},
  "errors": [...]
}
```

* For editors only
* MUST NOT be used in pipelines

## 3.3 Forward-Compatibility Mode (Non-Normative)

`forward_compat` is an explicitly opt-in compatibility mode for shared-version environments where a
consumer may encounter future syntax that a current parser does not implement.

Example result shape:

```json
{
  "ok": true,
  "mode": "forward_compat",
  "conformant": false,
  "downgradedUnknowns": [...]
}
```

Rules:

* `forward_compat` MUST NOT be the default mode
* `forward_compat` MUST be explicitly selected by the consumer
* `forward_compat` MUST NOT be treated as a conformant strict parse
* `forward_compat` MUST NOT be used for canonical emission, signing, validation pipelines, or any
  workflow that requires strict semantic agreement
* `forward_compat` MAY downgrade unknown future constructs into inert text or opaque compatibility
  nodes
* `forward_compat` MUST NOT silently repair malformed known Core v1 syntax

The purpose of `forward_compat` is compatibility with future syntax, not recovery from invalid
current-version documents.

---

## 3.4 Embedding and Profile Convention

The `&ND v1` header is a document-type declaration for standalone &ND files.
It is not required in every embedding context.

Profile and embedding rules:

* A standalone &ND file SHOULD begin with `&ND v1` on its first line.
* An AEON annotation or doc-comment embedding MAY omit the header; the enclosing profile
  or tool convention declares the content type.
* A profile that embeds &ND content MUST document whether the header is required,
  optional, or forbidden for that context.
* Parsers receiving &ND input through a typed channel (e.g., `fmt.and.aeon` annotation
  payload) MUST NOT require the header.

`fmt.and.aeon` comment payloads are therefore headerless &ND by convention.
The `&ND v1` header is a file-level signal, not a per-comment payload requirement.

---

# **4. Block Model**

## 4.1 Paragraph Boundary Rule (Critical)

> Blocks MUST NOT interrupt paragraphs.

```text
My number is
1. not a list
```

This is a paragraph.

Blocks only start:

* at document start
* after a blank line

A line that would otherwise look like a block opener is paragraph text when it appears inside an
already-open paragraph.

A line that is not block-open eligible MUST NOT be reinterpreted as a block opener.
If such a line cannot be consumed as valid paragraph continuation text under the Core v1 paragraph
rules, parsing MUST fail rather than silently reclassifying it.

That means block recognition is context-gated:

* **block-open eligible** at document start or immediately after a blank line
* **not block-open eligible** on continuation lines of an open paragraph

The block-open column for a block-open-eligible position is the **current block margin**:

* at top level, the current block margin is column 0
* inside a nested block context, the current block margin is the structural indentation column of
  that nested context

---

## 4.2 Block Types

### Headings

```text
# Heading
## Heading
...
###### Heading
```

Rules:

* MUST start at the current block margin
* MUST have space after `#`
* Single line only

---

### Paragraphs

* One or more lines
* Separated by blank line
* Inline parsing allowed
* A paragraph continuation line may begin with characters that would open a block in a
  block-open-eligible position; those characters are treated as paragraph text instead

---

### Lists

#### Unordered

```text
- Item
```

#### Ordered

```text
1. Item
2. Item
```

Rules:

* MUST have space after marker
* MUST be contiguous
* One or more consecutive non-blank lines immediately after a list item head that begin at the
  exact two-space item content margin continue the item head paragraph
* An unindented line immediately after a list item head ends the list and is parsed by the enclosing
  block context
* Nested blocks MUST be indented by **exactly two spaces**
* Tabs are invalid
* Nested lists require a blank line before them
* Ordered lists MAY start at any non-negative decimal integer, but each following item in the same
  source list MUST increase by exactly one
* A nested block intended for a list item's inner block context MUST begin exactly at that inner
  context's current block margin
* Additional structural indentation beyond that exact nested block margin is invalid in Core v1

---

### Blockquotes

```text
> Quote
> Continued
```

Rules:

* `>` MUST be followed by space or end-of-line
* Blank `>` line separates paragraphs
* A blockquote establishes an inner block context
* Within that inner context, the current block margin is the column immediately after the `>` marker
  and optional following space on each quote line
* A nested block inside a blockquote is valid only when the enclosing quoted position is
  block-open eligible
* A blank `>` line preserves the blockquote context while separating quoted paragraphs
* A nested block intended for a blockquote's inner context MUST begin exactly at that inner current
  block margin
* Additional structural indentation beyond that exact nested block margin is invalid in Core v1

---

### Code Blocks

````text
```lang
raw content
```
````

Rules:

* Open/close must be at the current block margin
* Content is opaque
* No parsing inside
* MUST be closed

---

### Tables

```text
| A | B |
| --- | --- |
| 1 | 2 |
```

Rules:

* MUST start at the current block margin after a blank line
* Header row REQUIRED
* Separator row REQUIRED
* Separator cells MUST be exactly `---`
* All rows MUST have same column count
* Once a table is recognized, every subsequent body row MUST conform to the recognized table shape
* A non-conforming body row MUST cause parse failure rather than fallback to paragraph text
* Inline parsing allowed inside cells
* Block content forbidden inside cells
* Pipes MUST be escaped: `\|`

---

### Horizontal Rule

```text
---
```

Rules:

* MUST be standalone line
* Unambiguous with table separator rows: a `TableSepRow` always starts with `|`, so a line
  beginning with `---` (no leading `|`) is always a `HorizontalRule`

---

### Extension Blocks

```text
+++type[/subtype]
raw content
+++
```

Extension blocks MAY be followed by an adjacent fallback block:

```text
+++unsupported/extension
opaque extension payload
+++
+++fallback
fallback &ND content
+++
```

Rules:

* MUST start at the current block margin
* MUST be closed
* MUST NOT be nested (v1)
* Extension content between opener and closer is opaque
* No parsing inside extension content
* `fallback` is a reserved extension name
* A `+++fallback` block is valid only when it immediately follows an extension block with no blank
  line or intervening block
* Only one fallback block may apply to an extension block
* Fallback block content is parsed as ordinary `&ND` content
* A fallback block cannot have its own fallback
* A `+++fallback` block found anywhere else MUST fail with `orphan_fallback_block`
* Extension names MUST match the lowercase grammar exactly in strict mode; uppercase characters
  MUST cause parse failure

Extension name grammar:

```text
[a-z][a-z0-9-]*(/[a-z][a-z0-9-]*)*(\.v[0-9]+)?
```

---

# **5. Inline Model**

The inline syntax is intentionally explicit and context-stable.
`[* ...]` is always strong and `[$ ...]` is always inline code.
The same character sequence MUST NOT change meaning based on surrounding prose or parser mode.

## 5.1 Syntax

```text
[<type> <content>]
```

---

## 5.2 Supported Types

```text
[* ...]          strong
[/ ...]          emphasis
[@ URL | text]   link
[$ ...]          inline code
```

---

## 5.3 Rules

### Nesting

```text
[* strong [/ nested]]   ✅
[* strong [/ broken]    ❌
```

* Must form a proper tree
* Overlapping spans are invalid

---

### Inline Code

```text
[$ render()]
```

Rules:

* Content is delimiter-opaque rather than tree-opaque
* No nested inline-node parsing occurs inside inline code
* Inside inline code, only `\]`, `\\`, `\[`, and `\|` are recognized escapes
* Escape resolution inside inline code MUST occur before closing-delimiter detection
* Any unescaped `]` terminates the inline code construct
* MUST be closed

---

### Links

```text
[@ https://x | label]
```

Rules:

* URL required
* Label required
* `|` is delimiter
* `\|` escapes pipe
* The label MUST contain at least one inline node or text character

---

### Unknown Inline Types

```text
[x something]
```

MUST error.

---

## 5.4 Symbol Taxonomy

### Block symbols

`````text
#     heading
>     blockquote
-     unordered list item
1.    ordered list item
---   horizontal rule
```   code block
````  ordered code block
+++   extension block
`````

### Inline symbols

```text
[* ...]          strong
[/ ...]          emphasis
[$ ...]          inline code
[@ url | text]   link
```

### Reserved — do not use in Core v1

```text
[# ...]   reserved for anchors/IDs if ever needed
[~ ...]   reserved for references/mentions if ever needed
[! ...]   reserved for warnings/admonitions if ever needed
[? ...]   reserved for hints/questions if ever needed
[+ ...]   reserved for insertion/addition if ever needed
[- ...]   reserved for deletion/removal if ever needed
[" ...]   reserved for inline quoted text if ever needed
[' ...]   reserved for comments if ever needed
[: ...]   reserved for typed values like datetime if ever needed
[> ...]   reserved for consumer defined tags if ever needed
[^ ...]   reserved for references if ever needed

[ ]   reserved for todo/unchecked if ever needed
[x]   reserved for todo/checked if ever needed
[=]   reserved for todo/in progress if ever needed
[.]   reserved for todo/cancelled if ever needed
[>]   reserved if ever needed

[n]   reserved for auto-number marker in headers if ever needed

===   reserved for header text if ever needed
~~~   reserved for alternative formating if ever needed
***   reserved for disclaimer text
```

### Design rule

> A symbol should mean one thing across &ND.

`#` means heading at block level. `[# ...]` therefore MUST NOT be repurposed for an unrelated
inline meaning. Reserved symbols remain unassigned so that any future assignment can stay aligned
with their natural meaning.

### Lock

Core v1 recognizes exactly four inline symbols:

```text
[* strong]
[/ emphasis]
[$ inline code]
[@ url | label]
```

Everything else is reserved until there is a strong need and a consistent assignment.

---

# **6. Escaping**

Escape character:

```text
\
```

Supported escapes:

```text
\[   [
\]   ]
\|   |
\\   \
```

Rules:

* Escape applies to next character only
* Escaping invalid characters MUST error
* Escape resolution is lexical and local: it happens during inline scanning, before any escaped
  character can be interpreted as syntax
* There is no later global "escape resolution" rewrite pass

---

# **7. Scanner And Parser Model**

The normative parser model is:

1. **Line normalization**
   Normalize line endings to logical lines for parsing.
2. **Top-level block scan**
   Scan lines left-to-right and recognize block openers only when the parser is
   **block-open eligible**.
3. **Raw islands first**
   Code blocks and extension blocks are detected before inline parsing and consumed as opaque raw
   regions.
4. **Inline scan**
   Inline parsing is a local left-to-right scan inside inline-capable regions. Escapes are resolved
   lexically during that scan.

Normative constraints:

* Implementations MUST NOT rely on unbounded backtracking.
* Implementations MUST use bounded lookahead only.
* Block recognition MUST depend only on local parser state plus the current line, except for table
  recognition which may inspect the immediately following separator line.
* Inline parsing MUST be local to the current inline-capable region and MUST NOT depend on global
  document state.

This model is intentionally stricter than forgiving markup parsers.
The goal is deterministic, auditable parsing rather than permissive recovery.

---

# **7.1 Normative Scanner Rules**

The following scanner rules are normative.

## 7.1.1 Line classes

Before block parsing, an implementation MUST classify each physical line using only:

* the normalized line text
* whether the parser is block-open eligible
* bounded local lookahead where explicitly allowed

There is no global reinterpretation pass.

## 7.1.2 Block-open eligible positions

A line is block-open eligible only:

* at document start
* immediately after a blank line
* inside a list item or blockquote only where that enclosing block explicitly permits a nested block

A paragraph continuation line is never block-open eligible.

## 7.1.3 Raw-island scanning

When a code block opener or extension block opener is recognized:

* the opener line is consumed immediately
* subsequent lines are treated as opaque raw payload
* parsing resumes only at the first valid closing fence at the same block margin as the opener
* if no closer exists before EOF, parsing MUST fail
* if a closing fence token appears at a different block margin, parsing MUST fail with the
  corresponding bad-closing-margin error

No inline parsing, block parsing, or escape reinterpretation occurs inside raw payload.

## 7.1.4 Table recognition

Table recognition is the only block form that may inspect the immediately following line to confirm
the current line's role.

A table starts only if:

* the current line is block-open eligible
* the line begins at the current block margin
* the current line matches `TableRow`
* the immediately following line matches `TableSepRow`

Otherwise the current line is parsed according to the normal block/paragraph rules.

Once a table has been recognized, subsequent candidate body rows are part of that table context.
A row that does not conform to the established table shape MUST fail the parse; implementations
MUST NOT terminate the table early and reinterpret that row as ordinary paragraph text.

## 7.1.5 Inline scanning

Inline-capable regions are scanned left-to-right.

At each position:

* if the next bytes form a valid escape, emit the escaped literal character
* else if the next bytes form a valid inline opener, parse that inline form
* else emit plain text until the next candidate escape or inline opener

Unknown inline openers MUST fail immediately.
Inside inline code, escape recognition occurs before closing-delimiter detection, and any unescaped
`]` closes the inline code region.

## 7.1.6 Failure points

Parsing MUST fail immediately on:

* invalid escape
* unknown inline tag
* unclosed inline construct
* unclosed raw block
* invalid indentation where indentation is structural
* table-shape mismatch
* budget exhaustion

Strict mode produces no partial document after any such failure.
Escaping a non-escapable character is a syntax error, not a literal fallback.

## 7.1.7 Worked edge cases

### Case A: paragraph vs ordered list

```text
My number is
1. not a list
```

Result:

* one paragraph with two lines
* the second line is paragraph text because the parser is not block-open eligible there

### Case B: ordered list after blank line

```text
My number is

1. a list item
```

Result:

* one paragraph
* one ordered list

### Case C: horizontal rule vs paragraph text

```text
Text
---
```

Result:

* invalid as a single paragraph continuation
* if `---` is intended as a horizontal rule, a blank line is required before it

Canonical valid form:

```text
Text

---
```

### Case D: table requires separator confirmation

```text
| A | B |
plain text
```

Result:

* not a table
* if the parser is block-open eligible there, the two lines form one paragraph
* if the enclosing context does not allow paragraph text at that position, parsing fails according
  to that enclosing context

### Case E: escaped inline opener

```text
\[* not strong]
```

Result:

* literal text `[* not strong]`
* not a strong node

### Case F: unknown inline tag

```text
[x something]
```

Result:

* fail with `unknown_inline_type`

### Case G: raw block swallowing apparent syntax

````text
```txt
[* not strong]
+++chart/pie
---
```
````

Result:

* one code block
* all interior lines are opaque payload

### Case H: unterminated extension block

```text
+++chart/pie
apples: 3
```

Result:

* fail with `unclosed_extension_block`

### Case I: oversized link target

```text
[@ https://example.invalid/...very-long... | label]
```

Result:

* if the configured link-target budget is exceeded, fail with `nd_budget_exceeded`
* implementations MUST stop scanning once the budget boundary is crossed

---

## 7.1.8 Conformance Test Seeds

The following seeds are normative conformance fixtures.

An implementation MAY add more tests, but it SHOULD include at least these cases in its
conformance suite.

### `seed-paragraph-vs-ordered-list`

Input:

```text
My number is
1. not a list
```

Expected result:

* parse success
* one paragraph block
* paragraph contains two lines of text

### `seed-header-standalone`

Input:

```text
&ND v1

# Title
```

Expected result:

* parse success
* header is recognized as a document declaration
* header does not appear as an AST block
* one heading block

### `seed-invalid-header-version`

Input:

```text
&ND v2

# Title
```

Expected result:

* parse failure
* reason: unsupported or malformed document header

### `seed-ordered-list-after-blank-line`

Input:

```text
My number is

1. a list item
```

Expected result:

* parse success
* one paragraph block
* one ordered list block with one item

### `seed-ordered-list-renumber-canonical`

Input:

```text
3. Alpha
4. Beta
```

Expected result:

* parse success
* one ordered list block
* source numbers are a valid monotonic sequence
* canonical emission renumbers ordered list items from `1`

### `seed-ordered-list-skipped-number`

Input:

```text
1. Alpha
3. Beta
```

Expected result:

* parse failure
* reason: ordered list item numbers must increase by exactly one within the source list

### `seed-horizontal-rule-needs-boundary`

Input:

```text
Text
---
```

Expected result:

* parse failure
* reason: block opener attempted on a paragraph continuation line

### `seed-inline-line-break`

Input:

```text
First[<]Second
```

Expected result:

* parse failure
* error code `unknown_inline_type`
* `[<]` is not assigned in Core v1

### `seed-table-requires-separator`

Input:

```text
| A | B |
plain text
```

Expected result:

* parse success when evaluated at top level
* one paragraph block with two lines
* no table block

### `seed-table-valid-top-level`

Input:

```text
| A | B |
| --- | --- |
| 1 | 2 |
```

Expected result:

* parse success
* one table block
* table has two columns and one body row

### `seed-table-inline-cells`

Input:

```text
| Name | Note |
| --- | --- |
| [* Ada] | escaped \| pipe |
```

Expected result:

* parse success
* one table block
* first body cell contains one strong inline node
* second body cell contains a literal pipe character

### `seed-table-mismatched-body-row`

Input:

```text
| A | B |
| --- | --- |
| 1 | 2 | 3 |
```

Expected result:

* parse failure
* reason: table body row has a different cell count from the header row

### `seed-table-missing-body-row`

Input:

```text
| A | B |
| --- | --- |
```

Expected result:

* parse failure
* reason: table has no body rows

### `seed-table-unescaped-pipe-extra-cell`

Input:

```text
| A | B |
| --- | --- |
| escaped | pipe | ok |
```

Expected result:

* parse failure
* reason: unescaped pipe creates an extra cell and violates table shape

### `seed-escaped-inline-opener`

Input:

```text
\[* not strong]
```

Expected result:

* parse success
* plain text only
* no strong inline node

### `seed-unknown-inline-tag`

Input:

```text
[x something]
```

Expected result:

* parse failure
* error code `unknown_inline_type`

### `seed-raw-block-opaque`

Input:

````text
```txt
[* not strong]
+++chart/pie
---
```
````

Expected result:

* parse success
* one code block
* payload contains the interior lines exactly, subject only to line-ending normalization

### `seed-ordered-code-block`

Input:

`````text
````aeon
title = "Hello World"
mode = "ordered"
````
`````

Expected result:

* parse success
* one code block
* code block is ordered
* payload contains the interior lines exactly, subject only to line-ending normalization

### `seed-ordered-code-block-wrong-closing-fence`

Input:

`````text
````aeon
title = "Hello World"
```
`````

Expected result:

* parse failure
* error code `unclosed_code_block`
* reason: ordered code blocks require a matching quadruple-fence closer

### `seed-extension-block-opaque`

Input:

```text
+++chart/pie
[* not strong]
| not | table |
+++
```

Expected result:

* parse success
* one extension block
* extension name is `chart/pie`
* payload is opaque and not parsed as inline or block content

### `seed-extension-block-fallback`

Input:

```text
+++unsupported/extension
opaque [* extension] payload
+++
+++fallback
Show [* this] instead
+++
```

Expected result:

* parse success
* one extension block
* extension opener attaches the extension name directly to the `+++` fence
* primary extension payload is opaque
* immediately adjacent `+++fallback` content is parsed as ordinary `&ND` blocks

### `seed-orphan-fallback-block`

Input:

```text
+++chart/pie
apples: 30
+++

+++fallback
Chart unavailable.
+++
```

Expected result:

* parse failure
* error code `orphan_fallback_block`
* reason: fallback is only valid when directly adjacent to the immediately preceding extension
  block

### `seed-fallback-not-immediately-after-extension`

Input:

```text
+++chart/pie
apples: 30
+++

Paragraph.

+++fallback
Chart unavailable.
+++
```

Expected result:

* parse failure
* error code `orphan_fallback_block`
* reason: any intervening block makes the fallback orphaned

### `seed-nested-fallback-block`

Input:

```text
+++chart/pie
apples: 30
+++
+++fallback
+++media/image
src: ./chart.png
+++
+++fallback
Image fallback.
+++
+++
```

Expected result:

* parse failure
* error code `nested_fallback_block`
* reason: fallback content is parsed as ordinary `&ND`, but extension blocks parsed inside
  fallback content cannot themselves receive fallback blocks

### `seed-unclosed-extension-block`

Input:

```text
+++chart/pie
apples: 3
```

Expected result:

* parse failure
* error code `unclosed_extension_block`

### `seed-extension-uppercase-name`

Input:

```text
+++Chart/pie
payload
+++
```

Expected result:

* parse failure
* error code `invalid_extension_name`
* reason: extension names are lowercase in strict mode

### `seed-invalid-escape`

Input:

```text
\q
```

Expected result:

* parse failure
* error code `invalid_escape`

### `seed-budget-block-count-at-limit`

Input:

```text
One

Two
```

Expected result:

* parse success when whole-document block-count equals the configured budget
* budget limit is inclusive

### `seed-budget-block-count`

Input:

```text
One

Two
```

Expected result:

* parse failure if configured whole-document block-count budget is exceeded
* error code `nd_budget_exceeded`
* budget failure occurs as blocks are created

### `seed-budget-code-block-size-at-limit`

Input:

````text
```
12345678
```
````

Expected result:

* parse success when raw code block payload size equals the configured budget
* budget limit is inclusive

### `seed-budget-code-block-size`

Input:

````text
```
123456789
```
````

Expected result:

* parse failure if configured raw block payload budget is exceeded
* error code `nd_budget_exceeded`
* budget failure occurs while scanning code block payload

### `seed-budget-document-size-at-limit`

Input:

```text
Hello
```

Expected result:

* parse success when normalized document size equals the configured budget
* budget limit is inclusive

### `seed-budget-document-size`

Input:

```text
This document is too long.
```

Expected result:

* parse failure if configured document-size budget is exceeded
* error code `nd_budget_exceeded`
* scanner rejects before unrestricted block parsing

### `seed-budget-extension-block-size-at-limit`

Input:

```text
+++diagram/opaque
12345678
+++
```

Expected result:

* parse success when extension block payload size equals the configured budget
* budget limit is inclusive

### `seed-budget-extension-block-size`

Input:

```text
+++diagram/opaque
123456789
+++
```

Expected result:

* parse failure if configured extension block payload budget is exceeded
* error code `nd_budget_exceeded`
* budget failure occurs while scanning opaque extension payload

### `seed-budget-inline-depth-at-limit`

Input:

```text
[* outer [* inner]]
```

Expected result:

* parse success when inline nesting depth equals the configured budget
* budget limit is inclusive

### `seed-budget-inline-depth`

Input:

```text
[* outer [* inner]]
```

Expected result:

* parse failure if configured inline nesting-depth budget is exceeded
* error code `nd_budget_exceeded`
* budget failure occurs when entering nested inline content

### `seed-budget-line-length-at-limit`

Input:

```text
Hello
```

Expected result:

* parse success when physical line length equals the configured budget
* budget limit is inclusive

### `seed-budget-line-length`

Input:

```text
This line is too long.
```

Expected result:

* parse failure if configured physical-line-length budget is exceeded
* error code `nd_budget_exceeded`
* scanner rejects during line validation

### `seed-budget-link-target-at-limit`

Input:

```text
[@ abc| label]
```

Expected result:

* parse success when link target length equals the configured budget
* budget limit is inclusive

### `seed-budget-link-target`

Input:

```text
[@ https://example.invalid/...very-long... | label]
```

Expected result:

* parse failure if configured link-target budget is exceeded
* error code `nd_budget_exceeded`
* scanner stops at the budget boundary rather than consuming unbounded input

### `seed-budget-list-item-count-at-limit`

Input:

```text
- One
- Two
```

Expected result:

* parse success when whole-document list-item count equals the configured budget
* budget limit is inclusive

### `seed-budget-list-item-count`

Input:

```text
- One
- Two
- Three
```

Expected result:

* parse failure if configured list-item budget is exceeded
* error code `nd_budget_exceeded`
* budget failure occurs as list items are recognized

### `seed-budget-list-item-count-whole-document`

Input:

```text
- One

- Two
- Three
```

Expected result:

* parse failure if configured list-item budget is exceeded across separate lists
* error code `nd_budget_exceeded`
* list-item budget is a whole-document budget

### `seed-budget-nesting-depth-at-limit`

Input:

```text
> Quote
```

Expected result:

* parse success when block nesting depth equals the configured budget
* budget limit is inclusive

### `seed-budget-nesting-depth`

Input:

```text
> Quote
```

Expected result:

* parse failure if configured block nesting-depth budget is exceeded
* error code `nd_budget_exceeded`
* budget failure occurs when entering a nested block context

### `seed-budget-table-columns-at-limit`

Input:

```text
| A | B |
| --- | --- |
| 1 | 2 |
```

Expected result:

* parse success when table column count equals the configured budget
* budget limit is inclusive

### `seed-budget-table-columns`

Input:

```text
| A | B | C |
| --- | --- | --- |
| 1 | 2 | 3 |
```

Expected result:

* parse failure if configured table-column budget is exceeded
* error code `nd_budget_exceeded`
* budget failure occurs before unrestricted table cell parsing

### `seed-nested-list-two-space-indent`

Input:

```text
- Parent

  - Child
  - Child
- Next parent
```

Expected result:

* parse success
* one unordered list block
* first parent item contains a nested unordered list with two child items
* second parent item is a sibling of the first parent item

### `seed-nested-list-deep`

Input:

```text
- One

  - Two

    - Three

      - Four
```

Expected result:

* parse success
* one unordered list block
* nested lists recurse through all four levels
* each nested level still depends on a blank line plus the exact two-space content margin

### `seed-list-item-paragraph-continuation-exact-margin`

Input:

```text
- Parse strict documents
  world
```

Expected result:

* parse success
* one unordered list block
* one list item
* item contains one paragraph with two source lines
* continuation line starts at the exact two-space list-item content margin

### `seed-list-item-unindented-line-ends-list`

Input:

```text
- Parse strict documents
world
```

Expected result:

* parse success
* one unordered list block
* one following top-level paragraph
* unindented text immediately after a list item ends the list

### `seed-list-item-nested-paragraph-exact-margin`

Input:

```text
1. Hello
2. Happy

  World
```

Expected result:

* parse success
* one ordered list block
* second item contains a nested paragraph
* nested paragraph starts at the exact two-space list-item inner margin

### `seed-list-item-unindented-paragraph-after-blank`

Input:

```text
1. Hello
2. Happy

World
```

Expected result:

* parse success
* one ordered list block
* one following top-level paragraph
* unindented text after a blank line is not captured into the previous list item

### `seed-nested-list-invalid-indent-one-space`

Input:

```text
- Parent

 - Child
```

Expected result:

* parse failure
* reason: structural indentation is exactly two spaces in Core v1

### `seed-nested-list-invalid-indent-tab`

Input:

```text
- Parent

	- Child
```

Expected result:

* parse failure
* reason: tabs are invalid where indentation is structural

### `seed-nested-list-needs-blank-line`

Input:

```text
- Parent
  - Child
```

Expected result:

* parse failure
* reason: nested blocks require a blank line before the nested block in Core v1

### `seed-blockquote-two-paragraphs`

Input:

```text
> First paragraph
>
> Second paragraph
```

Expected result:

* parse success
* one blockquote block
* blockquote contains two paragraph children

### `seed-blockquote-escaped-inline`

Input:

```text
> \[* not strong]
```

Expected result:

* parse success
* one blockquote block
* quoted paragraph contains plain text `[* not strong]`
* no strong inline node

### `seed-list-item-raw-block`

Input:

````text
- Parent

  ```txt
  raw
  ```
````

Expected result:

* parse success
* one unordered list block
* first item contains one nested code block
* code payload is `raw`

### `seed-list-item-extension-block`

Input:

```text
- Parent

  +++chart/pie
  apples: 3
  +++
```

Expected result:

* parse success
* one unordered list block
* first item contains one nested extension block
* extension payload is `apples: 3`

### `seed-list-item-heading`

Input:

```text
- Parent

  ## Child heading
```

Expected result:

* parse success
* one unordered list block
* first item contains one nested heading block
* heading level is `2`

### `seed-list-item-horizontal-rule`

Input:

```text
- Parent

  ---
```

Expected result:

* parse success
* one unordered list block
* first item contains one nested horizontal rule block

### `seed-list-item-table`

Input:

```text
- Parent

  | A | B |
  | --- | --- |
  | 1 | 2 |
```

Expected result:

* parse success
* one unordered list block
* first item contains one nested table block
* table has two columns and one body row

### `seed-list-item-table-missing-separator`

Input:

```text
- Parent

  | A | B |
  plain text
```

Expected result:

* parse success
* one unordered list block
* first item contains one paragraph block with two lines
* no nested table block

### `seed-list-item-table-mismatched-body-row`

Input:

```text
- Parent

  | A | B |
  | --- | --- |
  | 1 | 2 | 3 |
```

Expected result:

* parse failure
* error code `invalid_table_shape`
* reason: nested table body row has a different cell count from the header row and MUST fail
  rather than falling back to paragraph text

### `seed-list-item-raw-block-bad-closing-margin`

Input:

````text
- Parent

  ```txt
  raw
 ```
````

Expected result:

* parse failure
* reason: raw block closer must appear at the same block margin as the opener

### `seed-list-item-extension-block-bad-closing-margin`

Input:

```text
- Parent

  +++chart/pie
  apples: 3
 +++
```

Expected result:

* parse failure
* error code `extension_block_bad_closing_margin`
* reason: extension block closer must appear at the same block margin as the opener

### `seed-list-item-blockquote`

Input:

```text
- Parent

  > Quote line
```

Expected result:

* parse success
* one unordered list block
* first item contains one nested blockquote block
* blockquote contains one paragraph child

### `seed-list-item-blockquote-two-paragraphs`

Input:

```text
- Parent

  > First paragraph
  >
  > Second paragraph
```

Expected result:

* parse success
* one unordered list block
* first item contains one nested blockquote block
* blockquote contains two paragraph children

### `seed-blockquote-nested-list`

Input:

```text
> Quote intro
>
> - Child item
```

Expected result:

* parse success
* one blockquote block
* blockquote contains one paragraph child followed by one nested unordered list child

### `seed-blockquote-nested-list-needs-margin`

Input:

```text
> Quote intro
>
- Child item
```

Expected result:

* parse success
* one blockquote block containing one paragraph child
* one top-level unordered list block
* the list is not nested in the blockquote because it does not begin at the blockquote's current block margin

### `seed-blockquote-table-mismatched-body-row`

Input:

```text
> Quote intro
>
> | A | B |
> | --- | --- |
> | 1 | 2 | 3 |
```

Expected result:

* parse failure
* error code `invalid_table_shape`
* reason: a nested table inside a blockquote uses the same recognized table shape rules and MUST
  fail rather than falling back to quoted paragraph text

### `seed-blockquote-nested-code-block`

Input:

````text
> Quote intro
>
> ```txt
> raw
> ```
````

Expected result:

* parse success
* one blockquote block
* blockquote contains one paragraph child followed by one nested code block child
* code payload is `raw`

### `seed-blockquote-nested-extension-block`

Input:

```text
> Quote intro
>
> +++chart/pie
> apples: 3
> +++
```

Expected result:

* parse success
* one blockquote block
* blockquote contains one paragraph child followed by one nested extension block child
* extension payload is `apples: 3`

### `seed-blockquote-raw-block-bad-closing-margin`

Input:

````text
> Quote intro
>
> ```txt
> raw
```
````

Expected result:

* parse failure
* reason: raw block closer must appear at the same block margin as the opener inside the enclosing blockquote

### `seed-blockquote-extension-block-bad-closing-margin`

Input:

```text
> Quote intro
>
> +++chart/pie
> apples: 3
+++
```

Expected result:

* parse failure
* error code `extension_block_bad_closing_margin`
* reason: extension block closer must appear at the same block margin as the opener inside the enclosing blockquote

### `seed-list-item-blockquote-then-sibling`

Input:

```text
- Parent

  > Quote line
- Next parent
```

Expected result:

* parse success
* one unordered list block
* first item contains one nested blockquote child
* second parent item is a sibling at the outer list level

### `seed-blockquote-escaped-inline-opener`

Input:

```text
> \[@ https://example.com | label]
```

Expected result:

* parse success
* one blockquote block
* quoted paragraph contains plain text `[@ https://example.com | label]`
* no link inline node

### `seed-inline-nested-strong-emphasis`

Input:

```text
[* strong [/ emphasis]]
```

Expected result:

* parse success
* one paragraph block
* paragraph contains one strong node
* the strong node contains text plus one nested emphasis node

### `seed-inline-unclosed-strong`

Input:

```text
[* strong
```

Expected result:

* parse failure
* error code `unclosed_inline`

### `seed-inline-strong-newline`

Input:

```text
[* strong
continued]
```

Expected result:

* parse failure
* error code `unclosed_inline`
* reason: inline strong node crosses a line boundary before closing

### `seed-inline-unclosed-nested`

Input:

```text
[* strong [/ emphasis]
```

Expected result:

* parse failure
* error code `unclosed_inline`

### `seed-inline-unexpected-closing`

Input:

```text
text ]
```

Expected result:

* parse failure
* error code `unexpected_closing`

### `seed-inline-overlap-attempt`

Input:

```text
[* strong [/ emphasis] text]
```

Expected result:

* parse success
* one strong node containing one nested emphasis node and trailing text
* nesting is strictly tree-structured, not overlapping

### `seed-inline-code-opaque-brackets`

Input:

```text
[$ \[* not strong\] \[@ x \| y\]]
```

Expected result:

* parse success
* one inline code node
* code payload is `[* not strong] [@ x | y]`
* no nested strong or link nodes inside code

### `seed-inline-link-label-nesting`

Input:

```text
[@ https://example.com | [* label]]
```

Expected result:

* parse success
* one link node with the given target
* link label contains one nested strong node

### `seed-inline-link-missing-label`

Input:

```text
[@ https://example.com | ]
```

Expected result:

* parse failure
* reason: link label is required in Core v1

### `seed-inline-link-missing-target`

Input:

```text
[@ | label]
```

Expected result:

* parse failure
* reason: link target is required in Core v1

### `seed-inline-escaped-pipe-in-link-target`

Input:

```text
[@ https://example.com/a\|b | label]
```

Expected result:

* parse success
* one link node
* target contains the literal pipe character `|`

### `seed-inline-nbsp`

Input:

```text
A[_]B
```

Expected result:

* parse failure
* error code `unknown_inline_type`
* `[_]` is not assigned in Core v1

### `seed-inline-reserved-anchor-tag`

Input:

```text
[# section]
```

Expected result:

* parse failure
* error code `unknown_inline_type`
* `[# ...]` remains reserved in Core v1

### `seed-inline-reserved-reference-tag`

Input:

```text
[~ mention]
```

Expected result:

* parse failure
* error code `unknown_inline_type`
* `[~ ...]` remains reserved in Core v1

### `seed-inline-reserved-admonition-tag`

Input:

```text
[! warning]
```

Expected result:

* parse failure
* error code `unknown_inline_type`
* `[! ...]` remains reserved in Core v1

### `seed-inline-reserved-footnote-tag`

Input:

```text
[^ note]
```

Expected result:

* parse failure
* error code `unknown_inline_type`
* `[^ ...]` remains reserved in Core v1

### `seed-inline-reserved-todo-marker`

Input:

```text
[x]
```

Expected result:

* parse failure
* error code `unknown_inline_type`
* `[x]` remains reserved in Core v1

### `seed-inline-reserved-todo-unchecked-marker`

Input:

```text
[ ]
```

Expected result:

* parse failure
* error code `unknown_inline_type`
* `[ ]` remains reserved in Core v1

### `seed-inline-reserved-todo-in-progress-marker`

Input:

```text
[=]
```

Expected result:

* parse failure
* error code `unknown_inline_type`
* `[=]` remains reserved in Core v1

### `seed-inline-reserved-todo-cancelled-marker`

Input:

```text
[.]
```

Expected result:

* parse failure
* error code `unknown_inline_type`
* `[.]` remains reserved in Core v1

### `seed-inline-invalid-escape-in-code`

Input:

```text
[$ \q]
```

Expected result:

* parse failure
* error code `invalid_escape`

### `seed-source-spans-table-inline`

Input:

```text
&ND v1

|  Name  | Link\|Text |
| --- | --- |
|  Alpha | [* Strong] |
```

Expected result:

* parse success
* optional source-span CTS metadata checks may be evaluated separately from semantic AST equality
* table block span covers the full table source range
* inline spans inside table cells point at trimmed cell content
* escaped pipes inside table cells remain part of the cell source span
* nested inline spans inside table cells point at their exact source ranges

### `seed-source-spans-extension-fallback`

Input:

```text
&ND v1

+++unsupported/extension
opaque [* extension] payload
+++
+++fallback
Show [* this] instead
+++
```

Expected result:

* parse success
* optional source-span CTS metadata checks may be evaluated separately from semantic AST equality
* extension block span covers only the primary opaque extension block, not the attached fallback
* fallback paragraph spans point at parsed fallback content after the reserved `+++fallback` opener
* nested inline spans inside fallback content point at their exact source ranges

### `seed-source-spans-list-item-blockquote`

Input:

```text
&ND v1

- Parent

  > First paragraph
  >
  > Second paragraph
```

Expected result:

* parse success
* optional source-span CTS metadata checks may be evaluated separately from semantic AST equality
* list item spans cover the full nested block range belonging to that item
* nested blockquote spans include both quoted paragraphs but not the blank line before the nested block
* quoted paragraph spans point at the trimmed inner content after the list and blockquote margins

---

# **8. Structural Constraints**

Parser MUST enforce:

* Proper nesting of inline nodes
* Balanced delimiters
* No overlapping spans
* No unclosed blocks
* No mixed block contexts
* No hidden reinterpretation of a line from paragraph text into a block opener without a blank-line
  boundary

---

# **9. Output Model**

Abstract tree:

```json
{
  "type": "document",
  "children": [
    { "type": "heading", "level": 1 },
    { "type": "paragraph" },
    { "type": "list", "ordered": false },
    { "type": "code_block" },
    { "type": "horizontal_rule" },
    {
      "type": "extension_block",
      "name": "chart/pie",
      "content": "...",
      "fallback": {
        "type": "document_fragment",
        "children": [{ "type": "paragraph" }]
      }
    }
  ]
}
```

Inline:

```json
{ "type": "strong", "children": [...] }
{ "type": "emphasis", "children": [...] }
{ "type": "code", "text": "..." }
{ "type": "link", "href": "...", "children": [...] }
```

---

# **10. Error Model**

## 10.1 Failure Behavior

* Parsing MUST fail-closed
* No partial AST in strict mode

## 10.2 Error Output

```json
{
  "ok": false,
  "errors": [
    {
      "code": "unclosed_inline",
      "line": 4,
      "col": 12
    }
  ]
}
```

---

## 10.3 Error Categories

### Structural

* `unclosed_inline`
* `invalid_nesting`
* `unexpected_closing`
* `unknown_inline_type`

### Block

* `unclosed_code_block`
* `unclosed_extension_block`
* `extension_block_bad_closing_margin`
* `orphan_fallback_block`
* `nested_fallback_block`
* `invalid_table_shape`
* `invalid_ordered_list_sequence`

### Lexical

* `invalid_escape`
* `invalid_token`

---

# **11. Resource Limits (Security)**

Implementations MUST support limits:

* max document size
* max line length
* max nesting depth
* max inline depth
* max table columns
* max block size (code/extension)
* max block count
* max list item count
* max link target length

Implementations MUST enforce these limits during parsing, not after building an unrestricted
intermediate structure.

`max block count` and `max list item count` are whole-document limits. `max nesting depth` counts
entry into nested block contexts from the top-level document context. `max inline depth` counts
entry into recursively parsed inline content such as span bodies and link labels.

Strict-mode budget failure MUST produce no document.

Complexity requirements:

* Parsing a document of size `n` MUST be implementable in linear time with respect to `n`, subject
  to configured budgets.
* Implementations MUST avoid parser strategies whose worst-case behavior is superlinear on valid or
  invalid input.
* Implementations MUST avoid regular-expression or parser-combinator patterns that can introduce
  catastrophic backtracking on attacker-controlled input.

On exceed:

```json
{
  "code": "nd_budget_exceeded"
}
```

---

# **12. Non-Goals**

Excluded from v1:

* images
* footnotes
* attributes
* HTML embedding
* macros
* includes
* task lists
* table alignment
* math/diagrams (extensions only)

---

# **13. Relationship to AEON**

* &ND is not AEON
* &ND may be embedded in AEON annotations
* &ND produces a document tree
* Interpretation belongs to consumers/tonics

---

# **14. Guarantees**

## 🔒 Language Guarantees

* Single canonical grammar
* No dialects
* No implicit behavior
* No global references
* No HTML passthrough
* No executable constructs

## 🔒 Structural Guarantees

* Fully typed AST output
* Inline constructs are local
* Blocks cannot interrupt paragraphs
* Proper nesting required

## 🔒 Extension Guarantees

* Opaque
* Non-executable
* Do not alter parsing
* Consumer-defined semantics

---

# **15. Final Lock**

> &ND is not forgiving markup.
> It is deterministic structured prose.

---

The following EBNF summarizes the core grammar.
Margin-sensitive and state-sensitive behavior remains governed by the normative prose above.

```ebnf
Document        ::= Header? BlankLine? Block* EOF ;

Header          ::= "&ND" SP "v1" LineEnd ;

Block           ::= Heading
                  | HorizontalRule
                  | CodeBlock
                  | ExtensionBlock
                  | Table
                  | Blockquote
                  | List
                  | Paragraph ;

BlankLine       ::= WS? LineEnd ;
LineEnd         ::= "\n" | "\r\n" ;
SP              ::= " " ;
WS              ::= " " | "\t" ;
EOF             ::= ? end of input ? ;
```

## Blocks

````ebnf
Heading         ::= HeadingMarker WS InlineContent LineEnd ;
HeadingMarker   ::= "#" | "##" | "###" | "####" | "#####" | "######" ;

HorizontalRule  ::= "---" WS? LineEnd ;

Paragraph       ::= ParagraphTextLine+ ;
ParagraphTextLine ::= !BlankLine InlineContent LineEnd ;
````

Normative note:

```text
ParagraphTextLine is selected only after the parser has determined that the current position is not
block-open eligible for another block. In other words, block-open eligibility is a parser-state
rule, not a textual negative lookahead on every paragraph line. Blank lines remain structural
separators and are never paragraph content.
```

## Lists

```ebnf
List            ::= UnorderedList | OrderedList ;

UnorderedList   ::= UnorderedItem+ ;
UnorderedItem   ::= Indent? "- " InlineContent LineEnd NestedBlock* ;

OrderedList     ::= OrderedItem+ ;
OrderedItem     ::= Indent? OrderedMarker WS InlineContent LineEnd NestedBlock* ;

OrderedMarker   ::= Digit+ "." ;

NestedBlock     ::= Indent Block ;

Indent          ::= SP SP ;
Digit           ::= "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
```

List note:

```text
The EBNF shows structural containment only. The required blank-line boundary before a nested block
is a normative prose rule and is not fully expressed in this summary grammar.
```

## Blockquotes

```ebnf
Blockquote      ::= QuoteLine+ ;
QuoteLine       ::= ">" WS? InlineContent? LineEnd ;
```

Blockquote note:

```text
The EBNF shows the quoted line prefix only. Nested block behavior inside a blockquote is governed
by the normative prose and scanner rules: a blockquote establishes an inner block context, blank
quoted lines preserve that context, and nested blocks use the blockquote's inner current block
margin.
```

## Code blocks

````ebnf
CodeBlock       ::= PlainCodeBlock | OrderedCodeBlock ;
PlainCodeBlock  ::= CodeOpen RawLines CodeClose ;
OrderedCodeBlock ::= OrderedCodeOpen RawLines OrderedCodeClose ;
CodeOpen        ::= "```" CodeLang? LineEnd ;
CodeClose       ::= "```" WS? LineEnd ;
OrderedCodeOpen ::= "````" CodeLang? LineEnd ;
OrderedCodeClose ::= "````" WS? LineEnd ;
CodeLang        ::= Ident ;
````

`RawLines` is implementation-defined scanning: consume all text until the first line matching the
corresponding closing fence at the same block margin. Triple backticks produce a plain code block.
Quadruple backticks produce an ordered code block whose payload lines retain their raw text while
explicitly requesting line ordering in downstream projections.

## Extension blocks

```ebnf
ExtensionBlock  ::= ExtensionOpen RawLines ExtensionClose FallbackBlock? ;
ExtensionOpen   ::= "+++" WS? ExtensionName LineEnd ;
ExtensionClose  ::= "+++" WS? LineEnd ;
FallbackBlock   ::= "+++fallback" LineEnd Block* ExtensionClose ;

ExtensionName   ::= LowIdent ( "/" LowIdent )* ( ".v" Digit+ )? ;

LowIdent        ::= LowIdentStart LowIdentChar* ;
LowIdentStart   ::= "a".."z" ;
LowIdentChar    ::= LowIdentStart | Digit | "-" ;
```

`RawLines` is opaque: no inline parsing, no block parsing, no nesting in v1.
If present, `FallbackBlock` MUST be directly adjacent to the preceding extension close and is parsed
as ordinary `&ND` block content.
`fallback` is a reserved extension name and MUST NOT be interpreted as a general extension block.

## Tables

```ebnf
Table           ::= TableHeader TableSeparator TableBody ;
TableHeader     ::= TableRow ;
TableSeparator  ::= TableSepRow ;
TableBody       ::= TableRow+ ;

TableRow        ::= "|" TableCell ( "|" TableCell )* "|" WS? LineEnd ;
TableSepRow     ::= "|" TableSepCell ( "|" TableSepCell )* "|" WS? LineEnd ;

TableCell       ::= WS? InlineContent? WS? ;
TableSepCell    ::= WS? "---" WS? ;
```

Semantic table rule:

```text
header column count == separator column count == every body row column count
```

## Inline content

```ebnf
InlineContent   ::= InlineNode* ;

InlineNode      ::= Text
                  | Strong
                  | Emphasis
                  | Link
                  | Code ;

Strong          ::= "[*" WS InlineContent "]" ;
Emphasis        ::= "[/" WS InlineContent "]" ;
Link            ::= "[@" WS LinkTarget WS? "|" WS? LinkLabel "]" ;
Code            ::= "[$" WS InlineRaw "]" ;

LinkTarget      ::= LinkChar+ ;
LinkLabel       ::= InlineNode+ ;
InlineRaw       ::= RawChar* ;
```

Inline code rule:

```text
Inline code suppresses inline-node parsing inside [$ ...].
It still uses the inline-code escape rules for delimiter safety.
Only \], \\, \[, and \| are recognized escapes inside inline code, and any unescaped ] closes the
construct.
```

## Block margin note

```text
The EBNF below omits indentation-sensitive margin parameters for readability. Where the prose says
"current block margin", implementations must apply that margin-sensitive rule even if the raw EBNF
shows an unindented opener form.
```

## Text and escaping

```ebnf
Text            ::= TextChar+ ;

TextChar        ::= EscapedChar | NormalChar ;

EscapedChar     ::= "\" Escapable ;
Escapable       ::= "[" | "]" | "|" | "\" ;

NormalChar      ::= ? any character except [, ], \, line ending ? ;

RawChar         ::= EscapedChar | RawNormalChar ;
RawNormalChar   ::= ? any character except ], \, line ending ? ;

LinkChar        ::= EscapedChar | LinkNormalChar ;
LinkNormalChar  ::= ? any character except |, ], \, line ending ? ;
```

## Identifiers

```ebnf
Ident           ::= IdentStart IdentChar* ;
IdentStart      ::= "A".."Z" | "a".."z" ;
IdentChar       ::= IdentStart | Digit | "_" | "-" | "." ;
```

## Normative parser rules not fully captured by EBNF

```text
1. Parser MUST fail-closed on unclosed inline spans.
2. Parser MUST fail-closed on unclosed code or extension blocks.
3. Inline spans MUST form a proper tree.
4. Code blocks and extension blocks are raw islands.
5. Extension blocks MUST NOT nest in v1.
6. Tables MUST have equal cell counts per row.
7. Escapes apply only to [, ], |, and \.
8. Unknown inline tags are invalid in Core v1.
9. Unknown extension names are valid but opaque.
10. A line beginning with --- (no leading |) is always a HorizontalRule; table separator
    rows always start with |.
11. Structural indentation (list nesting) uses spaces only; tabs are invalid in Indent.
12. The &ND v1 header is optional; its presence or absence is governed by the embedding
    profile or tool convention.
13. Blocks may open only at document start or immediately after a blank line.
14. A paragraph continuation line is never reinterpreted as a block opener.
15. Escape handling is lexical during inline scanning; there is no post-parse escape pass.
16. Parser behavior MUST be bounded-lookahead and non-backtracking.
17. A nested block inside a list item requires a blank line before that nested block.
18. A blockquote establishes an inner block context for nested block recognition.
19. Blank quoted lines preserve the enclosing blockquote context.
20. Nested blocks inside a blockquote use the blockquote's inner current block margin.
```

---
