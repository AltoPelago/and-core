# &ND Core v2 — Proposal (Working Draft)

This document is the working proposal anchor for `&ND Core v2`.

## Proposal Status

- Stage: **proposal**
- Stability: **unstable by design**
- Publication status: **not published**

## Purpose

`&ND Core v2` explores extensions beyond the current v1 draft while preserving strictness,
explicit structure, and fail-closed behavior as first principles.

Current direction: treat v1 as a subset of v2 during proposal-stage development.

## Non-Goals At Proposal Start

- declaring final compatibility guarantees
- declaring final grammar
- declaring final canonical output profile

## Initial Work Areas

1. Header and versioning model for v2 documents.
2. Promotion of reserved v1 syntax into explicit v2 constructs.
3. Compatibility posture between v1 draft and v2 proposal.
4. CTS seed strategy for validating proposed behavior.
5. Migration notes for tools that currently target only v1.

## Working Compatibility Stance

Until publication policy changes, v2 SHOULD be developed with the following stance:

1. Any document accepted by v1 strict mode SHOULD also be accepted by v2 strict mode.
2. Existing v1 syntax MUST keep the same structural meaning in v2.
3. v2 extensions SHOULD be introduced first through syntax that is reserved-and-rejected in v1.
4. v1 remains draft and may still change, but v2 should avoid depending on semantic reinterpretation
	of already-valid v1 constructs.

The version declaration controls the grammar; parser capability does not override it:

| Declared document | v1-only parser | v2-capable parser |
| :---------------- | :------------- | :---------------- |
| v1 syntax under `&ND v1` | accept | accept as v1 |
| v2 syntax under `&ND v1` | reject | reject as v1 |
| v1 syntax under `&ND v2` | reject unsupported version | accept as v2 |
| v2 syntax under `&ND v2` | reject unsupported version | accept as v2 |

Standalone v2 input MUST declare `&ND v2`. Headerless input MUST receive its effective version from
its embedding profile or typed channel.
Implementations MUST NOT infer v2 from the presence of v2-looking syntax.

The reference API expresses this distinction as follows:

```js
parseAnd(standaloneSource, { allowV2: true });
parseAnd(embeddedSource, { allowV2: true, version: "v2" });
parseInline(inlineSource, { allowV2: true, version: "v2" });
```

`allowV2` declares parser capability. `version` selects the effective grammar only for headerless
input. A source declaration takes precedence, so a document declared as v1 remains governed by v1.
Successful document parses report the effective `version` beside the document AST.

## Capability Disposition

Core v1 reserves these spellings and rejects them in strict mode. The v2 first-draft candidate now
assigns each promoted form an explicit ownership boundary:

