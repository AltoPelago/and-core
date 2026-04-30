# &ND Core v1 — Implementation Guide

## 1. Status

This document is **non-normative**.

It describes a recommended engineering strategy for implementing `&ND Core v1` in a way that stays
aligned with the normative specification, canonical rules, and conformance seeds.

If this guide and the core specification ever disagree, the normative specification wins:

- [`and-core-proposal.md`](./and-core-proposal.md)
- [`and-canonical-rules.md`](./and-canonical-rules.md)

---

## 2. Purpose

The goal of this guide is to reduce implementation drift.

It is intended to help implementers build:

- deterministic parsers
- fail-closed validation
- budget-aware scanners
- canonical emitters
- editor recovery modes that do not leak into strict pipelines
- explicit forward-compatibility handling that does not weaken strict mode

It is especially important for `&ND` because the format is intentionally stricter than Markdown and
tries to avoid parser ambiguity and accidental complexity hazards.

---

## 3. Recommended Architecture

Recommended implementation layers:

1. input normalization
2. line scanner / block scanner
3. inline scanner
4. AST builder
5. strict-mode validator
6. optional recovery-mode editor adapter
7. optional forward-compatibility adapter
8. canonical emitter
9. conformance test suite

Each layer SHOULD have a narrow responsibility.
Avoid implementations that blur lexing, structural parsing, and emission into one large stateful
routine.

---

## 4. Core Principles For Implementers

### 4.1 Parser Truth Is Structural

The parser should decide structure from explicit syntax and parser state, not heuristics.

### 4.2 Fail Early

Structural invalidity, invalid escapes, bad nesting, and budget exhaustion should stop parsing as
soon as the failure is known in strict mode.

### 4.3 No Guessing

Do not “help” the author by repairing:

- unclosed inline spans
- malformed tables
- indentation mistakes
- unknown inline tags
- bad raw block closers

Those belong only in an explicitly separate editor recovery mode.

### 4.4 Keep Raw Regions Opaque

Code blocks and extension blocks are raw islands.
Inline code is delimiter-opaque.
Do not recursively parse their interiors as block or inline trees.

### 4.5 Budgets Are Part Of Parsing

Do not build unbounded intermediate structures and check limits afterward.
Budgets should be enforced during scanning and parsing.

---

## 5. Recommended Pipeline

### 5.1 Stage 1: Input Normalization

Normalize:

- line endings
- final trailing line handling
- byte offsets vs line/column tracking

Recommended approach:

- retain original byte offsets for diagnostics if needed
- normalize logical parsing to `\n`
- maintain a line table so diagnostics can still point back into the original source

Do not normalize:

- indentation width semantics
- escaped content
- raw payload contents beyond the line-ending rules permitted by the spec

### 5.2 Stage 2: Block Scanner

The block scanner should work line-by-line.

It should track:

- whether the current position is block-open eligible
- current block margin
- whether the parser is inside a raw island
- current nesting stack

Recommended output from this stage:

- block-level parse events or block skeleton nodes
- exact source spans for each recognized block

### 5.3 Stage 3: Inline Scanner

Run inline parsing only inside inline-capable regions:

- paragraph lines
- heading content
- list item inline heads
- blockquote inline lines
- table cells
- link labels

Do not run it inside:

- code blocks
- extension blocks
- inline code payload beyond delimiter-safe escape handling

### 5.4 Stage 4: AST Construction

Build a typed tree from the scanner outputs.

Suggested split:

- block node types
- inline node types
- source-span metadata

### 5.5 Stage 5: Validation

Validation should confirm:

- structural invariants
- table shape
- required fields such as non-empty link target and label
- nesting rules
- recovery-mode exclusions from strict mode

### 5.6 Stage 6: Emission

The canonical emitter should operate on a validated AST, not on raw source.

---

## 6. Input Model

Recommended parser input:

```ts
interface ParseNdInput {
  readonly text: string;
  readonly sourceName?: string;
  readonly budgets?: NdBudgets;
  readonly mode?: 'strict' | 'recovery' | 'forward_compat';
}
```

Recommended budget shape:

```ts
interface NdBudgets {
  readonly maxDocumentSize?: number;
  readonly maxLineLength?: number;
  readonly maxNestingDepth?: number;
  readonly maxInlineDepth?: number;
  readonly maxTableColumns?: number;
  readonly maxBlockSize?: number;
  readonly maxBlockCount?: number;
  readonly maxListItemCount?: number;
  readonly maxLinkTargetLength?: number;
}
```

The implementation MAY expose more limits internally, but it SHOULD support at least the normative
ones.

---

## 7. Recommended AST Shape

The spec defines required semantics, not a mandatory in-memory structure.

A practical AST split would be:

```ts
type NdBlockNode =
  | NdHeading
  | NdParagraph
  | NdList
  | NdListItem
  | NdBlockquote
  | NdCodeBlock
  | NdExtensionBlock
  | NdTable
  | NdHorizontalRule;

type NdInlineNode =
  | NdText
  | NdStrong
  | NdEmphasis
  | NdLink
  | NdInlineCode
  | NdLineBreak;
```

