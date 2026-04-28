# `and-core` CTS

This directory contains the `&ND` conformance test suite.

The intended role of the CTS is to make parser behavior reproducible across implementations by
turning the normative conformance seeds in the v1 specification into executable fixtures.

## Scope

* parser acceptance and rejection cases
* structural AST expectations for accepted documents
* stable error-code expectations for rejected documents
* strict vs `forward_compat` mode distinctions where relevant
* regression coverage for ambiguity, budget, and nesting edge cases

Canonicalization fixtures are expected to live here later, but the current suite is parser-focused.

## Layout

* [`AUTHORING.md`](./AUTHORING.md) — how to add and maintain fixtures
* [`fixtures/`](./fixtures/) — raw input and expected outcomes
* [`reports/`](./reports/) — generated adapter reports

## Current Runner Interface

The repository now includes a small CTS entrypoint:

* `npm run cts:run`
* `npm run cts:run:subset`
* `npm run cts:run:reference`
* `npm run cts:report:subset`
* `npm run cts:report:reference`

Current behavior:

* loads `cts/fixtures/index.json`
* validates fixture JSON shape
* emits a placeholder report when no parser adapter is configured
* reports aggregate document-check and error-code coverage
* can be paired with `npm run check:cts-seed-coverage` to ensure the index still matches the normative seed list in the spec

Future parser implementations can plug in through:

* `node scripts/run-cts.mjs --adapter ./path/to/adapter.mjs`
* `node scripts/run-cts.mjs --adapter ./path/to/adapter.mjs --json --out ./cts/reports/report.json`

The adapter contract is:

* export `runFixture(fixture, context)`
* return a result object with `status`, plus optional `actualOk`, `errorCode`, `document`, and `notes`
* optionally export `capabilities = { document: true }` to enable exact `expected.document` checks

## Reports

CTS reports are intended to be durable artifacts.

The current runner supports:

* `--json` for machine-readable output
* `--out <path>` to write a report file directly

The default report script writes:

* `cts/reports/reference-subset-report.json` once generated
* report directory guide: [cts/reports/README.md](./reports/README.md)