| Forms | Disposition | Contract boundary |
| :---- | :---------- | :---------------- |
| `[# ...]` and inherited `[@ #id | label]` | Core | Case-sensitive document-local anchors and resolved fragment links. |
| `[- ...]`, `[" ...]`, `[' ...]`, `[= ...]`, `[_ ...]` | Core | Rich inline content with stable structural meaning. |
| `[! ...]`, `[? ...]` | Core syntax + convention | Rich content; presentation and workflow are consumer-defined. |
| `[+ ...]` | Core syntax + convention | Scalar consumer tag; vocabulary and behavior remain consumer-defined. |
| `[~ source | alt | mode]` | Core | Inline image with required alt text and `inline`, `half`, or `full` display intent. |
| `[:type = scalar]` | Core syntax + convention | Exact AEON type-assignment syntax over a closed inline-scalar subset. |
| `- [ ] content`, `- [x] content`, `- [,] content`, `- [;] content` | Core | First-class todo lists and item states; workflow and presentation are projections. |
| `[>]`, `[<]` | Core | Directional author-intent markers; a leading marker replaces an unordered-list bullet in projection. |
| `[.]` | Core | Explicit inline line break; never a directional marker. |
| `- [?] content`, `- [!] content` | Core structure + consumer projection | Hint/attention markers replace unordered-list bullets while content remains visible. |
| heading `[n]` and `- [n] content` | Core | Contextual heading intent and first-class auto-number lists; number calculation is outside Core. |
| inherited `~~~$` / `~~~$ language`; v2 `~~~$ [n]` / `~~~$ [n] language` | Core | Shared code blocks plus v2 numbered-line intent; inherited backtick fences remain accepted. |
| table separators `<--`, `-=-`, `-->` and adjacent `|>` span markers | Core | Column alignment and horizontal cell spanning; row spanning is unsupported. |
| `~~~|` / `~~~| title` … `~~~|` | Core structure + consumer projection | Visible card container; a rich inline title makes the card collapsible. Styling and interaction details are consumer-defined. |
| `[% content]`, `[% (id) content]`, `[% (id)]` | Core structure + consumer projection | Footnote definitions and backward references; labels and presentation are consumer-defined. |
| `[^ ...]` | Core | Rich inline disclaimer content. |
| `[(id) content]`, `~~~(id)` … `~~~` | Core syntax + convention | Rich semantic wrappers whose portable IDs and interpretation are consumer-owned; default projection exposes only content. |
| `\` before a block opener | Core | V2-only structural escape for literal command text at a block-open position. |
| `~~~=`, `~~~*`, `~~~/`, `~~~_`, `~~~?`, `~~~!`, `~~~'`, `~~~#`, `~~~^` paired blocks | Core | Highlight, strong, emphasis, underline, hint, attention, comment, header-text, and disclaimer block structure. |
| `closing-fence (caption)` | Core | Optional rich inline caption on every fenced block node; authored labels are not automatic numbering instructions. |
| Other unpromoted reserved forms | Deferred | Rejected by v2 strict mode. |

“Core syntax + convention” does not introduce a feature gate. These forms remain part of one fixed
v2 strict grammar; Core standardizes parsing and canonical spelling without claiming ownership of
consumer vocabularies or presentation.

## Active First Slice

The initial implementation slice started with anchor and line-break forms and has expanded into an
executable 169-fixture proposal lane under `cts/fixtures/v2/strict/`:

- 60 accepted fixtures covering inline tags, rich nesting, shared identifiers, footnotes, card containers, block captions, semantic and formatted/advisory/comment blocks, structural escapes, code blocks, aligned/spanning tables, first-class todo and auto-number
  lists, compact markers, heading auto-numbering, and paired blocks
- 109 rejected fixtures covering empty payloads and captions, malformed spacing and IDs, invalid and misplaced escapes or markers, mixed list kinds,
  footnote graph integrity, local-fragment integrity, table spans, tags, and code/paired fences
- corpus-level version checks covering v1-only readers, declared-v1 gating in v2-capable readers,
  and preservation of v1 structure under v2
- embedded-version equivalence checks for every proposal fixture
- canonical standalone and embedded round trips plus inert HTML projection for every accepted fixture
- direct boundary checks for nested v2 contexts, paired-block budgets, opaque extensions, and
  unpromoted syntax

The fixture index is the complete machine-readable inventory. This document records the proposal
semantics and named design anchors rather than duplicating every variant filename.

## Code Block Grammar Snapshot (Proposal)

V2 retains all v1 triple- and quadruple-backtick code blocks and the first two dollar spellings,
then adds `[n]` to the latter two:

```text
~~~$
code
~~~$

~~~$ language
code
~~~$

~~~$ [n]
code
~~~$

~~~$ [n] language
code
~~~$
```

The optional language matches `[A-Za-z][A-Za-z0-9_-]*`; canonical output lowercases it. `[n]`
records numbered-line intent in the inherited `code_block.ordered` field. Every new form closes with
bare `~~~$` or a v2 captioned closer such as `~~~$ (Example A: description)`, and its payload has
inherited raw-code semantics and budgets.