Tables should use structured cells rather than raw source rows:

```ts
interface NdTable {
  readonly type: "table";
  readonly header: NdTableCell[];
  readonly rows: NdTableCell[][];
}

interface NdTableCell {
  readonly children: NdInlineNode[];
}
```

Recommended metadata on every node:

```ts
interface NdSpan {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}
```

If spans are exposed publicly, keep the contract narrow and stable:

- normalized-source offsets only
- inclusive `startOffset`, exclusive `endOffset`
- one-based line and column coordinates
- block spans covering the structural source owned by the block
- inline spans pointing at the exact trimmed inline content rather than enclosing block delimiters

Avoid exposing parser-internal bookkeeping that would make future scanner, indentation, or recovery
refactors look like breaking API changes.

This makes diagnostics, editor integration, and conformance debugging much easier.

---

## 8. Block Scanner Strategy

### 8.1 State You Should Track

At minimum:

- current line index
- current block margin
- block-open eligibility
- nesting stack
- whether a raw block is open
- counts for budgets

### 8.2 Block Recognition Order

Recommended order at a block-open-eligible position:

1. code fence
2. extension fence
3. heading
4. horizontal rule
5. table candidate
6. blockquote
7. list item
8. paragraph

That order follows the intent of the spec:

- raw islands first
- strongly delimited blocks before softer line-based blocks
- paragraph as the fallback

### 8.3 Paragraph Handling

Paragraphs should be built as runs of paragraph lines until:

- blank line
- EOF
- a block-open-eligible position that actually opens another block

Do not use “looks like a list” as enough reason to break a paragraph if the parser is not
block-open eligible there.

### 8.4 Table Handling

A table should only be recognized after a one-line bounded lookahead confirms a valid separator row.

If the separator row is missing:

- do not create a table
- treat the lines according to the normal fallback block rules

### 8.5 Raw Block Handling

For code and extension blocks:

- capture opener metadata
- scan forward line-by-line
- accept only a closer at the same block margin as the opener
- fail immediately if EOF arrives first

Do not parse inside the payload.

---

## 9. Blockquote Strategy

Blockquotes deserve dedicated handling because they create an inner block context.

Recommended mental model:

- each quoted line contributes content to a logical blockquote interior
- the `>` marker is not itself a child node; it establishes quoted scope
- a blank `>` line preserves blockquote scope and marks a paragraph break inside it

Implementation strategy:

1. collect consecutive quote lines belonging to the same outer blockquote
2. strip the quote prefix while preserving source-span mapping
3. parse the inner content using the block scanner again, but with the blockquote’s inner block
   margin and eligibility rules

This recursive-inner-document model is often cleaner than trying to parse blockquotes inline with
the outer block scanner.

---

## 10. List Strategy

Lists are another place where drift is likely.

Recommended approach:

- parse a list item head first
- determine whether the item contains only inline head content or nested blocks too
- require the blank-line boundary before nested blocks
- treat structural indentation as exact, not fuzzy

Important:

- tabs must not be normalized into spaces for structural parsing
- one-space indentation must not be accepted as a relaxed variant

If the indentation contract is broken, fail in strict mode.

---

## 11. Inline Scanner Strategy

### 11.1 Left-To-Right Scan

Use a left-to-right scanner with a small explicit state stack.

At each position:

1. check for valid escape
2. check for valid inline opener
3. check for invalid closing
4. otherwise emit text

Avoid regex-heavy approaches that can create hidden performance problems.

### 11.2 Stack Discipline

Track open inline constructs explicitly.

Recommended stack entries:

- strong
- emphasis
- link
- inline code

On close:

- the closer must match the current top of stack
- otherwise fail with the appropriate structural error

### 11.3 Inline Code

Inline code is special:

- it suppresses nested inline-node parsing
- it still recognizes escapes needed to represent delimiter-sensitive characters

Recommended implementation:

- once `[$` is opened, switch to a simpler raw-inline scanner
- allow only the defined escapes
- stop only on an unescaped closing `]`

### 11.4 Links

Links should be parsed as:

- non-empty target
- delimiter pipe
- non-empty label region

A good implementation should treat:

- empty target as failure
- empty label as failure
- escaped pipe in target as literal pipe

---

## 12. Parse Modes

### 12.1 Strict Mode

Strict mode should:

- return no AST on failure
- stop at first unrecoverable structural failure or budget failure
- avoid partial downstream use

### 12.2 Recovery Mode

Recovery mode is for editors only.

Recommended approach:

- preserve error nodes or recovery markers
- keep the tree clearly marked as partial
- never silently convert recovery output into strict pipeline output

### 12.3 Forward-Compatibility Mode

`forward_compat` is not a repair mode.

Its purpose is to allow explicitly opted-in consumers to continue through unknown future syntax in a
shared-version environment.

Recommended approach:

- keep strict mode as the default
- require an explicit mode switch to enter `forward_compat`
- record all downgraded unknown constructs
- mark the result as non-conformant
- forbid canonical, signing, or validation use of the downgraded result
- still fail on malformed known Core v1 syntax

