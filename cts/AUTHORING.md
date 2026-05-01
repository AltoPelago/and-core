# CTS Authoring Guide

This guide explains how to add and maintain `&ND Core v1` CTS fixtures.

The CTS has two jobs:

- prove accept/reject behavior
- pin stable parser outputs where the spec has a concrete contract

Fixtures are normative when they correspond to named conformance seeds in
[`docs/spec/v1/and-core-proposal.md`](../docs/spec/v1/and-core-proposal.md).

## Fixture Checklist

When adding a fixture:

1. Add a named seed section to `docs/spec/v1/and-core-proposal.md`.
2. Add a JSON fixture under `cts/fixtures/strict/accept/` or `cts/fixtures/strict/reject/`.
3. Add the fixture path to `cts/fixtures/index.json`.
4. Update adapters that intentionally cover the fixture.
5. Run `npm run precommit:check`.

The seed coverage check fails if the spec and fixture index drift apart.

## Accept Fixtures

Accept fixtures MUST set:

```json
{
  "expected": {
    "ok": true,
    "assertions": []
  }
}
```

Accept fixtures SHOULD include `expected.document` once the relevant AST shape is covered by
[`docs/spec/v1/and-ast-contract.md`](../docs/spec/v1/and-ast-contract.md).

Current policy: every strict accept fixture has `expected.document`.

`expected.document` is exact JSON. Order, node type strings, and payload fields are all checked
when an adapter declares document capability.

## Reject Fixtures

Reject fixtures MUST set:

```json
{
  "expected": {
    "ok": false,
    "errorCode": "stable_error_code",
    "assertions": []
  }
}
```

`expected.errorCode` is required for every reject fixture. Avoid adding generic reject-only fixtures
without a stable diagnostic, because they are much less useful for independent implementations and
agentic debugging.

Reject fixtures MUST NOT include `expected.document`. Strict-mode failures produce no document AST.

## Metadata Fixtures

Metadata fixtures are still successful strict parses:

```json
{
  "expected": {
    "ok": true,
    "spans": []
  }
}
```

Use `expected.spans` only when the span location is part of the stable public contract rather than
an implementation accident.

Good metadata targets include:

- trimmed inline spans inside structured containers such as table cells
- nested block spans where blank separator lines and exact margins matter
- fallback content spans attached to extension blocks

Common nested metadata patterns worth reusing:

- `container -> table`: pin the block span at the trimmed inner margin and then one or two
  representative cell or inline spans
- `container -> extension fallback`: pin the primary extension block span separately from the
  attached fallback paragraph span
- `container -> paragraph + structured child`: pin that the paragraph span stops before the blank
  separator line and the following child span starts after it
- `container -> container -> child`: prefer one doubly nested case per structural family instead of
  repeating every permutation

When choosing paths, prefer:

- one outer ownership span such as the list item or blockquote
- one nested block span whose start/end boundary is easy to accidentally shift
- one inline child span proving delimiter and padding trimming

Avoid fixtures that only restate already-pinned behavior at a different depth unless the added
container changes the trimming or boundary rules.

Avoid overspecifying every node in the tree. Metadata fixtures work best when they pin a few
high-value paths that are likely to drift during parser refactors.

For fallback fixtures, treat adjacency as container-local rather than purely textual. Good negative
cases include the same fallback surface syntax crossing a blockquote or list-item boundary; those
should still fail as `orphan_fallback_block` because the immediately preceding extension block is
not in the same nested container context.

## Assertions

`expected.assertions` are human-readable normative expectations.

Use assertions to explain why the case exists, even when the same behavior is also machine-checked
by `expected.document` or `expected.errorCode`.

Good assertions are concrete:

- `one blockquote block`
- `table body row has a different cell count from the header row`
- `extension block closer must appear at the same block margin as the opener`

Avoid vague assertions such as:

- `works correctly`
- `invalid syntax`
- `parser handles this`

## Adapter Capabilities

Adapters export:

```js
export async function runFixture(fixture, context) {
  return {
    status: "pass",
    actualOk: true,
    errorCode: undefined,
    notes: []
  };
}
```

Adapters that return AST documents should declare:

```js
export const capabilities = {
  document: true
};
```

When `document` capability is declared, the CTS runner compares `expected.document` exactly.

When `document` capability is not declared, document checks are reported as skipped. This is useful
for smoke adapters, but full parser adapters should declare document capability once they can emit
the contract shape.

## Reports

The CTS report includes:

- fixture totals
- per-fixture pass/fail results
- `documentChecks`
- `spanChecks`
- `errorCodeChecks`

For a complete strict parser, a healthy report should show:

```text
documentChecks expected=N checked=N matched=N skipped=0 failed=0
spanChecks expected=N checked=N matched=N skipped=0 failed=0
errorCodeChecks expected=N matched=N missingActual=0 mismatched=0
```

For a smoke adapter without AST output, skipped document checks are expected:

```text
documentChecks expected=N checked=0 matched=0 skipped=N failed=0
```

## Commands

Run the reference parser:

```sh
npm run cts:run:reference
```

Run the smoke subset adapter:

```sh
npm run cts:run:subset
```

Regenerate the reference report:

```sh
npm run cts:report:reference
```

Run all safety checks:

```sh
npm run precommit:check
```

## Common Mistakes

- Adding a spec seed but forgetting `cts/fixtures/index.json`.
- Adding a reject fixture without `expected.errorCode`.
- Adding `expected.document` to a reject fixture.
- Forgetting to update smoke/reference adapters for new seeds.
- Treating skipped document checks as equivalent to checked document matches.
- Pinning every span in a subtree instead of selecting the few boundaries most likely to drift.