A v1 parser accepts `~~~$` and `~~~$ language` but rejects the v2-only `[n]` variants. A v2 parser
accepts every inherited backtick and dollar fence. Canonical v2 emission prefers `~~~$`, including
for code parsed from backticks, and falls back to the matching inherited backtick fence when the
payload contains a bare or caption-shaped `~~~$` closer line. Canonical v1 emission prefers backticks, using `~~~$` only
when needed to preserve an exact triple-backtick payload line. The briefly introduced `~~~language` and
`~~~~language` forms have been removed and reject with `deprecated_code_fence`. Plain `~~~` remains
ordinary paragraph text.

## Block Caption Grammar Snapshot (Proposal)

V2 permits one optional, non-empty rich inline caption on the closing fence of every fenced block
node:

```text
captioned-close ::= block-close [ " " "(" caption-inline ")" ]
caption-inline ::= non-empty rich inline content on one physical line
```

This covers inherited backtick and dollar code, opaque extensions, every v2 paired block, semantic
blocks, and cards. It does not create a caption on the reserved `+++fallback` region. A caption on
an extension's primary closer preserves immediately adjacent fallback attachment. Card opener text
remains its title and collapsible label; the closing caption is independent descriptive content.

Canonical v2 emission preserves captions on closing fences. HTML uses visible `figcaption` content,
while non-visual projections retain an equivalent description. Figure/example numbering is authored
text, not Core numbering behavior. V1 rejects captioned inherited closers with
`block_caption_requires_v2`; v2 continues accepting all bare v1 closers.

## Table Grammar Snapshot (Proposal)

V2 retains inherited `---` table separators and adds exact column-alignment tokens:

```text
table-separator-cell ::= "---" | "<--" | "-=-" | "-->"
spanning-cell ::= ">"+ " " inline-content
colSpan ::= 1 + count(">")
```

`<--`, `-=-`, and `-->` mean left, center, and right alignment. The separator row defines the
logical column count. Every header and body row must have a total width equal to that count, where an
ordinary cell contributes one and a spanning cell contributes its `colSpan`.

The marker must be adjacent to its preceding delimiter: `|> A+B | C |` spans the first two columns,
while `| > literal |` remains ordinary text. Markers require one space and non-empty content. Header
and body cells may span; separator cells and rows may not. The alignment of a spanning cell is the
alignment of its first covered logical column. Canonical output preserves alignment intent and emits
compact adjacent markers. V1 rejects aligned separators and span markers.

## Paired Block Grammar Snapshot (Proposal)

The current paired-block proposal grammar used by the reference parser is:

```text
highlight paragraph block
	opener: ~~~=
	closer: ~~~=

strong paragraph block
	opener: ~~~*
	closer: ~~~*

emphasis paragraph block
	opener: ~~~/
	closer: ~~~/

underline paragraph block
	opener: ~~~_
	closer: ~~~_

hint paragraph block
	opener: ~~~?
	closer: ~~~?

attention paragraph block
	opener: ~~~!
	closer: ~~~!

comment block
	opener: ~~~'
	closer: ~~~'

header text block
	opener: ~~~#
	closer: ~~~#

disclaimer block
	opener: ~~~^
	closer: ~~~

semantic block
	opener: ~~~(<id>)
	closer: ~~~

standard card block
	opener: ~~~|
	closer: ~~~|

collapsible card block
	opener: ~~~| <rich-inline-title>
	closer: ~~~|

<id> ::= [A-Za-z0-9][A-Za-z0-9._:-]*
```

This is the same case-sensitive `v2-id` grammar used by anchors and named footnotes.

Validation rules in the current proposal lane:

- unclosed paired blocks fail with stable unclosed error codes
- empty payload blocks fail with stable invalid error codes
- legacy `===` and `***` paired blocks reject as unknown block types

## Initial Conformance Seeds (Proposal)

These seeds are proposal anchors. They do not imply final grammar decisions yet.

### `seed-v2-header-recognized`

Intent:

- define the minimal accepted document declaration shape for v2 in strict mode
- ensure v2 header recognition is explicit and not inferred from body syntax

Expected direction:

- strict parse success when the approved v2 header is used
- header is treated as declaration metadata, not a content block

### `seed-v2-header-rejected-by-v1-strict`

Intent:

