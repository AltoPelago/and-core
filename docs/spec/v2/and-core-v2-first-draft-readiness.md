# &ND Core v2 First-Draft Readiness Audit

Audit date: 2026-08-20

## Verdict

`&ND Core v2` satisfies the documented first-draft candidate gates and is ready for final promotion
review. It remains proposal-stage until the lifecycle change is explicitly approved.

The grammar surface and compatibility boundary are coherent and executable. Syntax, contracts,
migration, and consumer guidance are complete. Promotion should occur only through the final
clean-baseline and lifecycle review described below.

## Evidence Snapshot

| Area | Current evidence | Assessment |
| :--- | :--------------- | :--------- |
| Version boundary | Declared v1 remains v1; v1-only readers reject v2; headerless v2 requires explicit capability and version selection. | Ready |
| v1 compatibility | All 148 v1 reference fixtures pass; accepted v1 documents retain their structure under declared v2. | Ready |
| v2 grammar | 167 indexed strict fixtures: 59 accept and 108 reject. | Ready |
| v2 executable checks | 1007 proposal, version-boundary, canonical-fixed-point, HTML-smoke, budget, and API checks pass. | Ready |
| AST snapshots | 58 of 59 accepted fixtures carry exact document ASTs; the broad typed-scalar fixture is covered by the dedicated scalar contract. | Ready |
| AEON boundary | Contract `and-v2-aeon-inline-scalar-v1` covers 40 datatype names/aliases, 45 accepted forms, and 14 exclusions; live AEON `0.12.0` drift comparison passes when available. | Ready |
| Image boundary | Authored sources remain in Core; explicit HTML `imageBaseUrl` resolution and fail-closed URL handling are tested. | Ready |
| Canonical output | Every accepted fixture reaches standalone and embedded fixed points; contract `and-v2-projection-v1` pins 54 exact canonical snapshots across promoted families and interactions. | Ready |
| HTML projection | Every accepted fixture renders; contract `and-v2-projection-v1` pins 28 exact inert HTML snapshots across promoted families, interactions, and safety cases. | Ready |
| Source spans | The projection contract pins 46 exact assertions covering every promoted node family, adornments, and nested contexts. | Ready |
| Cross-form interactions | A 36-entry executable matrix covers cards with rich titles and block children, aligned/spanning tables, code-block language/numbering, paired blocks in lists/quotes, formatted/advisory/comment/semantic blocks with rich children, cross-container links, shared identifiers, rich resources, contextual list-item content, directional/advisory bullet replacement, heading-number hierarchy, semantic and disclaimer inline content, and rich/reused footnotes. | Ready |
| Migration guidance | The v1-to-v2 guide covers declarations, host selection, canonical profiles, links, images, AEON syntax, tooling, and downgrade limits. | Ready |
| Consumer conventions | The companion boundary maps every consumer-owned surface to its fixed Core fields and non-Core behavior. | Ready |
| Public runtime | Root parser, inline parser, diagnostics, canonical emitter, and HTML renderer support v2; CLI and playground exercise explicit v2 selection. | Ready |
| Public API types | `and-public-api.md` defines host authority, v2 capability/version options, result metadata, promoted unions, canonical versioning, diagnostics, and HTML options. | Ready |
| Editor tooling | The VS Code prototype explicitly targets Core v1. | Deferred, not a blocker |
| Formal mirrors | Proposal and AST-contract mirrors pass repository and website checks. | Ready |

## Promotion Gates

### B1. Embedding authority

Status: **closed**.

Only a host-controlled typed channel may supply the effective version, and it must
select both v2 capability and `version: "v2"`; document content cannot request or infer promotion.
Named embedding-profile registries can remain outside the first Core draft.

Closure evidence: the AST contract and public API contract contain the processing rule; positive and
negative API checks cover host-selected input, capability-only input, missing capability, declaration
precedence, and unknown versions.

### B2. v2 public API contract

Status: **closed**.

`and-public-api.md` types `allowV2`, headerless `version`, the `"v1" | "v2"` success result,
the promoted AST union, canonical version selection, budgets, spans, diagnostics, and `imageBaseUrl`.

Closure evidence: the document agrees with the root exports, CLI behavior, and public API checks.

### B3. Exact canonical snapshots

Status: **closed**.

Contract `and-v2-projection-v1` pins publication-grade canonical text for each promoted inline and
block node, inherited v1 syntax under v2, nested rich content, escaped fields, local fragments, AEON
scalars, image modes, and standalone/embedded profiles.

Closure evidence: machine-readable expected text checked in CI, with zero accepted candidate forms
covered only by a smoke test.

### B4. Exact HTML snapshots

Status: **closed**.

