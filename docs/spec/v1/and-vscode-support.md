# &ND Core v1 — VS Code Support Proposal

## 1. Purpose

This document describes a practical editor-support stack for `&ND Core v1`, with Visual Studio
Code as the primary target.

The goal is not only to color syntax, but to make `&ND` feel reliable and first-class inside an
IDE:

- predictable highlighting
- structural navigation
- deterministic diagnostics
- safe handling of malformed input
- room for embedded-language support

`&ND` is especially well suited to this because its syntax is explicit, fail-closed, and designed
to avoid Markdown-style ambiguity.

---

## 2. Design Goals

Editor support for `&ND` SHOULD preserve the same philosophy as the language itself:

- no guess-heavy parsing
- no forgiving reinterpretation
- no syntax highlighting that hides structural errors
- no dependency on Markdown heuristics

The editor stack SHOULD separate:

1. fast lexical highlighting
2. editor behaviors such as brackets and folding
3. parser-backed diagnostics and symbols
4. optional embedded-language support

---

## 3. Recommended Stack

### 3.1 Layer 1: TextMate Grammar

Use a TextMate grammar for:

- immediate syntax coloring
- lightweight bracket-aware editor behavior
- compatibility with standard VS Code themes

This layer SHOULD be treated as lexical only.
It SHOULD NOT be treated as the source of truth for structural validity.

### 3.2 Layer 2: Language Configuration

Use a VS Code language configuration for:

- bracket pairs
- auto-closing pairs
- surrounding pairs
- indentation rules
- folding markers where purely textual

### 3.3 Layer 3: Language Server

Use a parser-backed language server for:

- diagnostics
- document symbols
- outline view
- folding ranges
- semantic selections
- hover information
- future code actions

This layer SHOULD use the actual `&ND` parser rules, budgets, and strict-mode behavior.

### 3.4 Layer 4: Embedded Languages

Use embedded-language support for:

- fenced code blocks
- selected `+++extension` blocks

This layer is optional for the first release, but the architecture SHOULD allow it.

---

## 4. File Identity

Recommended initial file support:

- `.and`
- `.and.txt` only if plain-text compatibility is needed

Language id:

```text
and
```

Display name:

```text
&ND
```

---

## 5. TextMate Token Plan

### 5.1 Top-Level Tokens

The grammar SHOULD recognize at least:

