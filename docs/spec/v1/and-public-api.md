# &ND Core v1 — Public API Plan

## 1. Status

This document is **non-normative**.

It describes the recommended public package surface for `and-core` once the current reference
implementation entrypoints are promoted from internal implementation files into a consumer-facing
module contract.

---

## 2. Purpose

The repository already contains working parser, canonical, HTML, CLI, and diagnostics behavior.
What it does not yet expose is a stable package boundary for downstream consumers.

This document defines that boundary so that:

- editor integrations can depend on one parser contract
- renderers and tooling can share one AST contract
- future AES ecosystem packages can build on `and-core` without importing from
  `implementations/reference-*`
- the distinction between format engine and tonic/model layer stays explicit

---

## 3. Current State

Today, `and-core` exposes an initial root entrypoint at [`../../index.mjs`](../../index.mjs).

The current root surface is:

- `parseAnd(source, options)`
- `parseInline(text, options)`
- `collectDiagnostics(source, options)`
- `emitCanonical(document, options)`
- `renderHtml(document, options)`

Internally, these still delegate to the reference implementation files under
`implementations/reference-*`.

The underlying reference implementation surface is effectively:

- `parseAnd(source, options)`
- `parseInline(text, options)`
- `collectDiagnostics(source, options)`
- `emitCanonical(document, options)`
- `renderHtml(document, options)`

Those underlying entrypoints are real and CTS-backed, and currently live under internal
implementation paths:

- `implementations/reference-parser/parser.mjs`
- `implementations/reference-parser/diagnostics.mjs`
- `implementations/reference-canonical/emitter.mjs`
- `implementations/reference-html/renderer.mjs`

The important change is that repository consumers no longer need to import those internal paths
directly.
The root entrypoint is now the preferred import contract, even though the broader package contract
is still being formalized.

---

## 4. Public API Goal

The first stable `and-core` package surface should be intentionally small.

Recommended exports:

```ts
export type {
  NdDocument,
  NdBlockNode,
  NdInlineNode,
  NdSpan,
  NdError,
  NdBudgets,
  NdParseMode,
  NdParseOptions,
  NdParseSuccess,
  NdParseFailure,
  NdParseResult,
  NdDiagnostic,
  NdHtmlRenderOptions,
  NdCanonicalProfile,
  NdCanonicalOptions,
} from './types';

export {
  parseAnd,
  parseInline,
  collectDiagnostics,
  emitCanonical,
  renderHtml,
} from './index';
```

The package should prioritize:

- small surface area
- explicit modes and options
- stable AST node names
- stable diagnostic codes
- explicit separation between parsing, canonicalization, and rendering

It should avoid exposing:

- scanner internals
- CTS adapter helpers
- provisional recovery-node internals
- implementation-specific traversal or mutation helpers

---

## 5. Proposed Consumer API

### 5.1 Parse

```ts
interface NdParseOptions {
  readonly mode?: 'strict' | 'recovery' | 'forward_compat';
  readonly budgets?: NdBudgets;
  readonly includeSpans?: boolean;
  readonly sourceName?: string;
}

type NdParseResult =
  | NdParseSuccess
  | NdParseFailure;

interface NdParseSuccess {
  readonly ok: true;
  readonly version: 'v1';
  readonly document: NdDocument;
  readonly mode?: 'strict' | 'forward_compat';
  readonly conformant?: boolean;
  readonly downgradedUnknowns?: readonly NdDowngradedUnknown[];
}

interface NdParseFailure {
  readonly ok: false;
  readonly errorCode: string;
  readonly diagnostic?: NdDiagnostic;
}

declare function parseAnd(source: string, options?: NdParseOptions): NdParseResult;
```

Strict-mode failure should remain compact and deterministic.
If recovery mode grows into a multi-diagnostic result later, that should happen behind clearly
separated result typing rather than silently widening strict-mode semantics.

### 5.2 Inline Parse

