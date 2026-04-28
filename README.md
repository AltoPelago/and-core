# `and-core`

`and-core` is the standalone home for `&ND` (AEON Native Document).

`&ND` is a deterministic, fail-closed document language designed for structured document content,
editor integration, canonicalization, and future conformance-tested implementations.

## Repository Layout

* [docs/spec/v1/README.md](/Users/altopelago/Documents/GitHub/aeon-family/altopelago/and-core/docs/spec/v1/README.md) — the current v1 spec bundle
* [cts/README.md](/Users/altopelago/Documents/GitHub/aeon-family/altopelago/and-core/cts/README.md) — conformance test suite plan and fixture layout
* [implementations/README.md](/Users/altopelago/Documents/GitHub/aeon-family/altopelago/and-core/implementations/README.md) — future parser/emitter implementation home
* [examples/README.md](/Users/altopelago/Documents/GitHub/aeon-family/altopelago/and-core/examples/README.md) — future example documents and interoperability samples

## Current Status

The repository is currently documentation-first:

* the v1 language spec has been migrated in from the design workspace
* canonical, implementation, and editor-support documents are present
* CTS and implementation directories are scaffolded but not yet populated with runnable code

## Suggested Reading Order

1. [docs/spec/v1/and-core-proposal.md](/Users/altopelago/Documents/GitHub/aeon-family/altopelago/and-core/docs/spec/v1/and-core-proposal.md)
2. [docs/spec/v1/and-canonical-rules.md](/Users/altopelago/Documents/GitHub/aeon-family/altopelago/and-core/docs/spec/v1/and-canonical-rules.md)
3. [docs/spec/v1/and-implementation-guide.md](/Users/altopelago/Documents/GitHub/aeon-family/altopelago/and-core/docs/spec/v1/and-implementation-guide.md)
4. [docs/spec/v1/and-vscode-support.md](/Users/altopelago/Documents/GitHub/aeon-family/altopelago/and-core/docs/spec/v1/and-vscode-support.md)

## Near-Term Next Steps

* define the CTS fixture format and directory layout
* extract the current conformance seeds into machine-readable fixtures
* start the first reference parser implementation
* add editor tooling once the CTS baseline exists