- `&ND v1` header
- ATX headings `#` through `######`
- unordered list markers `- `
- ordered list markers `1. `
- blockquote markers `>`
- horizontal rule `---`
- code fences ````` ``` `````
- extension fences `+++`
- table pipes `|`
- table separator cells `---`

### 5.2 Inline Tokens

The grammar SHOULD recognize at least:

- strong opener `[*`
- emphasis opener `[/`
- link opener `[@`
- inline code opener `[$`
- closing `]`
- link delimiter `|`
- escapes:
  - `\[`
  - `\]`
  - `\|`
  - `\\`

### 5.3 Invalid Lexical Forms

The grammar SHOULD highlight obvious lexical-invalid forms distinctly, for example:

- `[x something]`
- reserved todo-like markers such as `[ ]`, `[x]`, `[=]`, and `[.]`
- unassigned bracket forms such as `[_]` and `[<]`
- invalid escapes such as `\q`
- fence-like openers in places where only plain text is lexically expected

This does not replace parser diagnostics, but it helps the editor surface likely mistakes quickly.
Reserved todo-like markers SHOULD be highlighted as reserved-or-future syntax rather than as valid
Core v1 task-list semantics.
`[_]` and `[<]` SHOULD be highlighted as unassigned invalid syntax rather than as valid Core v1
inline forms.

---

## 6. Suggested TextMate Scope Mapping

Suggested scope families:

- header:
  - `entity.name.type.and`
  - `keyword.other.declaration.and`
- headings:
  - `markup.heading.1.and`
  - `markup.heading.2.and`
  - `markup.heading.3.and`
  - `markup.heading.4.and`
  - `markup.heading.5.and`
  - `markup.heading.6.and`
- list markers:
  - `markup.list.unnumbered.and`
  - `markup.list.numbered.and`
- blockquote marker:
  - `markup.quote.and`
- horizontal rule:
  - `meta.separator.and`
- code fence:
  - `markup.fence.code.and`
  - `entity.name.section.code-language.and`
- extension fence:
  - `markup.fence.extension.and`
  - `entity.name.type.extension.and`
- table punctuation:
  - `punctuation.definition.table.and`
- strong:
  - `markup.bold.and`
- emphasis:
  - `markup.italic.and`
- link:
  - `markup.underline.link.and`
  - `string.other.link-target.and`
  - `punctuation.separator.link.and`
- inline code:
  - `markup.inline.raw.and`
- escape:
  - `constant.character.escape.and`
- invalid:
  - `invalid.illegal.and`

The exact scope names MAY vary, but they SHOULD map cleanly onto existing theme expectations.
The semantic meaning of these inline forms remains `strong` and `emphasis`; theme scopes are
presentation mappings only.

---

## 7. Language Configuration

### 7.1 Brackets

Recommended bracket pairs:

- `[` `]`
- `(` `)` only if later editor features need them in embedded regions

### 7.2 Auto-Closing Pairs

Recommended auto-closing pairs:

- `[` → `]`
- optionally `` ` `` inside embedded code contexts only if that proves useful

The extension SHOULD be conservative here.
`&ND` does not benefit from aggressive auto-closing beyond square brackets.

### 7.3 Surrounding Pairs

Recommended surrounding pairs:

- `[` `]`
- `"` `"`
- `'` `'`

### 7.4 Folding

Initial folding support SHOULD cover:

- fenced code blocks
- extension blocks
- consecutive list subtrees when parser-backed folding is available
- heading-based folding through the language server

### 7.5 Indentation

Editor indentation behavior SHOULD prefer:

- two-space structural indentation
- no tabs for structural indentation

The language server SHOULD diagnose structural tab misuse.

---

## 8. Language Server Responsibilities

### 8.1 Diagnostics

The language server SHOULD surface at least:

- `invalid_escape`
- `unknown_inline_type`
- `unclosed_inline`
- `unexpected_closing`
- `unclosed_code_block`
- `unclosed_extension_block`
- `invalid_table_shape`
- invalid structural indentation
- missing blank line before nested blocks
- budget exhaustion

Diagnostics SHOULD use the same codes and semantics as the language spec.

### 8.2 Symbols

Document symbols SHOULD include:

- headings
- extension blocks
- code blocks optionally, if useful for navigation

The outline view SHOULD primarily follow heading structure.

### 8.3 Folding Ranges

The language server SHOULD provide folding ranges for:

- heading sections
- blockquotes
- lists
- code blocks
- extension blocks
- tables if multi-line folding is useful

### 8.4 Semantic Navigation

Future language-server features MAY include:

- select enclosing inline node
- select enclosing block
- jump between opener and closer for inline spans or raw blocks
- inspect extension name and payload kind

---

## 9. Embedded Language Support

### 9.1 Fenced Code Blocks

Fenced code blocks SHOULD support language-id-based embedding when the language id maps cleanly to
an installed VS Code grammar.

Examples:

- ```` ```ts ```` → TypeScript
- ```` ```json ```` → JSON
- ```` ```aeon ```` → AEON, if available

### 9.2 Extension Blocks

Extension blocks MAY support embedded highlighting when the extension name is mapped deliberately.

Examples:

- `+++aeon`
- `+++chart/pie`
- `+++sql`

This mapping SHOULD be explicit.
Unknown extension names SHOULD remain opaque and receive only extension-block highlighting.

### 9.3 Safety Rule

Embedded highlighting MUST NOT change core `&ND` parsing semantics.
It is a presentation feature only.

---

## 10. What TextMate Can And Cannot Do

### 10.1 TextMate Is Good For

- lexical coloring
- obvious opener/closer highlighting
- simple block patterns
- embedded fenced-language handoff

### 10.2 TextMate Is Not Enough For

- enforcing blank-line requirements
- validating table shape
- enforcing current block margin
- validating nested block legality
- enforcing parser budgets
- distinguishing all valid vs invalid blockquote/list nesting cases

These belong in the parser-backed language server.

---

## 11. Recommended MVP

### Phase 1

Ship:

- TextMate grammar
- language configuration
- file association
- basic header, block, inline, and escape highlighting

### Phase 2

Ship:

- parser-backed diagnostics
- heading symbols
- folding ranges
- basic hover/error messages

### Phase 3

Ship:

- embedded fenced code highlighting
- selected extension-block embeddings
- richer structural navigation

---

## 12. Why `&ND` Fits IDE Use Well

Compared with Markdown, `&ND` is much easier to support precisely because:

- block starters are explicit
- inline forms are typed
- there is no emphasis-vs-text ambiguity
- raw regions are clearly delimited
- failure is explicit rather than heuristic

This means:

- coloring can be more accurate
- diagnostics can be more trustworthy
- malicious or malformed input is easier to flag early
- editor behavior can align with the language instead of compensating for ambiguity

The tradeoff is familiarity.
`&ND` is less immediately familiar than Markdown, but much better suited to a tooling-first
workflow.

---

## 13. Recommendation

`&ND` SHOULD be treated as:

- parser-first for truth
- TextMate-first for fast color
- language-server-backed for correctness

The syntax is strong enough to justify IDE-native support.
Its explicit structure is one of its main advantages over Markdown.