```ts
declare function parseInline(
  text: string,
  options?: NdParseOptions,
): { ok: true; children: NdInlineNode[] } | NdParseFailure;
```

This is useful for editor tooling, table-cell handling tests, and embedding profiles that parse only
inline payloads.

### 5.3 Diagnostics

```ts
interface NdDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly range: {
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
  };
}

declare function collectDiagnostics(
  source: string,
  options?: NdParseOptions,
): { ok: true; diagnostics: readonly [] } | { ok: false; diagnostics: readonly NdDiagnostic[] };
```

The CLI and editor tooling should prefer this surface rather than reconstructing diagnostics from
raw parse failures.

### 5.4 Canonical Emission

```ts
type NdCanonicalProfile = 'standalone' | 'embedded';

interface NdCanonicalOptions {
  readonly profile: NdCanonicalProfile;
}

declare function emitCanonical(
  document: NdDocument,
  options: NdCanonicalOptions,
): string;
```

Canonical emission should continue to require an explicit profile choice.

### 5.5 HTML Projection

```ts
interface NdHtmlRenderOptions {
  readonly fragment?: boolean;
  readonly imageBaseUrl?: string;
}

declare function renderHtml(
  document: NdDocument,
  options?: NdHtmlRenderOptions,
): string;
```

HTML rendering is a projection convenience, not part of the core language contract.
It belongs in the public package only if it remains clearly framed as a downstream projection over
validated AST.

---

## 6. Suggested Package Layout

Recommended future layout:

```text
src/
  index.ts
  types.ts
  parser/
  diagnostics/
  canonical/
  html/
```

Recommended exports map:

```json
{
  "name": "and-core",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

The implementation files under `implementations/reference-*` can remain as development sources
during the transition, but downstream users should eventually import only from the package root.

---

## 7. Readiness Stages

### Stage 0 — Internal Reference

Current state:

- CTS-backed reference parser exists
- canonical and HTML projections exist
- CLI uses the reference implementation directly
- import paths are still implementation-shaped

### Stage 1 — Public Surface Freeze

Ready when:

- AST node names and child fields are considered stable for strict mode
- parser options and budget names are considered stable
- diagnostic codes are treated as external contract
- imports can move to one root module without exposing scanner internals

This is the first stage where external tooling should be invited to depend on `and-core`.

### Stage 2 — Ecosystem Consumption

Ready when:

- the root package exports are in place
- examples use the root package instead of internal paths
- the CLI is just one consumer of the same public package
- the `fmt.and` AES vocabulary is documented

This is the first stage where a sibling AES package should be built on top.

### Stage 3 — Multi-implementation Ecosystem

Ready when:

- CTS can be consumed outside the repo
- at least one non-reference implementation can target the same AST and diagnostics contract
- package docs distinguish normative contracts from convenience helpers

---

## 8. Relation To AES Ecosystem Work

`and-core` should be treated as the **format engine**, not the tonic.

Its job is:

- `&ND text -> AST`
- `AST -> canonical &ND`
- `AST -> HTML`
- diagnostics and spans

The future AES package should be a sibling model layer, not a hidden extension of the parser.

That future package would own:

- `AES -> typed &ND document model`
- typed `&ND document model -> AES`
- optional `&ND text -> model` and `model -> &ND text` convenience helpers built on top of
  `and-core`

This is the same separation already visible in `fmt-md-model`:

- the model owns semantic projection and AES export
- renderers own text or HTML projection

---

## 9. Recommendation

The next implementation-facing milestone should be:

1. keep the new root package surface small and stable
2. freeze the strict-mode API above
3. update remaining examples and docs to treat that as the supported import path
4. only then build the AES-facing `fmt.and` model package

That sequencing keeps the foundation clear:

- `and-core` remains the source of truth for the language
- the AES ecosystem consumes it through an explicit public contract
- the future tonic/model package does not need to guess at internal parser structure
