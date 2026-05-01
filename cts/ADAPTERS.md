# CTS Adapter Guide

CTS adapters let an implementation participate in the `&ND Core v1` conformance suite without
requiring every implementation to expose the same level of detail.

Run an adapter with:

```sh
node scripts/run-cts.mjs --adapter ./path/to/adapter.mjs
```

Generate a report with:

```sh
node scripts/run-cts.mjs --adapter ./path/to/adapter.mjs --json --quiet --out ./cts/reports/my-report.json
```

## Minimal Adapter

An adapter MUST export `runFixture(fixture, context)`.

```js
export async function runFixture(fixture, context) {
  const result = parse(fixture.source, fixture.options ?? {});

  return {
    status: result.ok === fixture.expected.ok ? 'pass' : 'fail',
    actualOk: result.ok,
    errorCode: result.errorCode,
    notes: ['Evaluated by my parser.'],
  };
}
```

The minimal lane checks only parse outcome and stable error codes. This is enough for early parsers,
ports, and lightweight scanners.

For a runnable copyable example, see
[`cts/examples/baseline-adapter.mjs`](./examples/baseline-adapter.mjs).

## Result Shape

`runFixture` SHOULD return:

```ts
interface CtsAdapterResult {
  readonly status: "pass" | "fail" | "pending" | "error";
  readonly actualOk?: boolean;
  readonly errorCode?: string;
  readonly document?: unknown;
  readonly notes?: string[];
}
```

The runner compares `actualOk` and `errorCode` against each fixture's baseline expectations. It also
performs capability-gated checks described below.

## Context Shape

`context` currently contains:

```ts
interface CtsAdapterContext {
  readonly repoRoot: string;
  readonly fixturePath: string;
  readonly relativeFixturePath: string;
  readonly options: Record<string, unknown>;
}
```

Adapters SHOULD prefer `fixture.options` or `context.options` over hard-coded parser settings.

## Capabilities

Adapters MAY export `capabilities` to opt into additional CTS lanes.

```js
export const capabilities = {
  document: true,
  spans: true,
};
```

Supported capabilities:

* `document`: enables exact comparison against `expected.document`.
* `spans`: enables selected source-span checks from `expected.spans`.

If a fixture carries an expectation for a capability the adapter does not declare, the runner reports
that lane as skipped rather than failed.

## Document Capability

Adapters that declare `document: true` MUST return `document` in the shape defined by
[`docs/spec/v1/and-ast-contract.md`](../docs/spec/v1/and-ast-contract.md).

The comparison is exact JSON structural comparison. Extra semantic fields will fail unless the AST
contract defines them. Optional metadata SHOULD be kept additive and capability-gated.

## Span Capability

Adapters that declare `spans: true` MUST return spans on the selected AST nodes referenced by
`expected.spans`.

Span checks use path selectors such as:

```text
$
$.children[0]
$.children[0].header[1].children[0]
```

Spans use the contract from the AST guide:

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

Offsets are measured in normalized source. Line and column values are one-based. Starts are
inclusive; ends are exclusive.

## Status Guidance

Use `pass` when the adapter evaluated the fixture and matched the baseline expectation. Use `fail`
when it evaluated the fixture and disagreed. Use `pending` only for intentionally unsupported
fixtures. Use `error` for adapter/runtime failures.

Capability-gated lanes do not require the adapter to set `status`; the runner adds those checks on
top of the returned result.

## Nested Container Fixtures

Many fixtures intentionally exercise list-item and blockquote local rules, including trimmed nested
tables, nested extension fallback, and container-local orphan-fallback failure.

Smoke-test or subset adapters do not need a full AST to participate well here. A practical approach
is to normalize line endings first, then recognize the nested container shape from trimmed source
lines at the exact inner margin. This keeps adapters simple while still matching the Core v1 rule
that nested structure is local to its current container margin rather than reinterpreted globally.
