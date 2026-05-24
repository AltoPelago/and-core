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

## Reserved Syntax Promotion Track

Core v1 reserves a set of inline forms that are currently rejected in strict mode. v2 proposal work
can promote selected forms into first-class syntax while keeping v1 behavior unchanged.

Current v2 evaluation matrix for reserved syntax:

```text
[# ...]   reserved for anchors/IDs if ever needed
[~ ...]   reserved for references/mentions if ever needed
[! ...]   reserved for warnings/admonitions if ever needed
[? ...]   reserved for hints/questions if ever needed
[+ ...]   reserved for consumer defined tags if ever needed
[- ...]   reserved for strikethrough if ever needed
[" ...]   reserved for inline quoted text if ever needed
[' ...]   reserved for comments if ever needed
[: ...]   reserved for typed values like datetime if ever needed
[= ...]   reserved for highlighting text if ever needed
[_ ...]   reserved for underline text if ever needed

[ ]   reserved for todo/unchecked if ever needed
[x]   reserved for todo/checked if ever needed
[,]   reserved for todo/in progress if ever needed
[;]   reserved for todo/cancelled if ever needed
[.]   reserved for inline line break if ever needed
[>]   reserved for forward arrow if ever needed
[<]   reserved for backward arrow if ever needed
[%]   reserved for auto numbered list items if ever needed

[n]   reserved for auto-number marker in headers if ever needed

===   reserved for header text if ever needed
~~~   reserved for alternative formatting if ever needed
***   reserved for disclaimer text
```

This matrix is the default backlog for v2 syntax promotion sequencing.

## Active First Slice

The initial implementation slice started with two promoted forms and now expands through adjacent
reserved inline forms in small increments:

1. `[# ...]` anchor tag
2. `[.]` inline line-break marker

Current proposal fixtures for this slice live under `cts/fixtures/v2/strict/`:

1. `seed-v2-inline-anchor-tag-enabled`
2. `seed-v2-inline-line-break-marker-enabled`
3. `seed-v2-inline-reference-tag-enabled`
4. `seed-v2-inline-admonition-tag-enabled`
5. `seed-v2-inline-question-tag-enabled`
6. `seed-v2-inline-plus-tag-enabled`
7. `seed-v2-inline-strike-tag-enabled`
8. `seed-v2-inline-quoted-tag-enabled`
9. `seed-v2-inline-comment-tag-enabled`
10. `seed-v2-inline-typed-value-date`
11. `seed-v2-inline-typed-value-string`
12. `seed-v2-inline-highlight-tag-enabled`
13. `seed-v2-inline-underline-tag-enabled`
14. `seed-v2-inline-todo-markers-enabled`
15. `seed-v2-inline-directional-markers-enabled`
16. `seed-v2-inline-auto-number-marker-enabled`
17. `seed-v2-heading-auto-number-marker-enabled`
18. `seed-v2-block-highlight-paragraph-enabled`
19. `seed-v2-block-header-text-enabled`
20. `seed-v2-block-disclaimer-enabled`
21. `seed-v2-inline-anchor-tag-empty`
22. `seed-v2-inline-reference-tag-empty`
23. `seed-v2-inline-admonition-tag-empty`
24. `seed-v2-inline-question-tag-empty`
25. `seed-v2-inline-plus-tag-empty`
26. `seed-v2-inline-strike-tag-empty`
27. `seed-v2-inline-quoted-tag-empty`
28. `seed-v2-inline-comment-tag-empty`
29. `seed-v2-inline-typed-value-empty`
30. `seed-v2-inline-typed-value-missing-value`
31. `seed-v2-inline-highlight-tag-empty`
32. `seed-v2-inline-underline-tag-empty`
33. `seed-v2-inline-todo-marker-invalid-symbol`
34. `seed-v2-inline-directional-marker-invalid-symbol`
35. `seed-v2-inline-auto-number-marker-invalid-symbol`
36. `seed-v2-heading-auto-number-marker-empty`
37. `seed-v2-block-highlight-paragraph-unclosed`
38. `seed-v2-block-header-text-unclosed`
39. `seed-v2-block-disclaimer-unclosed`
40. `seed-v2-inline-line-break-marker-malformed`

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

### `seed-v2-unknown-extension-default-reject`

Intent:

- confirm v2 retains fail-closed behavior for unknown extension constructs by default
- avoid silent acceptance drift while extension surface is still being proposed

Expected direction:

- strict parse failure for unknown extension names unless an explicit compatibility rule allows it

### `seed-v2-canonical-roundtrip-core-subset`

Intent:

- establish that an agreed core subset can round-trip parse -> canonical -> parse without AST drift
- make canonical behavior testable before broader feature expansion

Expected direction:

- deterministic canonical text for the selected core subset
- reparsed canonical document is structurally equivalent

### `seed-v2-forward-compat-boundary`

Intent:

- define what forward compatibility mode may recover versus what must still hard-fail
- prevent ambiguous recovery behavior between strict and forward compatibility modes

Expected direction:

- clear, testable mode-specific distinction for the same input

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

### `seed-v2-inline-reference-tag-enabled`

Intent:

- promote v1-reserved `[~ ...]` into a v2 reference/mention construct
- keep deterministic parsing boundaries for link-like inline content

Expected direction:

- v2 strict parse success for valid reference-tag form
- stable reject behavior in v1 strict mode

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
- ensure explicit parse shape and error behavior for malformed cases

Expected direction:

- v2 strict parse success for valid plus-tag form
- strict rejection for malformed content with stable error code

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
- validate concrete examples like `[:date 2012-10-10]` and `[:string "hello world"]`

Expected direction:

- v2 strict parse success for valid typed-value forms
- strict rejection for missing datatype or missing payload with stable error code

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

### `seed-v2-inline-todo-markers-enabled`

Intent:

- promote v1-reserved todo markers `[ ]`, `[x]`, `[,]`, `[;]` into explicit v2 inline states
- ensure each marker maps to one stable semantic state

Expected direction:

- v2 strict parse success for each valid todo marker form
- malformed markers still fail-closed with stable error codes

### `seed-v2-inline-line-break-marker-enabled`

Intent:

- promote v1-reserved `[.]` into an explicit v2 inline line-break construct
- keep line-break behavior deterministic and distinct from paragraph soft wraps

Expected direction:

- v2 strict parse success for valid `[.]` line-break marker usage
- v1 strict behavior remains reject for the same source

## Open Questions

1. Which reserved forms should be promoted first versus deferred to profile-specific layers?
2. Should v2 canonicalization guarantee a lossless path back to v1 where possible?
3. What is the minimum promoted-syntax slice required before creating a reference parser lane?
4. Should any promoted reserved forms remain optional feature gates in strict mode?

## Next Edits

1. Add named conformance seeds for each accepted work area.
2. Define acceptance criteria for creating `cts/fixtures/v2`.
3. Split accepted decisions from unresolved proposals in this file.

## Acceptance Criteria For v2 Fixture Activation

Move from placeholder lane to active v2 fixtures when all are true:

1. At least 10 v2 seeds have stable names and expected outcomes documented in this file.
2. At least one seed exists for each of these areas: header/versioning, extension behavior,
	canonicalization, compatibility boundaries.
3. A first v2 fixture schema note is written under `cts/fixtures/v2/`.
4. A v2 adapter strategy is documented in `cts/ADAPTERS.md` (single parser with version switch or
	dedicated v2 adapter).
5. CI can run a non-empty v2 fixture set without reducing v1 coverage checks.