- keep v1 strict mode fail-closed when presented with v2 declarations
- preserve deterministic rejection behavior in v1 implementations

Expected direction:

- v1 strict parse failure with stable error code for unsupported header version

### `seed-v2-opaque-extension-inherited`

Intent:

- preserve the v1 opaque-extension compatibility model in v2
- distinguish syntactic extension validity from consumer support for an extension name

Expected direction:

- syntactically valid extension blocks parse into inherited `extension_block` nodes
- consumers that do not support an extension render its fallback or an explicit unsupported-extension diagnostic

### `seed-v2-canonical-roundtrip-core-subset`

Intent:

- establish that an agreed core subset can round-trip parse -> canonical -> parse without AST drift
- make canonical behavior testable before broader feature expansion

Expected direction:

- deterministic canonical text for the selected core subset
- reparsed canonical document is structurally equivalent

Current status: active for every accepted proposal fixture in both standalone and embedded profiles.

### `seed-v2-forward-compat-boundary`

Intent:

- define the strict boundary before any recovery mode is introduced
- prevent unpromoted reserved syntax from being silently accepted

Expected direction:

- strict mode rejects unpromoted reserved forms with `unknown_inline_type`
- no v2 recovery or forward-compatibility mode is currently defined

### `seed-v2-accepts-v1-strict-core`

Intent:

- codify that v1 strict-accepted documents remain valid in v2 strict mode
- prevent accidental regressions while adding v2-only features

Expected direction:

- v2 strict parse success for representative v1 accepted fixtures
- equivalent structural document output for the covered v1 subset

### `seed-v2-inline-anchor-tag-enabled`

Intent:

- promote v1-reserved `[# ...]` into an explicit v2 inline construct
- ensure activation does not alter unrelated inline parsing behavior

Expected direction:

- v2 strict parse success for valid anchor-tag form
- v1 strict behavior remains reject for the same source

### `seed-v2-inline-local-fragment-link-enabled`

Intent:

- reuse inherited `[@ target | label]` with `#id` targets for document-local navigation
- keep the existing rich-label link AST and browser-native fragment spelling

Expected direction:

- declared-v2 strict parse success when the case-sensitive fragment target resolves in the same document
- forward links are accepted; duplicate anchors and unresolved targets fail with stable errors
- image resources use the dedicated `[~ source | alt | mode]` v2 form

### `seed-v2-inline-admonition-tag-enabled`

Intent:

- promote v1-reserved `[! ...]` into a v2 inline admonition form
- ensure explicit parse shape and error behavior for malformed cases

Expected direction:

- v2 strict parse success for valid admonition-tag form
- strict rejection for malformed content with stable error code

### `seed-v2-inline-question-tag-enabled`

Intent:

- promote v1-reserved `[? ...]` into a v2 inline question/hint form
- ensure explicit parse shape and error behavior for malformed cases

Expected direction:

- v2 strict parse success for valid question-tag form
- strict rejection for malformed content with stable error code

### `seed-v2-inline-plus-tag-enabled`

Intent:

- promote v1-reserved `[+ ...]` into a v2 inline consumer-defined tag form
- keep its vocabulary and behavior outside Core semantics

Expected direction:

- v2 strict parse success for valid plus-tag form
- strict rejection for malformed content with stable error code

### `seed-v2-inline-image-tag-modes`

Intent:

- promote v1-reserved `[~ ...]` into a v2 inline-image form
- require source and alt text while preserving a closed display-intent enum

Expected direction:

- v2 strict mode accepts `[~ source | alt]` with an `inline` default
- explicit `inline`, `half`, and `full` modes produce one stable `image_tag` AST shape
- invalid field counts, empty required fields, and unknown modes fail with `invalid_image_tag`
- v1 strict mode continues to reject the same spelling
- Core and canonical output preserve the authored source without ambient filesystem or page resolution
- HTML consumers may opt into deterministic relative-source resolution with an explicit credential-free
  HTTP(S) `imageBaseUrl`; unsafe sources retain alt text but no source attribute

### `seed-v2-inline-strike-tag-enabled`

Intent:

