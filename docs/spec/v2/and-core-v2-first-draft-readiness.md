# &ND Core v2 First-Draft Readiness Audit

Audit date: 2026-08-20

## Verdict

`&ND Core v2` is implementation-ready but not yet publication-ready as a first draft.

The grammar surface and compatibility boundary are coherent and executable. The remaining work is
principally contract hardening and publication guidance rather than new syntax design. Promotion
should not occur until the blockers below are closed and the final promotion checks pass together.

## Evidence Snapshot

| Area | Current evidence | Assessment |
| :--- | :--------------- | :--------- |
| Version boundary | Declared v1 remains v1; v1-only readers reject v2; headerless v2 requires explicit capability and version selection. | Ready |
| v1 compatibility | All 139 v1 reference fixtures pass; accepted v1 documents retain their structure under declared v2. | Ready |
| v2 grammar | 94 indexed strict fixtures: 41 accept and 53 reject. | Ready |
| v2 executable checks | 648 proposal, version-boundary, canonical-fixed-point, HTML-smoke, budget, and API checks pass. | Ready |
| AST snapshots | 40 of 41 accepted fixtures carry exact document ASTs; the broad typed-scalar fixture is covered by the dedicated scalar contract. | Ready |
| AEON boundary | Contract `and-v2-aeon-inline-scalar-v1` covers 40 datatype names/aliases, 45 accepted forms, and 14 exclusions; live AEON `0.12.0` drift comparison passes when available. | Ready |
| Image boundary | Authored sources remain in Core; explicit HTML `imageBaseUrl` resolution and fail-closed URL handling are tested. | Ready |
| Canonical output | Every accepted fixture reaches standalone and embedded fixed points; contract `and-v2-projection-v1` pins 16 exact canonical snapshots across all promoted families. | Ready |
| HTML projection | Every accepted fixture renders; contract `and-v2-projection-v1` pins 9 exact inert HTML snapshots across all promoted families and safety cases. | Ready |
| Source spans | Exact span assertions exist for 3 of 41 accepted fixtures. | Blocker |
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

Extend span snapshots beyond anchor, admonition, and line-break cases. Cover every new scalar and rich
inline node family, heading `[n]`, all three paired blocks, escaped fields, datatype adornments, and
representative nested contexts.

Closure evidence: an explicit span matrix linked to executable fixtures.

### B6. Cross-form combination matrix

Add focused fixtures for interactions not yet publication-pinned:

- each paired block inside a list item and blockquote;
- representative v2 inline children inside every paired-block family;
- anchors and fragment links crossing nested container boundaries;
- images and typed values nested inside rich v2 tags;
- compact markers adjacent to rich tags and explicit line breaks.

Closure evidence: the matrix is complete, indexed, and included in canonical/HTML snapshots.

### B7. v1-to-v2 migration guide

Document declaration changes, parser capability versus effective-version selection, unchanged v1
meaning, v1 rejection of v2 syntax, canonical profile selection, local-link migration, image syntax,
and the replacement of the provisional typed-value spelling.

Closure evidence: a concise migration document with before/after examples and tool guidance.

### B8. Consumer-convention boundary

Publish one non-Core companion note listing what consumers own: `[!]`, `[?]`, `[+]`, custom typed
datatypes, optional paired-block tag vocabularies, numbering calculation, image fetching/layout/failure
UI, external navigation policy, and extension execution.

Closure evidence: each convention has a Core-guaranteed field and an explicitly consumer-owned
interpretation; no implementation-specific meaning is presented as Core semantics.

## Explicitly Deferred, Non-Blocking Work

- footnotes and `[^ ...]`;
- recovery or forward-compatibility parsing modes;
- v2-specific VS Code highlighting, completions, and diagnostics UX;
- Core-defined vocabularies for consumer tags or paired-block tags;
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
4. Keep footnotes, recovery, editor expansion, and consumer semantics explicitly deferred.

The recommended next implementation task is B5 and B6 together: complete the v2 source-span and
cross-form combination matrices, and include those new combinations in the projection contract.
