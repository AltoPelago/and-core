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
| `[ ]`, `[x]`, `[,]`, `[;]`, `[>]`, `[<]`, `[%]`, `[.]` | Core | Stable author-intent markers; display and numbering are projections. |
| heading `[n]` | Core | Stable heading field; number calculation is outside Core. |
| `~~~=`, `===`, `***` paired blocks | Core | Stable block structure; optional tag vocabularies are consumer-defined. |
| `[^ ...]` and other unpromoted reserved forms | Deferred | Rejected by v2 strict mode. |

“Core syntax + convention” does not introduce a feature gate. These forms remain part of one fixed
v2 strict grammar; Core standardizes parsing and canonical spelling without claiming ownership of
consumer vocabularies or presentation.

## Active First Slice

The initial implementation slice started with anchor and line-break forms and has expanded into an
executable 94-fixture proposal lane under `cts/fixtures/v2/strict/`:

- 41 accepted fixtures covering inline tags, rich nesting, compact markers, heading auto-numbering,
  and paired blocks
- 53 rejected fixtures covering empty payloads, malformed spacing, invalid markers, local-fragment
  integrity, tags, and fences
- corpus-level version checks covering v1-only readers, declared-v1 gating in v2-capable readers,
  and preservation of v1 structure under v2
- embedded-version equivalence checks for every proposal fixture
- canonical standalone and embedded round trips plus inert HTML projection for every accepted fixture
- direct boundary checks for nested v2 contexts, paired-block budgets, opaque extensions, and
  unpromoted syntax

The fixture index is the complete machine-readable inventory. This document records the proposal
semantics and named design anchors rather than duplicating every variant filename.

## Paired Block Grammar Snapshot (Proposal)

The current paired-block proposal grammar used by the reference parser is:

```text
highlight paragraph block
	opener: ~~~=
	closer: ~~~=

header text block
	opener: === or ===<tag>
	closer: ===

disclaimer block
	opener: *** or ***<tag>
	closer: ***

<tag> ::= [A-Za-z][A-Za-z0-9_-]*
```

Validation rules in the current proposal lane:

- unclosed paired blocks fail with stable unclosed error codes
- empty payload blocks fail with stable invalid error codes
- tagged paired blocks reject invalid tags when present

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

- strict mode rejects unpromoted forms such as `[^ ...]` with `unknown_inline_type`
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

### `seed-v2-inline-todo-markers-enabled`

Intent:

- promote v1-reserved todo markers `[ ]`, `[x]`, `[,]`, `[;]` into explicit v2 inline states
- ensure each marker maps to one stable semantic state and malformed forms fail closed

Expected direction:

- v2 strict parse success for the four valid todo markers
- strict rejection for malformed or unknown todo marker forms

### `seed-v2-inline-directional-markers-enabled`

Intent:

- promote v1-reserved directional markers `[>]` and `[<]` into explicit v2 inline states
- keep marker handling deterministic and reject malformed or unknown forms

Expected direction:

- v2 strict parse success for both directional markers
- strict rejection for malformed or unknown directional marker forms

### `seed-v2-inline-auto-number-marker-enabled`

Intent:

- promote v1-reserved `[%]` into an explicit v2 inline auto-number marker
- keep recognition exact and fail-closed for malformed near-miss forms

Expected direction:

- v2 strict parse success for valid `[%]` marker usage
- strict rejection for malformed or unknown auto-number marker forms

### `seed-v2-heading-auto-number-marker-enabled`

Intent:

- promote v1-reserved `[n]` into a header-only v2 auto-number marker
- keep scope explicit: valid in heading prefix position, rejected elsewhere

Expected direction:

- v2 strict parse success for heading forms like `# [n] Title`
- strict rejection for marker-only headings and non-heading usage

### `seed-v2-block-highlight-paragraph-enabled`

Intent:

- promote v1-reserved `~~~` into a v2 highlighted paragraph block form using `~~~=` delimiters
- provide an explicit block-level alternative for highlight semantics

Expected direction:

- v2 strict parse success for balanced `~~~=` blocks with non-empty payload
- strict rejection for unclosed or empty highlight paragraph blocks

### `seed-v2-block-header-text-enabled`

Intent:

- promote v1-reserved `===` into a v2 paired block form using `===` or `===name` openers
- keep closing deterministic with a plain `===` closer

Expected direction:

- v2 strict parse success for balanced `===` / `===name` blocks with non-empty payload
- strict rejection for unclosed blocks or invalid tags when present

### `seed-v2-block-disclaimer-enabled`

Intent:

- promote v1-reserved `***` into a v2 paired block form using `***` or `***name` openers
- keep closing deterministic with a plain `***` closer

Expected direction:

- v2 strict parse success for balanced `***` / `***name` blocks with non-empty payload
- strict rejection for unclosed blocks or invalid tags when present

### `seed-v2-inline-footnote-tag-enabled`

Intent:

- promote v1-reserved `[^ ...]` into a v2 footnote-capable inline form
- keep footnote handling local and deterministic in core parsing

Current status: deferred for now.

Expected direction:

- v2 strict parse success for valid footnote-tag form
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
