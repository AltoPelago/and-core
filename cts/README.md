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
