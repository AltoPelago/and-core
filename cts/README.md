# `and-core` CTS

This directory contains the `&ND` conformance test suite.

The intended role of the CTS is to make parser behavior reproducible across implementations by
turning the normative conformance seeds in the v1 specification into executable fixtures.

## Scope

* parser acceptance and rejection cases
* structural AST expectations for accepted documents
* exact canonical-text expectations for selected accepted documents
* stable error-code expectations for rejected documents
* strict vs `forward_compat` mode distinctions where relevant
* regression coverage for ambiguity, budget, and nesting edge cases

Canonical expectations can now live alongside parser fixtures through an optional
`expected.canonical` lane for selected documents, but the suite remains primarily parser-focused.

## Layout

* [`ADAPTERS.md`](./ADAPTERS.md) — how parser implementations plug into the CTS runner
* [`AUTHORING.md`](./AUTHORING.md) — how to add and maintain fixtures
* [`examples/`](./examples/) — copyable CTS adapter examples
* [`fixtures/`](./fixtures/) — raw input and expected outcomes
* [`reports/`](./reports/) — generated adapter reports

`fixtures/` currently contains:

* the active v1 index at `fixtures/index.json`
* an executable v2 proposal lane at `fixtures/v2/index.proposal.json`

## Current Runner Interface

The repository now includes a small CTS entrypoint:

* `npm run cts:run`
* `npm run cts:run:example`
* `npm run cts:run:subset`
* `npm run cts:run:reference`
* `npm run cts:run:v2:proposal`
* `npm run cts:report:example`
* `npm run cts:report:subset`
* `npm run cts:report:reference`
* `npm run cts:report:all`
* `npm run check:reports`
* `npm run check:cts-v2-lane`

Current behavior:

* loads `cts/fixtures/index.json`
* validates fixture JSON shape
* emits a placeholder report when no parser adapter is configured
* reports aggregate document-check and error-code coverage
* can be paired with `npm run check:cts-seed-coverage` to ensure the index still matches the normative seed list in the spec
* validates the v2 proposal lane metadata with `npm run check:cts-v2-lane`
* executes v2 fixtures, declared/headerless version equivalence, v1 compatibility, canonical
  round trips, HTML projection, nested contexts, and budget boundaries with
  `npm run cts:run:v2:proposal`

Future parser implementations can plug in through:

* `node scripts/run-cts.mjs --adapter ./path/to/adapter.mjs`
* `node scripts/run-cts.mjs --adapter ./path/to/adapter.mjs --json --quiet --out ./cts/reports/report.json`

The adapter contract is:

* export `runFixture(fixture, context)`
* return a result object with `status`, plus optional `actualOk`, `errorCode`, `document`, and `notes`
* optionally export `capabilities = { document: true, spans: true }` to enable capability-gated
  document and metadata checks

See [ADAPTERS.md](./ADAPTERS.md) for the complete adapter contract and capability guidance.

## Reports

CTS reports are intended to be durable artifacts.

The current runner supports:

* `--json` for machine-readable output
* `--quiet` to suppress stdout when writing report files
* `--out <path>` to write a report file directly

The default report script writes:

* `cts/reports/reference-subset-report.json` once generated
* report directory guide: [cts/reports/README.md](./reports/README.md)

Use `npm run check:reports` to verify that generated CTS, canonical, and HTML report artifacts match
the current fixtures and implementations. If it fails, run `npm run cts:report:all` and review the
artifact diff.