Recommended downgrade policy:

- unknown future inline constructs may degrade to plain text
- unknown future extension-like block forms may degrade to opaque compatibility nodes
- malformed known syntax must still fail

Recommended result shape:

```ts
type NdParseResult =
  | { ok: true; document: NdDocument }
  | { ok: false; errors: NdError[] }
  | { ok: false; partial: true; document: NdDocument; errors: NdError[] }
  | {
      ok: true;
      mode: 'forward_compat';
      conformant: false;
      document: NdDocument;
      downgradedUnknowns: NdDowngradedUnknown[];
    };
```

Suggested downgrade record:

```ts
interface NdDowngradedUnknown {
  readonly kind: 'inline' | 'block';
  readonly sourceText: string;
  readonly span: NdSpan;
}
```

---

## 13. Diagnostics

Diagnostics should be stable and machine-friendly.

Recommended shape:

```ts
interface NdError {
  readonly code: string;
  readonly message: string;
  readonly line: number;
  readonly column: number;
  readonly endLine?: number;
  readonly endColumn?: number;
}
```

Prefer:

- stable error codes
- short human-readable messages
- precise spans

Do not rely only on free-form prose messages.

---

## 14. Budget Enforcement

Budgets should be checked incrementally.

Recommended enforcement points:

- document size: before full parse
- line length: during line normalization
- block count: as blocks are created, counted across the whole document
- nesting depth: when entering nested block contexts from the top-level document context
- inline depth: when entering recursively parsed inline content such as span bodies and link labels
- link target length: while scanning the link target, not afterward
- raw block size: while consuming raw payload
- table columns: when reading header and separator rows
- list item count: as list items are recognized, counted across the whole document

If a budget is exceeded:

- stop parsing immediately in strict mode
- emit `nd_budget_exceeded`

This should happen before large structures are accumulated.

---

## 15. Canonical Emitter Strategy

The canonical emitter should consume a validated AST.

Do not canonicalize by rewriting arbitrary source text heuristically.

Recommended emitter phases:

1. emit header if required for standalone documents
2. emit blocks in tree order
3. emit inline content in tree order
4. emit only minimal required escapes
5. normalize line endings to `\n`
6. ensure exactly one final newline

For raw payload:

- preserve payload exactly
- except for allowed line-ending normalization

Canonical emission should be structurally pure:

- no hidden IDs
- no renderer-specific additions
- no reflowing prose

---

## 16. Conformance Testing Strategy

An implementation should have at least:

- lexer/scanner unit tests
- parser unit tests
- AST shape tests
- canonical emitter tests
- round-trip tests
- all normative seed cases from the core spec

Recommended suites:

### 16.1 Positive Conformance

- valid headings
- valid lists
- valid blockquotes
- valid tables
- valid raw blocks
- valid inline nesting

### 16.2 Negative Conformance

- unclosed raw blocks
- unknown inline tags
- invalid escapes
- wrong indentation
- missing blank lines for nested blocks
- malformed table shapes
- empty link targets or labels

### 16.3 Canonicalization

- same AST always emits the same text
- canonical text reparses to the same AST
- non-canonical but valid source emits canonical output after parse + emit

---

## 17. VS Code And Language Server Integration

Recommended division of responsibility:

- TextMate grammar:
  - lexical coloring
  - simple fence and inline opener scopes
- language configuration:
  - bracket pairs
  - basic folding support
- parser-backed language server:
  - diagnostics
  - outline symbols
  - folding ranges
  - structural selections

The language server should use the same parser core as batch tooling when possible.

Do not maintain separate truth models for:

- IDE diagnostics
- CLI validation
- canonical emission prechecks

One parser core with different modes is safer.

---

## 18. Recommended Repository Structure

A practical implementation could be split like this:

```text
and-core/
  scanner/
  parser/
  ast/
  errors/
  budgets/
  canonical/
  conformance/
  vscode/
```

This is only one possible layout, but separating the scanner, parser, canonical emitter, and
conformance fixtures is strongly recommended.

---

## 19. Final Recommendation

Build `&ND` as:

- a small deterministic parser
- an explicit AST
- a strict canonical emitter
- a conformance-led toolchain

Avoid:

- regex-heavy parsing
- heuristic Markdown-style fallback behavior
- hidden recovery in strict mode
- source-rewriting canonicalizers that do not go through the AST

Reserved symbols should remain reserved at implementation time.
In particular, todo-like markers such as `[ ]`, `[x]`, `[=]`, and `[.]` MUST NOT be interpreted as
task-list semantics in Core v1 strict mode, and SHOULD produce the same reserved/invalid handling
path as other unassigned Core v1 inline forms.

`[_]` and `[<]` are not assigned in Core v1 and MUST NOT be treated as active inline syntax.

If the implementation stays scanner-first, budget-aware, and conformance-driven, it should preserve
the core value of `&ND`: explicit structure without Markdown-style ambiguity.
