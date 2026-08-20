# &ND Core v2 Public API Contract

## Status

This is the first-draft candidate contract for the `and-core` root module. It describes the
executable strict API; it does not add syntax or make HTML projection part of Core language
semantics. Recovery and forward-compatibility modes are outside this contract.

## Root Exports

```js
import {
  collectDiagnostics,
  emitCanonical,
  parseAnd,
  parseInline,
  renderHtml,
} from "and-core";
```

Consumers should use the package root rather than importing reference implementation files.

## Version And Host Authority

```ts
type NdVersion = "v1" | "v2";

interface NdParseOptions {
  readonly allowV2?: boolean;
  readonly version?: NdVersion;
  readonly budgets?: NdBudgets;
  readonly includeSpans?: boolean;
}
```

`allowV2` is a reader-capability declaration. `version` is a host-controlled effective-version
selection for headerless input only. They are deliberately separate:

| Input | Options | Result |
| :---- | :------ | :----- |
| declared `&ND v1` | any valid capability/version options | parse as v1 |
| declared `&ND v2` | `allowV2: true` | parse as v2 |
| declared `&ND v2` | no v2 capability | reject declaration |
| headerless | no version | parse as v1 |
| headerless | `allowV2: true` only | parse as v1 |
| headerless | `version: "v2"` only | `unsupported_version` |
| headerless | `allowV2: true, version: "v2"` | parse as v2 |
| headerless | unknown version value | `invalid_version_option` |

A source declaration takes precedence over `options.version`. A host cannot reinterpret declared-v1
source as v2, or declared-v2 source as v1, by passing a conflicting option. Document content cannot
set `allowV2`, synthesize a typed channel, or cause v2 inference. Named embedding-profile registries
remain outside the first Core draft.

`parseInline` has no declaration channel, so v2 inline parsing always requires both explicit options.
`collectDiagnostics` uses the same version resolution as `parseAnd`.

## Parse Results

```ts
interface NdParseSuccess {
  readonly ok: true;
  readonly version: NdVersion;
  readonly document: NdDocument;
}

interface NdParseFailure {
  readonly ok: false;
  readonly errorCode: string;
  readonly diagnostic?: NdParseDiagnostic;
}

type NdParseResult = NdParseSuccess | NdParseFailure;

interface NdParseDiagnostic {
  readonly code: string;
  readonly offset?: number;
  readonly line?: number;   // one-based
  readonly column?: number; // one-based
}

declare function parseAnd(
  source: string,
  options?: NdParseOptions,
): NdParseResult;
```

The successful `version` is parse metadata, not a document child. Callers must retain it when
canonicalizing an AST whose syntax version matters.

## Inline Parse

```ts
type NdInlineParseResult =
  | { readonly ok: true; readonly children: readonly NdInlineNode[] }
  | NdParseFailure;

declare function parseInline(
  text: string,
  options?: NdParseOptions,
): NdInlineParseResult;
```

Standalone `parseInline` validates local-fragment syntax but cannot resolve fragment targets against
a document namespace. Full anchor uniqueness and resolution occur in `parseAnd` and v2 canonical
emission. It likewise returns the local shape of `footnote_reference`; named footnote declaration
order, uniqueness, and resolution require `parseAnd` or v2 canonical emission.

## AST Version Delta

The document root remains version-neutral. v2 extends, rather than replaces, the v1 node unions:

```ts
type NdInlineNode =
  | NdV1InlineNode
  | NdAnchorTag
  | NdAdmonitionTag
  | NdQuestionTag
  | NdPlusTag
  | NdImageTag
  | NdStrikeTag
  | NdQuotedTag
  | NdCommentTag
  | NdTypedValue
  | NdHighlightTag
  | NdUnderlineTag
  | NdFootnoteDefinition
  | NdFootnoteReference
  | NdDirectionalMarker
  | NdAdvisoryMarker
  | NdLineBreak;

type NdBlockNode =
  | NdV1BlockNode
  | NdTodoList
  | NdAutoNumberList
  | NdHighlightParagraphBlock
  | NdStrongParagraphBlock
  | NdEmphasisParagraphBlock
  | NdUnderlineParagraphBlock
  | NdQuestionParagraphBlock
  | NdAdmonitionParagraphBlock
  | NdCommentBlock
  | NdHeaderTextBlock
  | NdDisclaimerBlock;

interface NdHeading extends NdV1Heading {
  readonly autoNumber?: true;
}
```

The exact promoted fields, AEON scalar union, containment rules, and local-anchor invariants are
defined by [`and-ast-contract.md`](./and-ast-contract.md). No v1 node changes meaning under v2.

## Budgets And Spans

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

interface NdSpan {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}
```

All budgets are optional non-negative integers. Exceeding one fails with `nd_budget_exceeded`.
`includeSpans: true` adds spans without changing structural semantics.

## Diagnostics

```ts
interface NdDiagnostic {
  readonly severity: 1;
  readonly code: string;
  readonly source: "and-core";
  readonly message: string;
  readonly range: {
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
  };
  readonly data: {
    readonly errorCode: string;
    readonly diagnostic: NdParseDiagnostic | null;
  };
}

declare function collectDiagnostics(
  source: string,
  options?: NdParseOptions,
):
  | { readonly ok: true; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly NdDiagnostic[] };
```

Diagnostic ranges are zero-based even though compact parser diagnostics are one-based.

## Canonical Emission

```ts
type NdCanonicalProfile = "embedded" | "standalone";

interface NdCanonicalOptions {
  readonly profile: NdCanonicalProfile;
  readonly version?: NdVersion;
}

declare function emitCanonical(
  document: NdDocument,
  options: NdCanonicalOptions,
): string;
```

`profile` is mandatory. `version` defaults to v1 for backward compatibility, but v2 callers must
forward the successful parse result's `version`. Standalone v2 output declares `&ND v2`; embedded
output omits the declaration. Emitting any v2-only node with `version: "v1"` fails closed.

## HTML Projection

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

Fragments are the default. `fragment: false` emits a complete inert HTML document.
`imageBaseUrl`, when supplied, must be an absolute credential-free HTTP(S) URL and resolves relative
image sources without mutating the AST. Invalid bases fail with `invalid_image_base_url`.

HTML rendering, resource fetching, consumer tag vocabularies, custom datatype meaning, numbering,
and extension execution remain downstream concerns.

## Reference Flow

```js
const parsed = parseAnd(source, { allowV2: true });
if (!parsed.ok) throw new Error(parsed.errorCode);

const canonical = emitCanonical(parsed.document, {
  profile: "standalone",
  version: parsed.version,
});

const html = renderHtml(parsed.document, {
  imageBaseUrl: "https://docs.example/guide/document.and",
});
```