- promote v1-reserved `[- ...]` into a v2 inline strike-through style tag form
- ensure explicit parse shape and error behavior for malformed cases

Expected direction:

- v2 strict parse success for valid strike-tag form
- strict rejection for malformed content with stable error code

### `seed-v2-inline-quoted-tag-enabled`

Intent:

- promote v1-reserved `[" ...]` into a v2 inline quoted-text form
- ensure explicit parse shape and error behavior for malformed cases

Expected direction:

- v2 strict parse success for valid quoted-tag form
- strict rejection for malformed content with stable error code

### `seed-v2-inline-comment-tag-enabled`

Intent:

- promote v1-reserved `[' ...]` into a v2 inline comment form
- ensure explicit parse shape and error behavior for malformed cases

Expected direction:

- v2 strict parse success for valid comment-tag form
- strict rejection for malformed content with stable error code

### `seed-v2-inline-typed-value-enabled`

Intent:

- promote v1-reserved `[: ...]` into a v2 typed-value inline form
- adopt exact AEON anonymous typed-scalar syntax such as `[:date = 2012-10-10]` and
  `[:string = "hello world"]`

Expected direction:

- v2 strict parse success for the listed AEON scalar families and custom datatype labels
- preserve structured datatype generics/clarifiers and literal-family-aware scalar nodes
- enforce reserved datatype/literal compatibility and reject structured values, references,
  multiline families, nested typed values, or the earlier equals-free spelling
- pin the boundary as machine-readable contract `and-v2-aeon-inline-scalar-v1`, aligned with AEON
  TypeScript `0.12.0`, with mandatory &ND AST/canonical/HTML snapshots and an optional live AEON
  lexer/parser/canonicalizer drift check

### `seed-v2-inline-highlight-tag-enabled`

Intent:

- promote v1-reserved `[= ...]` into a v2 inline highlighting form
- ensure explicit parse shape and error behavior for malformed cases

Expected direction:

- v2 strict parse success for valid highlight-tag form
- strict rejection for malformed content with stable error code

### `seed-v2-inline-underline-tag-enabled`

Intent:

- promote v1-reserved `[_ ...]` into a v2 inline underlining form
- ensure explicit parse shape and error behavior for malformed cases

Expected direction:

- v2 strict parse success for valid underline-tag form
- strict rejection for malformed content with stable error code

### `seed-v2-todo-list-states`

Intent:

- promote `- [ ] content`, `- [x] content`, `- [,] content`, and `- [;] content` into a first-class
  todo-list block with state stored on each todo item
- keep todo states out of the generic inline union and enforce homogeneous list blocks

Expected direction:

- v2 strict parse success for all four states and inherited nested-list structure
- bare inline states, empty items, ordered todo markers, malformed spacing, unknown states, and mixed
  ordinary/todo list blocks fail closed

### `seed-v2-inline-directional-markers-enabled`

Intent:

- promote v1-reserved directional markers `[>]` and `[<]` into explicit v2 inline states
- keep marker handling deterministic and reject malformed or unknown forms

Expected direction:

- v2 strict parse success for both directional markers
- a leading marker in an unordered list item replaces its visual bullet while remaining an inline
  AST node; later markers in the same item remain inline
- strict rejection for malformed or unknown directional marker forms

### `seed-v2-auto-number-list-enabled`

Intent:

- promote `- [n] content` into a first-class auto-number list
- consume `[n]` as structural list intent rather than generic inline content

Expected direction:

- v2 strict parse success for homogeneous `- [n] content` blocks and inherited nesting
- strict rejection for empty, malformed, ordered-marker, and mixed-kind forms

### `seed-v2-heading-auto-number-marker-enabled`

Intent:

- promote v1-reserved `[n]` into a contextual heading auto-number marker
- keep scope exact: valid as the `# [n] content` prefix and rejected as generic inline content

Expected direction:

- v2 strict parse success for heading forms like `# [n] Title`
- strict rejection for marker-only headings, missing separator space, and non-contextual usage
- reference HTML projection visibly numbers participating headings hierarchically by heading level

