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

The initial fixture contract is intentionally small.
It is designed to support:

* accept/reject behavior
* stable error-code expectations
* lightweight structural assertions

without forcing the first CTS runner to adopt a full AST interchange format.

## Layout

* `index.json` — fixture manifest
* `strict/accept/` — strict-mode acceptance fixtures
* `strict/reject/` — strict-mode rejection fixtures

## Next Step

Once the first parser exists, this directory can grow to include:

* canonicalization fixtures
* budgeted fixtures with explicit parser options
* `forward_compat` fixtures
* result-schema validation
