# `and-core` CTS Fixtures

This directory contains the first machine-readable extraction of normative `&ND Core v1`
conformance seeds.

## Fixture Shape

Each fixture is a JSON document with:

* `schemaVersion` — fixture schema version
* `id` — stable fixture identifier
* `specVersion` — target language version
* `mode` — parse mode under test, usually `strict`
* `source` — the raw `&ND` input text
* `expected` — the expected high-level result

The fixture contract is intentionally small.
It supports:

* accept/reject behavior
* stable error-code expectations
* exact AST expectations for accepted documents
* lightweight human-readable assertions

See [`schema-v1.md`](./schema-v1.md) for the JSON schema notes and
[`../AUTHORING.md`](../AUTHORING.md) for authoring rules.

## Layout

* `index.json` — fixture manifest
* `strict/accept/` — strict-mode acceptance fixtures
* `strict/reject/` — strict-mode rejection fixtures

## Future Growth

This directory can grow to include:

* canonicalization fixtures
* budgeted fixtures with explicit parser options
* `forward_compat` fixtures
* result-schema validation
