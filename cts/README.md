# `and-core` CTS

This directory is reserved for the `&ND` conformance test suite.

The intended role of the CTS is to make parser behavior reproducible across implementations by
turning the normative conformance seeds in the v1 specification into executable fixtures.

## Intended Scope

* parser acceptance and rejection cases
* canonicalization fixtures
* strict vs `forward_compat` mode distinctions where relevant
* regression coverage for ambiguity, budget, and nesting edge cases

## Likely Future Layout

* `fixtures/` — raw input files and expected outcomes
* `schemas/` — fixture schemas or result contracts
* `runner/` — shared CTS runner tooling
* `reports/` — optional generated results or compatibility summaries

## Recommended First Slice

Start by extracting the existing named seeds from:

* [docs/spec/v1/and-core-proposal.md](../docs/spec/v1/and-core-proposal.md)

into a stable machine-readable fixture format.

## Current Runner Interface

The repository now includes a small CTS entrypoint:

* `npm run cts:run`
* `npm run cts:run:subset`
* `npm run cts:report:subset`

Current behavior:

* loads `cts/fixtures/index.json`
* validates fixture JSON shape
* emits a placeholder report when no parser adapter is configured

Future parser implementations can plug in through:

* `node scripts/run-cts.mjs --adapter ./path/to/adapter.mjs`
* `node scripts/run-cts.mjs --adapter ./path/to/adapter.mjs --json --out ./cts/reports/report.json`

The adapter contract is:

* export `runFixture(fixture, context)`
* return a result object with `status`, plus optional `actualOk`, `errorCode`, and `notes`

## Reports

CTS reports are intended to be durable artifacts.

The current runner supports:

* `--json` for machine-readable output
* `--out <path>` to write a report file directly

The default report script writes:

* `cts/reports/reference-subset-report.json` once generated
* report directory guide: [cts/reports/README.md](./reports/README.md)
