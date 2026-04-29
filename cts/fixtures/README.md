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
* optional metadata expectations, currently source-span checks
* lightweight human-readable assertions

## Expectation Lanes

CTS expectations are split into three lanes so implementations can participate honestly at different
levels of capability.

1. Parse outcome checks are the baseline lane. Every adapter is expected to report whether the
   fixture was accepted or rejected, and reject fixtures SHOULD report the stable `errorCode`.
2. Semantic document checks compare `expected.document` against the adapter's returned document AST.
   These checks run only when an adapter declares `document` capability.
3. Metadata checks compare optional non-semantic metadata, currently `expected.spans`. These checks
   run only when an adapter declares the matching metadata capability, such as `spans`.

Metadata checks MUST NOT change semantic AST equality. This keeps parser conformance, canonical
materialization, and editor-facing guarantees close together without making every lightweight
adapter expose editor metadata.

See [`schema-v1.md`](./schema-v1.md) for the JSON schema notes and
[`../AUTHORING.md`](../AUTHORING.md) for authoring rules.

## Layout

* `index.json` — fixture manifest
* `strict/accept/` — strict-mode acceptance fixtures
* `strict/metadata/` — strict-mode fixtures with optional metadata expectations
* `strict/reject/` — strict-mode rejection fixtures

## Future Growth

This directory can grow to include:

* canonicalization fixtures
* budgeted fixtures with explicit parser options
* `forward_compat` fixtures
* result-schema validation