### `seed-v2-code-block-dollar-fences`

Intent:

- extend the v1 `~~~$` code-block family consistently with inline `[$ code]`
- retain inherited backtick and unnumbered dollar code fences for v1 compatibility
- carry v2-only `[n]` numbered-line intent in the inherited `code_block` AST

Expected direction:

- v2 strict parse success for the four exact `~~~$` openers and inherited backtick fences
- canonical v2 output prefers the applicable `~~~$` form and safely falls back to backticks on a
  dollar-closer payload collision
- v1 acceptance for unnumbered dollar fences and strict rejection for their `[n]` variants; both
  versions reject removed `~~~language` / `~~~~language`
- malformed, mismatched, and unclosed dollar fences fail with stable diagnostics

### `seed-v2-block-captions`

Intent:

- generalize one closing-fence caption form across every fenced v2 block node
- keep extension fallback attachment and card-title meaning independent from captions
- preserve captions as rich inline AST content without assigning numbering semantics

Expected direction:

- v2 accepts non-empty one-line captions on inherited code/extensions and v2 fenced blocks
- canonical and consumer projections retain the caption separately from block payload/content
- v1 rejects captioned inherited closers, while v2 continues accepting their bare v1 forms

### `seed-v2-table-alignment-and-spans`

Intent:

- extend inherited tables with exact left/center/right separator tokens
- model adjacent `>` cell markers as horizontal `colSpan`
- retain the inherited AST exactly for ordinary v1-shaped tables

Expected direction:

- `<--`, `-=-`, and `-->` populate an optional logical-column alignment array
- each adjacent `>` increases a content cell's span by one; a padded `| > literal |` is ordinary text
- header and body row span sums must equal the separator-defined logical width
- missing content/spacing and underflow/overflow reject with `invalid_table_span`
- v1 rejects alignment and span extensions while v2 accepts every inherited v1 table unchanged

### `seed-v2-card-blocks`

Intent:

- define `~~~|` / `~~~|` as a visible card containing ordinary block children
- allow a non-empty rich inline title after one ASCII space on the opener
- make title presence carry collapsible intent without introducing a semantic ID

Expected direction:

- unnamed cards produce `card_block` without `title`; named cards preserve rich `title` children
- card bodies accept non-empty ordinary block content and project without losing structure
- empty, malformed-title, and unclosed cards reject with stable card-family diagnostics
- v1 reserves and rejects the v2 card opener

### `seed-v2-block-highlight-paragraph-enabled`

Intent:

- promote v1-reserved `~~~` into a v2 highlighted paragraph block form using `~~~=` delimiters
- provide an explicit block-level alternative for highlight semantics

Expected direction:

- v2 strict parse success for balanced `~~~=` blocks with non-empty payload
- strict rejection for unclosed or empty highlight paragraph blocks

### Formatted paragraph fence family

Intent:

- extend the paired paragraph family with `~~~*` strong, `~~~/` emphasis, `~~~_` underline,
  `~~~?` hint/question, `~~~!` attention/admonition, and `~~~'` block comments
- preserve rich inline payloads and exact canonical fences
- leave plain `~~~` as inherited ordinary paragraph text rather than a block delimiter

Expected direction:

- v2 strict parse success for balanced, non-empty formatted paragraph blocks
- strict family-specific rejection for empty or unclosed blocks
- v1 strict rejection for the five v2-only fences at block-open position

### `seed-v2-block-header-text-enabled`

Intent:

- define `~~~#` as an untagged rich header-text block
- use the same exact `~~~#` fence to close the block

Expected direction:

- v2 strict parse success for balanced `~~~#` blocks with non-empty payload
- strict rejection for unclosed or empty blocks and for legacy `===` openers

### `seed-v2-block-disclaimer-enabled`

Intent:

- define `~~~^` as an untagged rich disclaimer block
- use plain `~~~` as its deterministic closer

Expected direction:

- v2 strict parse success for `~~~^` / `~~~` blocks with non-empty payload
- strict rejection for unclosed or empty blocks and for legacy `***` openers