The same contract pins exact inert HTML for every promoted projection family, including nested
content, unsafe links and images, explicit image-base resolution, typed values, local anchors, display
modes, and full-document wrapping.

Closure evidence: machine-readable expected fragments checked in CI. HTML remains a reference
projection rather than Core parsing semantics.

### B5. v2 source-span coverage

Status: **closed**.

Contract `and-v2-projection-v1` contains an explicit 46-entry span matrix covering every new scalar
and rich inline family, first-class todo lists/items, heading and list `[n]`, all seven paired blocks,
code blocks, cards, aligned/spanning tables, escaped image fields, AEON datatype generics and clarifiers, nested rich/image/typed-value
content, ordinary lists, and blockquotes.

Closure evidence: the mandatory checker reparses each source with spans enabled and byte-compares the
exact offset and line/column tuple at every indexed AST path.

### B6. Cross-form combination matrix

Status: **closed**.

The projection contract indexes and pins focused cases for:

- each paired block inside a list item and blockquote;
- representative v2 inline children inside every paired-block family;
- rich inline children inside strong, emphasis, and underline paragraph blocks;
- anchors and fragment links crossing nested container boundaries;
- images and typed values nested inside rich v2 tags;
- rich inline and explicit line-break content inside first-class todo and auto-number items;
- leading directional markers replacing unordered-item bullets while later markers remain inline;
- leading hint/attention markers replacing unordered-item bullets while keeping item content visible;
- inline advisory callouts and visible `~~~?` / `~~~!` advisory paragraphs;
- rich inline disclaimers and visible `~~~^` disclaimer blocks;
- rich inline and block semantic wrappers with non-exposed consumer IDs;
- structural block escapes with canonical fixed-point preservation;
- the shared identifier grammar across anchors, named footnotes, and semantic wrappers;
- code blocks carrying numbered-line intent and a language, plus inherited backtick compatibility;
- table alignment combined with horizontal cell spans;
- named cards with rich titles and ordinary nested block children;
- heading-number hierarchy plus rich footnote content and repeated named references.

Closure evidence: all 36 required combination identifiers appear exactly once and participate in the
same 54 canonical and 28 HTML snapshots as the promoted-surface contract.

### B7. v1-to-v2 migration guide

Status: **closed**.

[`and-v1-to-v2-migration.md`](./and-v1-to-v2-migration.md) documents declaration changes, parser
capability versus effective-version selection, unchanged v1 meaning, v1 rejection of v2 syntax,
canonical profiles, local-link migration, images, exact AEON typed syntax, tool guidance, and the
absence of automatic downgrade.

Closure evidence: compatibility table, before/after spellings, supported-surface inventory, and a
mechanical migration checklist.

### B8. Consumer-convention boundary

Status: **closed**.

[`and-consumer-conventions.md`](./and-consumer-conventions.md) maps `[!]`, `[?]`, `[+]`, `[^]`,
semantic wrappers, cards, custom typed datatypes, header-text and disclaimer blocks, numbering, footnotes,
images, external navigation, extensions, todo and direction markers, and comments to their
Core-guaranteed fields and consumer-owned interpretation.

Closure evidence: the note defines processing order, registry constraints, non-execution, resource
and trust policy, independent versioning, and the separate conformance boundary.

## Explicitly Deferred, Non-Blocking Work

- other unpromoted reserved forms;
- recovery or forward-compatibility parsing modes;
- v2-specific VS Code highlighting, completions, and diagnostics UX;
- Core-defined vocabularies for consumer tags;
- automatic heading or inline number calculation;
- image fetching, MIME validation, intrinsic-dimension inspection, and failure UI;
- structured AEON values beyond the closed inline-scalar subset;
- a registry of named embedding profiles.

These remain rejected, inert, or consumer-owned under the current strict contract and therefore do
not prevent a first draft.

## Final Promotion Gate

After B1–B8 close:

1. Run the v1 reference CTS, v2 lane, scalar contract and live drift check, canonical snapshots,
   HTML snapshots, public API, CLI, playground, repository safety, formal-spec, and website checks.
2. Record a clean baseline with no failures and no unreviewed snapshot changes.
3. Move the formal documents and CTS metadata from proposal to draft lifecycle status in one reviewed
   change; do not imply publication merely by renaming a snapshot.
4. Keep unpromoted reserved forms, recovery, editor expansion, and consumer semantics explicitly
   deferred.

Candidate baseline recorded 2026-08-20: v1 reference CTS, v2 proposal lane, AEON scalar contract and
live drift, canonical and HTML checks, projection and guidance contracts, public API, CLI, playground,
repository safety, formal-spec, and website checks all pass.

All B1–B8 gates are closed. The remaining step is an explicit, reviewed proposal-to-draft lifecycle
change; the passing baseline alone does not change publication state.
