# `and-core`

`and-core` is the standalone home for `&ND` (AEON Native Document).

`&ND` is a deterministic, fail-closed document language designed for structured document content,
editor integration, canonicalization, and future conformance-tested implementations.

## Repository Layout

* [docs/spec/v1/README.md](./docs/spec/v1/README.md) — the current v1 spec bundle
* [cts/README.md](./cts/README.md) — conformance test suite plan and fixture layout
* [implementations/README.md](./implementations/README.md) — future parser/emitter implementation home
* [examples/README.md](./examples/README.md) — future example documents and interoperability samples

## Current Status

The repository is currently documentation-first:

* the v1 language spec has been migrated in from the design workspace
* canonical, implementation, and editor-support documents are present
* CTS and implementation directories are scaffolded but not yet populated with runnable code

## Suggested Reading Order

1. [docs/spec/v1/and-core-proposal.md](./docs/spec/v1/and-core-proposal.md)
2. [docs/spec/v1/and-canonical-rules.md](./docs/spec/v1/and-canonical-rules.md)
3. [docs/spec/v1/and-implementation-guide.md](./docs/spec/v1/and-implementation-guide.md)
4. [docs/spec/v1/and-vscode-support.md](./docs/spec/v1/and-vscode-support.md)

## Near-Term Next Steps

* define the CTS fixture format and directory layout
* extract the current conformance seeds into machine-readable fixtures
* start the first reference parser implementation
* add editor tooling once the CTS baseline exists

## Safety Scripts

* `npm run check:no-local-paths` — blocks workstation-specific path leaks in tracked files
* `npm run check:spec-layout` — verifies the expected spec bundle layout and local Markdown links
* `npm run check:cts-fixtures` — validates the CTS fixture index and fixture JSON shape
* `npm run check:cts-seed-coverage` — verifies that all normative spec seeds are represented in the CTS index
* `npm run cts:run` — loads the CTS fixture manifest and emits the current placeholder/adapted run report
* `npm run cts:run:subset` — runs the current reference subset adapter against the CTS
* `npm run cts:run:reference` — runs the first reference parser adapter against the CTS
* `npm run cts:report:subset` — writes a JSON CTS report artifact for the reference subset adapter
* `npm run cts:report:reference` — writes a JSON CTS report artifact for the reference parser adapter
* `npm run precommit:check` — runs the current repository safety checks together