### `seed-v2-inline-disclaimer-enabled`

Intent:

- define `[^ ...]` as rich inline disclaimer content
- preserve nested rich inline children while leaving exact presentation to consumers

Expected direction:

- v2 strict parse success for non-empty `[^ ...]`
- strict rejection for empty payloads or a missing required space

### Semantic wrappers

Intent:

- define `~~~(id)` / `~~~` as a rich semantic block and `[(id) content]` as its inline equivalent
- retain a portable consumer-owned ID in the AST without exposing it in the default HTML projection
- otherwise project their rich children as ordinary block or inline content

Expected direction:

- v2 strict parse success for non-empty semantic wrappers with shared `v2-id` IDs
- exact canonical preservation of IDs and rich content
- strict rejection for malformed IDs, missing inline spacing, empty payloads, or unclosed blocks

### Structural block escapes

Intent:

- allow a v2 author to prefix a block command with `\` when its source spelling should remain text
- decode the escape into an ordinary paragraph without weakening the inline escape rules
- cover headings, lists, blockquotes, horizontal rules, extensions, inherited backtick fences, v2
  dollar-code fences, removed tilde-language openers, and v2 paired fence forms

Expected direction:

- `\# heading`, `\~~~$ aeon`, `\~~~aeon`, and other real escaped openers parse as paragraph text
- canonical v2 emission restores the escape whenever omitting it would change the block type
- v1 keeps its closed four-character inline escape set
- mid-line and unnecessary structural escapes reject with `invalid_escape`

### `seed-v2-footnote-named-reuse`

Intent:

- promote reserved `[% ...]` into anonymous and named footnote definitions
- permit `[% (id)]` only as a backward shorthand reference to an already-declared named footnote
- retain rich footnote content while leaving displayed labels and placement to processors

Expected direction:

- v2 strict parse success for anonymous definitions, named definitions, and repeated named references
- shared case-sensitive `v2-id` IDs, one declaration per ID, and no nested footnotes
- strict rejection for empty definitions, malformed IDs, duplicate definitions, unresolved references,
  and forward references
- v1 strict behavior remains reject for the same source

### `seed-v2-inline-line-break-marker-enabled`

Intent:

- promote v1-reserved `[.]` into an explicit v2 inline line-break construct
- keep line-break behavior deterministic and distinct from paragraph soft wraps

Expected direction:

- v2 strict parse success for valid `[.]` line-break marker usage
- v1 strict behavior remains reject for the same source

## Embedding Decision

The Core-facing embedding question is resolved: only a host-controlled typed channel may select v2
for headerless input, and it must explicitly supply both v2 capability and `version: "v2"`.
Declarations take precedence over external version options. Named embedding-profile registries remain
deferred.

Image resolution and AEON scalar drift are now pinned. Migration and consumer-convention work are
published as proposal-stage companion guidance rather than unresolved Core syntax questions.

## Next Edits

1. Run the final promotion gate described in the readiness audit.
2. Move formal documents and CTS metadata from proposal to draft in one reviewed lifecycle change.

## Proposal Lane Status

The executable proposal lane is active but is not a published conformance lane. It currently has:

1. More than 10 stable proposal seed names and executable accept/reject variants.
2. Explicit header rejection and cross-version compatibility checks in the proposal runner.
3. A fixture schema note under `cts/fixtures/v2/`.
4. A single-parser version-switch strategy documented in `cts/ADAPTERS.md`.
5. Independent CI execution without reducing v1 coverage.
6. Canonical standalone and embedded output for every accepted proposal AST.
7. Inert HTML projections and CLI/playground access behind explicit v2 selection.

The detailed promotion status is recorded in
[`and-core-v2-first-draft-readiness.md`](./and-core-v2-first-draft-readiness.md). Image resolution and
AEON-inline-scalar drift controls, embedding authority, the v2 public API contract, and exact
canonical/HTML projection, source-span, and cross-form combination contracts are complete. Remaining
promotion work is the final clean-baseline review and explicit proposal-to-draft lifecycle change.
